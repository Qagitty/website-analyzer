/**
 * Shared compliance utilities.
 * Used by EAAComplianceSection (per-report) and the Compliance Dashboard (site-wide).
 */

import type { AccessibilityIssue } from '@/types/analysis';

export type ComplianceLevel = 'compliant' | 'partial' | 'non-compliant';

export interface ComplianceSummary {
  level: ComplianceLevel;
  totalIssues: number;
  criticalCount: number;
  moderateCount: number;
  perceivableCount: number;
  operableCount: number;
}

/** Derive EAA/WCAG compliance level from a list of axe-core violations. */
export function getComplianceLevel(issues: AccessibilityIssue[]): ComplianceLevel {
  const critical = issues.filter(
    (i) => i.impact === 'critical' || i.impact === 'serious',
  ).length;
  if (issues.length === 0) return 'compliant';
  if (critical === 0) return 'partial';
  return 'non-compliant';
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

/** Display metadata per compliance level. */
export const COMPLIANCE_CONFIG = {
  compliant: {
    label:       'Compliant',
    short:       'Compliant',
    badgeClass:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    textClass:   'text-emerald-400',
    borderClass: 'border-l-emerald-500',
    bgClass:     'bg-emerald-500/5',
    dot:         'bg-emerald-400',
  },
  partial: {
    label:       'Partially Compliant',
    short:       'Partial',
    badgeClass:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    textClass:   'text-amber-400',
    borderClass: 'border-l-amber-500',
    bgClass:     'bg-amber-500/5',
    dot:         'bg-amber-400',
  },
  'non-compliant': {
    label:       'Non-Compliant',
    short:       'Non-Compliant',
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
