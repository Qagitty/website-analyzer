import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { addDays } from 'date-fns';

const schema = z.object({
  url: z
    .string()
    .trim()
    .url('Invalid URL')
    .refine((u) => u.startsWith('http://') || u.startsWith('https://')),
  frequency: z.enum(['daily', 'weekly']).default('weekly'),
  notify_on_score_drop: z.boolean().default(true),
  score_drop_threshold: z.number().int().min(1).max(50).default(10),
});

// GET /api/monitors — list all monitors for the current user
export async function GET() {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await (supabase as any).from('monitors')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/monitors — create a monitor
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { url, frequency, notify_on_score_drop, score_drop_threshold } = parsed.data;

  // Limit monitors per user (free tier: 3, pro/agency: unlimited)
  const { count } = await (supabase as any).from('monitors')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  const plan = (sub as any)?.plan ?? 'free';
  const limit = plan === 'free' ? 3 : 999;

  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Free plan allows up to ${limit} monitors. Upgrade for more.` },
      { status: 402 }
    );
  }

  // Deduct a credit for the immediate first run
  const { data: hasCredit } = await supabase.rpc('use_credit', { p_user_id: user.id });
  if (!hasCredit) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.' },
      { status: 402 }
    );
  }

  // next_run_at is the SECOND scheduled run (first is immediate below)
  const nextRunAt = frequency === 'daily'
    ? addDays(new Date(), 1)
    : addDays(new Date(), 7);

  const { data: monitor, error: insertError } = await (supabase as any).from('monitors')
    .insert({
      user_id: user.id,
      url,
      frequency,
      notify_on_score_drop,
      score_drop_threshold,
      next_run_at: nextRunAt.toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    await supabase.rpc('refund_credit', { p_user_id: user.id });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Create initial analysis record
  const { data: analysis, error: analysisErr } = await supabase
    .from('analyses')
    .insert({ user_id: user.id, url, status: 'pending' })
    .select('id')
    .single();

  if (analysisErr || !analysis) {
    await supabase.rpc('refund_credit', { p_user_id: user.id });
    return NextResponse.json(monitor, { status: 201 });
  }

  const now = new Date().toISOString();

  // Update monitor to record initial run
  const { data: updatedMonitor } = await (supabase as any).from('monitors')
    .update({ last_run_at: now, last_analysis_id: analysis.id })
    .eq('id', monitor.id)
    .select()
    .single();

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
      url,
      callbackUrl,
      authToken: process.env.WORKER_CALLBACK_SECRET,
      monitorId: monitor.id,
      monitorUserId: user.id,
    }),
  }).catch((err) => console.error('[monitors/create] worker dispatch failed:', err));

  return NextResponse.json(updatedMonitor ?? monitor, { status: 201 });
}
