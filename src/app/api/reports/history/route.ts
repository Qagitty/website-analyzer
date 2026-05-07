import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10) || 30, 100);

  if (!url) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 });
  }

  const { data: analyses, error } = await (supabase as any)
    .from('analyses')
    .select('created_at, lighthouse_scores')
    .eq('status', 'completed')
    .eq('url', url)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }

  const history = (analyses ?? [])
    .filter((a: any) => a.lighthouse_scores != null)
    .map((a: any) => ({
      date: a.created_at,
      performance: a.lighthouse_scores.performance ?? null,
      accessibility: a.lighthouse_scores.accessibility ?? null,
      seo: a.lighthouse_scores.seo ?? null,
      bestPractices: a.lighthouse_scores.bestPractices ?? null,
    }));

  return NextResponse.json(history);
}
