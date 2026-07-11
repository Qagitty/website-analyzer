/**
 * Cron: queue-scheduler
 * Schedule: every minute (configured in vercel.json)
 *
 * Responsibilities:
 *  1. Acquire a short-lived distributed lock (so only one instance runs per cycle).
 *  2. Promote scheduled jobs whose scheduledFor ≤ now into the ready queues.
 *  3. Recover expired leases (placeholder — full implementation via ZSET tracker).
 *  4. Drain legacy monitor:jobs ZSET into the unified queue.
 */

import { NextResponse } from 'next/server';
import { redis } from '@/lib/queue/redis';
import { Q, LEGACY_MONITOR_JOBS_KEY } from '@/lib/queue/keys';
import { promoteScheduledJobs, popLegacyMonitorJobs, enqueueJob } from '@/lib/queue/service';
import { QueuePriority } from '@/lib/queue/types';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 55; // Vercel max for cron routes

const log = createLogger({ category: 'cron:queue-scheduler' });
const LOCK_TTL_SECONDS = 50;

export async function GET(req: Request) {
  // Verify Vercel cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const lockKey  = Q.schedulerLock();
  const lockToken = `scheduler_${Date.now()}`;

  // Try to acquire lock (SET NX with TTL)
  const acquired = await redis.set(lockKey, lockToken, { nx: true, ex: LOCK_TTL_SECONDS });
  if (!acquired) {
    log.info('scheduler_lock_skipped', { reason: 'already_running' });
    return NextResponse.json({ status: 'skipped', reason: 'locked' });
  }

  try {
    const start = Date.now();

    // 1. Promote scheduled → ready
    const promoted = await promoteScheduledJobs();

    // 2. Drain legacy monitor:jobs ZSET
    const legacyJobs = await popLegacyMonitorJobs(20);
    let legacyMigrated = 0;
    for (const { raw } of legacyJobs) {
      try {
        const parsed = JSON.parse(raw) as {
          analysisId?: string;
          url?:        string;
          monitorId?:  string;
          monitorRunId?: string;
          monitorUserId?: string;
          callbackUrl?: string;
          scheduledAt?: number;
        };

        if (!parsed.url || !parsed.monitorUserId) continue;

        await enqueueJob({
          jobType:        'monitor.page_check',
          tenantId:       parsed.monitorUserId,
          idempotencyKey: `legacy:${parsed.analysisId ?? raw.slice(0, 32)}`,
          priority:       QueuePriority.NORMAL,
          scheduledFor:   parsed.scheduledAt ? new Date(parsed.scheduledAt).toISOString() : undefined,
          payload: {
            monitorId:    parsed.monitorId ?? '',
            monitorRunId: parsed.monitorRunId ?? '',
            url:          parsed.url,
            callbackUrl:  parsed.callbackUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`,
          },
        });
        legacyMigrated++;
      } catch (err) {
        log.warn('legacy_job_migration_failed', { raw: raw.slice(0, 100) });
      }
    }

    const durationMs = Date.now() - start;
    log.info('scheduler_run', { promoted, legacyMigrated, durationMs });

    return NextResponse.json({ status: 'ok', promoted, legacyMigrated, durationMs });
  } finally {
    // Release lock only if we still own it
    const current = await redis.get<string>(lockKey);
    if (current === lockToken) {
      await redis.del(lockKey);
    }
  }
}
