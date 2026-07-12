import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  action: z.enum(['enable', 'disable', 'remove']),
  pageIds: z.array(z.string().uuid()).min(1).max(100),
});

// POST /api/monitors/[id]/pages/batch — bulk enable/disable/remove pages
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { action, pageIds } = parsed.data;

  // Verify monitor ownership
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  if (action === 'remove') {
    // Cannot remove root pages — exclude them
    const { data: pages } = await supabase
      .from('monitor_pages')
      .select('id, page_type')
      .eq('monitor_id', params.id)
      .in('id', pageIds);

    const removable = (pages ?? [])
      .filter((p) => p.page_type !== 'root')
      .map((p) => p.id);

    if (removable.length === 0) {
      return NextResponse.json({ error: 'No removable pages in selection (root page cannot be removed)' }, { status: 400 });
    }

    const { error } = await supabase
      .from('monitor_pages')
      .delete()
      .eq('monitor_id', params.id)
      .in('id', removable);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ affected: removable.length });
  }

  // enable or disable
  const { error, count } = await supabase
    .from('monitor_pages')
    .update({ is_active: action === 'enable' })
    .eq('monitor_id', params.id)
    .in('id', pageIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ affected: count ?? pageIds.length });
}
