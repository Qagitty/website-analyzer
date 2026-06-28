import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-keys/authenticate';
import { checkRateLimit } from '@/lib/api-keys/rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await authenticateApiKey(req.headers.get('Authorization'));
  if (!auth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });

  const { allowed, remaining, limit } = await checkRateLimit(auth.keyId, auth.plan);
  if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('analyses')
    .select('id, url, status, lighthouse_scores, accessibility_issues, console_errors, ai_insights, ai_summary, crawl_pages, created_at, completed_at')
    .eq('id', params.id)
    .eq('user_id', auth.userId)
    .single();

  if (!data) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  // §27 — expose structured score breakdown alongside top-level scores
  const ls = data.lighthouse_scores as Record<string, unknown> | null;
  const scoreDetails = ls
    ? {
        versions: {
          performance: ls.scoreVersion ?? null,
          seo:         (ls.seoAudit as any)?.scoreVersion ?? null,
          accessibility: (ls.accessibilityAudit as any)?.version ?? null,
          bestPractices: (ls.bestPracticesAudit as any)?.scoreVersion ?? null,
          llmReadiness:  (ls.llmReadinessAudit as any)?.scoreVersion ?? null,
        },
        breakdowns: {
          performance: (ls.scoreBreakdown as unknown[]) ?? null,
          seo:         (ls.seoAudit as any)?.scoreBreakdown ?? null,
          accessibility: (ls.accessibilityAudit as any)?.scoreBreakdown ?? null,
          bestPractices: (ls.bestPracticesAudit as any)?.categoryScores ?? null,
          llmReadiness:  (ls.llmReadinessAudit as any)?.categoryScores ?? null,
        },
        coverage: {
          performance: ls.coverage ?? null,
          seo:         (ls.seoAudit as any)?.coverage ?? null,
          accessibility: (ls.accessibilityAudit as any)?.coverage ?? null,
          bestPractices: (ls.bestPracticesAudit as any)?.coverage ?? null,
          llmReadiness:  (ls.llmReadinessAudit as any)?.coverage ?? null,
        },
      }
    : null;

  return NextResponse.json(
    { ...data, scoreDetails },
    {
      headers: {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
      },
    },
  );
}
