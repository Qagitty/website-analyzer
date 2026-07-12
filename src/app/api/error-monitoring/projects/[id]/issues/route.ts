/**
 * GET /api/error-monitoring/projects/[id]/issues — list issues for project
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, props: Params) {
  const { id } = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership check
  const { data: project } = await supabase
    .from('error_projects')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const level  = searchParams.get('level');
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '25', 10));
  const offset = (page - 1) * limit;

  let query = supabase
    .from('error_issues')
    .select('*', { count: 'exact' })
    .eq('error_project_id', id)
    .order('last_seen_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status as 'unresolved' | 'investigating' | 'resolved' | 'ignored' | 'archived');
  if (level)  query = query.eq('level',  level  as 'fatal' | 'error' | 'warning' | 'info');

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });

  return NextResponse.json({
    data:  data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
