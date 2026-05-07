import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('credits, credits_used')
    .eq('user_id', user.id)
    .single();

  if (error || !settings) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  }

  return NextResponse.json({
    credits: settings.credits,
    creditsUsed: settings.credits_used,
  });
}
