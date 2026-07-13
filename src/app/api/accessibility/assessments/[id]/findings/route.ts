/**
 * GET /api/accessibility/assessments/[id]/findings
 * Paginated findings with filters: status, impact, wcag_level, page_url.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: assessmentId } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership check via assessment
  const { data: assessment } = await supabase
    .from('accessibility_assessments')
    .select('id')
    .eq('id', assessmentId)
    .eq('user_id', user.id)
    .single();

  if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const status   = sp.get('status');
  const impact   = sp.get('impact');
  const wcagLevel = sp.get('wcag_level');
  const pageUrl  = sp.get('page_url');
  const page     = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(sp.get('page_size') ?? '25', 10)));
  const offset   = (page - 1) * pageSize;

  let query = supabase
    .from('accessibility_findings')
    .select('*', { count: 'exact' })
    .eq('assessment_id', assessmentId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (status)   query = query.eq('status', status);
  if (impact)   query = query.eq('impact', impact);
  if (wcagLevel) query = query.eq('wcag_level', wcagLevel);
  if (pageUrl)  query = query.eq('page_url', pageUrl);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    findings:    data ?? [],
    total:       count ?? 0,
    page,
    pageSize,
    totalPages:  Math.ceil((count ?? 0) / pageSize),
  });
}
