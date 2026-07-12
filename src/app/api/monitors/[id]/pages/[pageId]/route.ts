import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// DELETE /api/monitors/[id]/pages/[pageId] — remove a page (non-root only)
export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; pageId: string }> },
) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership and get the page
  const { data: page } = await supabase
    .from('monitor_pages')
    .select('id, page_type, monitor_id')
    .eq('id', params.pageId)
    .eq('monitor_id', params.id)
    .single();

  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  // Verify monitor belongs to user
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  // Root page cannot be removed
  if (page.page_type === 'root') {
    return NextResponse.json({ error: 'The root page cannot be removed.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('monitor_pages')
    .delete()
    .eq('id', params.pageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}

// PATCH /api/monitors/[id]/pages/[pageId] — toggle active state
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; pageId: string }> },
) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { is_active } = body;
  if (typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active (boolean) required' }, { status: 400 });
  }

  // Verify monitor ownership
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('monitor_pages')
    .update({ is_active })
    .eq('id', params.pageId)
    .eq('monitor_id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
