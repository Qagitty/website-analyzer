'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { DesignComparison, DesignMismatch } from '@/types/analysis';

const SEVERITY_CLASS: Record<DesignMismatch['severity'], string> = {
  critical: 'border-l-2 border-red-500 bg-red-500/5 rounded-r-lg p-3',
  major: 'border-l-2 border-amber-500 bg-amber-500/5 rounded-r-lg p-3',
  minor: 'border-l-2 border-white/10 bg-[#1C1C27] rounded-r-lg p-3',
};



interface Props {
  comparison: DesignComparison;
  designScreenshotUrl: string | null;
  liveScreenshotUrl: string | null;
}

export function DesignComparisonSection({ comparison, designScreenshotUrl, liveScreenshotUrl }: Props) {
  const criticalCount = comparison.mismatches.filter((m) => m.severity === 'critical').length;
  const majorCount = comparison.mismatches.filter((m) => m.severity === 'major').length;
  const minorCount = comparison.mismatches.filter((m) => m.severity === 'minor').length;

  const scoreColor =
    comparison.fidelityScore >= 80 ? 'text-emerald-400' :
    comparison.fidelityScore >= 60 ? 'text-amber-400' :
    'text-red-400';

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Design Comparison</h2>

      {/* Overview card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Fidelity score */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={`text-5xl font-bold ${scoreColor}`}>
                {comparison.fidelityScore}
              </div>
              <div className="text-sm text-muted-foreground">Fidelity score</div>
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${comparison.fidelityScore}%`,
                    backgroundColor:
                      comparison.fidelityScore >= 80 ? '#22c55e' :
                      comparison.fidelityScore >= 60 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            </div>

            {/* Summary + counts */}
            <div className="flex-1 space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">{comparison.summary}</p>
              <div className="flex flex-wrap gap-3">
                {criticalCount > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="font-medium text-red-400">{criticalCount} critical</span>
                  </div>
                )}
                {majorCount > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    <span className="font-medium text-amber-400">{majorCount} major</span>
                  </div>
                )}
                {minorCount > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="font-medium text-muted-foreground">{minorCount} minor</span>
                  </div>
                )}
                {comparison.mismatches.length === 0 && (
                  <span className="text-sm text-emerald-400 font-medium">✓ No mismatches found</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-side screenshots */}
      {(designScreenshotUrl || liveScreenshotUrl) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {designScreenshotUrl && (
            <div>
              <div className="rounded-xl overflow-hidden border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={designScreenshotUrl}
                  alt="Design screenshot"
                  className="w-full object-cover"
                />
              </div>
              <p className="text-xs text-[#475569] text-center mt-2">Design mockup</p>
            </div>
          )}
          {liveScreenshotUrl && (
            <div>
              <div className="rounded-xl overflow-hidden border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={liveScreenshotUrl}
                  alt="Live site screenshot"
                  className="w-full object-cover"
                />
              </div>
              <p className="text-xs text-[#475569] text-center mt-2">Live site</p>
            </div>
          )}
        </div>
      )}

      {/* Matching areas */}
      {comparison.matchingAreas.length > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-base font-semibold text-emerald-400 mb-3">✓ Matching areas</p>
          <ul className="space-y-1.5">
            {comparison.matchingAreas.map((area, i) => (
              <li key={i} className="flex items-start gap-2 text-emerald-400 text-sm">
                <span className="mt-0.5 shrink-0">✓</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mismatches */}
      {comparison.mismatches.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Issues Found</h3>
          {comparison.mismatches.map((mismatch, i) => (
            <div key={i} className={SEVERITY_CLASS[mismatch.severity]}>
              <p className="text-xs font-mono text-[#475569] mb-1">{mismatch.area}</p>
              <p className="text-sm text-foreground">{mismatch.designExpected}</p>
              <p className="text-xs text-muted-foreground mt-1">{mismatch.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
