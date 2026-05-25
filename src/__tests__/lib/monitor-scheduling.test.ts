import { describe, it, expect } from 'vitest';

// ── Monitor scheduling — pure logic tests ────────────────────────────────────
// Tests cover: next_run_at calculation, score-drop detection,
// monitor eligibility for cron, and free-plan limit guard.

type MonitorFrequency = 'daily' | 'weekly';

// ── next_run_at calculation ───────────────────────────────────────────────────

function calcNextRunAt(now: Date, frequency: MonitorFrequency): Date {
  const next = new Date(now);
  if (frequency === 'daily') {
    next.setHours(next.getHours() + 24);
  } else {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

describe('calcNextRunAt()', () => {
  const base = new Date('2026-05-14T10:00:00Z');

  it('advances 24 hours for daily frequency', () => {
    const next = calcNextRunAt(base, 'daily');
    const diffMs = next.getTime() - base.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  it('advances 7 days for weekly frequency', () => {
    const next = calcNextRunAt(base, 'weekly');
    const diffMs = next.getTime() - base.getTime();
    expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('does not mutate the input date', () => {
    const original = new Date(base);
    calcNextRunAt(base, 'daily');
    expect(base.getTime()).toBe(original.getTime());
  });
});

// ── Is monitor due? ───────────────────────────────────────────────────────────

function isMonitorDue(nextRunAt: Date, now: Date): boolean {
  return now.getTime() >= nextRunAt.getTime();
}

describe('isMonitorDue()', () => {
  it('returns true when now is past next_run_at', () => {
    const nextRun = new Date('2026-05-14T09:00:00Z');
    const now = new Date('2026-05-14T10:00:00Z');
    expect(isMonitorDue(nextRun, now)).toBe(true);
  });

  it('returns true when now equals next_run_at exactly', () => {
    const t = new Date('2026-05-14T10:00:00Z');
    expect(isMonitorDue(t, t)).toBe(true);
  });

  it('returns false when now is before next_run_at', () => {
    const nextRun = new Date('2026-05-14T11:00:00Z');
    const now = new Date('2026-05-14T10:00:00Z');
    expect(isMonitorDue(nextRun, now)).toBe(false);
  });
});

// ── Score drop detection ──────────────────────────────────────────────────────

interface ScoreSnapshot {
  performance: number;
  accessibility: number;
  seo: number;
}

function hasScoreDrop(
  previous: ScoreSnapshot,
  current: ScoreSnapshot,
  threshold: number
): boolean {
  return (
    previous.performance - current.performance >= threshold ||
    previous.accessibility - current.accessibility >= threshold ||
    previous.seo - current.seo >= threshold
  );
}

describe('hasScoreDrop()', () => {
  it('detects performance drop at threshold', () => {
    const prev = { performance: 90, accessibility: 80, seo: 85 };
    const curr = { performance: 80, accessibility: 80, seo: 85 };
    expect(hasScoreDrop(prev, curr, 10)).toBe(true);
  });

  it('detects accessibility drop', () => {
    const prev = { performance: 90, accessibility: 80, seo: 85 };
    const curr = { performance: 90, accessibility: 65, seo: 85 };
    expect(hasScoreDrop(prev, curr, 10)).toBe(true);
  });

  it('detects SEO drop', () => {
    const prev = { performance: 90, accessibility: 80, seo: 85 };
    const curr = { performance: 90, accessibility: 80, seo: 74 };
    expect(hasScoreDrop(prev, curr, 10)).toBe(true);
  });

  it('does not trigger when drop is below threshold', () => {
    const prev = { performance: 90, accessibility: 80, seo: 85 };
    const curr = { performance: 85, accessibility: 78, seo: 83 };
    expect(hasScoreDrop(prev, curr, 10)).toBe(false);
  });

  it('does not trigger on score improvement', () => {
    const prev = { performance: 70, accessibility: 70, seo: 70 };
    const curr = { performance: 90, accessibility: 90, seo: 90 };
    expect(hasScoreDrop(prev, curr, 10)).toBe(false);
  });

  it('triggers when exactly at threshold', () => {
    const prev = { performance: 80, accessibility: 80, seo: 80 };
    const curr = { performance: 70, accessibility: 80, seo: 80 };
    expect(hasScoreDrop(prev, curr, 10)).toBe(true);
  });

  it('does not trigger when one point below threshold', () => {
    const prev = { performance: 80, accessibility: 80, seo: 80 };
    const curr = { performance: 71, accessibility: 80, seo: 80 };
    expect(hasScoreDrop(prev, curr, 10)).toBe(false);
  });
});

// ── Free plan monitor limit ───────────────────────────────────────────────────

type Plan = 'free' | 'pro' | 'agency';

function canCreateMonitor(plan: Plan, existingCount: number): boolean {
  if (plan === 'free' && existingCount >= 3) return false;
  return true;
}

describe('canCreateMonitor()', () => {
  it('allows free user to create 1st monitor', () => {
    expect(canCreateMonitor('free', 0)).toBe(true);
  });

  it('allows free user to create 3rd monitor', () => {
    expect(canCreateMonitor('free', 2)).toBe(true);
  });

  it('blocks free user from creating 4th monitor', () => {
    expect(canCreateMonitor('free', 3)).toBe(false);
  });

  it('blocks free user beyond 3 monitors', () => {
    expect(canCreateMonitor('free', 5)).toBe(false);
  });

  it('allows pro user unlimited monitors', () => {
    expect(canCreateMonitor('pro', 100)).toBe(true);
  });

  it('allows agency user unlimited monitors', () => {
    expect(canCreateMonitor('agency', 500)).toBe(true);
  });
});

// ── Monitor eligibility for cron run ─────────────────────────────────────────

interface Monitor {
  id: string;
  is_active: boolean;
  next_run_at: string;
  user_credits: number;
}

function isEligibleForCronRun(monitor: Monitor, now: Date): boolean {
  if (!monitor.is_active) return false;
  if (monitor.user_credits <= 0) return false;
  return isMonitorDue(new Date(monitor.next_run_at), now);
}

describe('isEligibleForCronRun()', () => {
  const now = new Date('2026-05-14T10:00:00Z');

  it('returns true for active, due monitor with credits', () => {
    expect(isEligibleForCronRun(
      { id: '1', is_active: true, next_run_at: '2026-05-14T09:00:00Z', user_credits: 5 },
      now
    )).toBe(true);
  });

  it('returns false when paused', () => {
    expect(isEligibleForCronRun(
      { id: '1', is_active: false, next_run_at: '2026-05-14T09:00:00Z', user_credits: 5 },
      now
    )).toBe(false);
  });

  it('returns false when user has 0 credits', () => {
    expect(isEligibleForCronRun(
      { id: '1', is_active: true, next_run_at: '2026-05-14T09:00:00Z', user_credits: 0 },
      now
    )).toBe(false);
  });

  it('returns false when not yet due', () => {
    expect(isEligibleForCronRun(
      { id: '1', is_active: true, next_run_at: '2026-05-14T11:00:00Z', user_credits: 5 },
      now
    )).toBe(false);
  });
});
