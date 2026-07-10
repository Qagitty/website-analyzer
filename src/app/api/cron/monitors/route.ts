import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateNextRun, addJitter, scheduleFromLegacyFrequency } from '@/lib/monitoring/schedule';
import type { MonitorSchedule } from '@/lib/monitoring/types';
import { enqueueMonitorJobs } from '@/lib/monitoring/queue';

// Per-origin dispatch throttle — configurable via env, default 30s
const ORIGIN_THROTTLE_MS = parseInt(process.env.MONITOR_ORIGIN_DELAY_MS ?? '30000', 10);

/**
 * GET /api/cron/monitors
 * Triggered by Vercel Cron (see vercel.json — 0 9 * * *).
 *
 * Safety rules:
 *  §4 — atomic claiming via claim_monitor_run() prevents duplicate execution
 *  §47 — do NOT pass authToken through Worker body (Data Architecture §7)
 *  §3  — timezone-aware next_run_at via calculateNextRun()
 *  §2  — re-verify monitor status after lease is claimed before dispatching
 */
export async function GET(req: NextRequest) {
  // F4 — explicit guard: if CRON_SECRET is unset the template literal produces
  // "Bearer undefined" which anyone knowing the source code can send.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/monitors] CRON_SECRET env var not set — refusing all requests');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // Cleanup expired leases from previous cron runs (maintenance, §4)
  await supabase.rpc('cleanup_expired_monitor_leases');

  // Select due monitors — both legacy (is_active) and v2 (status='active')
  const { data: dueMonitors, error: fetchErr } = await supabase
    .from('monitors')
    .select('id, user_id, url, frequency, notify_on_score_drop, score_drop_threshold, last_scores, is_active, status, schedule, next_run_at, page_mode')
    .or('is_active.eq.true,status.eq.active')
    .lte('next_run_at', nowIso)
    .is('status', null) // include legacy rows where status is null
    .limit(50)
    .then(async (legacyResult) => {
      // Also fetch v2 monitors with explicit status='active'
      const { data: v2 } = await supabase
        .from('monitors')
        .select('id, user_id, url, frequency, notify_on_score_drop, score_drop_threshold, last_scores, is_active, status, schedule, next_run_at, page_mode')
        .eq('status', 'active')
        .lte('next_run_at', nowIso)
        .limit(50);

      const legacyRows = legacyResult.data ?? [];
      const v2Rows = v2 ?? [];
      // Deduplicate by id
      const seen = new Set(legacyRows.map((r: { id: string }) => r.id));
      const combined = [...legacyRows, ...v2Rows.filter((r: { id: string }) => !seen.has(r.id))];
      return { data: combined.slice(0, 50), error: legacyResult.error };
    });

  if (fetchErr) {
    console.error('[cron/monitors] fetch error:', fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!dueMonitors?.length) {
    return NextResponse.json({ processed: 0 });
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`;

  const results: {
    monitorId: string;
    url: string;
    analysisId: string;
    runId: string;
    status: string;
  }[] = [];

  for (const monitor of dueMonitors) {
    const runId = crypto.randomUUID();

    try {
      // ── Step 1: Atomically claim this monitor run ──────────────────────────
      const { data: claimedRunId } = await supabase.rpc('claim_monitor_run', {
        p_monitor_id: monitor.id,
        p_run_id: runId,
        lease_minutes: 30,
      });

      if (!claimedRunId) {
        // Another cron worker already claimed this monitor — skip
        results.push({
          monitorId: monitor.id,
          url: monitor.url,
          analysisId: '',
          runId: '',
          status: 'skipped_already_claimed',
        });
        continue;
      }

      // ── Step 2: Re-verify monitor is still active AFTER claiming (§2) ─────
      const { data: fresh } = await supabase
        .from('monitors')
        .select('id, status, is_active')
        .eq('id', monitor.id)
        .single();

      const isActive =
        fresh?.status === 'active' ||
        (fresh?.status == null && fresh?.is_active === true);

      if (!fresh || !isActive) {
        // Monitor was paused/deleted between our SELECT and our claim — release
        await supabase.rpc('release_monitor_lease', {
          p_monitor_id: monitor.id,
          p_run_id: runId,
        });
        results.push({
          monitorId: monitor.id,
          url: monitor.url,
          analysisId: '',
          runId,
          status: 'skipped_not_active',
        });
        continue;
      }

      // ── Step 3: Check credits ──────────────────────────────────────────────
      const { data: hasCredit } = await supabase.rpc('use_credit', {
        p_user_id: monitor.user_id,
      });

      if (!hasCredit) {
        await supabase
          .from('monitors')
          .update({ is_active: false, status: 'paused' })
          .eq('id', monitor.id);
        await supabase.rpc('release_monitor_lease', {
          p_monitor_id: monitor.id,
          p_run_id: runId,
        });
        results.push({
          monitorId: monitor.id,
          url: monitor.url,
          analysisId: '',
          runId,
          status: 'paused_no_credits',
        });
        continue;
      }

      // ── Step 4: Create analysis record ────────────────────────────────────
      const { data: analysis, error: insertErr } = await supabase
        .from('analyses')
        .insert({
          user_id: monitor.user_id,
          url: monitor.url,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertErr || !analysis) {
        await supabase.rpc('refund_credit', { p_user_id: monitor.user_id });
        await supabase.rpc('release_monitor_lease', {
          p_monitor_id: monitor.id,
          p_run_id: runId,
        });
        throw new Error('Failed to create analysis record');
      }

      // ── Step 5: Create monitor_run record ──────────────────────────────────
      await supabase.from('monitor_runs').insert({
        id: runId,
        monitor_id: monitor.id,
        analysis_id: analysis.id,
        scheduled_for: nowIso,
        started_at: nowIso,
        status: 'queued',
        trigger: 'schedule',
        attempt: 1,
        errors: [],
      });

      // ── Step 6: Compute timezone-aware next_run_at ─────────────────────────
      let schedule: MonitorSchedule;
      if (monitor.schedule && typeof monitor.schedule === 'object') {
        schedule = monitor.schedule as MonitorSchedule;
      } else {
        // Legacy monitor: map frequency → MonitorSchedule (UTC default)
        schedule = scheduleFromLegacyFrequency(
          (monitor.frequency as 'daily' | 'weekly') ?? 'weekly',
          'UTC',
        );
      }

      const baseNextRun = calculateNextRun(schedule, now);
      const nextRun = schedule.jitterWindowMinutes
        ? addJitter(baseNextRun, schedule.jitterWindowMinutes)
        : baseNextRun;

      // ── Step 7: Update monitor record ─────────────────────────────────────
      await supabase
        .from('monitors')
        .update({
          last_run_at: nowIso,
          next_run_at: nextRun.toISOString(),
          last_analysis_id: analysis.id,
          last_run_id: runId,
        })
        .eq('id', monitor.id);

      // ── Step 8: Dispatch to Cloudflare Worker ─────────────────────────────
      // For multi-page monitors fetch the active page list; for homepage-mode
      // use the root URL only. Pages are staggered 30s apart to avoid
      // hammering the same origin in rapid succession.
      const pageMode = (monitor as { page_mode?: string }).page_mode ?? 'homepage';
      let pagesToDispatch: Array<{ url: string; analysisId: string }> = [
        { url: monitor.url, analysisId: analysis.id },
      ];

      if (pageMode !== 'homepage') {
        const { data: pages } = await supabase
          .from('monitor_pages')
          .select('url')
          .eq('monitor_id', monitor.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (pages && pages.length > 1) {
          // Create analysis records for each extra page (root already created above)
          const extraPages = pages.filter((p: { url: string }) => p.url !== monitor.url);
          const extraAnalyses = await Promise.all(
            extraPages.map((p: { url: string }) =>
              supabase
                .from('analyses')
                .insert({ user_id: monitor.user_id, url: p.url, status: 'pending' })
                .select('id')
                .single()
                .then(({ data }) => data ? { url: p.url, analysisId: data.id } : null),
            ),
          );
          const validExtras = extraAnalyses.filter(Boolean) as Array<{ url: string; analysisId: string }>;
          pagesToDispatch = [{ url: monitor.url, analysisId: analysis.id }, ...validExtras];
        }
      }

      // Enqueue into Redis sorted set — the dispatcher cron fires them on schedule.
      // This replaces unreliable setTimeout in a serverless environment.
      await enqueueMonitorJobs(
        pagesToDispatch.map(({ url, analysisId: pageAnalysisId }) => ({
          analysisId: pageAnalysisId,
          url,
          monitorId: monitor.id,
          monitorRunId: runId,
          monitorUserId: monitor.user_id,
          callbackUrl,
        })),
        ORIGIN_THROTTLE_MS,
      );

      results.push({
        monitorId: monitor.id,
        url: monitor.url,
        analysisId: analysis.id,
        runId,
        status: 'dispatched',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error(`[cron/monitors] error processing monitor ${monitor.id}:`, err);

      // Best-effort lease release on unexpected errors
      try {
        await supabase.rpc('release_monitor_lease', {
          p_monitor_id: monitor.id,
          p_run_id: runId,
        });
      } catch { /* ignore — lease will expire naturally */ }

      results.push({
        monitorId: monitor.id,
        url: monitor.url,
        analysisId: '',
        runId,
        status: `error: ${message}`,
      });
    }
  }

  console.log(
    `[cron/monitors] processed ${results.length} monitors:`,
    results.map((r) => `${r.url}→${r.status}`).join(', '),
  );

  return NextResponse.json({ processed: results.length, results });
}
