import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { CRAWLER_REGISTRY } from '@/lib/site-connect/crawler-registry';

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
    .select('id, root_url, normalized_origin')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: events } = await supabase
    .from('site_telemetry_events')
    .select('route, page_url_sanitized, metrics, received_at')
    .eq('connected_site_id', params.id)
    .eq('event_type', 'indexability_observation')
    .order('received_at', { ascending: false })
    .limit(500);

  const routeMap = new Map<
    string,
    { route: string; observation: Record<string, unknown>; lastSeen: string }
  >();
  for (const ev of events ?? []) {
    const route = ev.route ?? ev.page_url_sanitized ?? '/';
    if (!routeMap.has(route)) {
      routeMap.set(route, {
        route,
        observation: (ev.metrics as Record<string, unknown>) ?? {},
        lastSeen: ev.received_at,
      });
    }
  }

  const pages = Array.from(routeMap.values()).map(({ route, observation, lastSeen }) => {
    const warnings: string[] = [];
    if (observation.hasNoindex) warnings.push('noindex directive detected');
    if (!observation.hasTitle) warnings.push('Missing page title');
    if (!observation.hasMetaDescription) warnings.push('Missing meta description');
    if (
      observation.hasCanonical &&
      observation.canonicalHref &&
      !String(observation.canonicalHref).startsWith(site.normalized_origin)
    ) {
      warnings.push('Canonical points off-origin');
    }
    return { route, observation, warnings, lastSeen };
  });

  const crawlers = CRAWLER_REGISTRY.map((c) => ({
    id: c.id,
    name: c.name,
    family: c.family,
    robotsName: c.robotsName,
    commonlyBlocked: c.commonlyBlocked ?? false,
  }));

  return NextResponse.json({
    pages,
    crawlers,
    totalPages: pages.length,
    totalWarnings: pages.reduce((n, p) => n + p.warnings.length, 0),
  });
}
