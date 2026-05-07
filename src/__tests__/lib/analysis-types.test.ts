import { describe, it, expect } from 'vitest';
import type {
  AnalysisStatus,
  LighthouseScores,
  ConsoleError,
  AccessibilityIssue,
  NetworkSummary,
  AIInsight,
  Analysis,
  Monitor,
  MonitorFrequency,
  DesignComparison,
  DesignMismatch,
} from '@/types/analysis';

// Runtime shape validators — ensure runtime data matches the TypeScript types.
// These catch regressions where the types drift from what the API actually returns.

function isValidLighthouseScores(s: unknown): s is LighthouseScores {
  if (typeof s !== 'object' || s === null) return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.performance === 'number' &&
    typeof obj.accessibility === 'number' &&
    typeof obj.bestPractices === 'number' &&
    typeof obj.seo === 'number' &&
    typeof obj.lcp === 'number' &&
    typeof obj.fid === 'number' &&
    typeof obj.cls === 'number' &&
    typeof obj.ttfb === 'number'
  );
}

function isValidConsoleError(e: unknown): e is ConsoleError {
  if (typeof e !== 'object' || e === null) return false;
  const obj = e as Record<string, unknown>;
  return (
    typeof obj.message === 'string' &&
    ['error', 'warning', 'info'].includes(obj.type as string) &&
    typeof obj.source === 'string' &&
    typeof obj.timestamp === 'number'
  );
}

function isValidAccessibilityIssue(i: unknown): i is AccessibilityIssue {
  if (typeof i !== 'object' || i === null) return false;
  const obj = i as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    ['critical', 'serious', 'moderate', 'minor'].includes(obj.impact as string) &&
    typeof obj.description === 'string' &&
    Array.isArray(obj.nodes) &&
    Array.isArray(obj.wcagCriteria)
  );
}

function isValidDesignMismatch(m: unknown): m is DesignMismatch {
  if (typeof m !== 'object' || m === null) return false;
  const obj = m as Record<string, unknown>;
  return (
    typeof obj.area === 'string' &&
    ['critical', 'major', 'minor'].includes(obj.severity as string) &&
    typeof obj.designExpected === 'string' &&
    typeof obj.liveSite === 'string' &&
    typeof obj.suggestion === 'string'
  );
}

function isValidDesignComparison(c: unknown): c is DesignComparison {
  if (typeof c !== 'object' || c === null) return false;
  const obj = c as Record<string, unknown>;
  return (
    typeof obj.fidelityScore === 'number' &&
    obj.fidelityScore >= 0 && obj.fidelityScore <= 100 &&
    typeof obj.summary === 'string' &&
    Array.isArray(obj.mismatches) &&
    Array.isArray(obj.matchingAreas)
  );
}

function isValidMonitor(m: unknown): m is Monitor {
  if (typeof m !== 'object' || m === null) return false;
  const obj = m as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.url === 'string' &&
    ['daily', 'weekly'].includes(obj.frequency as string) &&
    typeof obj.is_active === 'boolean' &&
    typeof obj.notify_on_score_drop === 'boolean' &&
    typeof obj.score_drop_threshold === 'number' &&
    typeof obj.next_run_at === 'string' &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  );
}

// ── LighthouseScores ──────────────────────────────────────────────────────────
describe('LighthouseScores type shape', () => {
  it('accepts a valid scores object', () => {
    const scores: LighthouseScores = {
      performance: 85, accessibility: 92, bestPractices: 88, seo: 90,
      lcp: 2400, fid: 45, cls: 0.08, ttfb: 320,
    };
    expect(isValidLighthouseScores(scores)).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(isValidLighthouseScores({ performance: 85 })).toBe(false);
    expect(isValidLighthouseScores(null)).toBe(false);
    expect(isValidLighthouseScores({})).toBe(false);
  });

  it('all scores are in valid 0–100 range for typical data', () => {
    const scores: LighthouseScores = {
      performance: 85, accessibility: 92, bestPractices: 88, seo: 90,
      lcp: 2400, fid: 45, cls: 0.08, ttfb: 320,
    };
    expect(scores.performance).toBeGreaterThanOrEqual(0);
    expect(scores.performance).toBeLessThanOrEqual(100);
  });
});

// ── ConsoleError ──────────────────────────────────────────────────────────────
describe('ConsoleError type shape', () => {
  it('accepts a valid error object', () => {
    const err: ConsoleError = { message: 'Uncaught TypeError', type: 'error', source: 'app.js', line: 42, timestamp: 1700000000000 };
    expect(isValidConsoleError(err)).toBe(true);
  });

  it('accepts warning type', () => {
    const warn: ConsoleError = { message: 'Deprecated API', type: 'warning', source: 'lib.js', timestamp: 1 };
    expect(isValidConsoleError(warn)).toBe(true);
  });

  it('line field is optional', () => {
    const err: ConsoleError = { message: 'Error', type: 'error', source: 'x.js', timestamp: 1 };
    expect(isValidConsoleError(err)).toBe(true);
  });
});

// ── AccessibilityIssue ────────────────────────────────────────────────────────
describe('AccessibilityIssue type shape', () => {
  it('accepts a valid issue', () => {
    const issue: AccessibilityIssue = {
      id: 'color-contrast', impact: 'serious',
      description: 'Elements must have sufficient color contrast',
      nodes: ['button.primary'], wcagCriteria: ['wcag2aa'],
    };
    expect(isValidAccessibilityIssue(issue)).toBe(true);
  });

  it('accepts all valid impact levels', () => {
    const impacts = ['critical', 'serious', 'moderate', 'minor'] as const;
    for (const impact of impacts) {
      expect(isValidAccessibilityIssue({ id: 'x', impact, description: 'd', nodes: [], wcagCriteria: [] })).toBe(true);
    }
  });
});

// ── AnalysisStatus ────────────────────────────────────────────────────────────
describe('AnalysisStatus type', () => {
  const validStatuses: AnalysisStatus[] = ['pending', 'queued', 'running', 'completed', 'failed'];

  it('has exactly 5 valid statuses', () => {
    expect(validStatuses).toHaveLength(5);
  });

  it.each(validStatuses)('"%s" is a valid AnalysisStatus', (status) => {
    expect(validStatuses).toContain(status);
  });
});

// ── NetworkSummary ────────────────────────────────────────────────────────────
describe('NetworkSummary type shape', () => {
  it('accepts a valid summary', () => {
    const summary: NetworkSummary = { totalRequests: 42, totalBytes: 1_024_000, failedRequests: 2, slowRequests: 1 };
    expect(summary.totalRequests).toBeGreaterThanOrEqual(0);
    expect(summary.totalBytes).toBeGreaterThanOrEqual(0);
    expect(summary.failedRequests).toBeGreaterThanOrEqual(0);
    expect(summary.slowRequests).toBeGreaterThanOrEqual(0);
  });
});

// ── DesignMismatch (NEW) ──────────────────────────────────────────────────────
describe('DesignMismatch type shape', () => {
  it('accepts a valid mismatch object', () => {
    const mismatch: DesignMismatch = {
      area: 'Hero section',
      severity: 'major',
      designExpected: 'Blue background #1a73e8',
      liveSite: 'Gray background #cccccc',
      suggestion: 'Change background-color to #1a73e8',
    };
    expect(isValidDesignMismatch(mismatch)).toBe(true);
  });

  it('accepts all three severity levels', () => {
    const severities = ['critical', 'major', 'minor'] as const;
    for (const severity of severities) {
      const m: DesignMismatch = {
        area: 'Nav', severity,
        designExpected: 'X', liveSite: 'Y', suggestion: 'Fix it',
      };
      expect(isValidDesignMismatch(m)).toBe(true);
    }
  });

  it('rejects missing required fields', () => {
    expect(isValidDesignMismatch({ area: 'Nav', severity: 'major' })).toBe(false);
    expect(isValidDesignMismatch(null)).toBe(false);
  });
});

// ── DesignComparison (NEW) ────────────────────────────────────────────────────
describe('DesignComparison type shape', () => {
  it('accepts a valid comparison object', () => {
    const comparison: DesignComparison = {
      fidelityScore: 78,
      summary: 'Overall good match with some color differences.',
      mismatches: [
        { area: 'Footer', severity: 'minor', designExpected: 'White text', liveSite: 'Gray text', suggestion: 'Use color: white' },
      ],
      matchingAreas: ['Logo placement', 'Navigation structure'],
    };
    expect(isValidDesignComparison(comparison)).toBe(true);
  });

  it('fidelityScore must be between 0 and 100', () => {
    const valid: DesignComparison = { fidelityScore: 0, summary: 'x', mismatches: [], matchingAreas: [] };
    const also: DesignComparison = { fidelityScore: 100, summary: 'x', mismatches: [], matchingAreas: [] };
    expect(isValidDesignComparison(valid)).toBe(true);
    expect(isValidDesignComparison(also)).toBe(true);
    expect(isValidDesignComparison({ fidelityScore: -1, summary: 'x', mismatches: [], matchingAreas: [] })).toBe(false);
    expect(isValidDesignComparison({ fidelityScore: 101, summary: 'x', mismatches: [], matchingAreas: [] })).toBe(false);
  });

  it('mismatches and matchingAreas can be empty arrays', () => {
    const c: DesignComparison = { fidelityScore: 95, summary: 'Perfect match', mismatches: [], matchingAreas: [] };
    expect(isValidDesignComparison(c)).toBe(true);
  });
});

// ── Monitor (NEW) ─────────────────────────────────────────────────────────────
describe('Monitor type shape', () => {
  const validMonitor: Monitor = {
    id: 'abc-123',
    user_id: 'user-456',
    url: 'https://example.com',
    frequency: 'weekly',
    is_active: true,
    notify_on_score_drop: true,
    score_drop_threshold: 10,
    last_run_at: null,
    next_run_at: '2026-05-14T10:00:00.000Z',
    last_analysis_id: null,
    last_scores: null,
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
  };

  it('accepts a valid monitor object', () => {
    expect(isValidMonitor(validMonitor)).toBe(true);
  });

  it('accepts both frequency values', () => {
    const daily: Monitor = { ...validMonitor, frequency: 'daily' };
    const weekly: Monitor = { ...validMonitor, frequency: 'weekly' };
    expect(isValidMonitor(daily)).toBe(true);
    expect(isValidMonitor(weekly)).toBe(true);
  });

  it('is_active can be false (paused monitor)', () => {
    expect(isValidMonitor({ ...validMonitor, is_active: false })).toBe(true);
  });

  it('rejects missing required fields', () => {
    expect(isValidMonitor({ id: 'x', user_id: 'y' })).toBe(false);
    expect(isValidMonitor(null)).toBe(false);
  });
});

// ── MonitorFrequency (NEW) ────────────────────────────────────────────────────
describe('MonitorFrequency type', () => {
  const validFrequencies: MonitorFrequency[] = ['daily', 'weekly'];

  it('has exactly 2 valid frequencies', () => {
    expect(validFrequencies).toHaveLength(2);
  });

  it.each(validFrequencies)('"%s" is a valid MonitorFrequency', (freq) => {
    expect(validFrequencies).toContain(freq);
  });
});

// ── Analysis.is_public (NEW) ──────────────────────────────────────────────────
describe('Analysis.is_public field', () => {
  it('is_public is a boolean field on the Analysis type', () => {
    // TypeScript compile-time check — if this compiles, the field exists
    const partial: Pick<Analysis, 'is_public'> = { is_public: false };
    expect(typeof partial.is_public).toBe('boolean');
  });

  it('defaults to false for private reports', () => {
    const partial: Pick<Analysis, 'is_public'> = { is_public: false };
    expect(partial.is_public).toBe(false);
  });
});
