import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { addDays } from 'date-fns';

/**
 * GET /api/cron/monitors
 * Called by Vercel Cron every hour (see vercel.json).
 * Finds all active monitors that are due, triggers an analysis for each.
 */
export async function GET(req: NextRequest) {
  // Verify this is coming from Vercel Cron (or our own secret)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  // Find all active monitors that are due.
  // Do NOT join auth.users here — user emails are PII and should not travel
  // through the Cloudflare Worker. The callback resolves the email itself.
  const { data: dueMonitors, error } = await (supabase as any).from('monitors')
    .select('id, user_id, url, frequency, notify_on_score_drop, score_drop_threshold, last_scores')
    .eq('is_active', true)
    .lte('next_run_at', now)
    .limit(50); // process max 50 per cron tick

  if (error) {
    console.error('[cron/monitors] fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dueMonitors?.length) {
    return NextResponse.json({ processed: 0 });
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`;
  const workerUrl = `${process.env.CLOUDFLARE_WORKER_URL}/analyze`;
  const results: { url: string; analysisId: string; status: string }[] = [];

  for (const monitor of dueMonitors) {
    try {
      // Check user still has credits
      const { data: hasCredit } = await supabase.rpc('use_credit', {
        p_user_id: monitor.user_id,
      });

      if (!hasCredit) {
        // Pause this monitor — user is out of credits
        await (supabase as any).from('monitors')
          .update({ is_active: false })
          .eq('id', monitor.id);

        console.log(`[cron/monitors] paused monitor ${monitor.id} — no credits`);
        results.push({ url: monitor.url, analysisId: '', status: 'paused_no_credits' });
        continue;
      }

      // Create analysis record
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
        throw new Error('Failed to create analysis');
      }

      // Calculate next run time
      const nextRun = monitor.frequency === 'daily'
        ? addDays(new Date(), 1)
        : addDays(new Date(), 7);

      // Update monitor — record last run, set next run
      await (supabase as any).from('monitors')
        .update({
          last_run_at: now,
          next_run_at: nextRun.toISOString(),
          last_analysis_id: analysis.id,
        })
        .eq('id', monitor.id);

      // Dispatch to Cloudflare Worker (fire-and-forget)
      // Attach monitor metadata so callback can update scores + send email
      fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_AUTH_TOKEN}`,
        },
        body: JSON.stringify({
          analysisId: analysis.id,
          url: monitor.url,
          callbackUrl,
          authToken: process.env.WORKER_CALLBACK_SECRET,
          // Monitor context — callback uses these to update scores and send alerts.
          // NOTE: no email here — callback resolves it from the DB to avoid
          // passing PII through Cloudflare Worker infrastructure.
          monitorId: monitor.id,
          monitorUserId: monitor.user_id,
          monitorLastScores: monitor.last_scores,
          monitorNotify: monitor.notify_on_score_drop,
          monitorThreshold: monitor.score_drop_threshold,
        }),
      }).catch((err) => console.error('[cron/monitors] worker fetch failed:', err));

      results.push({ url: monitor.url, analysisId: analysis.id, status: 'dispatched' });
    } catch (err: any) {
      console.error(`[cron/monitors] error processing monitor ${monitor.id}:`, err);
      results.push({ url: monitor.url, analysisId: '', status: `error: ${err.message}` });
    }
  }

  console.log(`[cron/monitors] processed ${results.length} monitors`);
  return NextResponse.json({ processed: results.length, results });
}
