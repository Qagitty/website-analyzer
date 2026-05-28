'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { DesignComparison, DesignMismatch } from '@/types/analysis';

interface Props {
  /** Full design-comparison result from AI. If undefined the section is hidden. */
  designComparison: DesignComparison | undefined | null;
  /** URL of the uploaded design/mockup screenshot. If absent the section is hidden. */
  designScreenshotUrl: string | undefined | null;
  /** URL of the live site screenshot */
  screenshotUrl?: string | undefined | null;
  /** @deprecated — use screenshotUrl */
  liveScreenshotUrl?: string | undefined | null;
}

function fidelityLabel(score: number): string {
  if (score >= 80) return 'High fidelity';
  if (score >= 60) return 'Moderate fidelity';
  return 'Low fidelity';
}

function fidelityColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function fidelityBarColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

const SEVERITY_CLASS: Record<DesignMismatch['severity'], string> = {
  critical: 'border-l-2 border-red-500 bg-red-500/5 rounded-r-lg p-3',
  major: 'border-l-2 border-amber-500 bg-amber-500/5 rounded-r-lg p-3',
  minor: 'border-l-2 border-border bg-secondary rounded-r-lg p-3',
};

function getMismatchField(mismatch: DesignMismatch, preferred: keyof DesignMismatch, fallback: keyof DesignMismatch): string {
  return (mismatch[preferred] as string | undefined) ?? (mismatch[fallback] as string | undefined) ?? '';
}

export function DesignComparisonSection({
  designComparison,
  designScreenshotUrl,
  screenshotUrl,
  liveScreenshotUrl,
}: Props) {
  // Hidden when there is no comparison data or when no design was uploaded
  if (!designComparison || !designScreenshotUrl) return null;

  const liveUrl = screenshotUrl ?? liveScreenshotUrl;
  const comparison = designComparison;
  const mismatches = comparison.mismatches ?? [];
  const matchingAreas = comparison.matchingAreas ?? [];

  const criticalCount = mismatches.filter((m) => m.severity === 'critical').length;
  const majorCount = mismatches.filter((m) => m.severity === 'major').length;
  const minorCount = mismatches.filter((m) => m.severity === 'minor').length;

  const score = comparison.fidelityScore ?? 0;

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Design Comparison</h2>

      {/* Overview card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Fidelity score */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={`text-5xl font-bold ${fidelityColor(score)}`}>
                {score}
              </div>
              <div className="text-sm text-muted-foreground">Fidelity score</div>
              <div className={`text-xs font-medium mt-0.5 ${fidelityColor(score)}`}>
                {fidelityLabel(score)}
              </div>
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${score}%`, backgroundColor: fidelityBarColor(score) }}
                />
              </div>
            </div>

            {/* Summary + mismatch counts */}
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
                    <span className="font-medium text-muted-foreground">{minorCount} low</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-side screenshots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="rounded-xl overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={designScreenshotUrl}
              alt="Design screenshot"
              className="w-full object-cover"
            />
          </div>
          <p className="text-xs text-muted-foreground/60 text-center mt-2">Your Design</p>
        </div>
        {liveUrl && (
          <div>
            <div className="rounded-xl overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={liveUrl}
                alt="Live site screenshot"
                className="w-full object-cover"
              />
            </div>
            <p className="text-xs text-muted-foreground/60 text-center mt-2">Live Site</p>
          </div>
        )}
      </div>

      {/* Matching areas */}
      {matchingAreas.length > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-base font-semibold text-emerald-400 mb-3">✓ Matching areas</p>
          <ul className="space-y-1.5">
            {matchingAreas.map((area, i) => (
              <li key={i} className="flex items-start gap-2 text-emerald-400 text-sm">
                <span className="mt-0.5 shrink-0">✓</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mismatches */}
      {mismatches.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Issues Found</h3>
          {mismatches.map((mismatch, i) => {
            const designExpectsText = getMismatchField(mismatch, 'designExpects', 'designExpected');
            const liveSiteShowsText = getMismatchField(mismatch, 'liveSiteShows', 'liveSite');
            const cssFixText = getMismatchField(mismatch, 'cssFix', 'suggestion');

            return (
              <div key={i} className={SEVERITY_CLASS[mismatch.severity]}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-mono text-muted-foreground/60">{'↳ '}{mismatch.area}</p>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">
                    {mismatch.severity}
                  </span>
                </div>
                {designExpectsText && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-blue-400 mb-0.5">Design expects</p>
                    <p className="text-sm text-foreground">{designExpectsText}</p>
                  </div>
                )}
                {liveSiteShowsText && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-orange-400 mb-0.5">Live site shows</p>
                    <p className="text-sm text-muted-foreground">{liveSiteShowsText}</p>
                  </div>
                )}
                {cssFixText && (
                  <pre className="text-xs font-mono bg-zinc-950 text-zinc-300 rounded p-2 overflow-x-auto mt-2">
                    {cssFixText}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-emerald-400 font-medium text-center py-4">
          ✓ No significant mismatches detected
        </div>
      )}
    </section>
  );
}
