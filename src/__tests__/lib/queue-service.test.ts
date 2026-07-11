/**
 * Tests for unified queue service.
 * Redis and crypto are mocked so no live connections are needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Redis ────────────────────────────────────────────────────────────────

const { store, mockRedis } = vi.hoisted(() => {
  const zsets  = new Map<string, Array<{ score: number; member: string }>>();
  const strings = new Map<string, { value: string; expiresAt?: number }>();
  const lists   = new Map<string, string[]>();
  const counts  = new Map<string, number>();

  const mockRedis = {
    set: vi.fn(async (key: string, value: string | number, opts?: { nx?: boolean; ex?: number }) => {
      const raw = String(value);
      if (opts?.nx && strings.has(key)) return null;
      strings.set(key, {
        value: raw,
        expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : undefined,
      });
      return 'OK';
    }),
    get: vi.fn(async (key: string) => {
      const entry = strings.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        strings.delete(key);
        return null;
      }
      return entry.value;
    }),
    del: vi.fn(async (...keys: string[]) => {
      let n = 0;
      for (const k of keys) { if (strings.delete(k)) n++; }
      return n;
    }),
    expire: vi.fn(async (key: string, secs: number) => {
      const entry = strings.get(key);
      if (!entry) return 0;
      strings.set(key, { ...entry, expiresAt: Date.now() + secs * 1000 });
      return 1;
    }),
    exists: vi.fn(async (...keys: string[]) => keys.filter((k) => strings.has(k)).length),
    incr: vi.fn(async (key: string) => {
      const cur = parseInt((strings.get(key)?.value ?? '0'), 10);
      const next = cur + 1;
      strings.set(key, { value: String(next) });
      return next;
    }),
    decr: vi.fn(async (key: string) => {
      const cur = parseInt((strings.get(key)?.value ?? '0'), 10);
      const next = Math.max(0, cur - 1);
      strings.set(key, { value: String(next) });
      return next;
    }),
    zadd: vi.fn(async (key: string, entry: { score: number; member: string }) => {
      const items = zsets.get(key) ?? [];
      const filtered = items.filter((e) => e.member !== entry.member);
      filtered.push(entry);
      zsets.set(key, filtered);
      return 1;
    }),
    zrem: vi.fn(async (key: string, ...members: string[]) => {
      const items = zsets.get(key) ?? [];
      zsets.set(key, items.filter((e) => !members.includes(e.member)));
      return members.length;
    }),
    zcard: vi.fn(async (key: string) => (zsets.get(key) ?? []).length),
    zrange: vi.fn(async (key: string, min: number, max: number, opts?: { byScore?: boolean; count?: number; offset?: number; rev?: boolean }) => {
      const items = zsets.get(key) ?? [];
      const filtered = opts?.byScore
        ? items.filter((e) => e.score >= min && e.score <= max)
        : items.slice(min, (max as number) + 1);
      const sorted = opts?.rev
        ? [...filtered].sort((a, b) => b.score - a.score)
        : [...filtered].sort((a, b) => a.score - b.score);
      const offset = opts?.offset ?? 0;
      const limited = opts?.count ? sorted.slice(offset, offset + opts.count) : sorted.slice(offset);
      return limited.map((e) => e.member);
    }),
    rpush: vi.fn(async (key: string, ...values: string[]) => {
      const list = lists.get(key) ?? [];
      list.push(...values);
      lists.set(key, list);
      return list.length;
    }),
    lpush: vi.fn(async (key: string, ...values: string[]) => {
      const list = lists.get(key) ?? [];
      list.unshift(...values);
      lists.set(key, list);
      return list.length;
    }),
    lpop: vi.fn(async (key: string) => {
      const list = lists.get(key) ?? [];
      return list.shift() ?? null;
    }),
    llen: vi.fn(async (key: string) => (lists.get(key) ?? []).length),
  };

  return { store: { zsets, strings, lists }, mockRedis };
});

vi.mock('@/lib/queue/redis', () => ({ redis: mockRedis }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  enqueueJob,
  claimJobs,
  completeJob,
  failJob,
  cancelJob,
  renewJobLease,
  promoteScheduledJobs,
  getQueueStats,
} from '@/lib/queue/service';
import { QueuePriority } from '@/lib/queue/types';

beforeEach(() => {
  store.zsets.clear();
  store.strings.clear();
  store.lists.clear();
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseInput(overrides = {}) {
  return {
    jobType:        'analysis.run' as const,
    tenantId:       'user-1',
    idempotencyKey: `test-${Date.now()}-${Math.random()}`,
    payload:        { analysisId: 'a1', url: 'https://example.com', callbackUrl: 'https://app.test/callback' },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('enqueueJob', () => {
  it('puts immediate jobs in the ready list', async () => {
    const result = await enqueueJob(baseInput());
    expect(result.status).toBe('enqueued');
    expect(result.jobId).toMatch(/^job_/);
  });

  it('puts future jobs in the scheduled ZSET', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const result = await enqueueJob(baseInput({ scheduledFor: future }));
    expect(result.status).toBe('scheduled');
    expect(mockRedis.zadd).toHaveBeenCalled();
  });

  it('deduplicates jobs with the same deduplicationKey', async () => {
    const key = 'dedupe-test-123';
    const first = await enqueueJob(baseInput({
      idempotencyKey:   `ik-${key}-1`,
      deduplicationKey: key,
    }));
    expect(first.status).toBe('enqueued');

    const second = await enqueueJob(baseInput({
      idempotencyKey:   `ik-${key}-2`,
      deduplicationKey: key,
    }));
    expect(second.status).toBe('deduplicated');
    expect(second.existingJobId).toBe(first.jobId);
  });

  it('respects priority — lower number is higher priority', async () => {
    await enqueueJob(baseInput({ priority: QueuePriority.NORMAL, idempotencyKey: 'ik-1' }));
    await enqueueJob(baseInput({ priority: QueuePriority.HIGH,   idempotencyKey: 'ik-2' }));
    // Both go to different ready lists
    expect(store.lists.get('queue:v1:ready:50')?.length).toBeGreaterThan(0);
    expect(store.lists.get('queue:v1:ready:20')?.length).toBeGreaterThan(0);
  });
});

describe('promoteScheduledJobs', () => {
  it('moves due jobs to the ready list', async () => {
    // Enqueue with a time 5 minutes in the future so it goes to scheduled state
    const futureMs = Date.now() + 300_000;
    const futureIso = new Date(futureMs).toISOString();

    const result = await enqueueJob(baseInput({
      scheduledFor:   futureIso,
      idempotencyKey: 'ik-promote-test',
    }));
    expect(result.status).toBe('scheduled');

    // Manually back-date the score to the past so promoteScheduledJobs picks it up
    store.zsets.get('queue:v1:scheduled')?.forEach((e) => {
      if (e.member === result.jobId) e.score = Date.now() - 1000;
    });

    const promoted = await promoteScheduledJobs();
    expect(promoted).toBeGreaterThanOrEqual(1);
  });

  it('does not promote future jobs', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    await enqueueJob(baseInput({ scheduledFor: future, idempotencyKey: 'ik-future' }));
    const promoted = await promoteScheduledJobs();
    expect(promoted).toBe(0);
  });
});

describe('claimJobs', () => {
  it('claims an available job', async () => {
    await enqueueJob(baseInput({ idempotencyKey: 'ik-claim-1' }));
    const claimed = await claimJobs({
      jobTypes:  ['analysis.run'],
      workerId:  'w-1',
      maxJobs:   5,
    });
    expect(claimed.length).toBeGreaterThan(0);
    expect(claimed[0].envelope.jobType).toBe('analysis.run');
    expect(claimed[0].lease.workerId).toBe('w-1');
  });

  it('returns empty when no jobs are available', async () => {
    const claimed = await claimJobs({ jobTypes: ['analysis.run'], workerId: 'w-1', maxJobs: 5 });
    expect(claimed).toEqual([]);
  });

  it('respects maxJobs limit', async () => {
    for (let i = 0; i < 5; i++) {
      await enqueueJob(baseInput({ idempotencyKey: `ik-limit-${i}` }));
    }
    const claimed = await claimJobs({ jobTypes: ['analysis.run'], workerId: 'w-1', maxJobs: 2 });
    expect(claimed.length).toBeLessThanOrEqual(2);
  });
});

describe('completeJob', () => {
  it('marks job as completed and releases lease', async () => {
    await enqueueJob(baseInput({ idempotencyKey: 'ik-complete' }));
    const [job] = await claimJobs({ jobTypes: ['analysis.run'], workerId: 'w-1', maxJobs: 1 });
    await completeJob({ jobId: job.envelope.jobId, workerId: 'w-1', result: { status: 'completed' } });
    const status = store.strings.get(`queue:v1:status:${job.envelope.jobId}`)?.value;
    expect(status).toBe('completed');
  });

  it('ignores completion from a different worker (lease mismatch)', async () => {
    await enqueueJob(baseInput({ idempotencyKey: 'ik-mismatch' }));
    const [job] = await claimJobs({ jobTypes: ['analysis.run'], workerId: 'w-1', maxJobs: 1 });
    // Should not throw — just logs warning
    await expect(
      completeJob({ jobId: job.envelope.jobId, workerId: 'w-WRONG', result: { status: 'completed' } }),
    ).resolves.not.toThrow();
  });
});

describe('failJob', () => {
  it('schedules a retry for transient failures within maxAttempts', async () => {
    await enqueueJob(baseInput({ idempotencyKey: 'ik-retry', maxAttempts: 3 }));
    const [job] = await claimJobs({ jobTypes: ['analysis.run'], workerId: 'w-1', maxJobs: 1 });
    const result = await failJob({
      jobId:        job.envelope.jobId,
      workerId:     'w-1',
      errorCode:    'TRANSIENT',
      errorMessage: 'timeout',
      failureType:  'transient',
    });
    expect(result.outcome).toBe('scheduled_retry');
    expect((result as { outcome: 'scheduled_retry'; scheduledFor: string; attempt: number }).attempt).toBe(2);
  });

  it('dead-letters jobs with permanent failure', async () => {
    await enqueueJob(baseInput({ idempotencyKey: 'ik-perm-fail' }));
    const [job] = await claimJobs({ jobTypes: ['analysis.run'], workerId: 'w-1', maxJobs: 1 });
    const result = await failJob({
      jobId:        job.envelope.jobId,
      workerId:     'w-1',
      errorCode:    'PERMANENT',
      errorMessage: 'not found',
      failureType:  'permanent',
    });
    expect(result.outcome).toBe('dead_lettered');
  });
});

describe('cancelJob', () => {
  it('cancels a scheduled job', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const { jobId } = await enqueueJob(baseInput({ scheduledFor: future, idempotencyKey: 'ik-cancel' }));
    const result = await cancelJob(jobId);
    expect(result.cancelled).toBe(true);
    expect(result.previousStatus).toBe('scheduled');
  });

  it('does nothing for already-completed jobs', async () => {
    await enqueueJob(baseInput({ idempotencyKey: 'ik-cancel-complete' }));
    const [job] = await claimJobs({ jobTypes: ['analysis.run'], workerId: 'w-1', maxJobs: 1 });
    await completeJob({ jobId: job.envelope.jobId, workerId: 'w-1', result: { status: 'completed' } });
    const result = await cancelJob(job.envelope.jobId);
    expect(result.cancelled).toBe(false);
  });
});

describe('renewJobLease', () => {
  it('extends the lease TTL for the current owner', async () => {
    await enqueueJob(baseInput({ idempotencyKey: 'ik-renew' }));
    const [job] = await claimJobs({ jobTypes: ['analysis.run'], workerId: 'w-1', maxJobs: 1 });
    const result = await renewJobLease({ jobId: job.envelope.jobId, workerId: 'w-1', leaseSeconds: 60 });
    expect(result.renewed).toBe(true);
    expect(result.leaseExpiresAt).toBeDefined();
  });

  it('rejects renewal from a different worker', async () => {
    await enqueueJob(baseInput({ idempotencyKey: 'ik-renew-fail' }));
    const [job] = await claimJobs({ jobTypes: ['analysis.run'], workerId: 'w-1', maxJobs: 1 });
    const result = await renewJobLease({ jobId: job.envelope.jobId, workerId: 'w-WRONG', leaseSeconds: 60 });
    expect(result.renewed).toBe(false);
  });
});

describe('getQueueStats', () => {
  it('returns stats object with expected shape', async () => {
    const stats = await getQueueStats();
    expect(stats).toHaveProperty('scheduledCount');
    expect(stats).toHaveProperty('readyCounts');
    expect(stats).toHaveProperty('dlqCount');
    expect(stats).toHaveProperty('globalConcurrency');
  });
});
