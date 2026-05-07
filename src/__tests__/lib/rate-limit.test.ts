import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @upstash/redis — must use vi.hoisted so the vars are available when the mock factory runs
const { mockIncr, mockExpire } = vi.hoisted(() => ({
  mockIncr: vi.fn(),
  mockExpire: vi.fn(),
}));

vi.mock('@upstash/redis', () => {
  return {
    Redis: class MockRedis {
      incr = mockIncr;
      expire = mockExpire;
      constructor(_opts: unknown) {}
    },
  };
});

import { checkRateLimit } from '@/lib/api-keys/rate-limit';

beforeEach(() => {
  mockIncr.mockReset();
  mockExpire.mockReset();
  mockExpire.mockResolvedValue(1);
});

describe('checkRateLimit', () => {
  it('allows request when under limit', async () => {
    mockIncr.mockResolvedValue(5);
    const result = await checkRateLimit('key-abc', 'pro');
    expect(result.allowed).toBe(true);
  });

  it('allows request exactly at limit (count === limit)', async () => {
    // count <= limit means count===limit is still allowed
    mockIncr.mockResolvedValue(10);
    const result = await checkRateLimit('key-abc', 'free');
    expect(result.allowed).toBe(true);
  });

  it('blocks request when over limit', async () => {
    mockIncr.mockResolvedValue(15);
    const result = await checkRateLimit('key-abc', 'free');
    expect(result.allowed).toBe(false);
  });

  it('returns correct remaining count', async () => {
    mockIncr.mockResolvedValue(3);
    const result = await checkRateLimit('key-abc', 'free');
    // free limit = 10, used = 3, remaining = 7
    expect(result.remaining).toBe(7);
  });

  it('remaining is 0 when at or over limit', async () => {
    mockIncr.mockResolvedValue(12);
    const result = await checkRateLimit('key-abc', 'free');
    expect(result.remaining).toBe(0);
  });

  it('free plan limit is 10', async () => {
    mockIncr.mockResolvedValue(1);
    const result = await checkRateLimit('key-abc', 'free');
    expect(result.limit).toBe(10);
  });

  it('pro plan limit is 100', async () => {
    mockIncr.mockResolvedValue(1);
    const result = await checkRateLimit('key-abc', 'pro');
    expect(result.limit).toBe(100);
  });

  it('agency plan limit is 1000', async () => {
    mockIncr.mockResolvedValue(1);
    const result = await checkRateLimit('key-abc', 'agency');
    expect(result.limit).toBe(1000);
  });

  it('unknown plan defaults to free (10)', async () => {
    mockIncr.mockResolvedValue(1);
    const result = await checkRateLimit('key-abc', 'enterprise');
    expect(result.limit).toBe(10);
  });

  it('calls expire with 90000 on first request (count===1)', async () => {
    mockIncr.mockResolvedValue(1);
    await checkRateLimit('key-abc', 'free');
    expect(mockExpire).toHaveBeenCalledOnce();
    expect(mockExpire).toHaveBeenCalledWith(expect.any(String), 90000);
  });

  it('does NOT call expire on subsequent requests', async () => {
    mockIncr.mockResolvedValue(2);
    await checkRateLimit('key-abc', 'free');
    expect(mockExpire).not.toHaveBeenCalled();
  });
});
