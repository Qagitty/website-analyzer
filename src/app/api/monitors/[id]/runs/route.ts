import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('monitor_runs')
    .select('id, monitor_id, analysis_id, scheduled_for, started_at, completed_at, status, trigger, attempt, failure_origin, errors, created_at')
    .eq('monitor_id', params.id)
    .order('scheduled_for', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
