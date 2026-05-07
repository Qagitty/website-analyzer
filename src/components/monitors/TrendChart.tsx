'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface HistoryPoint {
  date: string;
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
  bestPractices: number | null;
}

interface ChartPoint {
  label: string;
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
  bestPractices: number | null;
}

interface TrendChartProps {
  url: string;
  monitorId: string;
}

export function TrendChart({ url }: TrendChartProps) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      try {
        const res = await fetch(
          `/api/reports/history?url=${encodeURIComponent(url)}&limit=30`
        );
        if (!res.ok) return;
        const history: HistoryPoint[] = await res.json();
        if (cancelled) return;
        setData(
          history.map((h) => ({
            label: format(new Date(h.date), 'MMM d'),
            performance: h.performance,
            accessibility: h.accessibility,
            seo: h.seo,
            bestPractices: h.bestPractices,
          }))
        );
      } catch {
        // silently fail — chart is supplemental
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return <Skeleton className="h-[200px] w-full rounded-md" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-white/10 text-[#475569] text-sm text-center py-8">
        No history yet — scores will appear after the first automated run.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#475569', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#475569', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
        />
        <Tooltip
          contentStyle={{ background: '#13131A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F8FAFC', fontSize: '12px' }}
          labelStyle={{ color: '#94A3B8' }}
          formatter={(value: number, name: string) => [
            value != null ? `${value}/100` : '—',
            name,
          ]}
        />
        <Legend wrapperStyle={{ color: '#94A3B8', fontSize: '12px' }} />
        <Line
          type="monotone"
          dataKey="performance"
          name="Performance"
          stroke="#6366F1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="accessibility"
          name="Accessibility"
          stroke="#10B981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="seo"
          name="SEO"
          stroke="#F59E0B"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="bestPractices"
          name="Best Practices"
          stroke="#0EA5E9"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
