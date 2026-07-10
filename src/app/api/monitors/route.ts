import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature, getLimits, featureGateError } from '@/lib/billing/limits';
import { validateAnalysisUrl } from '@/lib/security/url-validator';
import { calculateNextRun, scheduleFromLegacyFrequency } from '@/lib/monitoring/schedule';
import type { MonitorSchedule } from '@/lib/monitoring/types';
import { z } from 'zod';

const schema = z.object({
  url: z
    .string()
    .trim()
    .url('Invalid URL')
    .refine((u) => u.startsWith('http://') || u.startsWith('https://')),
  frequency: z.enum(['daily', 'weekly']).default('weekly'),
  // v2 schedule fields (optional — fall back to frequency if absent)
  schedule_type: z.enum(['interval', 'cron']).optional(),
  schedule_interval_hours: z.number().int().min(6).max(168).optional(),
  schedule_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  schedule_days: z.array(z.number().int().min(0).max(6)).optional(),
  schedule_timezone: z.string().default('UTC'),
  notify_on_score_drop: z.boolean().default(true),
  score_drop_threshold: z.number().int().min(1).max(50).default(10),
  // Multi-page monitoring
  page_mode: z.enum(['homepage', 'pinned', 'sitemap', 'custom']).default('homepage'),
  max_pages: z.number().int().min(1).max(100).default(1),
});

// GET /api/monitors — list all monitors for the current user
export async function GET() {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('monitors')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/monitors — create a monitor
export async function POST(req: NextRequest) {
  // SE5 — CSRF now enforced centrally in middleware.ts.

  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { url, frequency, schedule_type, schedule_interval_hours, schedule_time, schedule_days, schedule_timezone, notify_on_score_drop, score_drop_threshold, page_mode, max_pages } = parsed.data;

  // SSRF protection: reject private IPs, metadata endpoints, blocked ports
  const urlValidation = validateAnalysisUrl(url);
  if (!urlValidation.valid) {
    return NextResponse.json(
      { error: urlValidation.rejectionReason ?? 'URL is not allowed' },
      { status: 400 }
    );
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  const plan = sub?.plan ?? 'free';

  // Feature gate: monitoring requires Pro+
  if (!hasFeature(plan, 'monitoring')) {
    return NextResponse.json(featureGateError('monitoring', 'pro'), { status: 403 });
  }

  // Limit monitors per plan
  const { count } = await supabase.from('monitors')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const limit = getLimits(plan).monitors;
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Your plan allows up to ${limit} monitors. Upgrade to add more.` },
      { status: 402 }
    );
  }

  // Deduct a credit for the immediate first run
  const { data: hasCredit } = await supabase.rpc('use_credit', { p_user_id: user.id });
  if (!hasCredit) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.' },
      { status: 402 }
    );
  }

  // Build v2 schedule JSONB
  let schedule: MonitorSchedule;
  if (schedule_type === 'interval' && schedule_interval_hours) {
    // Map interval to custom type with a cron-equivalent expression
    const h = schedule_interval_hours;
    schedule = { type: 'custom', cronExpression: `0 */${h} * * *`, timezone: schedule_timezone };
  } else {
    // Derive from legacy frequency field with optional time/day overrides
    const base = scheduleFromLegacyFrequency(frequency, schedule_timezone);
    if (schedule_time) {
      const [hr, mn] = schedule_time.split(':').map(Number);
      if (frequency === 'daily' && schedule_days && schedule_days.length > 0 && schedule_days.length < 7) {
        // Specific weekdays — use custom cron
        const days = schedule_days.join(',');
        schedule = { type: 'custom', cronExpression: `${mn} ${hr} * * ${days}`, timezone: schedule_timezone };
      } else if (frequency === 'daily') {
        schedule = { ...base, type: 'daily', hour: hr, minute: mn };
      } else {
        schedule = { ...base, type: 'weekly', hour: hr, minute: mn };
      }
    } else {
      schedule = base;
    }
  }

  // next_run_at is the SECOND scheduled run (first is immediate below)
  const nextRunAt = calculateNextRun(schedule, new Date());

  // Cap max_pages to plan limit
  const effectiveMaxPages = Math.min(max_pages, getLimits(plan).crawlPages);

  const { data: monitor, error: insertError } = await supabase.from('monitors')
    .insert({
      user_id: user.id,
      url,
      frequency,
      schedule,
      notify_on_score_drop,
      score_drop_threshold,
      next_run_at: nextRunAt.toISOString(),
      page_mode,
      max_pages: effectiveMaxPages,
    })
    .select()
    .single();

  if (insertError) {
    await supabase.rpc('refund_credit', { p_user_id: user.id });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Create initial analysis record
  const { data: analysis, error: analysisErr } = await supabase
    .from('analyses')
    .insert({ user_id: user.id, url, status: 'pending' })
    .select('id')
    .single();

  if (analysisErr || !analysis) {
    await supabase.rpc('refund_credit', { p_user_id: user.id });
    return NextResponse.json(monitor, { status: 201 });
  }

  const now = new Date().toISOString();
  const runId = crypto.randomUUID();

  // Create initial monitor_run record
  await supabase.from('monitor_runs').insert({
    id: runId,
    monitor_id: monitor.id,
    analysis_id: analysis.id,
    scheduled_for: now,
    started_at: now,
    status: 'queued',
    trigger: 'manual',
    attempt: 1,
    errors: [],
  });

  // Update monitor to record initial run
  const { data: updatedMonitor } = await supabase.from('monitors')
    .update({ last_run_at: now, last_analysis_id: analysis.id, last_run_id: runId })
    .eq('id', monitor.id)
    .select()
    .single();

  // Seed root page in monitor_pages (background, non-blocking)
  supabase.from('monitor_pages').upsert({
    monitor_id: monitor.id,
    url,
    page_type: 'root',
    discovery_source: 'initial',
    is_active: true,
    sort_order: 0,
  }, { onConflict: 'monitor_id,url' }).then(() => {
    // If sitemap mode, trigger async discovery and save discovered pages
    if (page_mode === 'sitemap') {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/monitors/${monitor.id}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `/* internal */` },
        body: JSON.stringify({ strategy: 'both', save: true }),
      }).catch(() => { /* non-critical — user can re-trigger manually */ });
    }
  });

  // Dispatch to Cloudflare Worker (fire-and-forget)
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`;
  fetch(`${process.env.CLOUDFLARE_WORKER_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      analysisId: analysis.id,
      url,
      callbackUrl,
      // F5 — authToken removed; Worker reads WORKER_CALLBACK_SECRET from its own env.
      monitorId: monitor.id,
      monitorRunId: runId,
      monitorUserId: user.id,
    }),
  }).catch((err) => console.error('[monitors/create] worker dispatch failed:', err));

  return NextResponse.json(updatedMonitor ?? monitor, { status: 201 });
}
