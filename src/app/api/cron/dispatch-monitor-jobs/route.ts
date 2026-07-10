import { NextRequest, NextResponse } from 'next/server';
import { popReadyJobs } from '@/lib/monitoring/queue';

/**
 * GET /api/cron/dispatch-monitor-jobs
 * Runs every minute (Vercel Cron). Pops ready monitor page analysis jobs from
 * the Redis sorted set and fires them to the Cloudflare Worker.
 *
 * This replaces the broken setTimeout approach in cron/monitors.
 * The monitors cron enqueues jobs; this dispatcher executes them on schedule.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[dispatch-jobs] CRON_SECRET not set');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workerUrl = `${process.env.CLOUDFLARE_WORKER_URL}/analyze`;
  const workerToken = process.env.CLOUDFLARE_WORKER_AUTH_TOKEN;
  if (!workerUrl || !workerToken) {
    return NextResponse.json({ error: 'Worker not configured' }, { status: 503 });
  }

  const jobs = await popReadyJobs(30);
  if (jobs.length === 0) {
    return NextResponse.json({ dispatched: 0 });
  }

  const dispatched: string[] = [];
  const failed: string[] = [];

  await Promise.allSettled(
    jobs.map(async (job) => {
      try {
        await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${workerToken}`,
          },
          body: JSON.stringify({
            analysisId: job.analysisId,
            url: job.url,
            callbackUrl: job.callbackUrl,
            monitorId: job.monitorId,
            monitorRunId: job.monitorRunId,
            monitorUserId: job.monitorUserId,
          }),
        });
        dispatched.push(job.analysisId);
      } catch (err) {
        console.error('[dispatch-jobs] failed to dispatch', job.analysisId, err);
        failed.push(job.analysisId);
      }
    }),
  );

  console.log(`[dispatch-jobs] dispatched=${dispatched.length} failed=${failed.length}`);
  return NextResponse.json({ dispatched: dispatched.length, failed: failed.length });
}
