/**
 * POST /api/connected-sites/:id/verification-challenge
 *
 * Creates a new one-time ownership-verification challenge.
 * Currently supports: script | meta_tag
 *
 * The raw token is returned ONCE for the user to embed.
 * Only the hash is stored in the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { generateVerificationToken } from '@/lib/site-keys/generate';

type Params = { params: { id: string } };

const CHALLENGE_TTL_HOURS = 24;
const MAX_ACTIVE_CHALLENGES = 3;

const CreateChallengeSchema = z.object({
  method: z.enum(['script', 'meta_tag']),
});

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership
  const { data: site, error: siteErr } = await supabase
    .from('connected_sites')
    .select('id, normalized_origin, canonical_host, verification_status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (siteErr || !site) return NextResponse.json({ error: 'Not found', code: 'CONNECTED_SITE_NOT_FOUND' }, { status: 404 });
  if (site.verification_status === 'revoked') return NextResponse.json({ error: 'Site is revoked' }, { status: 409 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreateChallengeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
  const { method } = parsed.data;

  // Rate-limit: max 3 active challenges per site
  const { count } = await supabase
    .from('site_verification_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('connected_site_id', site.id)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString());

  if ((count ?? 0) >= MAX_ACTIVE_CHALLENGES) {
    return NextResponse.json(
      { error: 'Too many active verification challenges. Wait or use an existing one.', code: 'SITE_VERIFICATION_RATE_LIMITED' },
      { status: 429 },
    );
  }

  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_HOURS * 3600 * 1000).toISOString();
  const { raw, hash, encrypted } = generateVerificationToken();

  // expected_value is what appears in HTML (for meta_tag) or the data-verification attr
  const expectedValue = raw; // user embeds the raw token; server verifies hash

  const { data: challenge, error: insertErr } = await supabase
    .from('site_verification_challenges')
    .insert({
      connected_site_id: site.id,
      method,
      token_hash:      hash,
      token_encrypted: encrypted,
      expected_value:  `webscore-${method}-${raw}`, // namespaced to prevent cross-feature replay
      expires_at:      expiresAt,
    })
    .select('id, method, expires_at, created_at')
    .single();

  if (insertErr || !challenge) {
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 });
  }

  // Update site to pending
  await supabase
    .from('connected_sites')
    .update({ verification_status: 'pending', verification_method: method })
    .eq('id', site.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.example.com';

  // Return raw token once; user embeds it
  const scriptSnippet = method === 'script'
    ? `<script\n  src="${appUrl}/site-connect/v1/webscore-connect.min.js"\n  data-site-key="(your site key)"\n  data-verification="${raw}"\n  defer\n  crossorigin="anonymous"\n></script>`
    : `<meta name="webscore-site-verification" content="${raw}" />`;

  return NextResponse.json({
    challenge: { ...challenge, token: raw }, // raw shown once
    snippet:   scriptSnippet,
    expiresAt,
    instructions: method === 'script'
      ? 'Add the snippet to your <head>. The verification token will be read automatically.'
      : 'Add the meta tag to your <head> and click Verify.',
  }, { status: 201 });
}
