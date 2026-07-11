/**
 * Shared compliance utilities.
 * Used by EAAComplianceSection (per-report) and the Compliance Dashboard (site-wide).
 */

import type { AccessibilityIssue } from '@/types/analysis';

/**
 * Technical assessment status — not a legal compliance determination.
 *
 * - 'no_blockers': zero automated violations detected; manual testing still required
 * - 'gaps':        no critical/serious automated violations, but other issues present
 * - 'blockers':    critical or serious automated violations detected
 *
 * None of these values represent legal certification or guarantee conformance.
 */
export type ComplianceLevel = 'no_blockers' | 'gaps' | 'blockers';

/** @deprecated Use ComplianceLevel. Retained for DB values during migration. */
export type LegacyComplianceLevel = 'compliant' | 'partial' | 'non-compliant';

export function normalizeLegacyLevel(level: string): ComplianceLevel {
  if (level === 'compliant') return 'no_blockers';
  if (level === 'partial')   return 'gaps';
  return 'blockers';
}

export interface ComplianceSummary {
  level: ComplianceLevel;
  totalIssues: number;
  criticalCount: number;
  moderateCount: number;
  perceivableCount: number;
  operableCount: number;
}

/** Derive automated technical status from a list of axe-core violations. */
export function getComplianceLevel(issues: AccessibilityIssue[]): ComplianceLevel {
  const critical = issues.filter(
    (i) => i.impact === 'critical' || i.impact === 'serious',
  ).length;
  if (issues.length === 0) return 'no_blockers';
  if (critical === 0) return 'gaps';
  return 'blockers';
}

/** Full compliance summary including category breakdowns. */
export function getComplianceSummary(issues: AccessibilityIssue[]): ComplianceSummary {
  const criticalCount  = issues.filter((i) => i.impact === 'critical' || i.impact === 'serious').length;
  const moderateCount  = issues.filter((i) => i.impact === 'moderate' || i.impact === 'minor').length;
  const perceivableCount = issues.filter((i) => i.wcagCriteria.some((c) => /^wcag1/i.test(c))).length;
  const operableCount    = issues.filter((i) => i.wcagCriteria.some((c) => /^wcag2[0-9]/i.test(c))).length;
  return {
    level: getComplianceLevel(issues),
    totalIssues: issues.length,
    criticalCount,
    moderateCount,
    perceivableCount,
    operableCount,
  };
}

/** Display metadata per technical assessment status. */
export const COMPLIANCE_CONFIG = {
  no_blockers: {
    label:       'No automated blockers detected',
    short:       'No Blockers',
    badgeClass:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    textClass:   'text-emerald-400',
    borderClass: 'border-l-emerald-500',
    bgClass:     'bg-emerald-500/5',
    dot:         'bg-emerald-400',
  },
  gaps: {
    label:       'Potential accessibility gaps',
    short:       'Gaps Detected',
    badgeClass:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    textClass:   'text-amber-400',
    borderClass: 'border-l-amber-500',
    bgClass:     'bg-amber-500/5',
    dot:         'bg-amber-400',
  },
  blockers: {
    label:       'Accessibility blockers found',
    short:       'Blockers Found',
    badgeClass:  'bg-red-500/10 text-red-400 border-red-500/20',
    textClass:   'text-red-400',
    borderClass: 'border-l-red-500',
    bgClass:     'bg-red-500/5',
    dot:         'bg-red-400',
  },
} satisfies Record<ComplianceLevel, {
  label: string; short: string; badgeClass: string; textClass: string;
  borderClass: string; bgClass: string; dot: string;
}>;
