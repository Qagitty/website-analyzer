import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const CANCELLABLE = new Set(['pending', 'queued', 'running']);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch the analysis — RLS ensures only the owner can see it
  const { data: analysis, error: fetchError } = await supabase
    .from('analyses')
    .select('id, status, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  if (!CANCELLABLE.has(analysis.status)) {
    return NextResponse.json(
      { error: `Cannot cancel an analysis with status '${analysis.status}'` },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from('analyses')
    .update({
      status: 'cancelled',
      error_message: 'Cancelled by user',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to cancel analysis' }, { status: 500 });
  }

  // Refund the credit
  await supabase.rpc('refund_credit', { p_user_id: user.id });

  return NextResponse.json({ cancelled: true });
}
