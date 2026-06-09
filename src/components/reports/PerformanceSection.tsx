'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreGauge } from '@/components/reports/ScoreGauge';
import type { LighthouseScores } from '@/types/analysis';

export function PerformanceSection({ scores }: { scores: LighthouseScores }) {
  const radarData = [
    { subject: 'Performance', value: scores.performance },
    { subject: 'Accessibility', value: scores.accessibility },
    { subject: 'Best Practices', value: scores.bestPractices },
    { subject: 'SEO', value: scores.seo },
  ];

  // FID and CLS cannot be measured by a static fetch — they require a real
  // browser with user interaction (FID) or layout-shift observation (CLS).
  // Show "N/A" instead of the hardcoded 0 to avoid implying a perfect score.
  const coreWebVitals = [
    { label: 'LCP', value: `${(scores.lcp / 1000).toFixed(1)}s`, good: scores.lcp < 2500, measured: true },
    { label: 'FID', value: 'N/A', good: false, measured: false },
    { label: 'CLS', value: 'N/A', good: false, measured: false },
    { label: 'TTFB', value: `${scores.ttfb}ms`, good: scores.ttfb < 800, measured: true },
  ];

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Performance</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
        {radarData.map((item) => (
          <ScoreGauge key={item.subject} score={item.value} label={item.subject} size="lg" />
        ))}
      </div>

      {scores.performanceVariance !== undefined && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">Measurement confidence:</span>
          {scores.performanceVariance < 200 ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">High — stable connection</Badge>
          ) : scores.performanceVariance < 600 ? (
            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Medium — some variance</Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">Low — unstable connection (±{Math.round(scores.performanceVariance / 10)}%)</Badge>
          )}
          {scores.ttfbSamples && (
            <span className="text-xs">
              (TTFB: {scores.ttfbSamples[0]}ms / {scores.ttfbSamples[1]}ms / {scores.ttfbSamples[2]}ms)
            </span>
          )}
        </div>
      )}

      <Card className="bg-card border border-border">
        <CardHeader><CardTitle className="text-foreground">Score Overview</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(99,102,241,0.15)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <Radar name="Score" dataKey="value" stroke="#6366F1" fill="#6366F1" fillOpacity={0.15} />
              <Tooltip
                formatter={(v) => [`${v}/100`]}
                contentStyle={{ background: '#13131A', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '0.5rem', color: '#F8FAFC' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border">
        <CardHeader><CardTitle className="text-foreground">Core Web Vitals</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {coreWebVitals.map((v) => (
              <div key={v.label} className="text-center space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">{v.label}</p>
                <p className="text-lg md:text-2xl font-bold text-foreground">{v.value}</p>
                {v.measured ? (
                  <p className={`text-xs ${v.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {v.good ? 'Good' : 'Needs work'}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60" title="Requires real-browser measurement — not available in static analysis">
                    Not measured
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
