/**
 * GET /api/compare/[id]
 * Returns a comparison record + the status/scores of all linked analyses.
 * Polls: call repeatedly until all analyses are 'completed' or 'failed'.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

interface ComparisonRow {
  id: string;
  user_id: string;
  analysis_ids: string[];
  labels: string[] | null;
  created_at: string;
}

interface AnalysisSummary {
  id: string;
  url: string;
  status: string;
  label: string;
  lighthouse_scores: Record<string, number> | null;
  ai_insights: Record<string, unknown> | null;
  screenshot_url: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch comparison
  const { data: comparison, error: compError } = await (supabase
    .from('comparisons' as any) as any)
    .select('id, user_id, analysis_ids, labels, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (compError || !comparison) {
    return NextResponse.json({ error: 'Comparison not found' }, { status: 404 });
  }

  const comp = comparison as ComparisonRow;

  // Fetch all linked analyses
  const { data: analyses, error: analError } = await supabase
    .from('analyses')
    .select('id, url, status, lighthouse_scores, ai_insights, screenshot_url, completed_at, error_message')
    .in('id', comp.analysis_ids)
    .eq('user_id', user.id);

  if (analError) return NextResponse.json({ error: analError.message }, { status: 500 });

  // Order analyses to match the original analysis_ids order
  const analysisMap = Object.fromEntries((analyses ?? []).map((a) => [a.id, a]));

  const ordered: AnalysisSummary[] = comp.analysis_ids.map((aid, i) => {
    const a = analysisMap[aid];
    const label = comp.labels?.[i] ?? (a ? new URL(a.url).hostname : `Site ${i + 1}`);
    if (!a) {
      return {
        id: aid,
        url: '',
        status: 'pending',
        label,
        lighthouse_scores: null,
        ai_insights: null,
        screenshot_url: null,
        completed_at: null,
        error_message: null,
      };
    }
    return {
      id: a.id,
      url: a.url,
      status: a.status,
      label,
      lighthouse_scores: a.lighthouse_scores as Record<string, number> | null,
      ai_insights: a.ai_insights as Record<string, unknown> | null,
      screenshot_url: a.screenshot_url,
      completed_at: a.completed_at,
      error_message: a.error_message,
    };
  });

  const allDone     = ordered.every((a) => a.status === 'completed' || a.status === 'failed');
  const anyFailed   = ordered.some((a) => a.status === 'failed');

  return NextResponse.json({
    id: comp.id,
    createdAt: comp.created_at,
    analyses: ordered,
    allDone,
    anyFailed,
  });
}
