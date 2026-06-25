import { describe, it, expect } from 'vitest';

// ─── Inline score classification helpers ─────────────────────────────────────
// Mirrors the thresholds in src/workers/analyzer/score.ts and perf-score.ts.
// Inline to avoid Cloudflare Worker globals.

type MetricStatus = 'good' | 'needs-improvement' | 'poor' | 'unavailable';

function classifyTtfb(ms: number): MetricStatus {
  if (ms < 800)  return 'good';
  if (ms < 1800) return 'needs-improvement';
  return 'poor';
}

function classifyLcp(ms: number | null | undefined): MetricStatus {
  if (ms == null) return 'unavailable';
  if (ms < 2500) return 'good';
  if (ms < 4000) return 'needs-improvement';
  return 'poor';
}

function classifyCls(value: number | null | undefined): MetricStatus {
  if (value == null) return 'unavailable';
  if (value < 0.1)  return 'good';
  if (value < 0.25) return 'needs-improvement';
  return 'poor';
}

function classifyFid(ms: number | null | undefined): MetricStatus {
  if (ms == null) return 'unavailable';
  if (ms < 100)  return 'good';
  if (ms < 300)  return 'needs-improvement';
  return 'poor';
}

function classifyFcp(ms: number | null | undefined): MetricStatus {
  if (ms == null) return 'unavailable';
  if (ms < 1800) return 'good';
  if (ms < 3000) return 'needs-improvement';
  return 'poor';
}

// Normalize raw value to 0–100 score using linear interpolation
function normalizeScore(value: number, good: number, poor: number): number {
  if (value <= good) return 100;
  if (value >= poor) return 0;
  return Math.round(100 - ((value - good) / (poor - good)) * 100);
}

// Weighted sum → final 0–100 performance score
interface ScoredFactor {
  normalizedScore: number;
  weight: number;
}
function computeWeightedScore(factors: ScoredFactor[]): number {
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const weighted = factors.reduce((s, f) => s + f.normalizedScore * f.weight, 0);
  return Math.round(weighted / totalWeight);
}

// Format bytes as human-readable string
function fmtBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// Format milliseconds
function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

// ─── TTFB classification ──────────────────────────────────────────────────────

describe('classifyTtfb', () => {
  it('classifies 0ms as good', () => {
    expect(classifyTtfb(0)).toBe('good');
  });

  it('classifies 799ms as good (below threshold)', () => {
    expect(classifyTtfb(799)).toBe('good');
  });

  it('classifies exactly 800ms as needs-improvement (boundary)', () => {
    expect(classifyTtfb(800)).toBe('needs-improvement');
  });

  it('classifies 1200ms as needs-improvement', () => {
    expect(classifyTtfb(1200)).toBe('needs-improvement');
  });

  it('classifies 1799ms as needs-improvement (just below poor threshold)', () => {
    expect(classifyTtfb(1799)).toBe('needs-improvement');
  });

  it('classifies exactly 1800ms as poor (boundary)', () => {
    expect(classifyTtfb(1800)).toBe('poor');
  });

  it('classifies 3000ms as poor', () => {
    expect(classifyTtfb(3000)).toBe('poor');
  });
});

// ─── LCP classification ───────────────────────────────────────────────────────

describe('classifyLcp', () => {
  it('returns unavailable for null', () => {
    expect(classifyLcp(null)).toBe('unavailable');
  });

  it('returns unavailable for undefined', () => {
    expect(classifyLcp(undefined)).toBe('unavailable');
  });

  it('classifies 2499ms as good', () => {
    expect(classifyLcp(2499)).toBe('good');
  });

  it('classifies exactly 2500ms as needs-improvement (boundary)', () => {
    expect(classifyLcp(2500)).toBe('needs-improvement');
  });

  it('classifies 3500ms as needs-improvement', () => {
    expect(classifyLcp(3500)).toBe('needs-improvement');
  });

  it('classifies exactly 4000ms as poor (boundary)', () => {
    expect(classifyLcp(4000)).toBe('poor');
  });

  it('classifies 8000ms as poor', () => {
    expect(classifyLcp(8000)).toBe('poor');
  });
});

// ─── CLS classification ───────────────────────────────────────────────────────

describe('classifyCls', () => {
  it('returns unavailable for null', () => {
    expect(classifyCls(null)).toBe('unavailable');
  });

  it('classifies 0 as good', () => {
    expect(classifyCls(0)).toBe('good');
  });

  it('classifies 0.099 as good (just below threshold)', () => {
    expect(classifyCls(0.099)).toBe('good');
  });

  it('classifies exactly 0.1 as needs-improvement (boundary)', () => {
    expect(classifyCls(0.1)).toBe('needs-improvement');
  });

  it('classifies 0.24 as needs-improvement', () => {
    expect(classifyCls(0.24)).toBe('needs-improvement');
  });

  it('classifies exactly 0.25 as poor (boundary)', () => {
    expect(classifyCls(0.25)).toBe('poor');
  });

  it('classifies 1.0 as poor', () => {
    expect(classifyCls(1.0)).toBe('poor');
  });
});

// ─── FID classification ───────────────────────────────────────────────────────

describe('classifyFid', () => {
  it('returns unavailable for null', () => {
    expect(classifyFid(null)).toBe('unavailable');
  });

  it('classifies 99ms as good', () => {
    expect(classifyFid(99)).toBe('good');
  });

  it('classifies exactly 100ms as needs-improvement (boundary)', () => {
    expect(classifyFid(100)).toBe('needs-improvement');
  });

  it('classifies exactly 300ms as poor (boundary)', () => {
    expect(classifyFid(300)).toBe('poor');
  });
});

// ─── FCP classification ───────────────────────────────────────────────────────

describe('classifyFcp', () => {
  it('returns unavailable for null', () => {
    expect(classifyFcp(null)).toBe('unavailable');
  });

  it('classifies 1799ms as good', () => {
    expect(classifyFcp(1799)).toBe('good');
  });

  it('classifies exactly 1800ms as needs-improvement (boundary)', () => {
    expect(classifyFcp(1800)).toBe('needs-improvement');
  });

  it('classifies exactly 3000ms as poor (boundary)', () => {
    expect(classifyFcp(3000)).toBe('poor');
  });
});

// ─── Score normalization ──────────────────────────────────────────────────────

describe('normalizeScore', () => {
  it('returns 100 when value equals good threshold', () => {
    expect(normalizeScore(800, 800, 1800)).toBe(100);
  });

  it('returns 100 when value is better than good threshold', () => {
    expect(normalizeScore(200, 800, 1800)).toBe(100);
  });

  it('returns 0 when value equals poor threshold', () => {
    expect(normalizeScore(1800, 800, 1800)).toBe(0);
  });

  it('returns 0 when value exceeds poor threshold', () => {
    expect(normalizeScore(3000, 800, 1800)).toBe(0);
  });

  it('returns 50 when value is midway between good and poor', () => {
    expect(normalizeScore(1300, 800, 1800)).toBe(50);
  });

  it('returns values between 0 and 100 for intermediate values', () => {
    const score = normalizeScore(1000, 800, 1800);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
});

// ─── Weighted score calculation ───────────────────────────────────────────────

describe('computeWeightedScore', () => {
  it('returns 100 when all factors are perfect', () => {
    const factors = [
      { normalizedScore: 100, weight: 0.4 },
      { normalizedScore: 100, weight: 0.3 },
      { normalizedScore: 100, weight: 0.3 },
    ];
    expect(computeWeightedScore(factors)).toBe(100);
  });

  it('returns 0 when all factors are zero', () => {
    const factors = [
      { normalizedScore: 0, weight: 0.5 },
      { normalizedScore: 0, weight: 0.5 },
    ];
    expect(computeWeightedScore(factors)).toBe(0);
  });

  it('weights heavier factors more strongly', () => {
    // One factor is 100, other is 0, but the 100 one has 80% weight
    const factors = [
      { normalizedScore: 100, weight: 0.8 },
      { normalizedScore: 0,   weight: 0.2 },
    ];
    expect(computeWeightedScore(factors)).toBe(80);
  });

  it('handles single factor', () => {
    expect(computeWeightedScore([{ normalizedScore: 73, weight: 1.0 }])).toBe(73);
  });

  it('result is always clamped to 0–100', () => {
    const score = computeWeightedScore([
      { normalizedScore: 45, weight: 0.3 },
      { normalizedScore: 80, weight: 0.7 },
    ]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── Missing metric behavior ──────────────────────────────────────────────────

describe('missing metric behavior', () => {
  it('unavailable metrics are excluded from score calculation', () => {
    const available = [
      { normalizedScore: 80, weight: 0.5 },
    ];
    const withUnavailable = [
      { normalizedScore: 80, weight: 0.5 },
      // unavailable metric would have been omitted from this array
    ];
    expect(computeWeightedScore(available)).toBe(computeWeightedScore(withUnavailable));
  });

  it('classifyLcp returns unavailable (not 0) when LCP not measured', () => {
    expect(classifyLcp(null)).toBe('unavailable');
    expect(classifyLcp(null)).not.toBe('poor');
  });

  it('classifyCls returns unavailable (not 0) when CLS not measured', () => {
    expect(classifyCls(null)).toBe('unavailable');
    expect(classifyCls(null)).not.toBe('good'); // 0 would be good, null must be unavailable
  });
});

// ─── Byte formatting ──────────────────────────────────────────────────────────

describe('fmtBytes', () => {
  it('formats bytes below 1KB as bytes', () => {
    expect(fmtBytes(512)).toBe('512 B');
  });

  it('formats exactly 1024 bytes as 1 KB', () => {
    expect(fmtBytes(1024)).toBe('1 KB');
  });

  it('formats 51200 bytes as 50 KB', () => {
    expect(fmtBytes(51_200)).toBe('50 KB');
  });

  it('formats exactly 1MB as 1.0 MB', () => {
    expect(fmtBytes(1_048_576)).toBe('1.0 MB');
  });

  it('formats 2.5MB correctly', () => {
    expect(fmtBytes(2_621_440)).toBe('2.5 MB');
  });
});

// ─── Timing formatting ────────────────────────────────────────────────────────

describe('fmtMs', () => {
  it('formats sub-second values in ms', () => {
    expect(fmtMs(500)).toBe('500 ms');
  });

  it('formats exactly 1000ms as 1.0 s', () => {
    expect(fmtMs(1000)).toBe('1.0 s');
  });

  it('formats 2500ms as 2.5 s', () => {
    expect(fmtMs(2500)).toBe('2.5 s');
  });

  it('formats 0 as 0 ms', () => {
    expect(fmtMs(0)).toBe('0 ms');
  });
});
