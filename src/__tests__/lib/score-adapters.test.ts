import { describe, it, expect } from 'vitest';
import {
  scoreLabel,
  adaptLegacyScore,
  checkScoreComparability,
  performanceAuditToCategoryScore,
  SCORE_LABEL_COLORS,
  isNotMeasured,
} from '@/workers/analyzer/score-adapters';
import type { CategoryScoreResult } from '@/workers/analyzer/scoring-types';

// ── scoreLabel ────────────────────────────────────────────────────────────────

describe('scoreLabel()', () => {
  it('returns "Not measured" for null', () => {
    expect(scoreLabel(null)).toBe('Not measured');
  });

  it('returns "Excellent" for 90', () => {
    expect(scoreLabel(90)).toBe('Excellent');
  });

  it('returns "Excellent" for 100', () => {
    expect(scoreLabel(100)).toBe('Excellent');
  });

  it('returns "Good" for 75', () => {
    expect(scoreLabel(75)).toBe('Good');
  });

  it('returns "Good" for 89', () => {
    expect(scoreLabel(89)).toBe('Good');
  });

  it('returns "Needs improvement" for 50', () => {
    expect(scoreLabel(50)).toBe('Needs improvement');
  });

  it('returns "Needs improvement" for 74', () => {
    expect(scoreLabel(74)).toBe('Needs improvement');
  });

  it('returns "Poor" for 25', () => {
    expect(scoreLabel(25)).toBe('Poor');
  });

  it('returns "Poor" for 49', () => {
    expect(scoreLabel(49)).toBe('Poor');
  });

  it('returns "Critical" for 24', () => {
    expect(scoreLabel(24)).toBe('Critical');
  });

  it('returns "Critical" for 0', () => {
    expect(scoreLabel(0)).toBe('Critical');
  });

  it('covers all spec-defined thresholds exactly (no off-by-one)', () => {
    // boundary between Excellent and Good
    expect(scoreLabel(90)).toBe('Excellent');
    expect(scoreLabel(89)).toBe('Good');
    // boundary between Good and Needs improvement
    expect(scoreLabel(75)).toBe('Good');
    expect(scoreLabel(74)).toBe('Needs improvement');
    // boundary between Needs improvement and Poor
    expect(scoreLabel(50)).toBe('Needs improvement');
    expect(scoreLabel(49)).toBe('Poor');
    // boundary between Poor and Critical
    expect(scoreLabel(25)).toBe('Poor');
    expect(scoreLabel(24)).toBe('Critical');
  });
});

// ── SCORE_LABEL_COLORS ────────────────────────────────────────────────────────

describe('SCORE_LABEL_COLORS', () => {
  it('has a colour definition for every ScoreLabel variant', () => {
    const labels = ['Excellent', 'Good', 'Needs improvement', 'Poor', 'Critical', 'Not measured'];
    for (const label of labels) {
      const colours = SCORE_LABEL_COLORS[label as keyof typeof SCORE_LABEL_COLORS];
      expect(colours).toBeDefined();
      expect(colours.text).toBeTruthy();
      expect(colours.bg).toBeTruthy();
      expect(colours.border).toBeTruthy();
    }
  });
});

// ── isNotMeasured ─────────────────────────────────────────────────────────────

describe('isNotMeasured()', () => {
  it('returns true for null', () => {
    expect(isNotMeasured(null)).toBe(true);
  });

  it('returns false for 0 (audit ran, all checks failed)', () => {
    expect(isNotMeasured(0)).toBe(false);
  });

  it('returns false for 72', () => {
    expect(isNotMeasured(72)).toBe(false);
  });
});

// ── adaptLegacyScore ──────────────────────────────────────────────────────────

describe('adaptLegacyScore()', () => {
  it('wraps a plain integer score in a CategoryScoreResult', () => {
    const result = adaptLegacyScore('seo', 78);
    expect(result.categoryId).toBe('seo');
    expect(result.score).toBe(78);
    expect(result.scoreVersion).toContain('legacy');
  });

  it('passes null score through unchanged', () => {
    const result = adaptLegacyScore('accessibility', null);
    expect(result.score).toBeNull();
  });

  it('clamps an out-of-range score (> 100)', () => {
    const result = adaptLegacyScore('performance', 120);
    expect(result.score).toBe(100);
  });

  it('clamps a negative score to 0', () => {
    const result = adaptLegacyScore('performance', -5);
    expect(result.score).toBe(0);
  });

  it('marks confidence as low (no per-check data available)', () => {
    const result = adaptLegacyScore('seo', 60);
    expect(result.confidence).toBe('low');
  });

  it('returns an empty checks array', () => {
    const result = adaptLegacyScore('accessibility', 55);
    expect(result.checks).toHaveLength(0);
  });

  it('includes at least one limitation explaining the legacy origin', () => {
    const result = adaptLegacyScore('seo', 80);
    expect(result.limitations.length).toBeGreaterThan(0);
    expect(result.limitations.some(l => l.toLowerCase().includes('legacy') || l.toLowerCase().includes('before'))).toBe(true);
  });
});

// ── checkScoreComparability ───────────────────────────────────────────────────

function makeCategoryResult(overrides: Partial<CategoryScoreResult> = {}): CategoryScoreResult {
  return {
    categoryId: 'seo',
    score: 80,
    scoreVersion: 'seo-v1',
    rawPoints: 80,
    availablePoints: 100,
    maximumPoints: 100,
    coverage: {
      supportedChecks: 10,
      applicableChecks: 10,
      executedChecks: 10,
      passedChecks: 8,
      failedChecks: 2,
      warningChecks: 0,
      manualReviewChecks: 0,
      unavailableChecks: 0,
      notExecutedChecks: 0,
      percentage: 100,
    },
    confidence: 'high',
    checks: [],
    limitations: [],
    ...overrides,
  };
}

describe('checkScoreComparability()', () => {
  it('returns comparable=true when results are equivalent', () => {
    const a = makeCategoryResult();
    const b = makeCategoryResult();
    const result = checkScoreComparability(a, b);
    expect(result.comparable).toBe(true);
    expect(result.differences).toHaveLength(0);
    expect(result.warning).toBeUndefined();
  });

  it('flags mismatched categoryIds as not comparable', () => {
    const a = makeCategoryResult({ categoryId: 'seo' });
    const b = makeCategoryResult({ categoryId: 'accessibility' });
    const result = checkScoreComparability(a, b);
    expect(result.comparable).toBe(false);
    expect(result.differences.some(d => d.includes('ategory'))).toBe(true);
  });

  it('flags mismatched scoreVersions as not comparable', () => {
    const a = makeCategoryResult({ scoreVersion: 'seo-v1' });
    const b = makeCategoryResult({ scoreVersion: 'seo-v2' });
    const result = checkScoreComparability(a, b);
    expect(result.comparable).toBe(false);
    expect(result.differences.some(d => d.includes('version'))).toBe(true);
  });

  it('flags a coverage difference > 20pp as not comparable', () => {
    const a = makeCategoryResult({ coverage: { ...makeCategoryResult().coverage, percentage: 100 } });
    const b = makeCategoryResult({ coverage: { ...makeCategoryResult().coverage, percentage: 60 } });
    const result = checkScoreComparability(a, b);
    expect(result.comparable).toBe(false);
    expect(result.differences.some(d => d.includes('overage'))).toBe(true);
  });

  it('flags null scores as not comparable', () => {
    const a = makeCategoryResult({ score: null });
    const b = makeCategoryResult({ score: 80 });
    const result = checkScoreComparability(a, b);
    expect(result.comparable).toBe(false);
  });

  it('returns a warning string when not comparable', () => {
    const a = makeCategoryResult({ scoreVersion: 'seo-v1' });
    const b = makeCategoryResult({ scoreVersion: 'seo-v2' });
    const result = checkScoreComparability(a, b);
    expect(typeof result.warning).toBe('string');
    expect(result.warning!.length).toBeGreaterThan(0);
  });
});

// ── performanceAuditToCategoryScore ──────────────────────────────────────────

describe('performanceAuditToCategoryScore()', () => {
  const sampleBreakdown = [
    { category: 'ttfb',           weight: 0.30, normalizedScore: 95, weightedContribution: 28.5, reason: 'TTFB 320ms — fast' },
    { category: 'estimatedLcp',   weight: 0.20, normalizedScore: 65, weightedContribution: 13.0, reason: 'LCP ~2.4s — fair' },
    { category: 'htmlSize',       weight: 0.15, normalizedScore: 30, weightedContribution: 4.5,  reason: 'HTML 950KB — large' },
    { category: 'renderBlocking', weight: 0.20, normalizedScore: null, weightedContribution: null, reason: 'Could not measure' },
    { category: 'imageOpt',       weight: 0.10, normalizedScore: 95, weightedContribution: 9.5,  reason: 'No image issues' },
    { category: 'thirdParty',     weight: 0.05, normalizedScore: 65, weightedContribution: 3.25, reason: '3 domains' },
  ];

  it('creates a CategoryScoreResult with categoryId=performance', () => {
    const result = performanceAuditToCategoryScore(78, 'performance-v2', sampleBreakdown, []);
    expect(result.categoryId).toBe('performance');
    expect(result.scoreVersion).toBe('performance-v2');
  });

  it('passes the score through unchanged', () => {
    const result = performanceAuditToCategoryScore(78, 'performance-v2', sampleBreakdown, []);
    expect(result.score).toBe(78);
  });

  it('creates one check per breakdown entry', () => {
    const result = performanceAuditToCategoryScore(78, 'performance-v2', sampleBreakdown, []);
    expect(result.checks).toHaveLength(sampleBreakdown.length);
  });

  it('marks checks with null normalizedScore as "unavailable"', () => {
    const result = performanceAuditToCategoryScore(78, 'performance-v2', sampleBreakdown, []);
    const unavailableCheck = result.checks.find(c => c.checkId === 'perf-renderBlocking');
    expect(unavailableCheck?.status).toBe('unavailable');
  });

  it('reflects unavailable checks in coverage', () => {
    const result = performanceAuditToCategoryScore(78, 'performance-v2', sampleBreakdown, []);
    expect(result.coverage.unavailableChecks).toBe(1);
  });

  it('handles a null score (audit failed)', () => {
    const result = performanceAuditToCategoryScore(null, 'performance-v2', sampleBreakdown, []);
    expect(result.score).toBeNull();
  });

  it('attaches limitations', () => {
    const limitations = ['Field data unavailable'];
    const result = performanceAuditToCategoryScore(78, 'performance-v2', sampleBreakdown, limitations);
    expect(result.limitations).toContain('Field data unavailable');
  });
});
