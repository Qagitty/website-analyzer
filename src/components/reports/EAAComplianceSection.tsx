import type React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import type { AccessibilityIssue } from '@/types/analysis';

interface Props {
  issues: AccessibilityIssue[];
  accessibilityScore: number | null;
}

type ComplianceLevel = 'compliant' | 'partial' | 'non-compliant';

function determineLevel(issues: AccessibilityIssue[], accessibilityScore: number | null): ComplianceLevel {
  const critical = issues.filter((i) => i.impact === 'critical' || i.impact === 'serious').length;
  const score = accessibilityScore ?? 0;

  if (critical === 0 && score >= 90) return 'compliant';
  if (critical <= 2 || score >= 70) return 'partial';
  return 'non-compliant';
}

const LEVEL_CONFIG = {
  compliant: {
    borderClass: 'border-l-emerald-500',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    badgeLabel: 'AA Compliant',
    Icon: ShieldCheck,
    iconClass: 'text-emerald-400',
    statusMessage: '✓ Your site meets WCAG 2.1 AA requirements. You are likely EAA compliant.',
    statusClass: 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/20',
  },
  partial: {
    borderClass: 'border-l-amber-500',
    badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    badgeLabel: 'Review Required',
    Icon: ShieldAlert,
    iconClass: 'text-amber-400',
    statusMessage: '⚠ Your site has minor accessibility issues. Review and fix them to achieve full EAA compliance.',
    statusClass: 'text-amber-400 bg-amber-500/5 border border-amber-500/20',
  },
  'non-compliant': {
    borderClass: 'border-l-red-500',
    badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20',
    badgeLabel: 'Non-Compliant',
    Icon: ShieldX,
    iconClass: 'text-red-400',
    statusMessage: '✗ Your site has significant accessibility barriers. Immediate action required for EAA compliance.',
    statusClass: 'text-red-400 bg-red-500/5 border border-red-500/20',
  },
} satisfies Record<ComplianceLevel, {
  borderClass: string;
  badgeClass: string;
  badgeLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  statusMessage: string;
  statusClass: string;
}>;

export function EAAComplianceSection({ issues, accessibilityScore }: Props) {
  const level = determineLevel(issues, accessibilityScore);
  const config = LEVEL_CONFIG[level];
  const { Icon } = config;

  const critical = issues.filter((i) => i.impact === 'critical' || i.impact === 'serious').length;
  const moderate = issues.filter((i) => i.impact === 'moderate' || i.impact === 'minor').length;
  const score = accessibilityScore ?? 0;

  // Collect unique WCAG criteria tags across all issues
  const allWcagTags = Array.from(
    new Set(issues.flatMap((i) => i.wcagCriteria).filter((tag) => tag.startsWith('wcag')))
  ).sort();

  return (
    <section>
      <div className={`border-l-4 ${config.borderClass} ${
        level === 'compliant'
          ? 'bg-emerald-500/5 rounded-r-xl p-5'
          : level === 'partial'
          ? 'bg-amber-500/5 rounded-r-xl p-5'
          : 'bg-red-500/5 rounded-r-xl p-5'
      }`}>
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
            The EAA came into force June 2025. Non-compliant businesses selling to EU customers
            face fines up to €100,000 or 4% of annual revenue.
          </p>
        </div>

        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Critical issues */}
            <div className="bg-[#0A0A0F] rounded-lg p-3 text-center">
              <p
                className={`text-2xl font-bold ${critical > 0 ? 'text-red-400' : 'text-foreground'}`}
              >
                {critical}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Critical issues</p>
            </div>

            {/* Moderate issues */}
            <div className="bg-[#0A0A0F] rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{moderate}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Moderate issues</p>
            </div>

            {/* Accessibility score */}
            <div className="bg-[#0A0A0F] rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{score}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Score / 100</p>
            </div>
          </div>

          {/* Status message */}
          <div className={`rounded-md px-4 py-3 text-sm font-medium ${config.statusClass}`}>
            {config.statusMessage}
          </div>

          {/* WCAG criteria affected */}
          {allWcagTags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                WCAG criteria affected
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allWcagTags.map((tag) => (
                  <span key={tag} className="bg-[#1C1C27] text-[#475569] text-xs px-2 py-0.5 rounded font-mono border border-white/5">
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
