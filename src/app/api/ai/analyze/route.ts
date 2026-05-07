import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { analyzeWithAI } from '@/lib/ai/claude';
import { z } from 'zod';

const schema = z.object({
  analysisId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid analysisId' }, { status: 400 });
  }

  const { data: analysis } = await supabase
    .from('analyses')
    .select('id, screenshot_url, lighthouse_scores, console_errors, accessibility_issues')
    .eq('id', parsed.data.analysisId)
    .eq('user_id', user.id)
    .single();

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  try {
    const aiInsights = await analyzeWithAI({
      screenshotBase64: '',
      lighthouseScores: analysis.lighthouse_scores,
      consoleErrors: (analysis.console_errors as any[]) ?? [],
      accessibilityIssues: (analysis.accessibility_issues as any[]) ?? [],
    });

    await supabase
      .from('analyses')
      .update({ ai_insights: aiInsights, ai_summary: String(aiInsights.summary ?? '') })
      .eq('id', analysis.id);

    return NextResponse.json({ success: true, insights: aiInsights });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'AI analysis failed' }, { status: 500 });
  }
}
