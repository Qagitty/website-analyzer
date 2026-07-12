import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = createServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ownership check
  const { data: fr } = await supabase
    .from('fix_requests')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!fr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('fix_request_read_states').upsert(
    { fix_request_id: params.id, user_id: user.id, last_read_at: now },
    { onConflict: 'fix_request_id,user_id' }
  );
  return NextResponse.json({ lastReadAt: now });
}
