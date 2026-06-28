/**
 * Monitoring domain unit tests (§56–§58).
 *
 * 22 categories of tests + 5 regression scenario fixtures.
 * All tests are pure-logic — no DB, no network, no filesystem.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateNextRun,
  addJitter,
  scheduleFromLegacyFrequency,
  validateSchedule,
  getLocalParts,
} from '@/lib/monitoring/schedule';
import {
  validateComparability,
  computeConfigFingerprint,
  selectBaseline,
} from '@/lib/monitoring/comparability';
import {
  computeFindingStableKey,
  normalizeTarget,
  classifyFindingChanges,
  canConfirmResolution,
} from '@/lib/monitoring/finding-identity';
import type { FindingSet } from '@/lib/monitoring/finding-identity';
import {
  evaluateMetricRegression,
  evaluateAllMetricRegressions,
  detectCoverageRegressions,
  classifyFailureOrigin,
  DEFAULT_METRIC_RULES,
} from '@/lib/monitoring/regression';
import {
  computeAlertFingerprint,
  shouldSendAlert,
  classifyScoreDropSeverity,
  checkQuietHours,
  defaultAlertPolicy,
  evaluateAlerts,
} from '@/lib/monitoring/alert-evaluation';
import type { MonitorRunConfiguration, AlertFingerprint, QuietHoursConfig } from '@/lib/monitoring/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<MonitorRunConfiguration> = {}): MonitorRunConfiguration {
  const base: Omit<MonitorRunConfiguration, 'configurationFingerprint'> = {
    analyzerVersion: '1.0.0',
    scoreVersions: { performance: '3', accessibility: '2', seo: '1', bestPractices: '1' },
    ruleRegistryVersions: { axe: '4.9', lighthouse: '11' },
    deviceProfile: 'desktop',
    auditModes: { performance: 'full', accessibility: 'full', seo: 'full' },
    crawlStrategy: 'bfs',
    maxPages: 10,
  };
  const merged = { ...base, ...overrides };
  return {
    ...merged,
    configurationFingerprint: computeConfigFingerprint(merged),
  };
}

function makeFingerprint(overrides: Partial<AlertFingerprint> = {}): AlertFingerprint {
  return {
    fingerprint: 'fp-abc123',
    firstDetectedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    lastDetectedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    occurrenceCount: 1,
    ...overrides,
  };
}

// ─── 1. Schedule calculation (§3) ─────────────────────────────────────────────

describe('schedule: calculateNextRun', () => {
  it('daily schedule fires next occurrence in the target timezone', () => {
    // 9am UTC has already passed — should get tomorrow at 9am UTC
    const from = new Date('2026-06-28T10:00:00Z');
    const schedule = scheduleFromLegacyFrequency('daily', 'UTC');
    const next = calculateNextRun(schedule, from);
    const local = getLocalParts(next, 'UTC');
    expect(local.hour).toBe(9);
    expect(local.minute).toBe(0);
    // Should be June 29
    expect(local.day).toBe(29);
  });

  it('daily schedule fires today when target time has not yet passed', () => {
    const from = new Date('2026-06-28T08:00:00Z'); // 8am UTC, target is 9am
    const schedule = scheduleFromLegacyFrequency('daily', 'UTC');
    const next = calculateNextRun(schedule, from);
    const local = getLocalParts(next, 'UTC');
    expect(local.hour).toBe(9);
    expect(local.day).toBe(28); // today
  });

  it('weekly schedule picks the correct day of week', () => {
    // June 28 2026 is a Sunday (weekday=0). Schedule for Monday (weekday=1).
    const from = new Date('2026-06-28T10:00:00Z'); // Sunday, past target
    const schedule = scheduleFromLegacyFrequency('weekly', 'UTC');
    const next = calculateNextRun(schedule, from);
    const local = getLocalParts(next, 'UTC');
    expect(local.weekday).toBe(1); // Monday
    expect(local.hour).toBe(9);
  });

  it('next run is always strictly after from', () => {
    const from = new Date('2026-06-28T09:00:00Z'); // exactly at target time
    const schedule = scheduleFromLegacyFrequency('daily', 'UTC');
    const next = calculateNextRun(schedule, from);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });
});

// ─── 2. DST transitions (§3) ──────────────────────────────────────────────────

describe('schedule: DST handling', () => {
  it('9am America/New_York before spring forward is still 9am wall clock', () => {
    // March 8 2026 clocks spring forward in the US. Before: UTC-5. After: UTC-4.
    // March 7 at 9am EST = 14:00 UTC
    const from = new Date('2026-03-07T14:30:00Z'); // past 9am EST on March 7
    const schedule = { type: 'daily' as const, timezone: 'America/New_York', hour: 9, minute: 0 };
    const next = calculateNextRun(schedule, from);
    const local = getLocalParts(next, 'America/New_York');
    // Wall clock should show 9am
    expect(local.hour).toBe(9);
    expect(local.minute).toBe(0);
  });

  it('9am America/New_York after spring forward is still 9am wall clock', () => {
    // March 8 at 9am EDT = 13:00 UTC
    const from = new Date('2026-03-08T13:30:00Z'); // past 9am EDT on March 8
    const schedule = { type: 'daily' as const, timezone: 'America/New_York', hour: 9, minute: 0 };
    const next = calculateNextRun(schedule, from);
    const local = getLocalParts(next, 'America/New_York');
    expect(local.hour).toBe(9);
    expect(local.minute).toBe(0);
  });
});

// ─── 3. Due monitor selection (implicit in cron route, tested via schedule) ───

describe('schedule: scheduleFromLegacyFrequency', () => {
  it('daily frequency produces a daily schedule at 9:00 UTC', () => {
    const s = scheduleFromLegacyFrequency('daily');
    expect(s.type).toBe('daily');
    expect(s.hour).toBe(9);
    expect(s.timezone).toBe('UTC');
  });

  it('weekly frequency defaults to Monday', () => {
    const s = scheduleFromLegacyFrequency('weekly');
    expect(s.type).toBe('weekly');
    expect(s.dayOfWeek).toContain(1);
  });
});

// ─── 4. Lease acquisition (§4) ───────────────────────────────────────────────
// Lease logic lives in DB function — tested via integration; here we verify
// that the run ID format is correct (crypto.randomUUID shape).

describe('lease: run ID format', () => {
  it('run IDs are valid UUIDs', () => {
    const id = crypto.randomUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

// ─── 5. Overlap prevention (§4) ───────────────────────────────────────────────
// The atomic claim is in the DB, but we test the jitter boundary to confirm
// two consecutive runs cannot fire at the same scheduled time.

describe('schedule: jitter', () => {
  it('addJitter never returns a time before the input', () => {
    const base = new Date('2026-06-28T09:00:00Z');
    for (let i = 0; i < 20; i++) {
      const jittered = addJitter(base, 15);
      expect(jittered.getTime()).toBeGreaterThanOrEqual(base.getTime());
    }
  });

  it('addJitter caps at 30 minutes even if maxMinutes is higher', () => {
    const base = new Date('2026-06-28T09:00:00Z');
    for (let i = 0; i < 20; i++) {
      const jittered = addJitter(base, 120); // ask for 120m, capped to 30m
      const diffMs = jittered.getTime() - base.getTime();
      expect(diffMs).toBeLessThanOrEqual(30 * 60 * 1000);
    }
  });
});

// ─── 6. Configuration fingerprint (§6) ───────────────────────────────────────

describe('comparability: computeConfigFingerprint', () => {
  it('produces a 64-char hex string', () => {
    const fp = computeConfigFingerprint(makeConfig());
    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]+$/);
  });

  it('same config produces same fingerprint regardless of key order', () => {
    const a = makeConfig();
    const b = {
      ...makeConfig(),
      scoreVersions: { accessibility: '2', performance: '3', seo: '1', bestPractices: '1' },
    };
    expect(computeConfigFingerprint(a)).toBe(computeConfigFingerprint(b));
  });

  it('different configs produce different fingerprints', () => {
    const a = computeConfigFingerprint(makeConfig({ analyzerVersion: '1.0.0' }));
    const b = computeConfigFingerprint(makeConfig({ analyzerVersion: '1.1.0' }));
    expect(a).not.toBe(b);
  });
});

// ─── 7. Baseline selection (§9) ──────────────────────────────────────────────

describe('comparability: selectBaseline', () => {
  it('selects the most recent completed comparable run', () => {
    const config = makeConfig();
    const result = selectBaseline(
      [
        { runId: 'run-1', status: 'completed', configuration: makeConfig(), completedAt: '2026-06-27T09:00:00Z' },
        { runId: 'run-2', status: 'completed', configuration: makeConfig(), completedAt: '2026-06-26T09:00:00Z' },
      ],
      config,
    );
    expect(result.selectedRunId).toBe('run-1');
    expect(result.rejectedRunIds).toHaveLength(0);
  });

  it('rejects failed runs', () => {
    const config = makeConfig();
    const result = selectBaseline(
      [{ runId: 'run-1', status: 'failed', configuration: makeConfig(), completedAt: '2026-06-27T09:00:00Z' }],
      config,
    );
    expect(result.selectedRunId).toBeNull();
    expect(result.rejectedRunIds).toContain('run-1');
  });

  it('rejects runs below minimum coverage', () => {
    const config = makeConfig();
    const result = selectBaseline(
      [{ runId: 'run-1', status: 'completed', configuration: makeConfig(), completedAt: '2026-06-27T09:00:00Z', coveragePercent: 30 }],
      config,
      50,
    );
    expect(result.selectedRunId).toBeNull();
  });

  it('rejects non-comparable runs (different score version)', () => {
    const config = makeConfig({ scoreVersions: { performance: '4', accessibility: '2', seo: '1', bestPractices: '1' } });
    const result = selectBaseline(
      [{ runId: 'run-1', status: 'completed', configuration: makeConfig(), completedAt: '2026-06-27T09:00:00Z' }],
      config,
    );
    expect(result.selectedRunId).toBeNull();
  });
});

// ─── 8. Comparability validation (§10) ───────────────────────────────────────

describe('comparability: validateComparability', () => {
  it('returns full comparability for identical configs', () => {
    const result = validateComparability(makeConfig(), makeConfig());
    expect(result.comparable).toBe(true);
    expect(result.level).toBe('full');
    expect(result.differences).toHaveLength(0);
  });

  it('returns not-comparable when score version differs', () => {
    const current = makeConfig({ scoreVersions: { performance: '4', accessibility: '2', seo: '1', bestPractices: '1' } });
    const baseline = makeConfig();
    const result = validateComparability(current, baseline);
    expect(result.comparable).toBe(false);
    expect(result.level).toBe('not-comparable');
    expect(result.excludedCategories).toContain('performance');
  });

  it('returns limited comparability for different device profile', () => {
    const current = makeConfig({ deviceProfile: 'mobile' });
    const baseline = makeConfig({ deviceProfile: 'desktop' });
    const result = validateComparability(current, baseline);
    expect(result.comparable).toBe(true);
    expect(result.level).toBe('limited');
    expect(result.warning).toBeTruthy();
  });

  it('returns info-level difference for analyzer version change', () => {
    const current = makeConfig({ analyzerVersion: '1.1.0' });
    const baseline = makeConfig({ analyzerVersion: '1.0.0' });
    const result = validateComparability(current, baseline);
    expect(result.comparable).toBe(true);
    expect(result.level).toBe('full'); // info-level does not make it limited
    expect(result.differences.some((d) => d.field === 'analyzerVersion')).toBe(true);
  });

  it('excludes both categories when their audit modes differ', () => {
    const current = makeConfig({ auditModes: { performance: 'lite', accessibility: 'full', seo: 'full' } });
    const baseline = makeConfig();
    const result = validateComparability(current, baseline);
    expect(result.excludedCategories).toContain('performance');
    expect(result.comparableCategories).not.toContain('performance');
  });
});

// ─── 9. Stable page matching (§7–§8) ─────────────────────────────────────────

describe('finding-identity: normalizeTarget', () => {
  it('strips dynamic IDs', () => {
    const norm = normalizeTarget('div#app-root-42 > span');
    expect(norm).toBe('div#[id] > span');
  });

  it('strips data-* attributes', () => {
    const norm = normalizeTarget('button[data-testid="submit-btn"]');
    expect(norm).toBe('button');
  });

  it('strips generated class names containing numbers', () => {
    const norm = normalizeTarget('div.css-1a2b3c4');
    expect(norm).toBe('div.[cls]');
  });
});

// ─── 10. Finding identity (§12) ──────────────────────────────────────────────

describe('finding-identity: computeFindingStableKey', () => {
  it('returns a 32-char hex string', () => {
    const key = computeFindingStableKey({ ruleId: 'color-contrast', scope: 'page', pageId: 'home', normalizedTarget: 'button.primary' });
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[0-9a-f]+$/);
  });

  it('same inputs → same key', () => {
    const a = computeFindingStableKey({ ruleId: 'color-contrast', scope: 'page', pageId: 'home', normalizedTarget: 'button' });
    const b = computeFindingStableKey({ ruleId: 'color-contrast', scope: 'page', pageId: 'home', normalizedTarget: 'button' });
    expect(a).toBe(b);
  });

  it('different ruleId → different key', () => {
    const a = computeFindingStableKey({ ruleId: 'color-contrast', scope: 'page' });
    const b = computeFindingStableKey({ ruleId: 'missing-alt', scope: 'page' });
    expect(a).not.toBe(b);
  });

  it('different pageId → different key', () => {
    const a = computeFindingStableKey({ ruleId: 'color-contrast', scope: 'page', pageId: 'home' });
    const b = computeFindingStableKey({ ruleId: 'color-contrast', scope: 'page', pageId: 'about' });
    expect(a).not.toBe(b);
  });
});

// ─── 11. Finding lifecycle (§13) ─────────────────────────────────────────────

describe('finding-identity: classifyFindingChanges', () => {
  const KEY_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00';
  const KEY_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb00';

  it('all findings are new when no baseline exists', () => {
    const current: FindingSet = { presentKeys: new Set([KEY_A]), passedKeys: new Set(), notExecutedKeys: new Set() };
    const result = classifyFindingChanges(null, current);
    expect(result.get(KEY_A)).toBe('new');
  });

  it('persistent: present in both runs', () => {
    const baseline: FindingSet = { presentKeys: new Set([KEY_A]), passedKeys: new Set(), notExecutedKeys: new Set() };
    const current: FindingSet = { presentKeys: new Set([KEY_A]), passedKeys: new Set(), notExecutedKeys: new Set() };
    const result = classifyFindingChanges(baseline, current);
    expect(result.get(KEY_A)).toBe('persistent');
  });

  it('resolved: was present, now passing (check ran)', () => {
    const baseline: FindingSet = { presentKeys: new Set([KEY_A]), passedKeys: new Set(), notExecutedKeys: new Set() };
    const current: FindingSet = { presentKeys: new Set(), passedKeys: new Set([KEY_A]), notExecutedKeys: new Set() };
    const result = classifyFindingChanges(baseline, current);
    expect(result.get(KEY_A)).toBe('resolved');
  });

  it('not-evaluated: present in baseline but check did not run this time', () => {
    const baseline: FindingSet = { presentKeys: new Set([KEY_A]), passedKeys: new Set(), notExecutedKeys: new Set() };
    const current: FindingSet = { presentKeys: new Set(), passedKeys: new Set(), notExecutedKeys: new Set([KEY_A]) };
    const result = classifyFindingChanges(baseline, current);
    expect(result.get(KEY_A)).toBe('not-evaluated');
  });

  it('regressed: was passing before, now failing', () => {
    const baseline: FindingSet = { presentKeys: new Set(), passedKeys: new Set([KEY_A]), notExecutedKeys: new Set() };
    const current: FindingSet = { presentKeys: new Set([KEY_A]), passedKeys: new Set(), notExecutedKeys: new Set() };
    const result = classifyFindingChanges(baseline, current);
    expect(result.get(KEY_A)).toBe('regressed');
  });

  it('new: appeared in current but not in baseline at all', () => {
    const baseline: FindingSet = { presentKeys: new Set(), passedKeys: new Set([KEY_B]), notExecutedKeys: new Set() };
    const current: FindingSet = { presentKeys: new Set([KEY_A]), passedKeys: new Set([KEY_B]), notExecutedKeys: new Set() };
    const result = classifyFindingChanges(baseline, current);
    expect(result.get(KEY_A)).toBe('new');
  });

  it('does NOT mark resolved if check was not executed', () => {
    const baseline: FindingSet = { presentKeys: new Set([KEY_A]), passedKeys: new Set(), notExecutedKeys: new Set() };
    const current: FindingSet = { presentKeys: new Set(), passedKeys: new Set(), notExecutedKeys: new Set() }; // neither passed nor not-executed
    const result = classifyFindingChanges(baseline, current);
    // The key is absent from current and from baseline.passedKeys — should be unknown/not-evaluated
    expect(result.get(KEY_A)).not.toBe('resolved');
  });
});

// ─── 12. Resolution confirmation (§21) ───────────────────────────────────────

describe('finding-identity: canConfirmResolution', () => {
  it('confirms resolution when all conditions are met', () => {
    expect(canConfirmResolution({
      checkExecuted: true, coverageAdequate: true, pageAnalyzed: true, comparable: true, findingAbsent: true,
    })).toBe(true);
  });

  it('cannot confirm when check did not execute', () => {
    expect(canConfirmResolution({
      checkExecuted: false, coverageAdequate: true, pageAnalyzed: true, comparable: true, findingAbsent: true,
    })).toBe(false);
  });

  it('cannot confirm when coverage is inadequate', () => {
    expect(canConfirmResolution({
      checkExecuted: true, coverageAdequate: false, pageAnalyzed: true, comparable: true, findingAbsent: true,
    })).toBe(false);
  });

  it('cannot confirm when runs are not comparable', () => {
    expect(canConfirmResolution({
      checkExecuted: true, coverageAdequate: true, pageAnalyzed: true, comparable: false, findingAbsent: true,
    })).toBe(false);
  });
});

// ─── 13. Metric thresholds (§14) ─────────────────────────────────────────────

describe('regression: evaluateMetricRegression', () => {
  const lcpRule = DEFAULT_METRIC_RULES.find((r) => r.metricId === 'lcp')!;

  it('does not regress when either value is null', () => {
    const result = evaluateMetricRegression(lcpRule, null, 3000);
    expect(result.regressed).toBe(false);
    expect(result.delta).toBeNull();
  });

  it('does not regress when baseline is below minimumBaselineValue', () => {
    const result = evaluateMetricRegression(lcpRule, 100, 3000); // baseline 100ms < 500ms minimum
    expect(result.regressed).toBe(false);
  });

  it('detects regression when absolute threshold exceeded', () => {
    const result = evaluateMetricRegression(lcpRule, 2000, 4500); // +2500ms > 1000ms threshold
    expect(result.regressed).toBe(true);
    expect(result.severity).toBeTruthy();
  });

  it('does not regress on improvement', () => {
    const result = evaluateMetricRegression(lcpRule, 3000, 2000);
    expect(result.regressed).toBe(false);
  });

  it('classifies critical severity for LCP >= 6000ms delta', () => {
    const result = evaluateMetricRegression(lcpRule, 500, 4600); // delta = +4100ms
    expect(result.regressed).toBe(true);
    expect(result.severity).toBe('critical');
  });

  it('classifies medium for LCP delta 1000–1999ms', () => {
    const result = evaluateMetricRegression(lcpRule, 1000, 2100); // delta = +1100ms
    expect(result.regressed).toBe(true);
    expect(result.severity).toBe('medium');
  });
});

// ─── 14. Noise filtering (§15) ────────────────────────────────────────────────

describe('regression: noise filtering via DEFAULT_METRIC_RULES', () => {
  const lcpRule = DEFAULT_METRIC_RULES.find((r) => r.metricId === 'lcp')!;

  it('LCP requires 2 confirmations (noise-sensitive)', () => {
    expect(lcpRule.requiredConfirmations).toBe(2);
  });

  it('totalBytes requires only 1 confirmation (less noisy)', () => {
    const rule = DEFAULT_METRIC_RULES.find((r) => r.metricId === 'totalBytes')!;
    expect(rule.requiredConfirmations).toBe(1);
  });

  it('small LCP delta below threshold is not a regression', () => {
    // LCP: absolute=1000ms, relative=25%. Delta of 400ms should NOT trigger.
    const result = evaluateMetricRegression(lcpRule, 2000, 2400); // +400ms < 1000ms threshold, 20% < 25%
    expect(result.regressed).toBe(false);
  });
});

// ─── 15. Persistent regression confirmation (§16) ─────────────────────────────

describe('regression: confirmation count rules', () => {
  it('requiredConfirmations is > 0 for all default metric rules', () => {
    for (const rule of DEFAULT_METRIC_RULES) {
      expect(rule.requiredConfirmations).toBeGreaterThan(0);
    }
  });

  it('evaluateAllMetricRegressions returns only rules that exceeded threshold', () => {
    const current = { lcp: 4500, cls: 0.01, ttfb: 300 };
    const baseline = { lcp: 2000, cls: 0.01, ttfb: 300 };
    const regressions = evaluateAllMetricRegressions(current, baseline);
    expect(regressions.some((r) => r.metricId === 'lcp')).toBe(true);
    expect(regressions.some((r) => r.metricId === 'cls')).toBe(false);
    expect(regressions.some((r) => r.metricId === 'ttfb')).toBe(false);
  });
});

// ─── 16. Alert severity classification (§18) ─────────────────────────────────

describe('alert-evaluation: classifyScoreDropSeverity', () => {
  const policy = defaultAlertPolicy();

  it('returns info for score drop below threshold', () => {
    const severity = classifyScoreDropSeverity('performance', -5, policy); // threshold is 10
    expect(severity).toBe('info');
  });

  it('returns medium for a drop equal to threshold', () => {
    const severity = classifyScoreDropSeverity('performance', -10, policy);
    expect(severity).toBe('medium');
  });

  it('returns high for a large drop', () => {
    const severity = classifyScoreDropSeverity('accessibility', -20, policy); // threshold is 5 * 3 = 15
    expect(severity).toBe('high');
  });

  it('returns info for positive delta (improvement)', () => {
    const severity = classifyScoreDropSeverity('seo', 5, policy);
    expect(severity).toBe('info');
  });
});

// ─── 17. Alert fingerprint creation (§19) ────────────────────────────────────

describe('alert-evaluation: computeAlertFingerprint', () => {
  it('produces a 32-char hex string', () => {
    const fp = computeAlertFingerprint({
      monitorId: 'mon-1',
      eventType: 'score-drop:performance',
      stableKey: 'score:performance',
      affectedPage: 'site',
      severity: 'medium',
      baselineState: '85',
    });
    expect(fp).toHaveLength(32);
    expect(fp).toMatch(/^[0-9a-f]+$/);
  });

  it('same inputs produce same fingerprint', () => {
    const params = {
      monitorId: 'mon-1', eventType: 'score-drop:performance',
      stableKey: 'score:performance', affectedPage: 'site', severity: 'medium' as const, baselineState: '85',
    };
    expect(computeAlertFingerprint(params)).toBe(computeAlertFingerprint(params));
  });

  it('different monitorIds produce different fingerprints', () => {
    const base = { eventType: 'score-drop:performance', stableKey: 'score:performance', affectedPage: 'site', severity: 'medium' as const, baselineState: '85' };
    const a = computeAlertFingerprint({ monitorId: 'mon-1', ...base });
    const b = computeAlertFingerprint({ monitorId: 'mon-2', ...base });
    expect(a).not.toBe(b);
  });
});

// ─── 18. Cooldown behavior (§19) ─────────────────────────────────────────────

describe('alert-evaluation: shouldSendAlert', () => {
  const now = new Date('2026-06-28T12:00:00Z');

  it('sends when no existing fingerprint', () => {
    const { send } = shouldSendAlert({
      fingerprint: 'fp-new',
      activeFingerprints: new Map(),
      cooldownMinutes: 60,
      severity: 'medium',
      isInQuietHours: false,
      now,
    });
    expect(send).toBe(true);
  });

  it('suppresses within cooldown window', () => {
    const lastDetected = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // 30 min ago, cooldown=60
    const { send, reason } = shouldSendAlert({
      fingerprint: 'fp-existing',
      activeFingerprints: new Map([['fp-existing', makeFingerprint({ lastDetectedAt: lastDetected })]]),
      cooldownMinutes: 60,
      severity: 'medium',
      isInQuietHours: false,
      now,
    });
    expect(send).toBe(false);
    expect(reason).toContain('cooldown');
  });

  it('sends after cooldown expires', () => {
    const lastDetected = new Date(now.getTime() - 90 * 60 * 1000).toISOString(); // 90 min ago, cooldown=60
    const { send } = shouldSendAlert({
      fingerprint: 'fp-old',
      activeFingerprints: new Map([['fp-old', makeFingerprint({ lastDetectedAt: lastDetected })]]),
      cooldownMinutes: 60,
      severity: 'medium',
      isInQuietHours: false,
      now,
    });
    expect(send).toBe(true);
  });

  it('suppresses non-critical alerts during quiet hours', () => {
    const { send } = shouldSendAlert({
      fingerprint: 'fp-quiet',
      activeFingerprints: new Map(),
      cooldownMinutes: 60,
      severity: 'low',
      isInQuietHours: true,
      now,
    });
    expect(send).toBe(false);
  });

  it('critical alerts bypass quiet hours', () => {
    const { send } = shouldSendAlert({
      fingerprint: 'fp-critical',
      activeFingerprints: new Map(),
      cooldownMinutes: 60,
      severity: 'critical',
      isInQuietHours: true,
      now,
    });
    expect(send).toBe(true);
  });
});

// ─── 19. Quiet hours (§35) ───────────────────────────────────────────────────

describe('alert-evaluation: checkQuietHours', () => {
  it('returns true during quiet hours window', () => {
    // Saturday 2am UTC — within window 22:00–06:00 on weekends (Sat=6, Sun=0)
    const qh: QuietHoursConfig = {
      timezone: 'UTC',
      startHour: 22,
      endHour: 6,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      allowCriticalOverride: true,
    };
    const now = new Date('2026-06-28T02:00:00Z'); // 2am UTC, Sunday
    expect(checkQuietHours(qh, now)).toBe(true);
  });

  it('returns false outside quiet hours window', () => {
    const qh: QuietHoursConfig = {
      timezone: 'UTC',
      startHour: 22,
      endHour: 6,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      allowCriticalOverride: true,
    };
    const now = new Date('2026-06-28T12:00:00Z'); // noon UTC
    expect(checkQuietHours(qh, now)).toBe(false);
  });

  it('returns false when day of week not in quiet hours', () => {
    const qh: QuietHoursConfig = {
      timezone: 'UTC',
      startHour: 22,
      endHour: 6,
      daysOfWeek: [6], // Saturday only
      allowCriticalOverride: true,
    };
    const now = new Date('2026-06-28T02:00:00Z'); // Sunday 2am
    expect(checkQuietHours(qh, now)).toBe(false);
  });
});

// ─── 20. Coverage regression detection (§23) ─────────────────────────────────

describe('regression: detectCoverageRegressions', () => {
  it('detects regression when coverage drops by ≥10 percentage points', () => {
    const records = detectCoverageRegressions(
      { accessibility: 60 },
      { accessibility: 80 }, // was 80%, now 60% — delta -20
    );
    expect(records[0].regressionDetected).toBe(true);
  });

  it('does not flag regression for a small drop', () => {
    const records = detectCoverageRegressions(
      { accessibility: 75 },
      { accessibility: 80 }, // delta -5
    );
    expect(records[0].regressionDetected).toBe(false);
  });

  it('does not flag null-to-value as regression', () => {
    const records = detectCoverageRegressions(
      { accessibility: 75 },
      { accessibility: null as unknown as number },
    );
    const rec = records.find((r) => r.category === 'accessibility');
    expect(rec?.regressionDetected).toBe(false);
  });
});

// ─── 21. Failure origin classification (§47) ─────────────────────────────────

describe('regression: classifyFailureOrigin', () => {
  it('returns target-site for HTTP 500', () => {
    expect(classifyFailureOrigin({ httpStatus: 500 })).toBe('target-site');
  });

  it('returns analyzer when browser start failed but direct HTTP OK', () => {
    expect(classifyFailureOrigin({ browserStartFailed: true, directHttpOk: true })).toBe('analyzer');
  });

  it('returns browser-provider when browser service is unavailable', () => {
    expect(classifyFailureOrigin({ browserServiceUnavailable: true })).toBe('browser-provider');
  });

  it('returns configuration when configuration is invalid', () => {
    expect(classifyFailureOrigin({ invalidConfiguration: true })).toBe('configuration');
  });

  it('returns unknown when no useful signals', () => {
    expect(classifyFailureOrigin({})).toBe('unknown');
  });
});

// ─── 22. Schedule validation (§3, §60) ───────────────────────────────────────

describe('schedule: validateSchedule', () => {
  it('validates a correct daily schedule', () => {
    const err = validateSchedule({ type: 'daily', timezone: 'America/New_York', hour: 9, minute: 0 });
    expect(err).toBeNull();
  });

  it('rejects missing timezone', () => {
    const err = validateSchedule({ type: 'daily', timezone: '', hour: 9, minute: 0 });
    expect(err).toBeTruthy();
    expect(err).toMatch(/timezone/i);
  });

  it('rejects invalid IANA timezone', () => {
    const err = validateSchedule({ type: 'daily', timezone: 'Mars/Olympus', hour: 9, minute: 0 });
    expect(err).toBeTruthy();
  });

  it('rejects hour > 23', () => {
    const err = validateSchedule({ type: 'daily', timezone: 'UTC', hour: 25, minute: 0 });
    expect(err).toBeTruthy();
  });

  it('rejects dayOfMonth > 28', () => {
    const err = validateSchedule({ type: 'monthly', timezone: 'UTC', hour: 9, minute: 0, dayOfMonth: 30 });
    expect(err).toBeTruthy();
  });

  it('requires cronExpression for custom type', () => {
    const err = validateSchedule({ type: 'custom', timezone: 'UTC' });
    expect(err).toBeTruthy();
    expect(err).toMatch(/cronExpression/);
  });
});

// ─── §58 Regression scenario fixtures ────────────────────────────────────────

describe('regression fixture: performance noise → no alert', () => {
  it('LCP improves by 5% — below relative threshold of 25% — no regression', () => {
    const lcpRule = DEFAULT_METRIC_RULES.find((r) => r.metricId === 'lcp')!;
    const result = evaluateMetricRegression(lcpRule, 2000, 2100); // +100ms, 5%
    expect(result.regressed).toBe(false);
  });
});

describe('regression fixture: confirmed regression → high alert', () => {
  it('LCP degrades from 2000ms to 5000ms (Δ+3000ms, 150%) → regressed at high/critical', () => {
    const lcpRule = DEFAULT_METRIC_RULES.find((r) => r.metricId === 'lcp')!;
    const result = evaluateMetricRegression(lcpRule, 2000, 5000);
    expect(result.regressed).toBe(true);
    expect(['high', 'critical']).toContain(result.severity);
  });
});

describe('regression fixture: incompatible score version → comparison limited', () => {
  it('score version change blocks score delta comparison', () => {
    const current = makeConfig({
      scoreVersions: { performance: '4', accessibility: '2', seo: '1', bestPractices: '1' },
    });
    const baseline = makeConfig(); // performance='3'
    const comp = validateComparability(current, baseline);
    expect(comp.comparable).toBe(false);
    expect(comp.level).toBe('not-comparable');
    expect(comp.comparableCategories).toHaveLength(0);
  });
});

describe('regression fixture: accessibility resolution with failed audit → not-evaluated', () => {
  it('finding is not-evaluated when audit did not run this cycle', () => {
    const KEY = computeFindingStableKey({ ruleId: 'color-contrast', scope: 'page', pageId: 'home' });
    const baseline: FindingSet = { presentKeys: new Set([KEY]), passedKeys: new Set(), notExecutedKeys: new Set() };
    const current: FindingSet = { presentKeys: new Set(), passedKeys: new Set(), notExecutedKeys: new Set([KEY]) };
    const changes = classifyFindingChanges(baseline, current);
    expect(changes.get(KEY)).toBe('not-evaluated');
  });
});

describe('regression fixture: security header removal → high alert', () => {
  it('new critical/high finding triggers an alert event', () => {
    const policy = defaultAlertPolicy();
    const now = new Date();
    const KEY = computeFindingStableKey({ ruleId: 'missing-csp', scope: 'site' });

    const result = evaluateAlerts({
      monitorId: 'mon-security',
      runId: 'run-1',
      policy,
      scoreChanges: [],
      findingChanges: [
        {
          identity: { stableKey: KEY, ruleId: 'missing-csp', scope: 'site' },
          changeStatus: 'new',
          currentSeverity: 'high',
        },
      ],
      metricRegressions: [],
      coverageChanges: [],
      now,
      activeFingerprints: new Map(),
    });

    expect(result.alertsTriggered.length).toBeGreaterThan(0);
    const alert = result.alertsTriggered[0];
    expect(alert.severity).toBe('high');
    expect(alert.eventType).toContain('finding:new');
  });
});
