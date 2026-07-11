/**
 * Queue consumer — claims jobs and dispatches them to registered handlers.
 *
 * Designed for serverless execution: each invocation claims a batch of jobs,
 * runs them synchronously, and returns. The Vercel cron fires this every minute.
 *
 * Lease renewal: long-running handlers should call ctx.renewLease() periodically.
 * The default lease is 120 s; heavy jobs request more via leaseSeconds.
 */

import { claimJobs, completeJob, failJob, renewJobLease } from './service';
import { getHandler } from './registry';
import { createLogger } from '@/lib/logger';
import type { QueueJobType, QueueJobEnvelope, JobLease } from './types';
import crypto from 'crypto';

const log = createLogger({ category: 'queue:consumer' });

const WORKER_ID_PREFIX = `consumer_${process.env.VERCEL_REGION ?? 'local'}`;

export interface ConsumeResult {
  claimed:    number;
  completed:  number;
  failed:     number;
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

  for (const { envelope, lease } of claimed) {
    const result = await runJob(workerId, envelope, lease);
    if (result === 'completed') completed++;
    else failed++;
  }

  return {
    claimed:    claimed.length,
    completed,
    failed,
    durationMs: Date.now() - start,
  };
}

async function runJob(
  workerId: string,
  envelope: QueueJobEnvelope,
  lease: JobLease,
): Promise<'completed' | 'failed'> {
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

  // Build context with lease renewal support
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
  }
}
