/**
 * Tests for the Redis-based monitor job queue.
 * Redis is mocked so no live connection is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Redis ────────────────────────────────────────────────────────────────

const { redisStore, stringStore, mockRedis } = vi.hoisted(() => {
  const redisStore: Map<string, { score: number; member: string }[]> = new Map();
  const stringStore: Map<string, { value: string; expiresAt?: number }> = new Map();

  const mockRedis = {
  zadd: vi.fn(async (_key: string, ...members: Array<{ score: number; member: string }>) => {
    const existing = redisStore.get(_key) ?? [];
    for (const m of members) {
      // Remove existing entry with same member
      const filtered = existing.filter((e) => e.member !== m.member);
      filtered.push(m);
      redisStore.set(_key, filtered);
    }
    return members.length;
  }),
  zrangebyscore: vi.fn(async (key: string, min: number, max: number, opts?: { count?: number }) => {
    const entries = (redisStore.get(key) ?? [])
      .filter((e) => e.score >= min && e.score <= max)
      .sort((a, b) => a.score - b.score);
    const limited = opts?.count ? entries.slice(0, opts.count) : entries;
    return limited.map((e) => e.member);
  }),
  zrem: vi.fn(async (key: string, ...members: string[]) => {
    const existing = redisStore.get(key) ?? [];
    redisStore.set(key, existing.filter((e) => !members.includes(e.member)));
    return members.length;
  }),
  zcard: vi.fn(async (key: string) => (redisStore.get(key) ?? []).length),
  zrange: vi.fn(async (key: string, min: number, max: number, opts?: { byScore?: boolean; count?: number; offset?: number }) => {
    const entries = (redisStore.get(key) ?? [])
      .filter((e) => e.score >= min && e.score <= max)
      .sort((a, b) => a.score - b.score);
    const offset = opts?.offset ?? 0;
    const limited = opts?.count ? entries.slice(offset, offset + opts.count) : entries.slice(offset);
    return limited.map((e) => e.member);
  }),
  get: vi.fn(async (key: string) => {
    const entry = stringStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      stringStore.delete(key);
      return null;
    }
    return entry.value;
  }),
  set: vi.fn(async (key: string, value: string, opts?: { px?: number }) => {
    stringStore.set(key, {
      value,
      expiresAt: opts?.px ? Date.now() + opts.px : undefined,
    });
    return 'OK';
  }),
  };

  return { redisStore, stringStore, mockRedis };
});

vi.mock('@/lib/queue/redis', () => ({ redis: mockRedis }));

// ── Import after mocks ────────────────────────────────────────────────────────

import { enqueueMonitorJobs, popReadyJobs, pendingJobCount, MONITOR_JOBS_KEY } from '@/lib/monitoring/queue';

beforeEach(() => {
  redisStore.clear();
  stringStore.clear();
  vi.clearAllMocks();
});

const BASE_JOB = {
  analysisId: 'analysis-1',
  url: 'https://example.com/page',
  monitorId: 'mon-1',
  monitorRunId: 'run-1',
  monitorUserId: 'user-1',
  callbackUrl: 'https://app.example.com/api/analyze/callback',
};

describe('enqueueMonitorJobs', () => {
  it('adds jobs to the sorted set', async () => {
    await enqueueMonitorJobs([BASE_JOB], 30_000);
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      MONITOR_JOBS_KEY,
      expect.objectContaining({ member: expect.any(String), score: expect.any(Number) }),
    );
  });

  it('does nothing when jobs array is empty', async () => {
    await enqueueMonitorJobs([], 30_000);
    expect(mockRedis.zadd).not.toHaveBeenCalled();
  });

  it('staggers multiple jobs by originDelayMs on the same origin', async () => {
    const jobs = [
      { ...BASE_JOB, analysisId: 'a1', url: 'https://example.com/page1' },
      { ...BASE_JOB, analysisId: 'a2', url: 'https://example.com/page2' },
    ];
    await enqueueMonitorJobs(jobs, 30_000);
    const entries = redisStore.get(MONITOR_JOBS_KEY) ?? [];
    expect(entries).toHaveLength(2);
    const scores = entries.map((e) => e.score).sort((a, b) => a - b);
    expect(scores[1] - scores[0]).toBeGreaterThanOrEqual(29_000); // ~30s gap
  });

  it('assigns separate schedules for different origins', async () => {
    const jobs = [
      { ...BASE_JOB, analysisId: 'a1', url: 'https://site-a.com/' },
      { ...BASE_JOB, analysisId: 'a2', url: 'https://site-b.com/' },
    ];
    await enqueueMonitorJobs(jobs, 30_000);
    const entries = redisStore.get(MONITOR_JOBS_KEY) ?? [];
    const scores = entries.map((e) => e.score).sort((a, b) => a - b);
    // Different origins should both fire at ~now (no stagger between them)
    expect(scores[1] - scores[0]).toBeLessThan(5_000);
  });
});

describe('popReadyJobs', () => {
  it('returns jobs whose score ≤ now', async () => {
    const pastMs = Date.now() - 1_000;
    redisStore.set(MONITOR_JOBS_KEY, [
      { score: pastMs, member: JSON.stringify({ ...BASE_JOB, scheduledAt: pastMs }) },
    ]);
    const jobs = await popReadyJobs(10);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].analysisId).toBe('analysis-1');
  });

  it('does not return future jobs', async () => {
    const futureMs = Date.now() + 60_000;
    redisStore.set(MONITOR_JOBS_KEY, [
      { score: futureMs, member: JSON.stringify({ ...BASE_JOB, scheduledAt: futureMs }) },
    ]);
    const jobs = await popReadyJobs(10);
    expect(jobs).toHaveLength(0);
  });

  it('removes popped jobs from the sorted set', async () => {
    const pastMs = Date.now() - 1_000;
    const member = JSON.stringify({ ...BASE_JOB, scheduledAt: pastMs });
    redisStore.set(MONITOR_JOBS_KEY, [{ score: pastMs, member }]);
    await popReadyJobs(10);
    expect(mockRedis.zrem).toHaveBeenCalledWith(MONITOR_JOBS_KEY, member);
  });

  it('returns empty array when queue is empty', async () => {
    const jobs = await popReadyJobs(10);
    expect(jobs).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    const pastMs = Date.now() - 1_000;
    redisStore.set(MONITOR_JOBS_KEY, [
      { score: pastMs, member: JSON.stringify({ ...BASE_JOB, analysisId: 'a1', scheduledAt: pastMs }) },
      { score: pastMs, member: JSON.stringify({ ...BASE_JOB, analysisId: 'a2', scheduledAt: pastMs }) },
      { score: pastMs, member: JSON.stringify({ ...BASE_JOB, analysisId: 'a3', scheduledAt: pastMs }) },
    ]);
    const jobs = await popReadyJobs(2);
    expect(jobs.length).toBeLessThanOrEqual(2);
  });
});

describe('pendingJobCount', () => {
  it('returns zero for empty queue', async () => {
    expect(await pendingJobCount()).toBe(0);
  });

  it('returns count of all entries (including future)', async () => {
    redisStore.set(MONITOR_JOBS_KEY, [
      { score: Date.now() - 1_000, member: '{"a":1}' },
      { score: Date.now() + 60_000, member: '{"b":2}' },
    ]);
    expect(await pendingJobCount()).toBe(2);
  });
});
