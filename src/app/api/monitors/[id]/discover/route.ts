import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature, getLimits } from '@/lib/billing/limits';
import { discoverPages } from '@/lib/monitoring/discovery';
import { z } from 'zod';

const schema = z.object({
  strategy: z.enum(['sitemap', 'crawl', 'both']).default('both'),
  save: z.boolean().default(false), // if true, upsert discovered pages into monitor_pages
});

// POST /api/monitors/[id]/discover — run page discovery and optionally save results
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { strategy, save } = parsed.data;

  const [{ data: monitor }, { data: sub }] = await Promise.all([
    supabase.from('monitors').select('id, user_id, url, page_mode, max_pages').eq('id', params.id).eq('user_id', user.id).single(),
    supabase.from('subscriptions').select('plan').eq('user_id', user.id).single(),
  ]);

  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  const plan = sub?.plan ?? 'free';
  if (!hasFeature(plan, 'monitoring')) {
    return NextResponse.json({ error: 'Monitoring requires Pro plan or higher.' }, { status: 403 });
  }

  const maxPages = Math.min(monitor.max_pages ?? 10, getLimits(plan).crawlPages);

  const result = await discoverPages(monitor.url, {
    strategy,
    maxPages,
  });

  if (save && result.pages.length > 0) {
    // Upsert discovered pages (skip root — already seeded)
    const rows = result.pages.map((p, i) => ({
      monitor_id: params.id,
      url: p.url,
      page_type: 'discovered' as const,
      discovery_source: p.source,
      depth: p.depth,
      is_active: true,
      sort_order: i + 1,
    }));

    await supabase.from('monitor_pages')
      .upsert(rows, { onConflict: 'monitor_id,url', ignoreDuplicates: true });

    await supabase.from('monitors')
      .update({ pages_last_discovered_at: new Date().toISOString() })
      .eq('id', params.id);
  }

  return NextResponse.json({
    discovered: result.pages.length,
    sitemapFound: result.sitemapFound,
    robotsFound: result.robotsFound,
    errors: result.errors,
    pages: result.pages,
  });
}
