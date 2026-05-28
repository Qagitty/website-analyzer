import type React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import type { AccessibilityIssue } from '@/types/analysis';

interface Props {
  accessibilityIssues: AccessibilityIssue[] | undefined;
}

type ComplianceLevel = 'compliant' | 'partial' | 'non-compliant';

function determineLevel(issues: AccessibilityIssue[]): ComplianceLevel {
  const critical = issues.filter((i) => i.impact === 'critical' || i.impact === 'serious').length;
  if (critical === 0 && issues.length === 0) return 'compliant';
  if (critical === 0) return 'partial';
  return 'non-compliant';
}

const LEVEL_CONFIG = {
  compliant: {
    borderClass: 'border-l-emerald-500',
    bgClass: 'bg-emerald-500/5',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    badgeLabel: 'Compliant',
    Icon: ShieldCheck,
    iconClass: 'text-emerald-400',
    statusMessage: '✓ Your site meets WCAG 2.1 AA requirements and passes accessibility checks.',
    statusClass: 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/20',
  },
  partial: {
    borderClass: 'border-l-amber-500',
    bgClass: 'bg-amber-500/5',
    badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    badgeLabel: 'Partially Compliant',
    Icon: ShieldAlert,
    iconClass: 'text-amber-400',
    statusMessage: '⚠ Your site has minor accessibility issues. Review and fix them for full certification.',
    statusClass: 'text-amber-400 bg-amber-500/5 border border-amber-500/20',
  },
  'non-compliant': {
    borderClass: 'border-l-red-500',
    bgClass: 'bg-red-500/5',
    badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20',
    badgeLabel: 'Non-Compliant',
    Icon: ShieldX,
    iconClass: 'text-red-400',
    statusMessage: '✗ Your site has significant accessibility barriers. Immediate action required.',
    statusClass: 'text-red-400 bg-red-500/5 border border-red-500/20',
  },
} satisfies Record<ComplianceLevel, {
  borderClass: string;
  bgClass: string;
  badgeClass: string;
  badgeLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  statusMessage: string;
  statusClass: string;
}>;

/** Issues whose WCAG criteria start with "wcag1" → Perceivable (Principle 1) */
function isPerceivable(issue: AccessibilityIssue): boolean {
  return issue.wcagCriteria.some((c) => /^wcag1/i.test(c));
}

/** Issues whose WCAG criteria start with "wcag2" (but not "wcag2aa" alone) → Operable (Principle 2) */
function isOperable(issue: AccessibilityIssue): boolean {
  return issue.wcagCriteria.some((c) => /^wcag2[0-9]/i.test(c));
}

export function EAAComplianceSection({ accessibilityIssues }: Props) {
  if (!accessibilityIssues) return null;

  const level = determineLevel(accessibilityIssues);
  const config = LEVEL_CONFIG[level];
  const { Icon } = config;

  const critical = accessibilityIssues.filter((i) => i.impact === 'critical' || i.impact === 'serious').length;
  const moderate = accessibilityIssues.filter((i) => i.impact === 'moderate' || i.impact === 'minor').length;

  const perceivableIssues = accessibilityIssues.filter(isPerceivable);
  const operableIssues = accessibilityIssues.filter(isOperable);
  const wcagAaIssues = accessibilityIssues; // all issues are WCAG 2.1 AA violations

  const allWcagTags = Array.from(
    new Set(accessibilityIssues.flatMap((i) => i.wcagCriteria).filter((tag) => tag.startsWith('wcag')))
  ).sort();

  const issueWord = (n: number) => `${n} issue${n !== 1 ? 's' : ''}`;

  return (
    <section>
      <div className={`border-l-4 ${config.borderClass} ${config.bgClass} rounded-r-xl p-5`}>
        {/* Header */}
        <div className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 shrink-0 ${config.iconClass}`} />
              <span className="font-semibold text-foreground">
                European Accessibility Act (EAA)
              </span>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badgeClass}`}
            >
              {config.badgeLabel}
            </span>
          </div>

          {/* Deadline callout */}
          <p className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 text-xs text-red-400/80 mt-3 leading-relaxed">
            Accessibility law took effect June 2025. Businesses selling to EU customers
            face fines up to €100,000 or 4% of annual revenue.
          </p>
        </div>

        <div className="space-y-4">
          {/* Status message */}
          <div className={`rounded-md px-4 py-3 text-sm font-medium ${config.statusClass}`}>
            {config.statusMessage}
          </div>

          {/* Three compliance categories */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* WCAG 2.1 AA */}
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                WCAG 2.1 AA
              </p>
              <p className={`text-sm font-semibold ${wcagAaIssues.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {issueWord(wcagAaIssues.length)}
              </p>
            </div>

            {/* Perceivable */}
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Perceivable
              </p>
              <p className={`text-sm font-semibold ${perceivableIssues.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {issueWord(perceivableIssues.length)}
              </p>
            </div>

            {/* Operable */}
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Operable
              </p>
              <p className={`text-sm font-semibold ${operableIssues.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {issueWord(operableIssues.length)}
              </p>
            </div>
          </div>

          {/* Stats row */}
          {accessibilityIssues.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${critical > 0 ? 'text-red-400' : 'text-foreground'}`}>
                  {critical}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Critical issues</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{moderate}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Moderate issues</p>
              </div>
            </div>
          )}

          {/* WCAG criteria affected */}
          {allWcagTags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                WCAG criteria affected
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allWcagTags.map((tag) => (
                  <span key={tag} className="bg-secondary text-muted-foreground/60 text-xs px-2 py-0.5 rounded font-mono border border-border">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
