import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature, featureGateError } from '@/lib/billing/limits';
import { z } from 'zod';

const createSchema = z.object({
  analysis_id:       z.string().uuid(),
  url:               z.string().url(),
  issue_id:          z.string().min(1),
  issue_description: z.string().min(1),
  impact:            z.enum(['critical', 'serious', 'moderate', 'minor']),
  wcag_criteria:     z.array(z.string()).default([]),
});

// GET /api/remediation — list all items for the current user
// Optional query params: ?url=<url> &status=<status>
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const filterUrl    = searchParams.get('url');
  const filterStatus = searchParams.get('status');

  let query = supabase
    .from('remediation_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (filterUrl)    query = query.eq('url', filterUrl);
  if (filterStatus) query = query.eq('status', filterStatus as any);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/remediation — create a tracked issue (Pro+ required)
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  if (!hasFeature(subscription?.plan ?? 'free', 'remediationBoard')) {
    return NextResponse.json(featureGateError('remediationBoard', 'pro'), { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Prevent duplicates: same user + analysis + issue_id
  const { data: existing } = await supabase
    .from('remediation_items')
    .select('id')
    .eq('user_id', user.id)
    .eq('analysis_id', parsed.data.analysis_id)
    .eq('issue_id', parsed.data.issue_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Already tracked' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('remediation_items')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
