import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// DELETE — remove a team member
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', params.id)
    .eq('owner_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
