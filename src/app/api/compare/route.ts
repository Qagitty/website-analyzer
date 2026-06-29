/**
 * POST /api/compare
 * Creates a competitor comparison — one analysis per URL.
 * First URL = user's site (primary). Subsequent = competitors.
 *
 * Plan limits (competitorUrls) control max number of competitor URLs:
 *   free=0, pro=1, agency=3, compliance=5
 * The primary URL always costs 1 credit; each competitor costs 1 more.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature, getLimits, featureGateError } from '@/lib/billing/limits';
import { z } from 'zod';

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const schema = z.object({
  urls:   z.array(z.string().trim().transform(normalizeUrl).pipe(z.string().url('Invalid URL')))
           .min(2, 'Provide at least 2 URLs (your site + 1 competitor)')
           .max(6, 'Maximum 5 competitors supported'),
  labels: z.array(z.string().max(50)).optional(),
});

// Dispatch a single analysis to the worker (fire-and-forget)
async function dispatchAnalysis(
  analysisId: string,
  url: string,
) {
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`;
  const workerUrl   = `${process.env.CLOUDFLARE_WORKER_URL}/analyze`;

  fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      analysisId,
      url,
      callbackUrl,
      // F5 — authToken removed; Worker reads WORKER_CALLBACK_SECRET from its own env.
    }),
  }).then(async (r) => {
    const text = await r.text().catch(() => '');
    console.log('[compare] worker response:', r.status, text.slice(0, 100));
  }).catch((err) => {
    console.error('[compare] worker dispatch failed:', err);
  });
}

export async function POST(req: NextRequest) {
  // SE5 — CSRF now enforced centrally in middleware.ts.

  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Feature gate: competitor comparison requires Pro+
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = subscription?.plan ?? 'free';

  if (!hasFeature(plan, 'competitorCompare')) {
    return NextResponse.json(featureGateError('competitorCompare', 'pro'), { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { urls, labels } = parsed.data;
  const primaryUrl     = urls[0];
  const competitorUrls = urls.slice(1);

  // Validate competitor count against plan limit
  const maxCompetitors = getLimits(plan).competitorUrls;
  if (competitorUrls.length > maxCompetitors) {
    return NextResponse.json(
      {
        error: `Your plan allows up to ${maxCompetitors} competitor URL${maxCompetitors === 1 ? '' : 's'}. Upgrade to add more.`,
        code: 'COMPETITOR_LIMIT_EXCEEDED',
      },
      { status: 403 },
    );
  }

  // Ensure enough credits (1 per URL)
  const totalUrlCount = urls.length;
  const { data: settings } = await supabase
    .from('user_settings')
    .select('credits')
    .eq('user_id', user.id)
    .single();
  const availableCredits = (settings as any)?.credits ?? 0;

  if (availableCredits < totalUrlCount) {
    return NextResponse.json(
      {
        error: `You need ${totalUrlCount} credits for this comparison but only have ${availableCredits}. Please upgrade your plan.`,
        code: 'INSUFFICIENT_CREDITS',
      },
      { status: 402 },
    );
  }

  // Create one analysis per URL and consume credits
  const analysisIds: string[] = [];
  const insertedAnalysisIds: string[] = [];

  for (const url of urls) {
    // Consume credit atomically
    const { data: hasCredit } = await supabase.rpc('use_credit', { p_user_id: user.id });
    if (!hasCredit) {
      // Refund already-used credits
      for (let i = 0; i < insertedAnalysisIds.length; i++) {
        await supabase.rpc('refund_credit', { p_user_id: user.id });
      }
      return NextResponse.json({ error: 'Ran out of credits mid-comparison.' }, { status: 402 });
    }

    const { data: analysis, error: insertError } = await supabase
      .from('analyses')
      .insert({ user_id: user.id, url, status: 'queued' })
      .select('id')
      .single();

    if (insertError || !analysis) {
      // Refund already-used credits
      for (let i = 0; i <= insertedAnalysisIds.length; i++) {
        await supabase.rpc('refund_credit', { p_user_id: user.id });
      }
      return NextResponse.json({ error: 'Failed to create analysis record.' }, { status: 500 });
    }

    analysisIds.push(analysis.id);
    insertedAnalysisIds.push(analysis.id);
  }

  // Create comparison record
  const { data: comparison, error: compError } = await supabase
    .from('comparisons' as any)
    .insert({
      user_id:      user.id,
      analysis_ids: analysisIds,
      labels:       labels ?? urls.map((u) => new URL(u).hostname),
    })
    .select('id')
    .single();

  if (compError || !comparison) {
    console.error('[compare] comparison insert failed:', compError);
    return NextResponse.json({ error: 'Failed to create comparison record.' }, { status: 500 });
  }

  // Dispatch all analyses to the worker (fire-and-forget)
  for (let i = 0; i < urls.length; i++) {
    dispatchAnalysis(analysisIds[i], urls[i]);
  }

  return NextResponse.json(
    {
      comparisonId: (comparison as any).id,
      analysisIds,
      primaryUrl,
      competitorUrls,
    },
    { status: 202 },
  );
}

// GET /api/compare — list comparisons for the authenticated user
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50);

  const { data, error } = await (supabase
    .from('comparisons' as any) as any)
    .select('id, analysis_ids, labels, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
