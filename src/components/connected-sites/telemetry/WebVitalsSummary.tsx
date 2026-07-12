'use client';

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { TelemetrySummary, MetricAggregate } from '@/types/connected-sites';

const METRIC_META: Record<
  string,
  { label: string; unit: string; decimals: number; description: string }
> = {
  lcp: { label: 'LCP', unit: 'ms', decimals: 0, description: 'Largest Contentful Paint' },
  cls: { label: 'CLS', unit: '', decimals: 3, description: 'Cumulative Layout Shift' },
  inp: { label: 'INP', unit: 'ms', decimals: 0, description: 'Interaction to Next Paint' },
  fcp: { label: 'FCP', unit: 'ms', decimals: 0, description: 'First Contentful Paint' },
  ttfb: { label: 'TTFB', unit: 'ms', decimals: 0, description: 'Time to First Byte' },
};

const RATING_CONFIG = {
  good: { label: 'Good', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  needs_improvement: { label: 'Needs work', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  poor: { label: 'Poor', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  insufficient_data: { label: 'Insufficient data', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
};

function MetricCard({ name, metric }: { name: string; metric: MetricAggregate }) {
  const meta = METRIC_META[name];
  const ratingCfg = RATING_CONFIG[metric.rating];
  const fmt = (v: number | null) =>
    v === null ? '—' : `${v.toFixed(meta.decimals)}${meta.unit}`;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{fmt(metric.p75)}</p>
            <p className="text-xs text-muted-foreground">p75</p>
          </div>
          <Badge variant="outline" className={ratingCfg.className}>
            {ratingCfg.label}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center pt-1 border-t border-border/30">
          {(['p50', 'p75', 'p90'] as const).map((p) => (
            <div key={p}>
              <p className="text-xs font-mono text-foreground">{fmt(metric[p])}</p>
              <p className="text-xs text-muted-foreground">{p}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {metric.sampleCount} samples
        </p>
      </CardContent>
    </Card>
  );
}

interface Props {
  siteId: string;
}

export function WebVitalsSummary({ siteId }: Props) {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [data, setData] = useState<TelemetrySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/connected-sites/${siteId}/telemetry-summary?range=${range}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [siteId, range]);

  const metricEntries = data
    ? Object.entries(data.metrics).filter(([, m]) => m !== undefined)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Core Web Vitals</h3>
          <p className="text-sm text-muted-foreground">Field data collected by the WebScore Connect script</p>
        </div>
        <div className="flex gap-1">
          {(['24h', '7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                range === r
                  ? 'bg-indigo-600 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {!data?.telemetryEnabled && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-300">
            Telemetry is disabled for this site. Enable it in Settings to collect field metrics.
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : metricEntries.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No telemetry data for this period.{' '}
              {data?.telemetryEnabled
                ? 'Data appears once your visitors trigger the script.'
                : 'Enable telemetry in Settings first.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {metricEntries.map(([name, metric]) => (
              <MetricCard key={name} name={name} metric={metric as MetricAggregate} />
            ))}
          </div>
          {data?.lastEventAt && (
            <p className="text-xs text-muted-foreground text-right">
              {data.sampleCount} events · Last received{' '}
              {new Date(data.lastEventAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
