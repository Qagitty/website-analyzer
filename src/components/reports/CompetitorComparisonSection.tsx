'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Minus, AlertTriangle, Loader2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LighthouseScores {
  performance:    number;
  accessibility:  number;
  seo:            number;
  bestPractices:  number;
  lcp?:           number;
  cls?:           number;
  ttfb?:          number;
  fid?:           number;
}

export interface ComparisonAnalysis {
  id:               string;
  url:              string;
  label:            string;
  status:           'pending' | 'queued' | 'running' | 'completed' | 'failed';
  lighthouse_scores: LighthouseScores | null;
  ai_insights?:     Record<string, unknown> | null;
  screenshot_url?:  string | null;
  error_message?:   string | null;
}

interface Props {
  analyses:  ComparisonAnalysis[];
  allDone:   boolean;
  anyFailed: boolean;
}

// ─── Score metrics to compare ────────────────────────────────────────────────

const METRICS: Array<{ key: keyof LighthouseScores; label: string; unit?: string; lowerBetter?: boolean }> = [
  { key: 'performance',   label: 'Performance'    },
  { key: 'accessibility', label: 'Accessibility'  },
  { key: 'seo',           label: 'SEO'            },
  { key: 'bestPractices', label: 'Best Practices' },
  { key: 'lcp',           label: 'LCP',  unit: 'ms', lowerBetter: true  },
  { key: 'cls',           label: 'CLS',            lowerBetter: true  },
  { key: 'ttfb',          label: 'TTFB', unit: 'ms', lowerBetter: true  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBarColor(score: number): string {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatValue(key: keyof LighthouseScores, val: number): string {
  if (key === 'lcp' || key === 'ttfb' || key === 'fid') return `${val}ms`;
  if (key === 'cls') return val.toFixed(3);
  return String(val);
}

function findWinner(
  analyses: ComparisonAnalysis[],
  key: keyof LighthouseScores,
  lowerBetter = false,
): string | null {
  const completed = analyses.filter((a) => a.status === 'completed' && a.lighthouse_scores?.[key] != null);
  if (completed.length < 2) return null;

  const sorted = [...completed].sort((a, b) => {
    const av = a.lighthouse_scores![key] as number;
    const bv = b.lighthouse_scores![key] as number;
    return lowerBetter ? av - bv : bv - av;
  });

  const best     = sorted[0];
  const bestVal  = best.lighthouse_scores![key] as number;
  const runnerVal = sorted[1].lighthouse_scores![key] as number;

  // Must be meaningfully better (≥2 point / 5% difference)
  const threshold = lowerBetter
    ? bestVal < runnerVal * 0.95
    : bestVal > runnerVal + 1;

  return threshold ? best.id : null;
}

// ─── Sub-component: status chip ──────────────────────────────────────────────

function StatusChip({ status }: { status: ComparisonAnalysis['status'] }) {
  if (status === 'completed') return null;
  if (status === 'failed') return (
    <Badge variant="destructive" className="text-xs gap-1">
      <AlertTriangle className="h-3 w-3" /> Failed
    </Badge>
  );
  return (
    <Badge variant="secondary" className="text-xs gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      {status === 'running' ? 'Analyzing…' : 'Queued'}
    </Badge>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompetitorComparisonSection({ analyses, allDone, anyFailed }: Props) {
  const completed = analyses.filter((a) => a.status === 'completed');

  // Column header width (first column = metric label)
  const colWidth = `${Math.floor(70 / analyses.length)}%`;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-2xl font-bold">Competitor Comparison</h2>
        {!allDone && (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {completed.length}/{analyses.length} complete
          </Badge>
        )}
        {allDone && !anyFailed && (
          <Badge variant="default" className="bg-emerald-600 text-white text-xs">
            All sites analyzed
          </Badge>
        )}
        {anyFailed && (
          <Badge variant="destructive" className="text-xs">
            Some analyses failed
          </Badge>
        )}
      </div>

      {/* Column summary cards — horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:overflow-visible sm:pb-0"
           style={{ gridTemplateColumns: `repeat(${analyses.length}, minmax(0, 1fr))` }}>
        {analyses.map((a, i) => (
          <Card
            key={a.id}
            className={`shrink-0 w-52 sm:w-auto ${i === 0 ? 'border-orange-400 dark:border-orange-800 bg-orange-600/5' : 'border-border'}`}
          >
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-sm font-medium truncate flex-1 min-w-0" title={a.url}>
                  {a.label}
                </CardTitle>
                {i === 0 && (
                  <Badge className="text-xs bg-orange-700 text-white shrink-0">Your site</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground/60 truncate">{a.url}</p>
            </CardHeader>
            <CardContent className="pb-4">
              <StatusChip status={a.status} />
              {a.status === 'completed' && a.lighthouse_scores && (
                <div className="mt-2 space-y-2">
                  {(['performance', 'accessibility', 'seo'] as const).map((k) => {
                    const v = a.lighthouse_scores![k];
                    const CARD_LABEL: Record<string, string> = { performance: 'Perf', accessibility: 'A11y', seo: 'SEO' };
                    return (
                      <div key={k}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-muted-foreground/60">{CARD_LABEL[k]}</span>
                          <span className={`text-xs font-mono font-semibold ${scoreColor(v)}`}>{v}</span>
                        </div>
                        <div className="bg-border/40 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${scoreBarColor(v)}`} style={{ width: `${v}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed metrics table */}
      {completed.length >= 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/60">
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium w-32">Metric</th>
                    {analyses.map((a, i) => (
                      <th
                        key={a.id}
                        className={`text-center px-3 py-2.5 text-xs font-medium ${i === 0 ? 'text-orange-500' : 'text-muted-foreground'}`}
                        style={{ width: colWidth }}
                      >
                        {a.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map(({ key, label, unit, lowerBetter }) => {
                    const winnerId = allDone ? findWinner(analyses, key, lowerBetter) : null;

                    return (
                      <tr key={key} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{label}</td>
                        {analyses.map((a) => {
                          const val = a.lighthouse_scores?.[key];
                          const isWinner = winnerId === a.id;
                          const isLoscore = val != null && !lowerBetter && val < 50;

                          return (
                            <td key={a.id} className="px-3 py-3 text-center">
                              {a.status === 'completed' ? (
                                val != null ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="flex items-center gap-1">
                                      {isWinner && (
                                        <Trophy className="h-3 w-3 text-amber-400 shrink-0" />
                                      )}
                                      <span
                                        className={`font-mono font-semibold text-sm ${
                                          lowerBetter
                                            ? isWinner ? 'text-emerald-400' : 'text-muted-foreground'
                                            : scoreColor(val as number)
                                        }`}
                                      >
                                        {formatValue(key, val as number)}
                                      </span>
                                    </div>
                                    {/* Mini progress bar for 0–100 scores */}
                                    {!lowerBetter && !unit && (
                                      <div className="w-12 bg-border/40 rounded-full h-1 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${scoreBarColor(val as number)}`}
                                          style={{ width: `${val}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/40 text-xs">—</span>
                                )
                              ) : a.status === 'failed' ? (
                                <span className="text-red-400/60 text-xs">—</span>
                              ) : (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/40 mx-auto" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No sites complete yet */}
      {completed.length === 0 && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
            <p className="text-sm text-muted-foreground">Analyzing all sites…</p>
            <p className="text-xs text-muted-foreground/60">This usually takes 30–90 seconds per site</p>
          </CardContent>
        </Card>
      )}

      {/* Partial complete */}
      {completed.length > 0 && completed.length < analyses.length && !allDone && (
        <p className="text-xs text-muted-foreground text-center">
          Detailed table will appear when all sites finish analyzing
        </p>
      )}

      {/* Failed sites callout */}
      {anyFailed && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">Some analyses failed</p>
                <ul className="mt-1 space-y-0.5">
                  {analyses.filter((a) => a.status === 'failed').map((a) => (
                    <li key={a.id} className="text-xs text-red-400/80">
                      {a.label}: {a.error_message ?? 'Unknown error'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
