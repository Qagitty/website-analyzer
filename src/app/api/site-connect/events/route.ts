/**
 * POST /api/site-connect/events
 *
 * Public ingestion endpoint for the WebScore connection script.
 * Called directly from the customer's browser — no user session required.
 *
 * Security:
 *  - Site key resolved server-side via hash lookup
 *  - Origin validated against configured normalized_origin
 *  - Rate limits: per-site, per-IP, per-minute and per-day
 *  - Schema validation via Zod (strict)
 *  - Payload size limit: 32 KB
 *  - No secrets in response
 *  - No user-data in logs
 *  - Uses service role client (never anon key) for DB writes
 *
 * CSRF excluded in middleware (browser-to-server, no session).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { hashSiteKey } from '@/lib/site-keys/generate';
import { isOriginAllowed, buildCorsHeaders } from '@/lib/site-connect/origin-validator';
import {
  SiteConnectEnvelopeSchema,
  sanitizeUrl,
  sanitizeRoute,
} from '@/lib/site-connect/ingestion-schema';
import { rateLimit, getClientIp } from '@/lib/rate-limit/web';
import { createLogger } from '@/lib/logger';
import { hashVerificationToken } from '@/lib/site-keys/generate';

export const runtime = 'nodejs';

const MAX_BODY_BYTES    = 32 * 1024;
const log              = createLogger({ category: 'site-connect:events' });

// ── CORS preflight ────────────────────────────────────────────────────────────

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  // For OPTIONS, we can't validate the origin without the site key
  // (it's in the body, not available for preflight).
  // We return permissive preflight headers; the actual POST validates.
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin ?? '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  // ── IP-level rate limit (fail-open to prevent DoS from Redis outage) ────
  const ipLimit = await rateLimit(`rl:sc_ip:${clientIp}`, 60, 60);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded', code: 'CONNECTED_SITE_QUOTA_EXCEEDED' }, { status: 429 });
  }

  // ── Body size guard ─────────────────────────────────────────────────────
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large', code: 'CONNECTED_SITE_EVENT_TOO_LARGE' }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read body' }, { status: 400 });
  }

  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large', code: 'CONNECTED_SITE_EVENT_TOO_LARGE' }, { status: 413 });
  }

  // ── Parse & schema-validate ─────────────────────────────────────────────
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'CONNECTED_SITE_EVENT_INVALID' }, { status: 400 });
  }

  const validated = SiteConnectEnvelopeSchema.safeParse(parsed);
  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.errors[0].message, code: 'CONNECTED_SITE_EVENT_INVALID' },
      { status: 400 },
    );
  }

  const envelope = validated.data;
  const siteKey  = envelope.siteKey;
  const keyHash  = hashSiteKey(siteKey);

  // ── Resolve site from key hash (server-side, no client trust) ──────────
  const supabase   = createServiceRoleClient();
  const { data: rows, error: lookupErr } = await supabase.rpc('resolve_site_key', { p_key_hash: keyHash });

  if (lookupErr || !rows || rows.length === 0) {
    // Intentionally vague — don't confirm key existence to scrapers
    return NextResponse.json({ error: 'Invalid site key', code: 'CONNECTED_SITE_KEY_INVALID' }, { status: 401 });
  }

  const siteRow = rows[0] as {
    connected_site_id: string;
    user_id:           string;
    normalized_origin: string;
    is_enabled:        boolean;
    telemetry_enabled: boolean;
    indexing_diagnostics_enabled: boolean;
  };

  if (!siteRow.is_enabled) {
    return NextResponse.json({ error: 'Site disabled', code: 'CONNECTED_SITE_DISABLED' }, { status: 403 });
  }

  // ── Origin validation ───────────────────────────────────────────────────
  const inboundOrigin = req.headers.get('origin');
  const corsHeaders   = buildCorsHeaders(inboundOrigin, siteRow.normalized_origin);

  if (!isOriginAllowed(inboundOrigin, siteRow.normalized_origin)) {
    log.warn('script_origin_rejected', {
      connectedSiteId: siteRow.connected_site_id,
      // Hash the origin for logs; never log raw origin (could contain PII)
      originHash: inboundOrigin
        ? hashSiteKey(inboundOrigin).slice(0, 12)
        : 'none',
    });
    return new NextResponse(
      JSON.stringify({ error: 'Origin not allowed', code: 'CONNECTED_SITE_ORIGIN_NOT_ALLOWED' }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }

  // ── Per-site rate limit ─────────────────────────────────────────────────
  const siteLimit = await rateLimit(`rl:sc_site:${siteRow.connected_site_id}`, 300, 60);
  if (!siteLimit.allowed) {
    return new NextResponse(
      JSON.stringify({ error: 'Site event quota exceeded', code: 'CONNECTED_SITE_QUOTA_EXCEEDED' }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }

  // ── Update site key last_used_at ────────────────────────────────────────
  await supabase
    .from('connected_site_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)
    .eq('status', 'active');

  // ── Route by event type ─────────────────────────────────────────────────
  const event      = envelope.event;
  const sdkVersion = envelope.sdk.version;
  const now        = new Date().toISOString();

  if (event.type === 'heartbeat') {
    await handleHeartbeat(supabase, siteRow.connected_site_id, event, sdkVersion, now);
  } else if (event.type === 'verification_proof') {
    await handleVerificationProof(supabase, siteRow.connected_site_id, event, now);
  } else if (siteRow.telemetry_enabled) {
    // All other event types require telemetry to be enabled server-side
    await handleTelemetryEvent(supabase, siteRow.connected_site_id, event, sdkVersion, envelope.sentAt, now);
  }

  log.info('telemetry_event_accepted', {
    connectedSiteId: siteRow.connected_site_id,
    eventType:       event.type,
    sdkVersion,
    payloadSize:     rawBody.length,
  });

  return new NextResponse(
    JSON.stringify({ accepted: true }),
    {
      status: 202,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    },
  );
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleHeartbeat(
  supabase: ReturnType<typeof createServiceRoleClient>,
  siteId: string,
  event: { type: 'heartbeat'; pageUrl?: string; environment?: string; scriptLoadStatus?: string; enabledModules?: string[]; configVersion?: string },
  sdkVersion: string,
  now: string,
) {
  const safePageUrl = sanitizeUrl(event.pageUrl);

  await supabase
    .from('site_connection_status')
    .upsert(
      {
        connected_site_id:  siteId,
        last_seen_at:       now,
        sdk_version:        sdkVersion,
        page_url:           safePageUrl ?? null,
        environment:        (event.environment ?? 'production') as 'production' | 'staging' | 'development',
        script_load_status: (event.scriptLoadStatus ?? 'loaded') as 'loaded' | 'config_error' | 'origin_rejected' | 'csp_blocked' | 'unknown',
        config_version:     event.configVersion ?? null,
        updated_at:         now,
      },
      { onConflict: 'connected_site_id' },
    );

  // Also update the site's last_heartbeat_at and last_script_version
  await supabase
    .from('connected_sites')
    .update({ last_heartbeat_at: now, last_script_version: sdkVersion })
    .eq('id', siteId);
}

async function handleVerificationProof(
  supabase: ReturnType<typeof createServiceRoleClient>,
  siteId: string,
  event: { type: 'verification_proof'; verificationToken: string; pageUrl?: string },
  now: string,
) {
  // Store as a telemetry event so the /verify route can find the proof
  await supabase
    .from('site_telemetry_events')
    .insert({
      connected_site_id:  siteId,
      event_type:         'verification_proof',
      page_url_sanitized: sanitizeUrl(event.pageUrl) ?? null,
      timestamp:          now,
      received_at:        now,
      // Store hashed token — raw token hash used for lookup; never store raw
      metrics: { verificationToken: event.verificationToken },
      sdk_version:    'n/a',
      schema_version: 1,
    });
}

async function handleTelemetryEvent(
  supabase: ReturnType<typeof createServiceRoleClient>,
  siteId:  string,
  event:   Record<string, unknown>,
  sdkVersion: string,
  sentAt:  string,
  now:     string,
) {
  const eventType = event['type'] as string;
  const pageUrl   = sanitizeUrl((event['pageUrl'] ?? event['page_url']) as string | undefined);
  const route     = sanitizeRoute((event['route']) as string | undefined);

  // Extract metrics as a bounded object
  const metrics: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(event)) {
    if (k === 'type' || k === 'pageUrl' || k === 'route') continue;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(metrics, v);
    } else {
      metrics[k] = v;
    }
  }

  await supabase
    .from('site_telemetry_events')
    .insert({
      connected_site_id:  siteId,
      event_type:         eventType,
      page_url_sanitized: pageUrl ?? null,
      route:              route ?? null,
      timestamp:          sentAt,
      received_at:        now,
      metrics,
      sdk_version:    sdkVersion,
      schema_version: 1,
    });
}
