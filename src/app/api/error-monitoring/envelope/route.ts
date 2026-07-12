/**
 * POST /api/error-monitoring/envelope
 *
 * Public browser error ingestion endpoint.
 * Receives envelopes from the WebScore Error SDK.
 *
 * Security:
 *  - Ingestion key resolved via SHA-256 hash lookup (key never stored in plain)
 *  - Origin validated against project's normalizedOrigin + allowedOrigins
 *  - Per-IP and per-project rate limits
 *  - Monthly quota enforced before staging
 *  - Schema validation via Zod (strict)
 *  - Payload size limit: 64 KB
 *  - All context is scrubbed for sensitive fields
 *  - Duplicate eventId returns 202 idempotently
 *
 * CSRF excluded in middleware (browser-to-server, no session).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit/web';
import {
  isOriginAllowed,
  buildCorsHeaders,
} from '@/lib/error-projects/origin-validator';
import {
  scrubContext,
  sanitizeUrl,
  truncateStackFrames,
  truncateBreadcrumbs,
} from '@/lib/error-projects/scrub';
import { enqueueJob } from '@/lib/queue/service';
import { createHash } from 'crypto';
import { createLogger } from '@/lib/logger';
import { z } from 'zod';

export const runtime = 'nodejs';

const log        = createLogger({ category: 'error-monitoring:ingestion' });
const MAX_BODY   = 64 * 1024; // 64 KB

// ── Schema ───────────────────────────────────────────────────────────────────

const StackFrameSchema = z.object({
  function: z.string().max(256).optional(),
  filename: z.string().max(512).optional(),
  lineno:   z.number().int().optional(),
  colno:    z.number().int().optional(),
});

const EnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  eventId:       z.string().min(1).max(64),
  sentAt:        z.string().datetime().optional(),
  projectKey:    z.string().startsWith('ws_err_').max(100),
  event: z.object({
    type:    z.enum(['exception', 'unhandled_rejection', 'resource_error', 'network_error', 'message']),
    level:   z.enum(['fatal', 'error', 'warning', 'info']).default('error'),
    message: z.string().min(1).max(2048),
    exception: z.object({
      type:  z.string().max(256).optional(),
      value: z.string().max(2048).optional(),
    }).optional(),
    stack:       z.array(StackFrameSchema).max(100).default([]),
    breadcrumbs: z.array(z.unknown()).max(100).default([]),
    context:     z.record(z.unknown()).optional(),
    page: z.object({
      url:      z.string().max(2048).optional(),
      referrer: z.string().max(2048).optional(),
    }).optional(),
    runtime: z.object({
      browser:        z.string().max(200).optional(),
      deviceCategory: z.string().max(32).optional(),
    }).optional(),
    environment:       z.string().max(64).optional(),
    release:           z.string().max(128).optional(),
    customFingerprint: z.array(z.string().max(128)).max(5).optional(),
  }),
});

type Envelope = z.infer<typeof EnvelopeSchema>;

// ── CORS preflight ────────────────────────────────────────────────────────────

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  return new NextResponse(null, {
    status:  204,
    headers: { ...buildCorsHeaders(origin), 'Content-Length': '0' },
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  const ip     = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // IP rate limit
  const ipRl = await rateLimit(`rl:em_ip:${ip}`, 100, 60);
  if (!ipRl.allowed && !ipRl.bypassed) {
    return NextResponse.json(
      { error: 'Rate limited' },
      { status: 429, headers: buildCorsHeaders(origin) },
    );
  }

  // Body size pre-check
  const contentLength = parseInt(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY) {
    return NextResponse.json(
      { error: 'Payload too large', code: 'ERROR_EVENT_TOO_LARGE' },
      { status: 413, headers: buildCorsHeaders(origin) },
    );
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
    if (rawBody.length > MAX_BODY) {
      return NextResponse.json(
        { error: 'Payload too large', code: 'ERROR_EVENT_TOO_LARGE' },
        { status: 413, headers: buildCorsHeaders(origin) },
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid body' },
      { status: 400, headers: buildCorsHeaders(origin) },
    );
  }

  let parsed: Envelope;
  try {
    parsed = EnvelopeSchema.parse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json(
      { error: 'Invalid envelope', code: 'ERROR_EVENT_INVALID' },
      { status: 400, headers: buildCorsHeaders(origin) },
    );
  }

  const keyHash  = createHash('sha256').update(parsed.projectKey).digest('hex');
  const supabase = createServiceRoleClient();

  const { data: project } = await supabase
    .rpc('resolve_error_project_key', { p_key_hash: keyHash })
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Invalid project key', code: 'ERROR_PROJECT_KEY_INVALID' },
      { status: 401, headers: buildCorsHeaders(origin) },
    );
  }

  if ((project as { status: string }).status !== 'active') {
    return NextResponse.json(
      { error: 'Project disabled', code: 'ERROR_PROJECT_DISABLED' },
      { status: 403, headers: buildCorsHeaders(origin) },
    );
  }

  const p = project as {
    project_id:          string;
    user_id:             string;
    normalized_origin:   string;
    allowed_origins:     string[];
    status:              string;
    sample_rate:         number;
    event_quota_monthly: number;
    max_breadcrumbs:     number;
  };

  // Origin validation
  if (!isOriginAllowed(origin, p.normalized_origin, p.allowed_origins)) {
    log.warn('origin_rejected', {
      projectId: p.project_id,
      originHash: createHash('sha256').update(origin).digest('hex').slice(0, 12),
    });
    return NextResponse.json(
      { error: 'Origin not allowed', code: 'ERROR_PROJECT_ORIGIN_NOT_ALLOWED' },
      { status: 403, headers: buildCorsHeaders(origin) },
    );
  }

  // Per-project rate limit
  const projectRl = await rateLimit(`rl:em_proj:${p.project_id}`, 500, 60);
  if (!projectRl.allowed && !projectRl.bypassed) {
    return NextResponse.json(
      { error: 'Rate limited', code: 'ERROR_EVENT_RATE_LIMITED' },
      { status: 429, headers: buildCorsHeaders(origin) },
    );
  }

  // Sampling
  if (p.sample_rate < 1 && Math.random() >= p.sample_rate) {
    return NextResponse.json(
      { accepted: true, sampled: false },
      { status: 202, headers: buildCorsHeaders(origin) },
    );
  }

  // Quota check
  const month = new Date().toISOString().slice(0, 7);
  const { data: quotaRow } = await supabase
    .from('error_project_quotas')
    .select('event_count')
    .eq('error_project_id', p.project_id)
    .eq('month', month)
    .single();

  const currentCount = (quotaRow as { event_count: number } | null)?.event_count ?? 0;
  if (currentCount >= p.event_quota_monthly) {
    return NextResponse.json(
      { error: 'Monthly quota exceeded', code: 'ERROR_PROJECT_QUOTA_EXCEEDED' },
      { status: 429, headers: buildCorsHeaders(origin) },
    );
  }

  // Scrub and stage event
  const ev = parsed.event;
  const scrubbed = {
    event_id:          parsed.eventId,
    error_project_id:  p.project_id,
    user_id:           p.user_id,
    source:            'browser_sdk',
    event_type:        ev.type,
    level:             ev.level,
    message:           ev.message.slice(0, 2048),
    exception_type:    ev.exception?.type?.slice(0, 256),
    stack_frames:      truncateStackFrames(ev.stack ?? []),
    breadcrumbs:       truncateBreadcrumbs(ev.breadcrumbs ?? [], p.max_breadcrumbs),
    context:           scrubContext(ev.context ?? {}),
    page_url_sanitized: sanitizeUrl(ev.page?.url),
    browser:           ev.runtime?.browser?.slice(0, 128),
    device_category:   ev.runtime?.deviceCategory?.slice(0, 32),
    environment:       ev.environment?.slice(0, 64),
    release:           ev.release?.slice(0, 128),
    occurred_at:       parsed.sentAt ?? null,
    is_test_event:     false,
  };

  const { data: staged, error: stageErr } = await supabase
    .from('error_events')
    .insert(scrubbed)
    .select('id')
    .single();

  if (stageErr) {
    if (stageErr.code === '23505') {
      // Duplicate event_id — idempotent
      return NextResponse.json(
        { accepted: true, duplicate: true },
        { status: 202, headers: buildCorsHeaders(origin) },
      );
    }
    log.error('stage_failed', { projectId: p.project_id, error: stageErr.message });
    return NextResponse.json(
      { error: 'Queue unavailable', code: 'ERROR_EVENT_QUEUE_UNAVAILABLE' },
      { status: 503, headers: buildCorsHeaders(origin) },
    );
  }

  // Increment quota
  await supabase.rpc('increment_error_event_quota', {
    p_project_id: p.project_id,
    p_user_id:    p.user_id,
    p_month:      month,
  });

  // Update last_event_at
  await supabase
    .from('error_projects')
    .update({ last_event_at: new Date().toISOString() })
    .eq('id', p.project_id);

  // Enqueue processing
  try {
    await enqueueJob({
      jobType:        'error_event.process',
      tenantId:       p.user_id,
      idempotencyKey: `error_event:${parsed.eventId}`,
      payload: {
        eventDbId:    (staged as { id: string }).id,
        projectId:    p.project_id,
        userId:       p.user_id,
        fingerprint:  ev.customFingerprint,
        message:      ev.message.slice(0, 2048),
        exceptionType: ev.exception?.type?.slice(0, 256),
        level:        ev.level,
        isTest:       false,
      },
      weight: 'light',
    });
  } catch {
    // Event is staged — processing will retry
    log.warn('enqueue_failed', { eventId: parsed.eventId });
  }

  log.info('event_accepted', {
    projectId:   p.project_id,
    eventType:   ev.type,
    level:       ev.level,
    payloadSize: rawBody.length,
  });

  return NextResponse.json(
    { accepted: true },
    { status: 202, headers: buildCorsHeaders(origin) },
  );
}
