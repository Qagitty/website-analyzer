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

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export function PerformanceSection({ scores }: { scores: LighthouseScores }) {
  const radarData = [
    { subject: 'Performance', value: scores.performance },
    { subject: 'Accessibility', value: scores.accessibility },
    { subject: 'Best Practices', value: scores.bestPractices },
    { subject: 'SEO', value: scores.seo },
  ];

  const coreWebVitals = [
    { label: 'LCP', value: `${(scores.lcp / 1000).toFixed(1)}s`, good: scores.lcp < 2500 },
    { label: 'FID', value: `${scores.fid}ms`, good: scores.fid < 100 },
    { label: 'CLS', value: scores.cls.toFixed(3), good: scores.cls < 0.1 },
    { label: 'TTFB', value: `${scores.ttfb}ms`, good: scores.ttfb < 800 },
  ];

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Performance</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
        {radarData.map((item) => (
          <ScoreGauge key={item.subject} score={item.value} label={item.subject} size="lg" />
        ))}
      </div>

      {scores.performanceVariance !== undefined && (
        <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
          <span className="font-medium">Measurement confidence:</span>
          {scores.performanceVariance < 200 ? (
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">High — stable connection</Badge>
          ) : scores.performanceVariance < 600 ? (
            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">Medium — some variance</Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-400 border border-red-500/20">Low — unstable connection (±{Math.round(scores.performanceVariance / 10)}%)</Badge>
          )}
          {scores.ttfbSamples && (
            <span className="text-xs">
              (TTFB: {scores.ttfbSamples[0]}ms / {scores.ttfbSamples[1]}ms / {scores.ttfbSamples[2]}ms)
            </span>
          )}
        </div>
      )}

      <Card className="bg-[#13131A] border border-white/5">
        <CardHeader><CardTitle className="text-white">Score Overview</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
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

      <Card className="bg-[#13131A] border border-white/5">
        <CardHeader><CardTitle className="text-white">Core Web Vitals</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {coreWebVitals.map((v) => (
              <div key={v.label} className="text-center space-y-1">
                <p className="text-xs font-semibold text-[#94A3B8]">{v.label}</p>
                <p className="text-lg md:text-2xl font-bold text-white">{v.value}</p>
                <p className={`text-xs ${v.good ? 'text-emerald-400' : 'text-red-400'}`}>
                  {v.good ? 'Good' : 'Needs work'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
