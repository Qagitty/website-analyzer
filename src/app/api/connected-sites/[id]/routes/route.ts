import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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

  const { data: site } = await supabase
    .from('connected_sites')
    .select('id, monitor_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const search = req.nextUrl.searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10));

  const { data: events } = await supabase
    .from('site_telemetry_events')
    .select('route, received_at, metrics')
    .eq('connected_site_id', params.id)
    .eq('event_type', 'route_observed')
    .order('received_at', { ascending: false })
    .limit(5000);

  type RouteEntry = {
    route: string;
    firstSeen: string;
    lastSeen: string;
    count: number;
    source: string;
  };

  const routeMap = new Map<string, RouteEntry>();
  for (const ev of events ?? []) {
    if (!ev.route) continue;
    const m = ev.metrics as Record<string, string> | null;
    const existing = routeMap.get(ev.route);
    if (!existing) {
      routeMap.set(ev.route, {
        route: ev.route,
        firstSeen: ev.received_at,
        lastSeen: ev.received_at,
        count: 1,
        source: m?.method ?? 'observed',
      });
    } else {
      existing.count++;
      if (ev.received_at < existing.firstSeen) existing.firstSeen = ev.received_at;
    }
  }

  let routes = Array.from(routeMap.values()).sort((a, b) => b.count - a.count);
  if (search) {
    const lower = search.toLowerCase();
    routes = routes.filter((r) => r.route.toLowerCase().includes(lower));
  }

  const total = routes.length;
  const paginated = routes.slice((page - 1) * limit, page * limit);

  return NextResponse.json({ routes: paginated, total, page, limit });
}
