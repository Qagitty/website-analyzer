/**
 * Metric regression detection and noise handling (§14–§15).
 *
 * Rules:
 *  - Do not alert on every small fluctuation (§14).
 *  - Browser performance metrics naturally vary — require confirmation for
 *    noisy metrics (§15).
 *  - Do not claim laboratory measurements are perfectly stable.
 *  - 'null' means the metric was not available — not that it regressed.
 *  - Do NOT convert reduced coverage into a healthy score improvement (§23).
 *  - Classify site failure separately from analyzer failure (§47).
 */

import type {
  MetricRegressionRule,
  MetricSeverityThreshold,
  MetricChangeRecord,
  MonitorEventSeverity,
  MonitorFailureOrigin,
  CoverageChangeRecord,
} from './types';

// ─── Default metric regression rules ──────────────────────────────────────────

/**
 * Default rules for metrics tracked across all monitor runs.
 * Callers can override these per-monitor via the alert policy.
 */
export const DEFAULT_METRIC_RULES: MetricRegressionRule[] = [
  {
    metricId: 'lcp',
    relativeThresholdPercent: 25,
    absoluteThreshold: 1000,          // 1 s absolute jump also counts
    minimumBaselineValue: 500,         // ignore if baseline is already very fast
    direction: 'increase-is-bad',
    requiredConfirmations: 2,          // noisy — require two consecutive regressions
    severityMapping: [
      { severity: 'critical', absoluteThreshold: 4000 },
      { severity: 'high',     absoluteThreshold: 2000 },
      { severity: 'medium',   absoluteThreshold: 1000 },
      { severity: 'low',      absoluteThreshold: 0 },
    ],
  },
  {
    metricId: 'cls',
    absoluteThreshold: 0.05,
    minimumBaselineValue: 0,
    direction: 'increase-is-bad',
    requiredConfirmations: 2,
    severityMapping: [
      { severity: 'high',   absoluteThreshold: 0.25 },
      { severity: 'medium', absoluteThreshold: 0.1 },
      { severity: 'low',    absoluteThreshold: 0.05 },
    ],
  },
  {
    metricId: 'ttfb',
    absoluteThreshold: 500,
    relativeThresholdPercent: 50,
    minimumBaselineValue: 100,
    direction: 'increase-is-bad',
    requiredConfirmations: 2,
    severityMapping: [
      { severity: 'high',   absoluteThreshold: 1800 },
      { severity: 'medium', absoluteThreshold: 800 },
      { severity: 'low',    absoluteThreshold: 500 },
    ],
  },
  {
    metricId: 'tbt',
    absoluteThreshold: 200,
    relativeThresholdPercent: 50,
    minimumBaselineValue: 50,
    direction: 'increase-is-bad',
    requiredConfirmations: 2,
    severityMapping: [
      { severity: 'high',   absoluteThreshold: 600 },
      { severity: 'medium', absoluteThreshold: 300 },
      { severity: 'low',    absoluteThreshold: 200 },
    ],
  },
  {
    metricId: 'totalBytes',
    relativeThresholdPercent: 50,
    minimumBaselineValue: 50_000,     // 50 KB minimum baseline
    direction: 'increase-is-bad',
    requiredConfirmations: 1,
    severityMapping: [
      { severity: 'high',   relativeThresholdPercent: 100 },
      { severity: 'medium', relativeThresholdPercent: 50 },
      { severity: 'low',    relativeThresholdPercent: 20 },
    ],
  },
  {
    metricId: 'jsBytes',
    relativeThresholdPercent: 30,
    minimumBaselineValue: 10_000,
    direction: 'increase-is-bad',
    requiredConfirmations: 1,
    severityMapping: [
      { severity: 'high',   relativeThresholdPercent: 100 },
      { severity: 'medium', relativeThresholdPercent: 50 },
      { severity: 'low',    relativeThresholdPercent: 30 },
    ],
  },
  {
    metricId: 'imageBytes',
    relativeThresholdPercent: 30,
    minimumBaselineValue: 10_000,
    direction: 'increase-is-bad',
    requiredConfirmations: 1,
    severityMapping: [
      { severity: 'medium', relativeThresholdPercent: 50 },
      { severity: 'low',    relativeThresholdPercent: 30 },
    ],
  },
  {
    metricId: 'requestCount',
    absoluteThreshold: 20,
    relativeThresholdPercent: 30,
    minimumBaselineValue: 5,
    direction: 'increase-is-bad',
    requiredConfirmations: 1,
    severityMapping: [
      { severity: 'medium', absoluteThreshold: 50 },
      { severity: 'low',    absoluteThreshold: 20 },
    ],
  },
  {
    metricId: 'accessibilityIssueCount',
    absoluteThreshold: 1,
    minimumBaselineValue: 0,
    direction: 'increase-is-bad',
    requiredConfirmations: 1,
    severityMapping: [
      { severity: 'high',   absoluteThreshold: 5 },
      { severity: 'medium', absoluteThreshold: 2 },
      { severity: 'low',    absoluteThreshold: 1 },
    ],
  },
  {
    metricId: 'brokenLinkCount',
    absoluteThreshold: 1,
    minimumBaselineValue: 0,
    direction: 'increase-is-bad',
    requiredConfirmations: 1,
    severityMapping: [
      { severity: 'high',   absoluteThreshold: 5 },
      { severity: 'medium', absoluteThreshold: 2 },
      { severity: 'low',    absoluteThreshold: 1 },
    ],
  },
  {
    metricId: 'runtimeErrorCount',
    absoluteThreshold: 5,
    minimumBaselineValue: 0,
    direction: 'increase-is-bad',
    requiredConfirmations: 1,
    severityMapping: [
      { severity: 'high',   absoluteThreshold: 20 },
      { severity: 'medium', absoluteThreshold: 10 },
      { severity: 'low',    absoluteThreshold: 5 },
    ],
  },
];

// ─── Regression evaluation ────────────────────────────────────────────────────

export interface MetricRegressionResult {
  metricId: string;
  regressed: boolean;
  baselineValue: number | null;
  currentValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
  severity: MonitorEventSeverity | null;
  exceedsAbsoluteThreshold: boolean;
  exceedsRelativeThreshold: boolean;
}

/**
 * Evaluate whether a metric change constitutes a regression.
 *
 * Returns null delta when either value is null (metric unavailable — not a regression).
 */
export function evaluateMetricRegression(
  rule: MetricRegressionRule,
  baselineValue: number | null,
  currentValue: number | null,
): MetricRegressionResult {
  const base: MetricRegressionResult = {
    metricId: rule.metricId,
    regressed: false,
    baselineValue,
    currentValue,
    delta: null,
    deltaPercent: null,
    severity: null,
    exceedsAbsoluteThreshold: false,
    exceedsRelativeThreshold: false,
  };

  // Cannot compare if either value is unavailable
  if (baselineValue === null || currentValue === null) return base;

  // Check minimum baseline value
  if (rule.minimumBaselineValue !== undefined && Math.abs(baselineValue) < rule.minimumBaselineValue) {
    return base;
  }

  const rawDelta = currentValue - baselineValue;
  const delta = rule.direction === 'increase-is-bad' ? rawDelta : -rawDelta;
  const deltaPercent = baselineValue !== 0 ? (rawDelta / Math.abs(baselineValue)) * 100 : null;

  base.delta = rawDelta;
  base.deltaPercent = deltaPercent;

  if (delta <= 0) return base; // improvement or flat

  // Check absolute threshold
  const absExceeded = rule.absoluteThreshold !== undefined && delta >= rule.absoluteThreshold;
  // Check relative threshold
  const relExceeded =
    rule.relativeThresholdPercent !== undefined &&
    deltaPercent !== null &&
    Math.abs(deltaPercent) >= rule.relativeThresholdPercent;

  base.exceedsAbsoluteThreshold = absExceeded;
  base.exceedsRelativeThreshold = relExceeded;

  // Either threshold triggers a regression
  if (!absExceeded && !relExceeded) return base;

  base.regressed = true;
  base.severity = classifyMetricSeverity(rule.severityMapping, delta, deltaPercent);
  return base;
}

function classifyMetricSeverity(
  mapping: MetricSeverityThreshold[],
  delta: number,
  deltaPercent: number | null,
): MonitorEventSeverity {
  // Try from most to least severe (assumes mapping is ordered from high to low severity)
  for (const threshold of mapping) {
    if (threshold.absoluteThreshold !== undefined && delta >= threshold.absoluteThreshold) {
      return threshold.severity;
    }
    if (
      threshold.relativeThresholdPercent !== undefined &&
      deltaPercent !== null &&
      Math.abs(deltaPercent) >= threshold.relativeThresholdPercent
    ) {
      return threshold.severity;
    }
  }
  return 'low';
}

// ─── Evaluate all metrics ──────────────────────────────────────────────────────

/**
 * Evaluate all default metric rules against current/baseline values.
 * Returns only the metrics that actually exceeded a threshold.
 */
export function evaluateAllMetricRegressions(
  currentMetrics: Record<string, number | null>,
  baselineMetrics: Record<string, number | null>,
  rules: MetricRegressionRule[] = DEFAULT_METRIC_RULES,
): MetricRegressionResult[] {
  const results: MetricRegressionResult[] = [];
  for (const rule of rules) {
    const current = currentMetrics[rule.metricId] ?? null;
    const baseline = baselineMetrics[rule.metricId] ?? null;
    const result = evaluateMetricRegression(rule, baseline, current);
    if (result.regressed) results.push(result);
  }
  return results;
}

// ─── Build MetricChangeRecords ────────────────────────────────────────────────

export function buildMetricChangeRecords(
  currentMetrics: Record<string, number | null>,
  baselineMetrics: Record<string, number | null>,
  rules: MetricRegressionRule[] = DEFAULT_METRIC_RULES,
): MetricChangeRecord[] {
  return rules.map((rule) => {
    const current = currentMetrics[rule.metricId] ?? null;
    const baseline = baselineMetrics[rule.metricId] ?? null;
    const result = evaluateMetricRegression(rule, baseline, current);
    return {
      metricId: rule.metricId,
      baselineValue: baseline,
      currentValue: current,
      delta: result.delta,
      deltaPercent: result.deltaPercent,
      exceedsThreshold: result.regressed,
      rule,
    };
  });
}

// ─── Coverage regression detection (§23) ─────────────────────────────────────

/** Minimum coverage decrease (percentage points) that constitutes a regression. */
const COVERAGE_REGRESSION_THRESHOLD = 10;

export function detectCoverageRegressions(
  currentCoverage: Record<string, number | null>,
  baselineCoverage: Record<string, number | null>,
): CoverageChangeRecord[] {
  const records: CoverageChangeRecord[] = [];
  const allCategories = new Set([
    ...Object.keys(currentCoverage),
    ...Object.keys(baselineCoverage),
  ]);

  for (const category of allCategories) {
    const current = currentCoverage[category] ?? null;
    const baseline = baselineCoverage[category] ?? null;

    let delta: number | null = null;
    if (current !== null && baseline !== null) {
      delta = current - baseline;
    }

    const regressionDetected =
      delta !== null && delta <= -COVERAGE_REGRESSION_THRESHOLD;

    records.push({
      category,
      baselineCoverage: baseline,
      currentCoverage: current,
      delta,
      regressionDetected,
    });
  }

  return records;
}

// ─── Failure origin classification (§47) ─────────────────────────────────────

/**
 * Classify the origin of a monitor run failure.
 * Do NOT tell users their website failed when it was the analyzer that failed.
 */
export function classifyFailureOrigin(params: {
  httpStatus?: number | null;
  workerCrashed?: boolean;
  browserStartFailed?: boolean;
  browserServiceUnavailable?: boolean;
  notificationFailed?: boolean;
  invalidConfiguration?: boolean;
  directHttpOk?: boolean;
}): MonitorFailureOrigin {
  if (params.invalidConfiguration) return 'configuration';
  if (params.notificationFailed) return 'notification-provider';
  if (params.browserServiceUnavailable) return 'browser-provider';
  if (params.workerCrashed || params.browserStartFailed) return 'analyzer';

  // If the analyzer browser failed but direct HTTP to the URL succeeded,
  // the site is up — this is an analyzer failure, not a site failure.
  if (params.directHttpOk) return 'analyzer';

  if (params.httpStatus !== undefined && params.httpStatus !== null) {
    if (params.httpStatus >= 500) return 'target-site';
    if (params.httpStatus === 429) return 'target-site'; // rate limiting by target
    if (params.httpStatus === 0) return 'analyzer';      // connection refused = infra
  }

  return 'unknown';
}

// ─── Score change attribution ─────────────────────────────────────────────────

import type { MonitorScoreChange, ScoreChangeCause } from './types';

export function buildScoreChanges(
  categories: string[],
  currentScores: Record<string, number | null>,
  baselineScores: Record<string, number | null>,
  coverageChanges: CoverageChangeRecord[],
  pageSampleChanged: boolean,
): MonitorScoreChange[] {
  return categories.map((category) => {
    const current = currentScores[category] ?? null;
    const baseline = baselineScores[category] ?? null;
    const delta = current !== null && baseline !== null ? current - baseline : null;
    const comparable = current !== null && baseline !== null;

    const causes: ScoreChangeCause[] = [];

    if (delta !== null && delta !== 0) {
      if (pageSampleChanged) causes.push('page-sample-changed');

      const coverageChange = coverageChanges.find((c) => c.category === category);
      if (coverageChange?.regressionDetected) causes.push('coverage-changed');

      if (delta < 0 && !pageSampleChanged) causes.push('metric-regressed');
      if (delta > 0 && !pageSampleChanged) causes.push('metric-improved');
    }

    return {
      category,
      previousScore: baseline,
      currentScore: current,
      delta,
      comparable,
      causes,
    };
  });
}
