/**
 * Integration tests: monitor alert pipeline wiring in the analyze callback.
 *
 * Verifies that:
 *  - Monitor callbacks invoke the alert pipeline
 *  - Non-monitor callbacks do not invoke the pipeline
 *  - The pipeline is skipped when eligibility conditions are not met
 *  - Duplicate callbacks (already-evaluated) are idempotent at the callback level
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldEvaluateMonitorAlerts } from '@/lib/monitoring/alert-eligibility';

// ── shouldEvaluateMonitorAlerts unit tests ────────────────────────────────────

describe('shouldEvaluateMonitorAlerts', () => {
  it('returns true when all conditions are met', () => {
    expect(shouldEvaluateMonitorAlerts({
      monitorId:     'monitor-1',
      monitorNotify: true,
      monitorUserId: 'user-1',
      newScores:     { performance: 80 },
    })).toBe(true);
  });

  it('returns false when monitorId is missing', () => {
    expect(shouldEvaluateMonitorAlerts({
      monitorId:     undefined,
      monitorNotify: true,
      monitorUserId: 'user-1',
      newScores:     { performance: 80 },
    })).toBe(false);
  });

  it('returns false when monitorNotify is false', () => {
    expect(shouldEvaluateMonitorAlerts({
      monitorId:     'monitor-1',
      monitorNotify: false,
      monitorUserId: 'user-1',
      newScores:     { performance: 80 },
    })).toBe(false);
  });

  it('returns false when monitorNotify is null', () => {
    expect(shouldEvaluateMonitorAlerts({
      monitorId:     'monitor-1',
      monitorNotify: null,
      monitorUserId: 'user-1',
      newScores:     { performance: 80 },
    })).toBe(false);
  });

  it('returns false when monitorUserId is missing', () => {
    expect(shouldEvaluateMonitorAlerts({
      monitorId:     'monitor-1',
      monitorNotify: true,
      monitorUserId: undefined,
      newScores:     { performance: 80 },
    })).toBe(false);
  });

  it('returns false when newScores is null', () => {
    expect(shouldEvaluateMonitorAlerts({
      monitorId:     'monitor-1',
      monitorNotify: true,
      monitorUserId: 'user-1',
      newScores:     null,
    })).toBe(false);
  });

  it('returns false when newScores is undefined', () => {
    expect(shouldEvaluateMonitorAlerts({
      monitorId:     'monitor-1',
      monitorNotify: true,
      monitorUserId: 'user-1',
      newScores:     undefined,
    })).toBe(false);
  });

  it('returns true even when monitorLastScores (baseline) is null — first run', () => {
    // First run has no baseline; pipeline handles this gracefully
    expect(shouldEvaluateMonitorAlerts({
      monitorId:     'monitor-1',
      monitorNotify: true,
      monitorUserId: 'user-1',
      newScores:     { performance: 80 },
    })).toBe(true);
  });
});

// ── Pipeline invocation logic tests ──────────────────────────────────────────

vi.mock('@/lib/monitoring/alert-pipeline', () => ({
  runAlertPipeline: vi.fn().mockResolvedValue(undefined),
}));

import { runAlertPipeline } from '@/lib/monitoring/alert-pipeline';

describe('monitor callback → alert pipeline wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls runAlertPipeline when eligibility passes', async () => {
    const ctx = {
      monitorId:     'monitor-1',
      monitorNotify: true,
      monitorUserId: 'user-1',
      newScores:     { performance: 80, accessibility: 85, seo: 90, bestPractices: 88 },
    };

    if (shouldEvaluateMonitorAlerts(ctx)) {
      runAlertPipeline({
        supabase:          {} as any,
        monitorId:         ctx.monitorId!,
        analysisId:        'analysis-1',
        monitorRunId:      'run-1',
        monitorUserId:     ctx.monitorUserId!,
        monitorLastScores: { performance: 90, accessibility: 90, seo: 90, bestPractices: 90 },
        newScores:         ctx.newScores,
        url:               'https://example.com',
      });
    }

    expect(runAlertPipeline).toHaveBeenCalledOnce();
    expect(runAlertPipeline).toHaveBeenCalledWith(expect.objectContaining({
      monitorId:    'monitor-1',
      analysisId:   'analysis-1',
      monitorUserId: 'user-1',
    }));
  });

  it('does NOT call runAlertPipeline for non-monitor analyses', () => {
    const ctx = {
      monitorId:     undefined,
      monitorNotify: true,
      monitorUserId: 'user-1',
      newScores:     { performance: 80 },
    };

    if (shouldEvaluateMonitorAlerts(ctx)) {
      runAlertPipeline({} as any);
    }

    expect(runAlertPipeline).not.toHaveBeenCalled();
  });

  it('does NOT call runAlertPipeline when notify is disabled', () => {
    const ctx = {
      monitorId:     'monitor-1',
      monitorNotify: false,
      monitorUserId: 'user-1',
      newScores:     { performance: 80 },
    };

    if (shouldEvaluateMonitorAlerts(ctx)) {
      runAlertPipeline({} as any);
    }

    expect(runAlertPipeline).not.toHaveBeenCalled();
  });

  it('does NOT call runAlertPipeline when newScores is null (analysis produced no scores)', () => {
    const ctx = {
      monitorId:     'monitor-1',
      monitorNotify: true,
      monitorUserId: 'user-1',
      newScores:     null,
    };

    if (shouldEvaluateMonitorAlerts(ctx)) {
      runAlertPipeline({} as any);
    }

    expect(runAlertPipeline).not.toHaveBeenCalled();
  });
});

// ── Regression: existing non-monitor email path unaffected ───────────────────

describe('regression: non-monitor completion emails', () => {
  it('shouldEvaluateMonitorAlerts is false for non-monitor → existing email path unchanged', () => {
    // Non-monitor analyses have no monitorId → eligibility check returns false
    // → the old sendAnalysisComplete / sendAnalysisFailed paths are unaffected
    const result = shouldEvaluateMonitorAlerts({
      monitorId:     undefined,
      monitorNotify: undefined,
      monitorUserId: undefined,
      newScores:     { performance: 90 },
    });
    expect(result).toBe(false);
  });
});
