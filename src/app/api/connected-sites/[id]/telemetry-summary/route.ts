import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const METRIC_THRESHOLDS: Record<string, [number, number]> = {
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
  inp: [200, 500],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
};

function percentile(arr: number[], p: number): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length * p) / 100);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function getMetricRating(
  name: string,
  p75: number | null,
  count: number
): 'good' | 'needs_improvement' | 'poor' | 'insufficient_data' {
  if (p75 === null || count < 30) return 'insufficient_data';
  const [goodThreshold, poorThreshold] = METRIC_THRESHOLDS[name] ?? [0, 0];
  if (p75 <= goodThreshold) return 'good';
  if (p75 <= poorThreshold) return 'needs_improvement';
  return 'poor';
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const range = req.nextUrl.searchParams.get('range') ?? '7d';
  const hoursMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 };
  const hours = hoursMap[range] ?? 168;
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();

  const { data: site } = await supabase
    .from('connected_sites')
    .select('id, telemetry_enabled')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: events } = await supabase
    .from('site_telemetry_events')
    .select('metrics, received_at')
    .eq('connected_site_id', params.id)
    .eq('event_type', 'web_vitals')
    .gte('received_at', since)
    .order('received_at', { ascending: false })
    .limit(1000);

  const METRIC_NAMES = ['lcp', 'cls', 'inp', 'fcp', 'ttfb'] as const;
  const buckets: Record<string, number[]> = Object.fromEntries(
    METRIC_NAMES.map((k) => [k, []])
  );

  for (const ev of events ?? []) {
    const m = ev.metrics as Record<string, unknown> | null;
    if (!m) continue;
    for (const k of METRIC_NAMES) {
      const v = m[k];
      if (typeof v === 'number' && isFinite(v)) buckets[k].push(v);
    }
  }

  const metrics: Record<string, unknown> = {};
  for (const k of METRIC_NAMES) {
    const arr = buckets[k];
    if (!arr.length) continue;
    const p75 = percentile(arr, 75);
    metrics[k] = {
      p50: percentile(arr, 50),
      p75,
      p90: percentile(arr, 90),
      sampleCount: arr.length,
      rating: getMetricRating(k, p75, arr.length),
    };
  }

  const lastEvent = (events ?? [])[0];
  return NextResponse.json({
    range,
    sampleCount: (events ?? []).length,
    metrics,
    lastEventAt: lastEvent?.received_at ?? null,
    telemetryEnabled: site.telemetry_enabled,
  });
}
