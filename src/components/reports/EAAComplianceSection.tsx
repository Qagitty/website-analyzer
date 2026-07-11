import type React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import type { AccessibilityIssue } from '@/types/analysis';

interface Props {
  accessibilityIssues: AccessibilityIssue[] | undefined;
}

type TechnicalStatus = 'no_blockers' | 'gaps' | 'blockers';

function determineLevel(issues: AccessibilityIssue[]): TechnicalStatus {
  const critical = issues.filter((i) => i.impact === 'critical' || i.impact === 'serious').length;
  if (critical === 0 && issues.length === 0) return 'no_blockers';
  if (critical === 0) return 'gaps';
  return 'blockers';
}

const LEVEL_CONFIG = {
  no_blockers: {
    borderClass: 'border-l-emerald-500',
    bgClass: 'bg-emerald-500/5',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    badgeLabel: 'No automated blockers detected',
    Icon: ShieldCheck,
    iconClass: 'text-emerald-400',
    statusMessage: '✓ No automated accessibility blockers detected. Manual testing is still required — automated tools cannot verify all accessibility criteria.',
    statusClass: 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/20',
  },
  gaps: {
    borderClass: 'border-l-amber-500',
    bgClass: 'bg-amber-500/5',
    badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    badgeLabel: 'Potential accessibility gaps',
    Icon: ShieldAlert,
    iconClass: 'text-amber-400',
    statusMessage: '⚠ Potential accessibility gaps detected. Review and address the issues listed below, then conduct manual testing with assistive technologies.',
    statusClass: 'text-amber-400 bg-amber-500/5 border border-amber-500/20',
  },
  blockers: {
    borderClass: 'border-l-red-500',
    bgClass: 'bg-red-500/5',
    badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20',
    badgeLabel: 'Accessibility blockers found',
    Icon: ShieldX,
    iconClass: 'text-red-400',
    statusMessage: '✗ Significant accessibility barriers detected. These issues may prevent people with disabilities from using your site and should be prioritized for remediation.',
    statusClass: 'text-red-400 bg-red-500/5 border border-red-500/20',
  },
} satisfies Record<TechnicalStatus, {
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

          {/* EAA context note */}
          <p className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-xs text-amber-400/80 mt-3 leading-relaxed">
            The EU Accessibility Act applies to certain digital products and services sold to EU customers.
            Whether it applies to your organization depends on your specific business circumstances.
            Consult a qualified legal professional to determine your obligations.
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

          {/* Static analysis disclaimer */}
          <p className="text-xs text-muted-foreground/60 border-t border-border/40 pt-3 leading-relaxed">
            Based on static HTML analysis only — not a legal compliance certification. A full audit requires testing with screen readers, keyboard navigation, and browser-based tools.
          </p>
        </div>
      </div>
    </section>
  );
}
