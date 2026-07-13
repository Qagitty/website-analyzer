'use client';

import { Progress } from '@/components/ui/progress';

interface CoverageBarProps {
  label:        string;
  percent:      number;
  /** Accessible description of what is being measured */
  description?: string;
}

export function AccessibilityCoverageBar({ label, percent, description }: CoverageBarProps) {
  const safePercent = Math.max(0, Math.min(100, percent));
  const color =
    safePercent >= 80 ? 'text-emerald-600' :
    safePercent >= 50 ? 'text-amber-600' :
    'text-red-600';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${color}`} aria-label={`${label}: ${safePercent}%`}>
          {safePercent}%
        </span>
      </div>
      <Progress
        value={safePercent}
        aria-label={description ?? label}
        className="h-2"
      />
    </div>
  );
}

interface MultiCoverageBarProps {
  pageCoverage:   number;
  journeyCoverage?: number;
  manualCoverage?: number;
}

export function AccessibilityMultiCoverageBar({
  pageCoverage,
  journeyCoverage,
  manualCoverage,
}: MultiCoverageBarProps) {
  return (
    <div className="space-y-3" role="group" aria-label="Assessment coverage">
      <AccessibilityCoverageBar
        label="Page coverage"
        percent={pageCoverage}
        description="Percentage of pages with completed automated assessment"
      />
      {journeyCoverage !== undefined && journeyCoverage < 100 && (
        <AccessibilityCoverageBar
          label="Journey coverage"
          percent={journeyCoverage}
          description="Percentage of critical journeys assessed"
        />
      )}
      {manualCoverage !== undefined && manualCoverage > 0 && (
        <AccessibilityCoverageBar
          label="Manual checks"
          percent={manualCoverage}
          description="Percentage of required manual checks completed"
        />
      )}
    </div>
  );
}
