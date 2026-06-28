/**
 * Score adapters and utilities — bridges existing rich audit results to the
 * unified CategoryScoreResult type system (§4, §8, §21, §36, §37).
 *
 * Adapters never recompute scores. They extract the already-computed score
 * from each audit and wrap it in the canonical shape. The scoring logic
 * stays in each category module; this file only reshapes the output.
 */

import type {
  CategoryScoreResult,
  ScoreCheckResult,
  AuditCoverage,
  CheckExecutionStatus,
  CheckConfidence,
  CheckSource,
  ScoreLabel,
  ScoreComparabilityResult,
} from './scoring-types';

// ── Score labels (§8) ─────────────────────────────────────────────────────────

/**
 * Returns the human-readable band label for a 0–100 score.
 * Returns "Not measured" when score is null.
 *
 * Bands (verbatim from spec §8):
 *   90–100 Excellent
 *   75–89  Good
 *   50–74  Needs improvement
 *   25–49  Poor
 *   0–24   Critical
 */
export function scoreLabel(score: number | null): ScoreLabel {
  if (score === null) return 'Not measured';
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs improvement';
  if (score >= 25) return 'Poor';
  return 'Critical';
}

/** Tailwind colour tokens for each score label — for consistent UI rendering. */
export const SCORE_LABEL_COLORS: Record<ScoreLabel, { text: string; bg: string; border: string }> = {
  'Excellent':          { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  'Good':               { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'Needs improvement':  { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  'Poor':               { text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30'  },
  'Critical':           { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30'     },
  'Not measured':       { text: 'text-zinc-400',    bg: 'bg-zinc-500/10',    border: 'border-zinc-500/20'    },
};

// ── Null vs zero guard ────────────────────────────────────────────────────────

/**
 * Returns true when score is null (audit did not run), false when score is 0
 * (audit ran and every check failed). The distinction matters for display:
 * null → "—" (no data), 0 → "0 Critical" (measured, all failed).
 */
export function isNotMeasured(score: number | null): score is null {
  return score === null;
}

// ── Coverage helper ───────────────────────────────────────────────────────────

function emptyCoverage(): AuditCoverage {
  return {
    supportedChecks: 0,
    applicableChecks: 0,
    executedChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    warningChecks: 0,
    manualReviewChecks: 0,
    unavailableChecks: 0,
    notExecutedChecks: 0,
    percentage: 0,
  };
}

// ── Adapter: legacy integer score (§36, §37) ──────────────────────────────────

/**
 * Wraps a plain integer score (stored in the database before the scoring
 * architecture was introduced) in a minimal CategoryScoreResult.
 *
 * This is the backward-compatibility adapter. Every consumer that reads a
 * pre-v2 score from the database must call this instead of inventing its own
 * wrapper. The adapted result carries enough metadata to identify its origin.
 */
export function adaptLegacyScore(
  categoryId: string,
  score: number | null,
): CategoryScoreResult {
  const clampedScore = score !== null ? Math.min(100, Math.max(0, Math.round(score))) : null;
  return {
    categoryId,
    score: clampedScore,
    scoreVersion: `${categoryId}-legacy`,
    rawPoints: clampedScore ?? 0,
    availablePoints: 100,
    maximumPoints: 100,
    coverage: emptyCoverage(),
    confidence: 'low',
    checks: [],
    limitations: [
      'Score was computed before the scoring architecture was introduced.',
      'Per-check breakdown, coverage, and confidence data are not available.',
      'Do not compare this score to scores produced by current versions.',
    ],
  };
}

// ── Adapter: SEO audit ────────────────────────────────────────────────────────

export function seoAuditToCategoryScore(
  audit: import('../../types/seo').SeoAuditResult,
): CategoryScoreResult {
  const findings = audit.findings ?? [];
  const cov = audit.coverage;

  const checks: ScoreCheckResult[] = findings.map(f => {
    const status = findingStatusToCheck(f.status as string);
    const source = findingSourceToCheck(f.evidence?.[0]?.source as string | undefined);
    const confidence = confidenceFrom(f.confidence as string | undefined);
    const weight = (f.severity === 'critical' ? 4 : f.severity === 'high' ? 2 : f.severity === 'medium' ? 1 : 0.5);
    const earned = status === 'passed' ? weight : status === 'warning' ? weight * 0.5 : 0;
    return {
      checkId: f.ruleId ?? f.id,
      categoryId: 'seo',
      status,
      applicability: 'applicable',
      confidence,
      source,
      weight,
      earnedPoints: earned,
      maxPoints: weight,
      deduction: weight - earned,
      capped: false,
      reason: f.description ?? '',
      evidenceRefs: (f.affectedPages ?? []).slice(0, 3),
    };
  });

  const passed = checks.filter(c => c.status === 'passed').length;
  const failed = checks.filter(c => c.status === 'failed').length;
  const unavailable = checks.filter(c => c.status === 'unavailable').length;
  const warning = checks.filter(c => c.status === 'warning').length;
  const manual = checks.filter(c => c.status === 'manual-review').length;
  const executed = checks.length - unavailable;

  const coverage: AuditCoverage = cov
    ? {
        supportedChecks: cov.supportedChecks,
        applicableChecks: cov.supportedChecks - (cov.skippedChecks ?? 0),
        executedChecks: cov.executedChecks,
        passedChecks: passed,
        failedChecks: failed,
        warningChecks: warning,
        manualReviewChecks: manual,
        unavailableChecks: cov.unavailableChecks,
        notExecutedChecks: 0,
        percentage: cov.percentage,
      }
    : {
        ...emptyCoverage(),
        supportedChecks: checks.length,
        applicableChecks: checks.length,
        executedChecks: executed,
        passedChecks: passed,
        failedChecks: failed,
        warningChecks: warning,
        manualReviewChecks: manual,
        unavailableChecks: unavailable,
        percentage: checks.length > 0 ? Math.round((executed / checks.length) * 100) : 0,
      };

  const rawPoints = checks.reduce((s, c) => s + c.earnedPoints, 0);
  const maxPoints = checks.reduce((s, c) => s + c.maxPoints, 0);

  return {
    categoryId: 'seo',
    score: audit.score,
    scoreVersion: audit.scoreVersion ?? 'seo-v1',
    rawPoints,
    availablePoints: maxPoints,
    maximumPoints: maxPoints,
    coverage,
    confidence: overallConfidence(checks),
    checks,
    limitations: cov?.limitations ?? [],
  };
}

// ── Adapter: accessibility audit ──────────────────────────────────────────────

export function accessibilityAuditToCategoryScore(
  audit: import('../../types/accessibility').AccessibilityAuditResult,
): CategoryScoreResult {
  const findings = audit.findings ?? [];

  const checks: ScoreCheckResult[] = findings.map(f => {
    const rawStatus = f.status as string;
    const status: CheckExecutionStatus =
      rawStatus === 'confirmed' ? 'failed' :
      rawStatus === 'likely' ? 'failed' :
      rawStatus === 'passed' ? 'passed' :
      rawStatus === 'manual-review' ? 'manual-review' :
      rawStatus === 'not-applicable' ? 'not-applicable' :
      'unavailable';

    const severityWeight = (f.severity === 'critical' ? 12 : f.severity === 'serious' ? 7 : f.severity === 'moderate' ? 4 : 2);
    const earned = status === 'passed' ? severityWeight : 0;
    const confidence: CheckConfidence = rawStatus === 'confirmed' ? 'high' : rawStatus === 'likely' ? 'medium' : 'low';

    return {
      checkId: f.id,
      categoryId: 'accessibility',
      status,
      applicability: status === 'not-applicable' ? 'not-applicable' : 'applicable',
      confidence,
      source: 'html' as CheckSource,
      weight: severityWeight,
      earnedPoints: earned,
      maxPoints: severityWeight,
      deduction: severityWeight - earned,
      capped: false,
      reason: f.what ?? f.description ?? '',
      evidenceRefs: (f.where ?? []).map(n => n.selector ?? '').filter(Boolean).slice(0, 3),
    };
  });

  const passed = checks.filter(c => c.status === 'passed').length;
  const failed = checks.filter(c => c.status === 'failed').length;
  const warning = checks.filter(c => c.status === 'warning').length;
  const manual = checks.filter(c => c.status === 'manual-review').length;
  const na = checks.filter(c => c.status === 'not-applicable').length;
  const executed = checks.length - na;

  const coverage: AuditCoverage = {
    supportedChecks: checks.length,
    applicableChecks: checks.length - na,
    executedChecks: executed,
    passedChecks: passed,
    failedChecks: failed,
    warningChecks: warning,
    manualReviewChecks: manual,
    unavailableChecks: 0,
    notExecutedChecks: 0,
    percentage: checks.length > 0 ? Math.round((executed / checks.length) * 100) : 0,
  };

  const rawPoints = checks.reduce((s, c) => s + c.earnedPoints, 0);
  const maxPoints = checks.reduce((s, c) => s + c.maxPoints, 0);

  const limitations: string[] = [audit.disclaimer ?? ''].filter(Boolean);

  return {
    categoryId: 'accessibility',
    score: audit.score,
    scoreVersion: audit.version ?? 'accessibility-v2',
    rawPoints,
    availablePoints: maxPoints,
    maximumPoints: maxPoints,
    coverage,
    confidence: overallConfidence(checks),
    checks,
    limitations,
  };
}

// ── Adapter: best practices audit ─────────────────────────────────────────────

export function bestPracticesAuditToCategoryScore(
  audit: import('../../types/best-practices').BestPracticesAuditResult,
): CategoryScoreResult {
  const findings = audit.findings ?? [];

  const checks: ScoreCheckResult[] = findings.map(f => {
    const status = findingStatusToCheck(f.status as string);
    const source = f.source ? (f.source as CheckSource) : 'http' as CheckSource;
    const confidence = confidenceFrom(f.confidence as string | undefined);
    const weight = (f.severity === 'critical' ? 4 : f.severity === 'high' ? 2 : f.severity === 'medium' ? 1 : 0.5);
    const earned = status === 'passed' ? weight : status === 'warning' ? weight * 0.5 : 0;

    return {
      checkId: f.ruleId ?? f.id,
      categoryId: 'best-practices',
      status,
      applicability: status === 'not-applicable' ? 'not-applicable' : 'applicable',
      confidence,
      source,
      weight,
      earnedPoints: earned,
      maxPoints: weight,
      deduction: weight - earned,
      capped: false,
      reason: f.description ?? f.title ?? '',
      evidenceRefs: (f.affectedPages ?? []).slice(0, 3),
    };
  });

  const cov = audit.coverage;
  const passed = checks.filter(c => c.status === 'passed').length;
  const failed = checks.filter(c => c.status === 'failed').length;
  const warning = checks.filter(c => c.status === 'warning').length;
  const manual = checks.filter(c => c.status === 'manual-review').length;
  const unavailable = checks.filter(c => c.status === 'unavailable').length;
  const executed = checks.length - unavailable;

  const coverage: AuditCoverage = cov
    ? {
        supportedChecks: cov.supportedChecks,
        applicableChecks: cov.supportedChecks,
        executedChecks: cov.executedChecks,
        passedChecks: passed,
        failedChecks: failed,
        warningChecks: warning,
        manualReviewChecks: manual,
        unavailableChecks: cov.unavailableChecks,
        notExecutedChecks: 0,
        percentage: cov.percentage,
      }
    : {
        ...emptyCoverage(),
        supportedChecks: checks.length,
        executedChecks: executed,
        passedChecks: passed,
        failedChecks: failed,
        warningChecks: warning,
        manualReviewChecks: manual,
        unavailableChecks: unavailable,
        percentage: checks.length > 0 ? Math.round((executed / checks.length) * 100) : 0,
      };

  const rawPoints = checks.reduce((s, c) => s + c.earnedPoints, 0);
  const maxPoints = checks.reduce((s, c) => s + c.maxPoints, 0);

  return {
    categoryId: 'best-practices',
    score: audit.score,
    scoreVersion: audit.scoreVersion ?? 'bp-v1',
    rawPoints,
    availablePoints: maxPoints,
    maximumPoints: maxPoints,
    coverage,
    confidence: overallConfidence(checks),
    checks,
    limitations: cov?.limitations ?? [],
  };
}

// ── Adapter: LLM readiness audit ──────────────────────────────────────────────

export function llmReadinessAuditToCategoryScore(
  audit: import('../../types/llm-readiness').LlmReadinessAuditResult,
): CategoryScoreResult {
  const findings = audit.findings ?? [];

  const checks: ScoreCheckResult[] = findings.map(f => {
    const status = findingStatusToCheck(f.status as string);
    const confidence = confidenceFrom(f.confidence as string | undefined);
    const weight = (f.severity === 'critical' ? 4 : f.severity === 'high' ? 2 : f.severity === 'medium' ? 1 : 0.5);
    const earned = status === 'passed' ? weight : status === 'warning' ? weight * 0.5 : 0;

    return {
      checkId: f.ruleId ?? f.id,
      categoryId: 'llm-readiness',
      status,
      applicability: status === 'not-applicable' ? 'not-applicable' : 'applicable',
      confidence,
      source: 'html' as CheckSource,
      weight,
      earnedPoints: earned,
      maxPoints: weight,
      deduction: weight - earned,
      capped: false,
      reason: f.description ?? f.title ?? '',
      evidenceRefs: [],
    };
  });

  const cov = audit.coverage;
  const passed = checks.filter(c => c.status === 'passed').length;
  const failed = checks.filter(c => c.status === 'failed').length;
  const warning = checks.filter(c => c.status === 'warning').length;
  const manual = checks.filter(c => c.status === 'manual-review').length;
  const unavailable = checks.filter(c => c.status === 'unavailable').length;
  const executed = checks.length - unavailable;

  const coverage: AuditCoverage = cov
    ? {
        supportedChecks: cov.supportedSignals,
        applicableChecks: cov.supportedSignals,
        executedChecks: cov.executedSignals,
        passedChecks: passed,
        failedChecks: failed,
        warningChecks: warning,
        manualReviewChecks: manual,
        unavailableChecks: cov.unavailableSignals,
        notExecutedChecks: 0,
        percentage: cov.percentage,
      }
    : {
        ...emptyCoverage(),
        supportedChecks: checks.length,
        executedChecks: executed,
        passedChecks: passed,
        failedChecks: failed,
        warningChecks: warning,
        manualReviewChecks: manual,
        unavailableChecks: unavailable,
        percentage: checks.length > 0 ? Math.round((executed / checks.length) * 100) : 0,
      };

  const rawPoints = checks.reduce((s, c) => s + c.earnedPoints, 0);
  const maxPoints = checks.reduce((s, c) => s + c.maxPoints, 0);

  return {
    categoryId: 'llm-readiness',
    score: audit.score,
    scoreVersion: audit.scoreVersion ?? 'llm-readiness-v2',
    rawPoints,
    availablePoints: maxPoints,
    maximumPoints: maxPoints,
    coverage,
    confidence: overallConfidence(checks),
    checks,
    limitations: cov?.limitations ?? [],
  };
}

// ── Adapter: performance audit ────────────────────────────────────────────────

export function performanceAuditToCategoryScore(
  score: number | null,
  scoreVersion: string,
  breakdown: Array<{ category: string; weight: number; normalizedScore: number | null; weightedContribution: number | null; reason: string }>,
  limitations: string[],
): CategoryScoreResult {
  const items = Array.isArray(breakdown) ? breakdown : [];
  const checks: ScoreCheckResult[] = items.map(b => {
    const status: CheckExecutionStatus = b.normalizedScore === null ? 'unavailable' : b.normalizedScore >= 65 ? 'passed' : 'failed';
    const earned = b.weightedContribution !== null ? Math.max(0, b.weightedContribution) : 0;
    return {
      checkId: `perf-${b.category}`,
      categoryId: 'performance',
      status,
      applicability: b.normalizedScore === null ? 'conditional' : 'applicable',
      confidence: b.normalizedScore === null ? 'low' : 'medium',
      source: 'heuristic' as CheckSource,
      weight: b.weight,
      earnedPoints: earned,
      maxPoints: b.weight * 100,
      deduction: b.weight * 100 - earned,
      capped: false,
      reason: b.reason ?? b.category,
      evidenceRefs: [],
    };
  });

  const passed = checks.filter(c => c.status === 'passed').length;
  const failed = checks.filter(c => c.status === 'failed').length;
  const unavailable = checks.filter(c => c.status === 'unavailable').length;
  const executed = checks.length - unavailable;

  const coverage: AuditCoverage = {
    supportedChecks: checks.length,
    applicableChecks: checks.length,
    executedChecks: executed,
    passedChecks: passed,
    failedChecks: failed,
    warningChecks: 0,
    manualReviewChecks: 0,
    unavailableChecks: unavailable,
    notExecutedChecks: 0,
    percentage: checks.length > 0 ? Math.round((executed / checks.length) * 100) : 0,
  };

  const rawPoints = checks.reduce((s, c) => s + c.earnedPoints, 0);
  const maxPoints = checks.reduce((s, c) => s + c.maxPoints, 0);

  return {
    categoryId: 'performance',
    score,
    scoreVersion,
    rawPoints,
    availablePoints: maxPoints,
    maximumPoints: maxPoints,
    coverage,
    confidence: unavailable > 0 ? 'medium' : 'high',
    checks,
    limitations,
  };
}

// ── Score comparability (§21) ─────────────────────────────────────────────────

/**
 * Determines whether two CategoryScoreResults can be meaningfully compared.
 * Scores with different scoreVersions, categoryIds, or fundamentally different
 * coverage levels should not be shown as a diff without a warning.
 */
export function checkScoreComparability(
  a: CategoryScoreResult,
  b: CategoryScoreResult,
): ScoreComparabilityResult {
  const differences: string[] = [];

  if (a.categoryId !== b.categoryId) {
    differences.push(`Category mismatch: "${a.categoryId}" vs "${b.categoryId}"`);
  }
  if (a.scoreVersion !== b.scoreVersion) {
    differences.push(`Score version changed: "${a.scoreVersion}" → "${b.scoreVersion}"`);
  }
  if (Math.abs(a.coverage.percentage - b.coverage.percentage) > 20) {
    differences.push(
      `Coverage changed significantly: ${a.coverage.percentage}% → ${b.coverage.percentage}%`,
    );
  }
  if (a.score === null || b.score === null) {
    differences.push('One or both scores are null (audit did not complete)');
  }

  const comparable = differences.length === 0;
  return {
    comparable,
    differences,
    warning: comparable
      ? undefined
      : `Score comparison may be misleading: ${differences.join('; ')}`,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function findingStatusToCheck(status: string | undefined): CheckExecutionStatus {
  switch (status) {
    case 'passed':         return 'passed';
    case 'failed':         return 'failed';
    case 'warning':        return 'warning';
    case 'manual-review':  return 'manual-review';
    case 'not-applicable': return 'not-applicable';
    case 'unavailable':    return 'unavailable';
    default:               return 'not-executed';
  }
}

function findingSourceToCheck(source: string | undefined): CheckSource {
  const valid: CheckSource[] = ['browser','http','html','rendered-dom','network',
    'accessibility-engine','structured-data','crawler','heuristic','ai-assisted','legacy'];
  return valid.includes(source as CheckSource) ? (source as CheckSource) : 'html';
}

function confidenceFrom(c: string | undefined): CheckConfidence {
  if (c === 'high') return 'high';
  if (c === 'low')  return 'low';
  return 'medium';
}

function overallConfidence(checks: ScoreCheckResult[]): CheckConfidence {
  if (checks.length === 0) return 'low';
  const lowCount = checks.filter(c => c.confidence === 'low').length;
  const highCount = checks.filter(c => c.confidence === 'high').length;
  if (lowCount > checks.length * 0.4) return 'low';
  if (highCount > checks.length * 0.6) return 'high';
  return 'medium';
}
