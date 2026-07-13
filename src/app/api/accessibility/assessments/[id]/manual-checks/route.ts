/**
 * GET /api/accessibility/assessments/[id]/manual-checks
 * Returns manual check catalog items joined with this assessment's results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: assessmentId } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership check
  const { data: assessment } = await supabase
    .from('accessibility_assessments')
    .select('id, profile_id')
    .eq('id', assessmentId)
    .eq('user_id', user.id)
    .single();

  if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });

  // Load full catalog
  const { data: catalog } = await supabase
    .from('accessibility_manual_check_catalog')
    .select('*')
    .order('created_at', { ascending: true });

  // Load this assessment's results
  const { data: results } = await supabase
    .from('accessibility_manual_check_results')
    .select('*')
    .eq('assessment_id', assessmentId);

  // Join: for each catalog item, find matching result(s)
  const catalogWithResults = (catalog ?? []).map((item: any) => {
    const matchingResults = (results ?? []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => r.catalog_check_id === item.id,
    );
    return {
      ...item,
      results: matchingResults,
      status: matchingResults[0]?.status ?? 'not_started',
    };
  });

  return NextResponse.json(catalogWithResults);
}
