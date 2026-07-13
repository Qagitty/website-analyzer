/**
 * GET /api/accessibility/assessments/[id]
 * Assessment detail with pages, findings summary, and manual check summary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: assessment, error } = await supabase
    .from('accessibility_assessments')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });

  // Fetch pages
  const { data: pages } = await supabase
    .from('accessibility_assessment_pages')
    .select('*')
    .eq('assessment_id', id)
    .order('created_at', { ascending: true });

  // Findings summary
  const { data: findingsSummary } = await supabase
    .from('accessibility_findings')
    .select('status, impact, wcag_level, severity')
    .eq('assessment_id', id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openCount     = (findingsSummary ?? []).filter((f: any) => f.status === 'open').length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const criticalCount = (findingsSummary ?? []).filter((f: any) =>
    f.impact === 'critical' || f.severity === 'critical',
  ).length;

  // Manual checks summary
  const { data: manualSummary } = await supabase
    .from('accessibility_manual_check_results')
    .select('status')
    .eq('assessment_id', id);

  const manualTotal    = (manualSummary ?? []).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manualComplete = (manualSummary ?? []).filter((r: any) => r.status !== 'not_started').length;

  return NextResponse.json({
    ...assessment,
    pages:   pages ?? [],
    summary: {
      totalFindings:   (findingsSummary ?? []).length,
      openFindings:    openCount,
      criticalFindings: criticalCount,
      manualChecks: {
        total:     manualTotal,
        completed: manualComplete,
      },
    },
  });
}
