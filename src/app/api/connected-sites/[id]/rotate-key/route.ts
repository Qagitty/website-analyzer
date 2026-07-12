/**
 * POST /api/connected-sites/:id/rotate-key
 *
 * Generates a new site key and marks the previous one as 'rotated'.
 * Old key remains active for GRACE_PERIOD_MS to allow the customer
 * to update their HTML without an outage.
 *
 * For compromise revocation, call DELETE /api/connected-sites/:id instead
 * (which immediately revokes all keys).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateSiteKey } from '@/lib/site-keys/generate';
import { createLogger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

const GRACE_PERIOD_MS = 24 * 3600 * 1000; // 24 hours

const log = createLogger({ category: 'site-connect:rotate-key' });

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site, error: siteErr } = await supabase
    .from('connected_sites')
    .select('id, verification_status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (siteErr || !site) return NextResponse.json({ error: 'Not found', code: 'CONNECTED_SITE_NOT_FOUND' }, { status: 404 });
  if (site.verification_status === 'revoked') return NextResponse.json({ error: 'Site is revoked' }, { status: 409 });

  const now = new Date().toISOString();
  const rotatedAt = new Date(Date.now() + GRACE_PERIOD_MS).toISOString(); // mark rotated after grace

  // Mark existing active key as rotated
  await supabase
    .from('connected_site_keys')
    .update({ status: 'rotated', rotated_at: now })
    .eq('connected_site_id', site.id)
    .eq('status', 'active');

  // Create new key
  const { raw, hash, prefix, encrypted } = generateSiteKey();
  const { data: newKey, error: keyErr } = await supabase
    .from('connected_site_keys')
    .insert({
      connected_site_id: site.id,
      user_id:           user.id,
      key_prefix:        prefix,
      key_hash:          hash,
      key_encrypted:     encrypted,
    })
    .select('id, key_prefix, created_at')
    .single();

  if (keyErr || !newKey) {
    return NextResponse.json({ error: 'Failed to generate new key' }, { status: 500 });
  }

  log.info('site_key_rotated', { connectedSiteId: site.id, userId: user.id, newKeyPrefix: prefix });

  return NextResponse.json({
    siteKey:      raw, // shown once
    keyId:        newKey.id,
    keyPrefix:    prefix,
    gracePeriod:  '24 hours — old key remains active during this period',
    rotatedAt:    now,
  });
}
