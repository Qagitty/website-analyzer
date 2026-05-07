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
import { ScoreGauge } from '@/components/reports/ScoreGauge';
import type { LighthouseScores } from '@/types/analysis';

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
      <h2 className="text-2xl font-bold">Performance</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
        {radarData.map((item) => (
          <ScoreGauge key={item.subject} score={item.value} label={item.subject} size="lg" />
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Score Overview</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <Radar name="Score" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
              <Tooltip formatter={(v) => [`${v}/100`]} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Core Web Vitals</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {coreWebVitals.map((v) => (
              <div key={v.label} className="text-center space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">{v.label}</p>
                <p className="text-lg md:text-2xl font-bold">{v.value}</p>
                <p className={`text-xs ${v.good ? 'text-green-600' : 'text-red-600'}`}>
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
