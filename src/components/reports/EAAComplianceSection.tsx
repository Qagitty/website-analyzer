import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    borderClass: 'border-l-green-500',
    badgeClass: 'bg-green-100 text-green-800 border-green-300',
    badgeLabel: 'AA Compliant',
    Icon: ShieldCheck,
    iconClass: 'text-green-600',
    statusMessage: '✓ Your site meets WCAG 2.1 AA requirements. You are likely EAA compliant.',
    statusClass: 'text-green-700 bg-green-50 border border-green-200',
  },
  partial: {
    borderClass: 'border-l-amber-500',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    badgeLabel: 'Review Required',
    Icon: ShieldAlert,
    iconClass: 'text-amber-600',
    statusMessage: '⚠ Your site has minor accessibility issues. Review and fix them to achieve full EAA compliance.',
    statusClass: 'text-amber-700 bg-amber-50 border border-amber-200',
  },
  'non-compliant': {
    borderClass: 'border-l-red-500',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    badgeLabel: 'Non-Compliant',
    Icon: ShieldX,
    iconClass: 'text-red-600',
    statusMessage: '✗ Your site has significant accessibility barriers. Immediate action required for EAA compliance.',
    statusClass: 'text-red-700 bg-red-50 border border-red-200',
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
      <Card className={`border-l-4 ${config.borderClass}`}>
        {/* Header */}
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 shrink-0 ${config.iconClass}`} />
              <CardTitle className="text-base font-semibold">
                European Accessibility Act (EAA)
              </CardTitle>
            </div>
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${config.badgeClass}`}
            >
              {config.badgeLabel}
            </span>
          </div>

          {/* Deadline callout */}
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            The EAA came into force June 2025. Non-compliant businesses selling to EU customers
            face fines up to €100,000 or 4% of annual revenue.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Critical issues */}
            <div
              className={`rounded-lg p-3 text-center ${
                critical > 0
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-muted border border-border'
              }`}
            >
              <p
                className={`text-2xl font-bold ${critical > 0 ? 'text-red-600' : 'text-foreground'}`}
              >
                {critical}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Critical issues</p>
            </div>

            {/* Moderate issues */}
            <div className="rounded-lg bg-muted border border-border p-3 text-center">
              <p className="text-2xl font-bold">{moderate}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Moderate issues</p>
            </div>

            {/* Accessibility score */}
            <div className="rounded-lg bg-muted border border-border p-3 text-center">
              <p className="text-2xl font-bold">{score}</p>
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
                  <Badge key={tag} variant="outline" className="text-xs font-mono">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
