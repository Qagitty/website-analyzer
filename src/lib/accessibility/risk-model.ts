/**
 * Transparent risk model for accessibility assessment.
 *
 * Each dimension is computed from observable evidence.
 * The final risk level is derived from a weighted combination — all weights
 * are documented here and visible to the user.
 *
 * This model produces an observed technical risk indicator, NOT:
 *  - A legal compliance determination
 *  - A guarantee of website accessibility
 *  - A certification of any kind
 *  - A prediction of regulatory enforcement outcomes
 */

import type {
  RegionalAccessibilityRisk,
  AccessibilityRiskAssessment,
  AccessibilityRiskLevel,
} from '@/types/accessibility-profile';
import { RISK_LEVEL_LABELS } from '@/types/accessibility-profile';

// ── Dimension weights (must sum to 1.0) ──────────────────────────────────────

export const RISK_WEIGHTS = {
  technicalSeverity:        0.30,
  affectedPageCoverage:     0.20,
  issueRecurrence:          0.15,
  criticalJourneyExposure:  0.15,
  manualCoverageGap:        0.10,
  remediationAge:           0.05,
  evidenceCompleteness:     0.05,   // higher completeness = LOWER risk
} as const;

// Validate weights sum to 1.0 at import time
const _weightSum = Object.values(RISK_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(_weightSum - 1.0) > 0.001) {
  throw new Error(`Risk model weights must sum to 1.0, got ${_weightSum}`);
}

// ── Risk thresholds ───────────────────────────────────────────────────────────

const THRESHOLDS: { score: number; level: AccessibilityRiskLevel }[] = [
  { score: 75, level: 'critical' },
  { score: 50, level: 'high' },
  { score: 25, level: 'moderate' },
  { score: 0,  level: 'low' },
];

// ── Dimension calculators ─────────────────────────────────────────────────────

interface FindingSummary {
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  pageUrl: string;
  ruleId: string;
  ageInDays: number;
  isCriticalJourney: boolean;
  status: string;
}

interface ManualCheckSummary {
  total:    number;
  completed: number;
}

interface EvidenceSummary {
  hasBaselineAssessment:  boolean;
  hasManualChecks:        boolean;
  hasRemediationPlan:     boolean;
  hasAccessibilityStatement: boolean;
  assessmentAgeInDays:    number | null;
}

export interface RiskModelInput {
  findings:       FindingSummary[];
  totalPages:     number;
  manualChecks:   ManualCheckSummary;
  evidence:       EvidenceSummary;
}

function technicalSeverityScore(findings: FindingSummary[]): number {
  const open = findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
  if (open.length === 0) return 0;
  const highSeverity = open.filter((f) => f.impact === 'critical' || f.impact === 'serious').length;
  return Math.min(100, Math.round((highSeverity / open.length) * 100));
}

function affectedPageCoverageScore(findings: FindingSummary[], totalPages: number): number {
  if (totalPages === 0) return 50; // no data = moderate risk
  const pagesWithIssues = new Set(
    findings
      .filter((f) => f.status === 'open' || f.status === 'in_progress')
      .map((f) => f.pageUrl),
  ).size;
  return Math.min(100, Math.round((pagesWithIssues / totalPages) * 100));
}

function issueRecurrenceScore(findings: FindingSummary[]): number {
  const open = findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
  if (open.length === 0) return 0;

  const ruleCounts: Record<string, number> = {};
  for (const f of open) {
    ruleCounts[f.ruleId] = (ruleCounts[f.ruleId] ?? 0) + 1;
  }
  const recurrentRules = Object.values(ruleCounts).filter((c) => c >= 3).length;
  return Math.min(100, recurrentRules * 20);
}

function criticalJourneyExposureScore(findings: FindingSummary[]): number {
  const open = findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
  if (open.length === 0) return 0;
  const journeyFindings = open.filter((f) => f.isCriticalJourney);
  if (journeyFindings.length === 0) return 0;
  const criticalInJourney = journeyFindings.filter(
    (f) => f.impact === 'critical' || f.impact === 'serious',
  ).length;
  return Math.min(100, Math.round((criticalInJourney / journeyFindings.length) * 100));
}

function manualCoverageGapScore(checks: ManualCheckSummary): number {
  if (checks.total === 0) return 80; // no manual checks at all = high gap
  return Math.min(100, Math.round(((checks.total - checks.completed) / checks.total) * 100));
}

function remediationAgeScore(findings: FindingSummary[]): number {
  const open = findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
  if (open.length === 0) return 0;
  const avgAge = open.reduce((s, f) => s + f.ageInDays, 0) / open.length;
  if (avgAge < 7)   return 10;
  if (avgAge < 30)  return 30;
  if (avgAge < 90)  return 55;
  if (avgAge < 180) return 75;
  return 90;
}

function evidenceCompletenessScore(evidence: EvidenceSummary): number {
  let score = 0;
  if (evidence.hasBaselineAssessment)     score += 30;
  if (evidence.hasManualChecks)           score += 25;
  if (evidence.hasRemediationPlan)        score += 20;
  if (evidence.hasAccessibilityStatement) score += 15;
  if (evidence.assessmentAgeInDays !== null && evidence.assessmentAgeInDays <= 90) score += 10;
  return Math.min(100, score);
}

// ── Main calculator ───────────────────────────────────────────────────────────

export function calculateRiskDimensions(input: RiskModelInput): RegionalAccessibilityRisk {
  return {
    technicalSeverity:       technicalSeverityScore(input.findings),
    affectedPageCoverage:    affectedPageCoverageScore(input.findings, input.totalPages),
    issueRecurrence:         issueRecurrenceScore(input.findings),
    criticalJourneyExposure: criticalJourneyExposureScore(input.findings),
    manualCoverageGap:       manualCoverageGapScore(input.manualChecks),
    remediationAge:          remediationAgeScore(input.findings),
    evidenceCompleteness:    evidenceCompletenessScore(input.evidence),
  };
}

export function calculateRiskScore(dimensions: RegionalAccessibilityRisk): number {
  // evidenceCompleteness reduces risk (invert it)
  const invertedEvidence = 100 - dimensions.evidenceCompleteness;
  const rawScore =
    dimensions.technicalSeverity       * RISK_WEIGHTS.technicalSeverity       +
    dimensions.affectedPageCoverage    * RISK_WEIGHTS.affectedPageCoverage    +
    dimensions.issueRecurrence         * RISK_WEIGHTS.issueRecurrence         +
    dimensions.criticalJourneyExposure * RISK_WEIGHTS.criticalJourneyExposure +
    dimensions.manualCoverageGap       * RISK_WEIGHTS.manualCoverageGap       +
    dimensions.remediationAge          * RISK_WEIGHTS.remediationAge          +
    invertedEvidence                   * RISK_WEIGHTS.evidenceCompleteness;

  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

export function scoreToRiskLevel(score: number): AccessibilityRiskLevel {
  for (const threshold of THRESHOLDS) {
    if (score >= threshold.score) return threshold.level;
  }
  return 'low';
}

export function assessRisk(input: RiskModelInput): AccessibilityRiskAssessment {
  const dimensions = calculateRiskDimensions(input);
  const score      = calculateRiskScore(dimensions);
  const riskLevel  = scoreToRiskLevel(score);

  const pagesNote = input.totalPages > 0
    ? `${input.totalPages} page${input.totalPages !== 1 ? 's' : ''} assessed`
    : 'page count unknown';
  const manualNote = input.manualChecks.total > 0
    ? `${input.manualChecks.completed}/${input.manualChecks.total} manual checks completed`
    : 'no manual checks recorded';

  return {
    dimensions,
    riskLevel,
    riskLabel:   RISK_LEVEL_LABELS[riskLevel],
    scopeNote:   `Risk assessment based on automated scanning (${pagesNote}) and ${manualNote}. Automated scanning covers a subset of WCAG success criteria. This indicator reflects observed technical risk and does not determine legal obligations or guarantee accessibility.`,
    calculatedAt: new Date().toISOString(),
  };
}
