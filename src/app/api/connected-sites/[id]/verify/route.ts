/**
 * POST /api/connected-sites/:id/verify
 *
 * Verifies site ownership using the active challenge.
 *
 * Script verification: checks that a recent heartbeat contained the
 * verification proof from the correct origin.
 *
 * Meta-tag verification: server-side fetches the homepage via the existing
 * SSRF-safe fetcher and inspects the <meta name="webscore-site-verification"> tag.
 *
 * Returns typed errors from the SITE_VERIFICATION_* namespace.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { hashVerificationToken } from '@/lib/site-keys/generate';
import { validateAnalysisUrl } from '@/lib/security/url-validator';
import { createLogger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

const FETCH_TIMEOUT_MS    = 10_000;
const MAX_RESPONSE_BYTES  = 1_024 * 1_024; // 1 MB
const MAX_VERIFY_ATTEMPTS = 10;

const log = createLogger({ category: 'site-connect:verify' });

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site, error: siteErr } = await supabase
    .from('connected_sites')
    .select('id, user_id, normalized_origin, canonical_host, root_url, verification_status, verification_method')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (siteErr || !site) {
    return NextResponse.json({ error: 'Not found', code: 'CONNECTED_SITE_NOT_FOUND' }, { status: 404 });
  }

  if (site.verification_status === 'verified') {
    return NextResponse.json({ error: 'Already verified', code: 'SITE_ALREADY_VERIFIED' }, { status: 409 });
  }

  if (site.verification_status === 'revoked') {
    return NextResponse.json({ error: 'Site is revoked' }, { status: 409 });
  }

  // Find the active unconsumed challenge
  const { data: challenge, error: challengeErr } = await supabase
    .from('site_verification_challenges')
    .select('id, method, token_hash, token_encrypted, expected_value, expires_at, attempt_count')
    .eq('connected_site_id', site.id)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (challengeErr || !challenge) {
    return NextResponse.json({ error: 'No active verification challenge found', code: 'SITE_VERIFICATION_NOT_FOUND' }, { status: 404 });
  }

  if (challenge.expires_at < new Date().toISOString()) {
    return NextResponse.json({ error: 'Verification token has expired', code: 'SITE_VERIFICATION_TOKEN_EXPIRED' }, { status: 410 });
  }

  if (challenge.attempt_count >= MAX_VERIFY_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many verification attempts', code: 'SITE_VERIFICATION_RATE_LIMITED' }, { status: 429 });
  }

  // Record attempt
  await supabase
    .from('site_verification_challenges')
    .update({ attempt_count: challenge.attempt_count + 1, last_attempt_at: new Date().toISOString() })
    .eq('id', challenge.id);

  const method = challenge.method;
  let verified = false;
  let failureCode = 'SITE_VERIFICATION_CONTENT_MISMATCH';

  if (method === 'script') {
    verified = await verifyViaScriptHeartbeat(supabase, site.id, challenge.token_hash, site.normalized_origin);
    failureCode = 'SITE_VERIFICATION_CONTENT_MISMATCH';
  } else if (method === 'meta_tag') {
    const result = await verifyViaMetaTag(site.root_url, challenge.token_hash);
    verified     = result.verified;
    failureCode  = result.failureCode;
  }

  if (!verified) {
    log.warn('verification_failed', { connectedSiteId: site.id, method, userId: user.id, errorCode: failureCode });
    await supabase
      .from('connected_sites')
      .update({ verification_status: 'failed' })
      .eq('id', site.id);
    return NextResponse.json({ verified: false, code: failureCode }, { status: 422 });
  }

  // Consume the challenge
  const now = new Date().toISOString();
  await supabase
    .from('site_verification_challenges')
    .update({ consumed_at: now })
    .eq('id', challenge.id);

  // Mark site verified
  await supabase
    .from('connected_sites')
    .update({
      verification_status: 'verified',
      verified_at:         now,
      last_verified_at:    now,
    })
    .eq('id', site.id);

  log.info('verification_succeeded', { connectedSiteId: site.id, method, userId: user.id });

  return NextResponse.json({ verified: true, verifiedAt: now });
}

// ── Method implementations ──────────────────────────────────────────────────

async function verifyViaScriptHeartbeat(
  supabase: ReturnType<typeof createServerClient>,
  siteId: string,
  tokenHash: string,
  expectedOrigin: string,
): Promise<boolean> {
  // Look for a recent verification_proof telemetry event that matches
  // token hash and originates from the correct site
  const { data } = await supabase
    .from('site_telemetry_events')
    .select('id, metrics')
    .eq('connected_site_id', siteId)
    .eq('event_type', 'verification_proof')
    .gt('received_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // last 30 min
    .limit(10);

  if (!data) return false;

  for (const event of data) {
    const proof = event.metrics as Record<string, unknown> | null;
    if (!proof) continue;
    const raw = proof['verificationToken'] as string | undefined;
    if (!raw) continue;
    const hash = hashVerificationToken(raw);
    if (hash === tokenHash) return true;
  }

  return false;
}

async function verifyViaMetaTag(
  rootUrl: string,
  tokenHash: string,
): Promise<{ verified: boolean; failureCode: string }> {
  // SSRF-safe check before fetching
  const urlCheck = validateAnalysisUrl(rootUrl);
  if (!urlCheck.valid) {
    return { verified: false, failureCode: 'SITE_VERIFICATION_FETCH_FAILED' };
  }

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const res = await fetch(rootUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WebScore-Verifier/1.0 (+https://webscore.app/verification)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return { verified: false, failureCode: 'SITE_VERIFICATION_FETCH_FAILED' };
    }

    // Enforce response size limit
    const reader    = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        if (totalBytes > MAX_RESPONSE_BYTES) { reader.cancel(); break; }
        chunks.push(value);
      }
    }
    html = new TextDecoder().decode(Buffer.concat(chunks));
  } catch {
    return { verified: false, failureCode: 'SITE_VERIFICATION_FETCH_FAILED' };
  } finally {
    clearTimeout(timer);
  }

  // Find <meta name="webscore-site-verification" content="TOKEN">
  const match = html.match(/<meta[^>]+name=["']webscore-site-verification["'][^>]+content=["']([^"']+)["']/i)
             ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']webscore-site-verification["']/i);

  if (!match) return { verified: false, failureCode: 'SITE_VERIFICATION_CONTENT_MISMATCH' };

  const rawToken  = match[1].trim();
  const foundHash = hashVerificationToken(rawToken);

  if (foundHash !== tokenHash) {
    return { verified: false, failureCode: 'SITE_VERIFICATION_CONTENT_MISMATCH' };
  }

  return { verified: true, failureCode: '' };
}
