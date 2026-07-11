import { describe, it, expect } from 'vitest';
import {
  calculateBackoffMs,
  calculateBackoffWithUpstream,
  retryScheduledFor,
  BACKOFF_EXPECTED_MS,
} from '@/lib/queue/backoff';

describe('calculateBackoffMs', () => {
  it('returns ~30s for attempt 1', () => {
    const ms = calculateBackoffMs(1, () => 0); // no jitter
    expect(ms).toBe(30_000);
  });

  it('doubles each attempt up to cap', () => {
    const a1 = calculateBackoffMs(1, () => 0);
    const a2 = calculateBackoffMs(2, () => 0);
    const a3 = calculateBackoffMs(3, () => 0);
    expect(a2).toBe(a1 * 2);
    expect(a3).toBe(a1 * 4);
  });

  it('caps at 30 minutes', () => {
    const ms = calculateBackoffMs(100, () => 0);
    expect(ms).toBe(30 * 60_000);
  });

  it('applies jitter within ±20%', () => {
    const base = calculateBackoffMs(1, () => 0);
    const withJitter = calculateBackoffMs(1, () => 1);
    expect(withJitter).toBeGreaterThan(base);
    expect(withJitter).toBeLessThanOrEqual(base * 1.21); // 20% jitter
  });
});

describe('calculateBackoffWithUpstream', () => {
  it('uses natural backoff when upstream is less', () => {
    const natural = calculateBackoffMs(1, () => 0);
    const result  = calculateBackoffWithUpstream(1, 5, () => 0); // 5s upstream
    expect(result).toBe(natural);
  });

  it('uses upstream when it is larger than natural backoff', () => {
    const result = calculateBackoffWithUpstream(1, 120, () => 0); // 120s upstream
    expect(result).toBe(120_000);
  });

  it('clamps upstream to 2 hours max', () => {
    const result = calculateBackoffWithUpstream(1, 86_400, () => 0); // 1 day upstream
    expect(result).toBe(2 * 60 * 60_000);
  });

  it('parses HTTP-date string', () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    const result = calculateBackoffWithUpstream(1, future, () => 0);
    expect(result).toBeGreaterThan(55_000);
    expect(result).toBeLessThan(65_000);
  });

  it('handles null upstream gracefully', () => {
    const natural = calculateBackoffMs(1, () => 0);
    const result  = calculateBackoffWithUpstream(1, null, () => 0);
    expect(result).toBe(natural);
  });
});

describe('retryScheduledFor', () => {
  it('returns an ISO date string in the future', () => {
    const iso = retryScheduledFor(1, null, () => 0);
    expect(new Date(iso).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('BACKOFF_EXPECTED_MS', () => {
  it('has expected values', () => {
    expect(BACKOFF_EXPECTED_MS.attempt1).toBe(30_000);
    expect(BACKOFF_EXPECTED_MS.max).toBe(30 * 60_000);
  });
});
