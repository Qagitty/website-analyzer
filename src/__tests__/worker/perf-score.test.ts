import { describe, it, expect } from 'vitest';
import { computeFetchOnlyScore, buildFetchOnlyAudit } from '../../workers/analyzer/perf-score';
import { FETCH_SCORE_WEIGHTS, SCORE_VERSION, CWV_THRESHOLDS, classify, normalize3tier } from '../../workers/analyzer/thresholds';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const goodInputs = {
  ttfb: 300,
  estimatedLcp: 1800,
  htmlBytes: 40_000,
  renderBlockingCount: 0,
  imageIssueCount: 0,
  totalImages: 5,
  thirdPartyCount: 1,
  testedUrl: 'https://example.com',
  finalUrl: 'https://example.com/',
};

const poorInputs = {
  ttfb: 2500,
  estimatedLcp: 5500,
  htmlBytes: 700_000,
  renderBlockingCount: 7,
  imageIssueCount: 8,
  totalImages: 10,
  thirdPartyCount: 15,
  testedUrl: 'https://slow-site.com',
  finalUrl: 'https://slow-site.com/',
};

// ── thresholds.ts ────────────────────────────────────────────────────────────

describe('CWV_THRESHOLDS', () => {
  it('LCP good ≤2500ms, poor >4000ms', () => {
    expect(CWV_THRESHOLDS.lcp.good).toBe(2500);
    expect(CWV_THRESHOLDS.lcp.poor).toBe(4000);
  });

  it('CLS good ≤0.1, poor >0.25', () => {
    expect(CWV_THRESHOLDS.cls.good).toBe(0.1);
    expect(CWV_THRESHOLDS.cls.poor).toBe(0.25);
  });

  it('TTFB good ≤800ms, poor >1800ms', () => {
    expect(CWV_THRESHOLDS.ttfb.good).toBe(800);
    expect(CWV_THRESHOLDS.ttfb.poor).toBe(1800);
  });

  it('TBT good ≤200ms, poor >600ms', () => {
    expect(CWV_THRESHOLDS.tbt.good).toBe(200);
    expect(CWV_THRESHOLDS.tbt.poor).toBe(600);
  });
});

describe('FETCH_SCORE_WEIGHTS', () => {
  it('weights sum to exactly 1.0', () => {
    const total = Object.values(FETCH_SCORE_WEIGHTS).reduce((s, e) => s + e.weight, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  it('has exactly 6 factors', () => {
    expect(Object.keys(FETCH_SCORE_WEIGHTS)).toHaveLength(6);
  });

  it('TTFB has the largest weight (0.30)', () => {
    expect(FETCH_SCORE_WEIGHTS.ttfb.weight).toBe(0.30);
  });
});

describe('SCORE_VERSION', () => {
  it('equals performance-v2', () => {
    expect(SCORE_VERSION).toBe('performance-v2');
  });
});

describe('classify()', () => {
  it('classifies good TTFB', () => expect(classify('ttfb', 500)).toBe('good'));
  it('classifies needs-improvement TTFB', () => expect(classify('ttfb', 1000)).toBe('needs-improvement'));
  it('classifies poor TTFB', () => expect(classify('ttfb', 2500)).toBe('poor'));
  it('classifies good LCP', () => expect(classify('lcp', 2000)).toBe('good'));
  it('classifies needs-improvement LCP', () => expect(classify('lcp', 3000)).toBe('needs-improvement'));
  it('classifies poor LCP', () => expect(classify('lcp', 5000)).toBe('poor'));
  it('returns unavailable for unknown key', () => expect(classify('xyz', 999)).toBe('unavailable'));
  it('classifies boundary: TTFB exactly at good threshold', () => expect(classify('ttfb', 800)).toBe('good'));
  it('classifies boundary: TTFB just over good threshold', () => expect(classify('ttfb', 801)).toBe('needs-improvement'));
  it('classifies boundary: TTFB exactly at poor threshold', () => expect(classify('ttfb', 1800)).toBe('needs-improvement'));
  it('classifies boundary: TTFB just over poor threshold', () => expect(classify('ttfb', 1801)).toBe('poor'));
});

describe('normalize3tier()', () => {
  it('returns 95 for good values', () => {
    expect(normalize3tier(500, CWV_THRESHOLDS.ttfb)).toBe(95);
  });
  it('returns 65 for needs-improvement values', () => {
    expect(normalize3tier(1000, CWV_THRESHOLDS.ttfb)).toBe(65);
  });
  it('returns 30 for poor values', () => {
    expect(normalize3tier(2500, CWV_THRESHOLDS.ttfb)).toBe(30);
  });
});

// ── computeFetchOnlyScore ────────────────────────────────────────────────────

describe('computeFetchOnlyScore()', () => {
  it('returns a score, scoreVersion, and breakdown', () => {
    const result = computeFetchOnlyScore(goodInputs);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('scoreVersion');
    expect(result).toHaveProperty('breakdown');
  });

  it('scoreVersion matches SCORE_VERSION constant', () => {
    const { scoreVersion } = computeFetchOnlyScore(goodInputs);
    expect(scoreVersion).toBe(SCORE_VERSION);
  });

  it('score is bounded 0–100', () => {
    const good = computeFetchOnlyScore(goodInputs);
    const poor = computeFetchOnlyScore(poorInputs);
    expect(good.score).toBeGreaterThanOrEqual(0);
    expect(good.score).toBeLessThanOrEqual(100);
    expect(poor.score).toBeGreaterThanOrEqual(0);
    expect(poor.score).toBeLessThanOrEqual(100);
  });

  it('good inputs produce a higher score than poor inputs', () => {
    const good = computeFetchOnlyScore(goodInputs);
    const poor = computeFetchOnlyScore(poorInputs);
    expect(good.score).toBeGreaterThan(poor.score);
  });

  it('good inputs produce score ≥80', () => {
    const { score } = computeFetchOnlyScore(goodInputs);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('poor inputs produce score <50', () => {
    const { score } = computeFetchOnlyScore(poorInputs);
    expect(score).toBeLessThan(50);
  });

  it('breakdown has exactly 6 items (one per weight factor)', () => {
    const { breakdown } = computeFetchOnlyScore(goodInputs);
    expect(breakdown).toHaveLength(6);
  });

  it('each breakdown item has required fields', () => {
    const { breakdown } = computeFetchOnlyScore(goodInputs);
    for (const item of breakdown) {
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('weight');
      expect(item).toHaveProperty('normalizedScore');
      expect(item).toHaveProperty('weightedContribution');
      expect(item).toHaveProperty('reason');
      expect(typeof item.weight).toBe('number');
      expect(typeof item.reason).toBe('string');
    }
  });

  it('normalizedScore is a number (not null) for all factors with complete inputs', () => {
    const { breakdown } = computeFetchOnlyScore(goodInputs);
    for (const item of breakdown) {
      expect(item.normalizedScore).not.toBeNull();
      expect(typeof item.normalizedScore).toBe('number');
    }
  });

  it('weightedContribution approximates weight × normalizedScore / 10 for rounding', () => {
    const { breakdown } = computeFetchOnlyScore(goodInputs);
    for (const item of breakdown) {
      if (item.normalizedScore != null && item.weightedContribution != null) {
        const expected = item.normalizedScore * item.weight;
        expect(item.weightedContribution).toBeCloseTo(expected, 0);
      }
    }
  });

  it('score approximates sum of weightedContributions (within ±1 from rounding)', () => {
    const { score, breakdown } = computeFetchOnlyScore(goodInputs);
    const sum = breakdown.reduce((s, b) => s + (b.weightedContribution ?? 0), 0);
    expect(Math.abs(score - sum)).toBeLessThanOrEqual(1);
  });

  it('handles zero images gracefully', () => {
    const input = { ...goodInputs, totalImages: 0, imageIssueCount: 0 };
    const { score, breakdown } = computeFetchOnlyScore(input);
    expect(score).toBeGreaterThanOrEqual(0);
    const imgItem = breakdown.find(b => b.category.toLowerCase().includes('image'));
    expect(imgItem).toBeDefined();
    expect(imgItem?.reason).toContain('No images');
  });

  it('handles zero third-party domains gracefully', () => {
    const input = { ...goodInputs, thirdPartyCount: 0 };
    const { breakdown } = computeFetchOnlyScore(input);
    const tpItem = breakdown.find(b => b.category.toLowerCase().includes('third'));
    expect(tpItem?.normalizedScore).toBe(100);
  });

  it('render-blocking score is 100 when count is 0', () => {
    const input = { ...goodInputs, renderBlockingCount: 0 };
    const { breakdown } = computeFetchOnlyScore(input);
    const rbItem = breakdown.find(b => b.category.toLowerCase().includes('render'));
    expect(rbItem?.normalizedScore).toBe(100);
  });

  it('render-blocking score drops for many blocking resources', () => {
    const few = computeFetchOnlyScore({ ...goodInputs, renderBlockingCount: 2 });
    const many = computeFetchOnlyScore({ ...goodInputs, renderBlockingCount: 7 });
    const fewRb = few.breakdown.find(b => b.category.toLowerCase().includes('render'));
    const manyRb = many.breakdown.find(b => b.category.toLowerCase().includes('render'));
    expect((fewRb?.normalizedScore ?? 0)).toBeGreaterThan((manyRb?.normalizedScore ?? 0));
  });
});

// ── buildFetchOnlyAudit ──────────────────────────────────────────────────────

describe('buildFetchOnlyAudit()', () => {
  const { score, scoreVersion, breakdown } = computeFetchOnlyScore(goodInputs);

  it('returns a complete PerformanceAuditPayload', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit).toHaveProperty('score');
    expect(audit).toHaveProperty('scoreVersion');
    expect(audit).toHaveProperty('measurementMode');
    expect(audit).toHaveProperty('metrics');
    expect(audit).toHaveProperty('scoreBreakdown');
    expect(audit).toHaveProperty('resources');
    expect(audit).toHaveProperty('warnings');
  });

  it('measurementMode is fetch-only', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.measurementMode).toBe('fetch-only');
  });

  it('scoreVersion propagates correctly', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.scoreVersion).toBe(SCORE_VERSION);
  });

  it('TTFB metric is measured with high confidence', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.metrics.ttfb.isMeasured).toBe(true);
    expect(audit.metrics.ttfb.confidence).toBe('high');
    expect(audit.metrics.ttfb.source).toBe('fetch-timing');
    expect(audit.metrics.ttfb.value).toBe(goodInputs.ttfb);
  });

  it('LCP metric is estimated with low confidence', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.metrics.lcp.isMeasured).toBe(false);
    expect(audit.metrics.lcp.confidence).toBe('low');
    expect(audit.metrics.lcp.source).toBe('estimated');
    expect(audit.metrics.lcp.status).not.toBe('unavailable');
  });

  it('CLS metric is unavailable', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.metrics.cls.status).toBe('unavailable');
    expect(audit.metrics.cls.value).toBeNull();
    expect(audit.metrics.cls.isMeasured).toBe(false);
    expect(audit.metrics.cls.confidence).toBe('none');
  });

  it('TBT metric is unavailable', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.metrics.tbt.status).toBe('unavailable');
    expect(audit.metrics.tbt.value).toBeNull();
  });

  it('FCP metric is unavailable', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.metrics.fcp.status).toBe('unavailable');
    expect(audit.metrics.fcp.value).toBeNull();
  });

  it('INP metric is unavailable', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.metrics.inp.status).toBe('unavailable');
    expect(audit.metrics.inp.value).toBeNull();
  });

  it('scoreBreakdown matches the provided breakdown', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.scoreBreakdown).toEqual(breakdown);
  });

  it('TTFB metric classifies correctly for good TTFB', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.metrics.ttfb.status).toBe('good');
  });

  it('TTFB metric classifies correctly for poor TTFB', () => {
    const { score: s, scoreVersion: sv, breakdown: bd } = computeFetchOnlyScore(poorInputs);
    const audit = buildFetchOnlyAudit(poorInputs, s, sv, bd);
    expect(audit.metrics.ttfb.status).toBe('poor');
  });

  it('each metric has a threshold object (where applicable)', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.metrics.ttfb.threshold).not.toBeNull();
    expect(audit.metrics.lcp.threshold).not.toBeNull();
    expect(audit.metrics.cls.threshold).not.toBeNull();
  });

  it('includes warnings about unmeasured metrics', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.warnings.length).toBeGreaterThan(0);
    expect(audit.warnings.some(w => w.toLowerCase().includes('lcp'))).toBe(true);
  });

  it('testedUrl and finalUrl are set correctly', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.testedUrl).toBe(goodInputs.testedUrl);
    expect(audit.finalUrl).toBe(goodInputs.finalUrl);
  });

  it('resources.transferredBytes equals htmlBytes', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.resources.transferredBytes).toBe(goodInputs.htmlBytes);
  });

  it('JS/CSS/image/font breakdown bytes are null (fetch-only cannot measure them)', () => {
    const audit = buildFetchOnlyAudit(goodInputs, score, scoreVersion, breakdown);
    expect(audit.resources.jsBytes).toBeNull();
    expect(audit.resources.cssBytes).toBeNull();
    expect(audit.resources.imageBytes).toBeNull();
    expect(audit.resources.fontBytes).toBeNull();
  });

  it('includes TTFB samples description when ttfbSamples provided', () => {
    const inputWithSamples = { ...goodInputs, ttfbSamples: [280, 300, 320] };
    const { score: s, scoreVersion: sv, breakdown: bd } = computeFetchOnlyScore(inputWithSamples);
    const audit = buildFetchOnlyAudit(inputWithSamples, s, sv, bd);
    expect(audit.metrics.ttfb.description).toContain('3');
  });
});
