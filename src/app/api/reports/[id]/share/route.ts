import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST /api/reports/[id]/share  — toggle is_public, returns { isPublic, shareUrl }
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch current state (RLS ensures it belongs to this user)
  const { data: analysis, error: fetchError } = await (supabase
    .from('analyses') as any)
    .select('id, is_public, status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !analysis) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  if (analysis.status !== 'completed') {
    return NextResponse.json({ error: 'Only completed reports can be shared' }, { status: 400 });
  }

  const newPublic = !(analysis as any).is_public;

  const { error: updateError } = await supabase
    .from('analyses')
    .update({ is_public: newPublic } as any)
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update share status' }, { status: 500 });
  }

  const shareUrl = newPublic
    ? `${process.env.NEXT_PUBLIC_APP_URL}/share/${params.id}`
    : null;

  return NextResponse.json({ isPublic: newPublic, shareUrl });
}
