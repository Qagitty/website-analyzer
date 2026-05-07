'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DesignComparison, DesignMismatch } from '@/types/analysis';

const SEVERITY_VARIANT: Record<DesignMismatch['severity'], 'destructive' | 'default' | 'secondary'> = {
  critical: 'destructive',
  major: 'default',
  minor: 'secondary',
};

const SEVERITY_LABEL: Record<DesignMismatch['severity'], string> = {
  critical: '🔴 Critical',
  major: '🟠 Major',
  minor: '🟡 Minor',
};

function FidelityRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? '#22c55e' :
    score >= 60 ? '#f59e0b' :
    '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" className="-rotate-90">
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted-foreground/20"
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ marginTop: '-72px' }}>
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

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
    comparison.fidelityScore >= 80 ? 'text-green-600' :
    comparison.fidelityScore >= 60 ? 'text-yellow-600' :
    'text-red-600';

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
                    <span className="font-medium text-red-600">{criticalCount} critical</span>
                  </div>
                )}
                {majorCount > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    <span className="font-medium text-orange-600">{majorCount} major</span>
                  </div>
                )}
                {minorCount > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="font-medium text-yellow-600">{minorCount} minor</span>
                  </div>
                )}
                {comparison.mismatches.length === 0 && (
                  <span className="text-sm text-green-600 font-medium">✓ No mismatches found</span>
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Your Design</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={designScreenshotUrl}
                  alt="Design screenshot"
                  className="w-full rounded-b-lg object-cover"
                />
              </CardContent>
            </Card>
          )}
          {liveScreenshotUrl && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Live Website</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={liveScreenshotUrl}
                  alt="Live site screenshot"
                  className="w-full rounded-b-lg object-cover"
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Matching areas */}
      {comparison.matchingAreas.length > 0 && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-700 dark:text-green-400">
              ✓ Matching areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {comparison.matchingAreas.map((area, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                  <span className="mt-0.5 shrink-0">✓</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Mismatches */}
      {comparison.mismatches.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Issues Found</h3>
          {comparison.mismatches.map((mismatch, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">{mismatch.area}</CardTitle>
                  <Badge variant={SEVERITY_VARIANT[mismatch.severity]}>
                    {SEVERITY_LABEL[mismatch.severity]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 space-y-1">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                      Design expects
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-300">{mismatch.designExpected}</p>
                  </div>
                  <div className="rounded-md bg-orange-50 dark:bg-orange-950/30 p-3 space-y-1">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide">
                      Live site shows
                    </p>
                    <p className="text-sm text-orange-800 dark:text-orange-300">{mismatch.liveSite}</p>
                  </div>
                </div>
                <div className="rounded-md bg-muted p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Suggested fix
                  </p>
                  <p className="text-sm font-mono text-foreground/80">{mismatch.suggestion}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
