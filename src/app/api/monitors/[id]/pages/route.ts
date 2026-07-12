import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { validateAnalysisUrl } from '@/lib/security/url-validator';
import { getLimits } from '@/lib/billing/limits';
import { z } from 'zod';

const addPageSchema = z.object({
  url: z.string().trim().url('Invalid URL')
    .refine((u) => u.startsWith('http://') || u.startsWith('https://')),
  page_type: z.enum(['pinned', 'discovered']).default('pinned'),
});

// GET /api/monitors/[id]/pages — list all pages for a monitor
export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id, user_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('monitor_pages')
    .select('*')
    .eq('monitor_id', params.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/monitors/[id]/pages — add a page to a monitor
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = addPageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { url, page_type } = parsed.data;

  // SSRF check
  const urlCheck = validateAnalysisUrl(url);
  if (!urlCheck.valid) {
    return NextResponse.json({ error: urlCheck.rejectionReason ?? 'URL not allowed' }, { status: 400 });
  }

  // Verify ownership + get plan limits
  const [{ data: monitor }, { data: sub }] = await Promise.all([
    supabase.from('monitors').select('id, user_id, page_mode').eq('id', params.id).eq('user_id', user.id).single(),
    supabase.from('subscriptions').select('plan').eq('user_id', user.id).single(),
  ]);

  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  const plan = sub?.plan ?? 'free';
  const maxPages = getLimits(plan).crawlPages;

  // Count existing active pages
  const { count } = await supabase
    .from('monitor_pages')
    .select('id', { count: 'exact', head: true })
    .eq('monitor_id', params.id)
    .eq('is_active', true);

  if ((count ?? 0) >= maxPages) {
    return NextResponse.json(
      { error: `Your plan allows up to ${maxPages} pages per monitor.` },
      { status: 402 },
    );
  }

  // Get current max sort_order
  const { data: last } = await supabase
    .from('monitor_pages')
    .select('sort_order')
    .eq('monitor_id', params.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const sortOrder = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('monitor_pages')
    .upsert({
      monitor_id: params.id,
      url,
      page_type,
      discovery_source: 'manual',
      is_active: true,
      sort_order: sortOrder,
    }, { onConflict: 'monitor_id,url' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
