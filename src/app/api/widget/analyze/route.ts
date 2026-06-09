/**
 * POST /api/widget/analyze
 *
 * PUBLIC endpoint — authenticated by widget key (not session cookie).
 * Visitor submits their URL from an embedded widget; analysis runs on
 * behalf of the widget owner (agency) using their credits.
 *
 * Security model:
 *   - Widget key is a public key (safe to embed in HTML)
 *   - Only permits submitting URLs for analysis, nothing else
 *   - Rate limited: 20 submissions / day per widget key  +  3 / hour per IP
 *   - CORS: Allow-Origin: * (needed for cross-site embed)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isValidWidgetKeyFormat } from '@/lib/widget/key';
import { checkWebRateLimit } from '@/lib/rate-limit/web';
import { z } from 'zod';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const schema = z.object({
  key:   z.string().min(1, 'Widget key required'),
  url:   z.string().trim().transform(normalizeUrl).pipe(z.string().url('Invalid URL')),
  email: z.string().email().optional(),
  name:  z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  // Per-IP rate limit: 3 widget submissions per hour
  const ipLimited = await checkWebRateLimit(req, 'widget-ip', 3, 3600);
  if (ipLimited) return new NextResponse(ipLimited.body, { status: 429, headers: { ...CORS_HEADERS, ...Object.fromEntries(ipLimited.headers) } });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const { key, url, email, name } = parsed.data;

  // Validate key format
  if (!isValidWidgetKeyFormat(key)) {
    return NextResponse.json(
      { error: 'Invalid widget key format.' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Service role client bypasses RLS — needed to look up user by widget key
  const supabase = createServiceRoleClient();

  // Look up widget owner by key
  const { data: settings } = await (supabase.from('user_settings') as any)
    .select('user_id, widget_settings')
    .eq('widget_key', key)
    .single();

  if (!settings) {
    return NextResponse.json(
      { error: 'Widget key not found.' },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const userId = settings.user_id;

  // Per-widget-key rate limit: 20 widget submissions per day (86400s)
  const keyLimited = await checkWebRateLimit(req, `widget-key-${key}`, 20, 86400);
  if (keyLimited) return new NextResponse(keyLimited.body, { status: 429, headers: { ...CORS_HEADERS, ...Object.fromEntries(keyLimited.headers) } });

  // Check + consume credit atomically
  const { data: hasCredit, error: creditError } = await supabase.rpc('use_credit', {
    p_user_id: userId,
  });

  if (creditError || !hasCredit) {
    return NextResponse.json(
      { error: 'The widget owner has run out of analysis credits.' },
      { status: 402, headers: CORS_HEADERS },
    );
  }

  // Create analysis record
  const { data: analysis, error: insertError } = await supabase
    .from('analyses')
    .insert({
      user_id:    userId,
      url,
      status:     'queued',
      source:     'widget',
      lead_email: email ?? null,
      lead_name:  name ?? null,
    } as any)
    .select('id')
    .single();

  if (insertError || !analysis) {
    await supabase.rpc('refund_credit', { p_user_id: userId });
    return NextResponse.json(
      { error: 'Failed to start analysis.' },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  // Dispatch to Cloudflare Worker (fire-and-forget)
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`;
  const workerUrl   = `${process.env.CLOUDFLARE_WORKER_URL}/analyze`;

  fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      analysisId: analysis.id,
      url,
      callbackUrl,
      authToken: process.env.WORKER_CALLBACK_SECRET,
    }),
  }).catch((err) => console.error('[widget] worker dispatch failed:', err));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  return NextResponse.json(
    {
      analysisId: analysis.id,
      reportUrl:  `${appUrl}/share/${analysis.id}`,
      message:    'Analysis started. Your report will be ready in about 60 seconds.',
    },
    { status: 202, headers: CORS_HEADERS },
  );
}
