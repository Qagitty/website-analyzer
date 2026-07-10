/**
 * Redis sorted-set queue for monitor page dispatch.
 *
 * Instead of unreliable setTimeout inside a serverless function, we enqueue
 * jobs with a future Unix-epoch-ms score. A dispatcher cron (every minute)
 * pops jobs whose score ≤ now and fires them to the Cloudflare Worker.
 *
 * Key schema:
 *  monitor:jobs               — ZSET: score=scheduledAtMs, member=JSON(MonitorJob)
 *  monitor:origin:{key}:lock  — STRING: next-available-at (ms) for per-origin throttle
 */

import { redis } from '@/lib/queue/redis';
import { getOriginKey } from './url-normalizer';

export const MONITOR_JOBS_KEY = 'monitor:jobs';
const ORIGIN_LOCK_PREFIX = 'monitor:origin:';
const ORIGIN_LOCK_SUFFIX = ':lock';

export interface MonitorJob {
  analysisId: string;
  url: string;
  monitorId: string;
  monitorRunId: string;
  monitorUserId: string;
  callbackUrl: string;
  scheduledAt: number; // Unix ms
}

/** Enqueue a batch of monitor jobs with per-origin staggering. */
export async function enqueueMonitorJobs(
  jobs: Array<Omit<MonitorJob, 'scheduledAt'>>,
  originDelayMs: number,
): Promise<void> {
  if (jobs.length === 0) return;

  const now = Date.now();
  // Track per-origin next-available time within this batch
  const originNextAt = new Map<string, number>();

  const members: Array<{ score: number; member: string }> = [];

  for (const job of jobs) {
    const originKey = await getOriginKey(job.url);
    const lockKey = `${ORIGIN_LOCK_PREFIX}${originKey}${ORIGIN_LOCK_SUFFIX}`;

    // Read existing Redis lock for this origin
    let nextAt: number = now;
    const existing = originNextAt.get(originKey);
    if (existing !== undefined) {
      nextAt = existing;
    } else {
      const redisVal = await redis.get<string>(lockKey);
      if (redisVal) {
        const parsed = parseInt(redisVal, 10);
        if (!Number.isNaN(parsed) && parsed > now) nextAt = parsed;
      }
    }

    const scheduledAt = nextAt;
    const scheduledJob: MonitorJob = { ...job, scheduledAt };
    members.push({ score: scheduledAt, member: JSON.stringify(scheduledJob) });

    // Advance the origin's next-available time
    const updatedNext = scheduledAt + originDelayMs;
    originNextAt.set(originKey, updatedNext);

    // Write updated next-available time to Redis
    const ttlMs = updatedNext - now + 60_000; // extra 60s buffer
    await redis.set(lockKey, String(updatedNext), { px: Math.max(ttlMs, 60_000) });
  }

  // Bulk enqueue into sorted set (one zadd call per member for Upstash API compatibility)
  if (members.length > 0) {
    await Promise.all(
      members.map(({ score, member }) => redis.zadd(MONITOR_JOBS_KEY, { score, member })),
    );
  }
}

/** Pop up to `limit` jobs whose scheduled time ≤ now. */
export async function popReadyJobs(limit = 20): Promise<MonitorJob[]> {
  const now = Date.now();
  // zrange with BYSCORE option is the Upstash-compatible way to do ZRANGEBYSCORE
  const raw = await redis.zrange(MONITOR_JOBS_KEY, 0, now, {
    byScore: true,
    count: limit,
    offset: 0,
  });
  if (!raw || raw.length === 0) return [];

  // Remove the popped members atomically
  await redis.zrem(MONITOR_JOBS_KEY, ...raw);

  const jobs: MonitorJob[] = [];
  for (const item of raw) {
    try {
      jobs.push(JSON.parse(typeof item === 'string' ? item : JSON.stringify(item)) as MonitorJob);
    } catch { /* skip malformed entries */ }
  }
  return jobs;
}

/** Count all pending jobs (for observability). */
export async function pendingJobCount(): Promise<number> {
  return redis.zcard(MONITOR_JOBS_KEY);
}
