/**
 * GET  /api/connected-sites  — list connected sites for the current user
 * POST /api/connected-sites  — create a new connected site
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { validateAnalysisUrl } from '@/lib/security/url-validator';
import { normalizeOrigin, canonicalHost } from '@/lib/site-connect/origin-validator';
import { generateSiteKey } from '@/lib/site-keys/generate';
import { getLimits, getFeatures, featureGateError } from '@/lib/billing/limits';

const CreateSiteSchema = z.object({
  name:        z.string().min(1).max(128).trim(),
  root_url:    z.string().url().max(2048),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
  monitor_id:  z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: sites, error } = await supabase
    .from('connected_sites')
    .select(`
      id, name, root_url, normalized_origin, canonical_host,
      verification_status, verification_method,
      verified_at, last_heartbeat_at, last_script_version,
      is_enabled, telemetry_enabled, indexing_diagnostics_enabled,
      crawler_visibility_enabled, environment, monitor_id,
      created_at, updated_at,
      connected_site_keys(id, key_prefix, status, created_at, last_used_at),
      site_connection_status(last_seen_at, sdk_version, script_load_status, environment)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Parse body
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreateSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message, code: 'CONNECTED_SITE_INVALID_URL' }, { status: 400 });
  }
  const { name, root_url, environment, monitor_id } = parsed.data;

  // Get user plan
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = sub?.plan ?? 'free';

  // Feature gate
  if (!getFeatures(plan).connectedSites) {
    return NextResponse.json(featureGateError('connectedSites'), { status: 403 });
  }

  // SSRF validation
  const urlCheck = validateAnalysisUrl(root_url);
  if (!urlCheck.valid) {
    return NextResponse.json({ error: 'Invalid or private URL', code: 'CONNECTED_SITE_PRIVATE_URL' }, { status: 400 });
  }

  // Compute normalized origin and host
  const normalized = normalizeOrigin(root_url);
  const host       = canonicalHost(root_url);
  if (!normalized || !host) {
    return NextResponse.json({ error: 'Cannot normalize URL', code: 'CONNECTED_SITE_INVALID_URL' }, { status: 400 });
  }

  // Plan limit check
  const { count } = await supabase
    .from('connected_sites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('verification_status', 'revoked');
  const limit = getLimits(plan).connectedSites;
  if ((count ?? 0) >= limit) {
    return NextResponse.json({ error: `Plan limit reached (${limit} sites)`, code: 'CONNECTED_SITE_LIMIT_REACHED' }, { status: 403 });
  }

  // Duplicate check
  const { data: existing } = await supabase
    .from('connected_sites')
    .select('id')
    .eq('user_id', user.id)
    .eq('normalized_origin', normalized)
    .neq('verification_status', 'revoked')
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'This origin is already connected', code: 'CONNECTED_SITE_ALREADY_EXISTS' }, { status: 409 });
  }

  // Create site
  const { data: site, error: insertErr } = await supabase
    .from('connected_sites')
    .insert({
      user_id:           user.id,
      name,
      root_url,
      normalized_origin: normalized,
      canonical_host:    host,
      environment,
      monitor_id:        monitor_id ?? null,
    })
    .select('id, name, root_url, normalized_origin, canonical_host, verification_status, environment, created_at')
    .single();

  if (insertErr || !site) {
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }

  // Generate initial site key
  const { raw, hash, prefix, encrypted } = generateSiteKey();
  const { error: keyErr } = await supabase
    .from('connected_site_keys')
    .insert({
      connected_site_id: site.id,
      user_id:           user.id,
      key_prefix:        prefix,
      key_hash:          hash,
      key_encrypted:     encrypted,
    });

  if (keyErr) {
    // Rollback site
    await supabase.from('connected_sites').delete().eq('id', site.id);
    return NextResponse.json({ error: 'Failed to generate site key' }, { status: 500 });
  }

  return NextResponse.json(
    { site, siteKey: raw }, // raw key shown ONCE on creation
    { status: 201 },
  );
}
