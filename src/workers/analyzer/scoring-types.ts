/**
 * Centralized scoring type system — §2, §5, §6 of the Scoring Architecture spec.
 *
 * Every category scorer (performance, accessibility, SEO, best practices,
 * security headers, LLM readiness) must produce a CategoryScoreResult.
 * No other module may invent its own scoring shape.
 *
 * Invariants:
 *   score === null  → the category audit failed entirely; do not display 0
 *   score === 0     → the audit ran successfully and every check failed
 *   coverage.percentage is always 0–100
 */

// ── Check-level types ─────────────────────────────────────────────────────────

/** Every possible outcome for a single check execution. */
export type CheckExecutionStatus =
  | 'passed'
  | 'failed'
  | 'warning'
  | 'manual-review'
  | 'not-applicable'
  | 'unavailable'
  | 'not-executed';

/** How confident the engine is that the check result is accurate. */
export type CheckConfidence = 'high' | 'medium' | 'low';

/**
 * Where the evidence for a check was obtained.
 * Callers must not invent new values — add them here if needed.
 */
export type CheckSource =
  | 'browser'
  | 'http'
  | 'html'
  | 'rendered-dom'
  | 'network'
  | 'accessibility-engine'
  | 'structured-data'
  | 'crawler'
  | 'heuristic'
  | 'ai-assisted'
  | 'legacy';

/** Per-check result within a CategoryScoreResult. */
export interface ScoreCheckResult {
  checkId: string;
  categoryId: string;
  status: CheckExecutionStatus;
  applicability: 'applicable' | 'not-applicable' | 'conditional';
  confidence: CheckConfidence;
  source: CheckSource;
  weight: number;
  earnedPoints: number;
  maxPoints: number;
  /** Points deducted from the base score (0 when status is passed). */
  deduction: number;
  /** True when a deduction cap prevented the full penalty from applying. */
  capped: boolean;
  reason: string;
  evidenceRefs: string[];
}

// ── Coverage ──────────────────────────────────────────────────────────────────

/** Coverage summary for a single category audit. */
export interface AuditCoverage {
  supportedChecks: number;
  applicableChecks: number;
  executedChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  manualReviewChecks: number;
  unavailableChecks: number;
  notExecutedChecks: number;
  /** executedChecks / supportedChecks × 100, rounded to nearest integer. */
  percentage: number;
}

// ── Category result ───────────────────────────────────────────────────────────

/**
 * Canonical per-category output. Every scorer must return exactly one of these.
 *
 * score === null means the audit itself failed (network error, parse error, etc.).
 * score === 0   means the audit ran and every applicable check failed.
 * Never conflate the two.
 */
export interface CategoryScoreResult {
  categoryId: string;
  score: number | null;
  /** Semver-style version string, e.g. "performance-v2". Increment when formula changes. */
  scoreVersion: string;
  rawPoints: number;
  availablePoints: number;
  maximumPoints: number;
  coverage: AuditCoverage;
  confidence: CheckConfidence;
  checks: ScoreCheckResult[];
  limitations: string[];
}

// ── Overall score ─────────────────────────────────────────────────────────────

export interface OverallScoreResult {
  score: number | null;
  scoreVersion: string;
  categoryContributions: Array<{
    categoryId: string;
    score: number | null;
    weight: number;
    contribution: number | null;
  }>;
  limitations: string[];
}

// ── Rule registry ─────────────────────────────────────────────────────────────

/** Deduction cap preventing a single rule from dominating the score. */
export interface DeductionCap {
  scope: 'rule' | 'page' | 'component' | 'origin' | 'site';
  maximumDeduction: number;
  reason: string;
}

/** Single entry in the centralized rule registry. */
export interface ScoreRuleDefinition {
  checkId: string;
  categoryId: string;
  name: string;
  description: string;
  defaultWeight: number;
  applicability: 'always' | 'conditional' | 'optional';
  supportedAuditModes: string[];
  scoringMethod: 'binary' | 'weighted' | 'continuous' | 'penalty';
  deductionCap?: DeductionCap;
  experimental: boolean;
  limitations: string[];
}

/** Continuous-metric scoring definition (used by performance metrics). */
export interface MetricScoringDefinition {
  metricId: string;
  goodThreshold: number;
  poorThreshold: number;
  direction: 'lower-is-better' | 'higher-is-better';
  interpolation: 'linear' | 'step' | 'logarithmic';
  minimumScore: number;
  maximumScore: number;
}

// ── Comparability & change tracking ──────────────────────────────────────────

/** Whether two CategoryScoreResults can be meaningfully compared. */
export interface ScoreComparabilityResult {
  comparable: boolean;
  differences: string[];
  warning?: string;
}

/** Reason a score changed between two audit runs. */
export interface ScoreChangeReason {
  type:
    | 'finding-fixed'
    | 'finding-added'
    | 'metric-improved'
    | 'metric-degraded'
    | 'coverage-changed'
    | 'version-changed'
    | 'methodology-changed';
  description: string;
  scoreImpact?: number;
}

// ── Confidence breakdown ──────────────────────────────────────────────────────

/** Factors that contributed to a check's final confidence level. */
export interface ConfidenceBreakdown {
  finalConfidence: CheckConfidence;
  factors: Array<{
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    reason: string;
  }>;
}

// ── Score labels ──────────────────────────────────────────────────────────────

/** Human-readable label for a 0–100 score range. */
export type ScoreLabel =
  | 'Excellent'
  | 'Good'
  | 'Needs improvement'
  | 'Poor'
  | 'Critical'
  | 'Not measured';
