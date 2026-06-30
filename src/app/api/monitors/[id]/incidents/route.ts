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
    .from('monitor_incidents')
    .select('id, monitor_id, fingerprint, title, severity, status, first_detected_run_id, last_detected_run_id, resolved_run_id, affected_pages, occurrence_count, last_detected_at, created_at, updated_at')
    .eq('monitor_id', params.id)
    .order('last_detected_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
