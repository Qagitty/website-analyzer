import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { validateAnalysisUrl } from '@/lib/security/url-validator';

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch the monitor (ownership check built-in via user_id filter)
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id, url, user_id, status, is_active')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  // Re-validate URL on every run (SSRF — can't trust creation-time validation)
  const urlValidation = validateAnalysisUrl(monitor.url);
  if (!urlValidation.valid) {
    return NextResponse.json({ error: urlValidation.rejectionReason ?? 'URL is not allowed' }, { status: 400 });
  }

  // Deduct a credit
  const { data: hasCredit } = await supabase.rpc('use_credit', { p_user_id: user.id });
  if (!hasCredit) {
    return NextResponse.json({ error: 'Insufficient credits. Please upgrade your plan.' }, { status: 402 });
  }

  // Create analysis record
  const { data: analysis, error: analysisErr } = await supabase
    .from('analyses')
    .insert({ user_id: user.id, url: monitor.url, status: 'pending' })
    .select('id')
    .single();

  if (analysisErr || !analysis) {
    await supabase.rpc('refund_credit', { p_user_id: user.id });
    return NextResponse.json({ error: 'Failed to create analysis' }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const runId = crypto.randomUUID();

  // Create monitor_run record (trigger = 'manual')
  await supabase.from('monitor_runs').insert({
    id: runId,
    monitor_id: monitor.id,
    analysis_id: analysis.id,
    scheduled_for: nowIso,
    started_at: nowIso,
    status: 'queued',
    trigger: 'manual',
    attempt: 1,
    errors: [],
  });

  // Update monitor last_run reference
  await supabase.from('monitors')
    .update({ last_run_at: nowIso, last_analysis_id: analysis.id, last_run_id: runId })
    .eq('id', monitor.id);

  // Dispatch to Cloudflare Worker (fire-and-forget)
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`;
  fetch(`${process.env.CLOUDFLARE_WORKER_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      analysisId: analysis.id,
      url: monitor.url,
      callbackUrl,
      monitorId: monitor.id,
      monitorRunId: runId,
      monitorUserId: user.id,
    }),
  }).catch((err) => console.error('[monitors/run-now] worker dispatch failed:', err));

  return NextResponse.json({ analysisId: analysis.id, runId, status: 'queued' }, { status: 202 });
}
