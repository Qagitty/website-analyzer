import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature } from '@/lib/billing/limits';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await supabase.from('user_settings').select('plan').eq('user_id', user.id).single();
  if (!hasFeature(settings?.plan ?? 'free', 'fixRequests')) {
    return NextResponse.json({ error: 'Fix requests require a Pro plan.' }, { status: 403 });
  }

  const { data: fr } = await supabase.from('fix_requests').select('id').eq('id', params.id).eq('user_id', user.id).single();
  if (!fr) return NextResponse.json({ error: 'Fix request not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('fix_request_activities')
    .select('id, event_type, previous_status, new_status, actor_display_name, actor_is_external, metadata, created_at')
    .eq('fix_request_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  return NextResponse.json({ data });
}
