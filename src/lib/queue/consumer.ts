/**
 * Queue consumer — claims jobs and dispatches them to registered handlers.
 *
 * Designed for serverless execution: each invocation claims a batch of jobs,
 * runs them synchronously, and returns. The Vercel cron fires this every minute.
 *
 * Origin throttling (execution-time):
 *   For every website-targeting job, the consumer atomically acquires an origin
 *   lease immediately before calling the handler.  If the origin is not yet
 *   eligible (active lease, delay window, cooldown, or suspension), the job is
 *   rescheduled — attempt counter and credit balance are not changed.
 *
 *   This is separate from enqueue-time staggering (in monitoring/queue.ts), which
 *   is an optimisation that reduces ready-queue churn.  Consumer-time enforcement
 *   is the correctness guarantee; enqueue-time staggering is defense-in-depth.
 *
 * Lease ordering (§20):
 *   1. Queue lease  — prevents two consumers from owning the same queue job.
 *   2. Origin lease — prevents different queue jobs from hammering the same site.
 *   3. next_at      — enforces minimum interval between job starts.
 *   These are three distinct locks; releasing one never touches another.
 *
 * Redis outage:
 *   If Redis is unavailable during origin acquisition the job is rescheduled
 *   (fail-closed).  It is never executed without a confirmed origin lease.
 */

import { claimJobs, completeJob, failJob, renewJobLease, rescheduleForOriginDelay, decrementConcurrency } from './service';
import { getHandler } from './registry';
import { getJobExecutionPolicy, getOriginLimits, deriveNormalizedOrigin, hashOrigin } from './origin-policy';
import { tryAcquireOriginLease, releaseOriginLease } from './origin-throttle';
import { createLogger } from '@/lib/logger';
import type { QueueJobType, QueueJobEnvelope, JobLease } from './types';
import crypto from 'crypto';

const log = createLogger({ category: 'queue:consumer' });

const WORKER_ID_PREFIX = `consumer_${process.env.VERCEL_REGION ?? 'local'}`;

export interface ConsumeResult {
  claimed:    number;
  completed:  number;
  failed:     number;
  delayed:    number;
  durationMs: number;
}

export async function consumeJobs(options: {
  jobTypes:    QueueJobType[];
  maxJobs?:    number;
  leaseSeconds?: number;
}): Promise<ConsumeResult> {
  const start    = Date.now();
  const workerId = `${WORKER_ID_PREFIX}_${crypto.randomUUID().slice(0, 8)}`;
  const maxJobs  = options.maxJobs ?? 5;

  const claimed = await claimJobs({
    jobTypes:    options.jobTypes,
    workerId,
    maxJobs,
    leaseSeconds: options.leaseSeconds,
  });

  log.info('consumer_run', {
    workerId,
    claimed: claimed.length,
    jobTypes: options.jobTypes,
  });

  let completed = 0;
  let failed    = 0;
  let delayed   = 0;

  for (const { envelope, lease } of claimed) {
    const result = await runJob(workerId, envelope, lease);
    if (result === 'completed') completed++;
    else if (result === 'delayed')  delayed++;
    else failed++;
  }

  return {
    claimed:    claimed.length,
    completed,
    failed,
    delayed,
    durationMs: Date.now() - start,
  };
}

async function runJob(
  workerId: string,
  envelope: QueueJobEnvelope,
  lease: JobLease,
): Promise<'completed' | 'delayed' | 'failed'> {
  const { jobId, jobType, tenantId, correlationId, attempt } = envelope;

  const handler = getHandler(jobType);
  if (!handler) {
    await failJob({
      jobId,
      workerId,
      errorCode:    'UNREGISTERED_JOB_TYPE',
      errorMessage: `No handler registered for job type: ${jobType}`,
      failureType:  'permanent',
    });
    return 'failed';
  }

  // ── Origin throttle ─────────────────────────────────────────────────────────
  const policy = getJobExecutionPolicy(jobType);
  let originLeaseToken: string | null = null;
  let originHash: string | null = null;

  if (policy.requiresOriginThrottle) {
    // Derive canonical origin from the job payload.
    // For safety, we normalise server-side rather than trusting arbitrary payload data.
    const derivedOrigin = deriveOriginFromPayload(jobType, envelope.payload);
    if (!derivedOrigin) {
      log.warn('origin_derivation_failed', { jobId, jobType });
      await failJob({
        jobId,
        workerId,
        errorCode:    'ORIGIN_DERIVATION_FAILED',
        errorMessage: 'Could not derive a valid origin from job payload',
        failureType:  'permanent',
      });
      return 'failed';
    }

    const serverOriginHash = await hashOrigin(derivedOrigin);
    originHash = serverOriginHash;

    // If the envelope already carries an originHash, validate it matches.
    // A mismatch means the payload was tampered with or is stale.
    if (envelope.originHash && envelope.originHash !== serverOriginHash) {
      log.warn('origin_hash_mismatch', {
        jobId,
        jobType,
        envelopeHash: envelope.originHash,
        serverHash:   serverOriginHash,
      });
      await failJob({
        jobId,
        workerId,
        errorCode:    'ORIGIN_HASH_MISMATCH',
        errorMessage: 'Envelope originHash does not match server-derived origin',
        failureType:  'permanent',
      });
      return 'failed';
    }

    const limits = getOriginLimits(policy.weight);
    let acquireResult;

    try {
      acquireResult = await tryAcquireOriginLease({
        originHash:           serverOriginHash,
        leaseDurationSeconds: limits.leaseSecs,
        minimumDelayMs:       limits.delayMs,
        jobId,
        workerId,
      });
    } catch (redisErr) {
      // Redis unavailable — fail closed: do NOT execute the job.
      log.error('origin_throttle_dependency_failure', {
        jobId,
        jobType,
        originHash: serverOriginHash,
        error: redisErr instanceof Error ? redisErr.message.slice(0, 100) : 'unknown',
      });
      // Reschedule 60s later; this is not a user-visible failure.
      await rescheduleForOriginDelay({
        jobId,
        workerId,
        envelope,
        eligibleAt:  Date.now() + 60_000,
        delayReason: 'origin_throttle_dependency_failure',
      });
      return 'delayed';
    }

    if (!acquireResult.acquired) {
      log.info('origin_job_delayed', {
        jobId,
        jobType,
        tenantId,
        originHash:  serverOriginHash,
        reason:      acquireResult.reason,
        eligibleAt:  new Date(acquireResult.eligibleAt).toISOString(),
        attempt,
      });

      await rescheduleForOriginDelay({
        jobId,
        workerId,
        envelope,
        eligibleAt:  acquireResult.eligibleAt,
        delayReason: acquireResult.reason,
      });
      return 'delayed';
    }

    originLeaseToken = acquireResult.leaseToken;
  }

  // ── Build context and execute handler ────────────────────────────────────────
  const ctx = {
    jobId,
    jobType,
    tenantId,
    correlationId,
    attempt,
    lease,
    renewLease: async () => {
      await renewJobLease({ jobId, workerId, leaseSeconds: 120 });
    },
  };

  try {
    const result = await handler(ctx, envelope.payload);

    if (result.status === 'completed' || result.status === 'reschedule') {
      await completeJob({ jobId, workerId, result });
      return 'completed';
    }

    if (result.status === 'cancelled') {
      await completeJob({ jobId, workerId, result });
      return 'completed';
    }

    // retry or failed
    await failJob({
      jobId,
      workerId,
      errorCode:    result.errorCode,
      errorMessage: result.errorCode,
      failureType:  result.failureType,
      retryAfterMs: 'retryAfterMs' in result ? result.retryAfterMs : undefined,
    });
    return result.status === 'retry' ? 'completed' : 'failed';

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error('job_handler_threw', { jobId, jobType, tenantId, attempt, error: message.slice(0, 200) });

    await failJob({
      jobId,
      workerId,
      errorCode:    'HANDLER_THREW',
      errorMessage: message.slice(0, 500),
      failureType:  'transient',
    });
    return 'failed';

  } finally {
    // Always release origin lease (if owned), regardless of outcome.
    // Do NOT delete next_at — the delay must apply to subsequent jobs.
    if (originHash && originLeaseToken) {
      await releaseOriginLease(originHash, originLeaseToken).catch((e) => {
        log.warn('origin_lease_release_failed_in_finally', {
          jobId,
          originHash,
          error: e instanceof Error ? e.message.slice(0, 100) : 'unknown',
        });
        // TTL-based auto-expiry is the fallback. The job's own result is already durable.
      });
    }
  }
}

// ─── Origin derivation ────────────────────────────────────────────────────────
//
// Each website-targeting job type has a known payload structure.
// We extract the URL from the payload and normalise it server-side.
// We do NOT load from the database here — the URLs are trusted (set server-side
// at job creation by authenticated handlers that ran SSRF checks).
//
// If envelope.originHash is present, the caller (runJob) will compare it against
// the server-derived hash and reject on mismatch.

function deriveOriginFromPayload(
  jobType: QueueJobType,
  payload: unknown,
): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  switch (jobType) {
    case 'analysis.run': {
      const url = typeof p['url'] === 'string' ? p['url'] : null;
      return url ? deriveNormalizedOrigin(url) : null;
    }
    case 'monitor.page_check': {
      const url = typeof p['url'] === 'string' ? p['url'] : null;
      return url ? deriveNormalizedOrigin(url) : null;
    }
    case 'monitor.discovery': {
      const rootUrl = typeof p['rootUrl'] === 'string' ? p['rootUrl'] : null;
      return rootUrl ? deriveNormalizedOrigin(rootUrl) : null;
    }
    case 'site_connect.verify': {
      // Payload should carry the normalizedOrigin or root_url of the connected site.
      const origin = typeof p['normalizedOrigin'] === 'string' ? p['normalizedOrigin'] : null;
      const url    = typeof p['rootUrl'] === 'string' ? p['rootUrl'] : null;
      const src    = origin ?? url;
      return src ? deriveNormalizedOrigin(src) : null;
    }
    default:
      // Non-website job — should not be called (policy.requiresOriginThrottle = false)
      return null;
  }
}
