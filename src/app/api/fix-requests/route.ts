import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature } from '@/lib/billing/limits';
import { FIX_REQUEST_BOUNDS } from '@/types/fix-request';
import { z } from 'zod';

const createSchema = z.object({
  requestType: z.enum(['audit', 'fix', 'estimate', 'review', 'verification', 'consultation']),
  title:       z.string().min(FIX_REQUEST_BOUNDS.title.min).max(FIX_REQUEST_BOUNDS.title.max),
  summary:     z.string().max(FIX_REQUEST_BOUNDS.summary.max).optional(),
  technicalDescription: z.string().max(FIX_REQUEST_BOUNDS.technicalDesc.max).optional(),
  severity:    z.enum(['critical', 'high', 'medium', 'low', 'informational']).default('medium'),
  category:    z.string().max(100).optional(),
  sourceType:  z.enum([
    'analysis_finding', 'accessibility_finding', 'error_issue',
    'monitor_regression', 'security_finding', 'seo_finding',
    'design_mismatch', 'llm_readiness_finding', 'remediation_item', 'manual',
  ]),
  sourceId:    z.string().max(200).optional(),
  analysisId:  z.string().uuid().optional(),
  monitorId:   z.string().uuid().optional(),
  siteId:      z.string().uuid().optional(),
  affectedUrls:       z.array(z.string().url()).max(FIX_REQUEST_BOUNDS.affectedUrls.max).default([]),
  reproductionSteps:  z.array(z.string().max(500)).max(FIX_REQUEST_BOUNDS.reproductionSteps.max).default([]),
  verificationSteps:  z.array(z.string().max(500)).max(FIX_REQUEST_BOUNDS.verificationSteps.max).default([]),
  recommendedFix: z.string().max(10_000).optional(),
  codeExample:    z.string().max(20_000).optional(),
  evidence:    z.array(z.object({
    type:      z.enum(['screenshot', 'log', 'report_excerpt', 'test_result', 'url', 'text']),
    label:     z.string().max(200),
    value:     z.string().max(5_000),
    isPrivate: z.boolean().default(false),
  })).max(FIX_REQUEST_BOUNDS.evidence.max).default([]),
  requestedDueDate:  z.string().date().optional(),
  requestedPriority: z.enum(['urgent', 'high', 'normal', 'low']).optional(),
  coverMessage:      z.string().max(FIX_REQUEST_BOUNDS.message.max).optional(),
});

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await supabase
    .from('user_settings')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = settings?.plan ?? 'free';

  if (!hasFeature(plan, 'fixRequests')) {
    return NextResponse.json({ error: 'Fix request workflow requires a Pro plan or higher.', code: 'FEATURE_GATE_fixRequests', requiredPlan: 'pro' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get('status');
  const severity = searchParams.get('severity');
  const sourceType = searchParams.get('source_type');
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
  const offset = (page - 1) * limit;

  let query = supabase
    .from('fix_requests')
    .select('id, request_type, status, severity, title, summary, category, source_type, source_id, analysis_id, affected_urls, requested_due_date, requested_priority, is_archived, created_at, updated_at', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)     query = query.eq('status', status);
  if (severity)   query = query.eq('severity', severity);
  if (sourceType) query = query.eq('source_type', sourceType);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch fix requests' }, { status: 500 });

  return NextResponse.json({ data, total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await supabase
    .from('user_settings')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = settings?.plan ?? 'free';

  if (!hasFeature(plan, 'fixRequests')) {
    return NextResponse.json({ error: 'Fix request workflow requires a Pro plan or higher.', code: 'FEATURE_GATE_fixRequests', requiredPlan: 'pro' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const d = parsed.data;
  const { data: fr, error: insertError } = await supabase
    .from('fix_requests')
    .insert({
      user_id:              user.id,
      request_type:         d.requestType,
      title:                d.title,
      summary:              d.summary,
      technical_description: d.technicalDescription,
      severity:             d.severity,
      category:             d.category,
      source_type:          d.sourceType,
      source_id:            d.sourceId,
      analysis_id:          d.analysisId,
      monitor_id:           d.monitorId,
      site_id:              d.siteId,
      affected_urls:        d.affectedUrls,
      reproduction_steps:   d.reproductionSteps,
      verification_steps:   d.verificationSteps,
      recommended_fix:      d.recommendedFix,
      code_example:         d.codeExample,
      evidence:             d.evidence,
      requested_due_date:   d.requestedDueDate,
      requested_priority:   d.requestedPriority,
      cover_message:        d.coverMessage,
      status:               'draft',
    })
    .select('id, status, created_at')
    .single();

  if (insertError || !fr) {
    return NextResponse.json({ error: 'Failed to create fix request' }, { status: 500 });
  }

  // Write activity log
  await supabase.from('fix_request_activities').insert({
    fix_request_id: fr.id,
    user_id:        user.id,
    event_type:     'created',
    new_status:     'draft',
    metadata:       { sourceType: d.sourceType, severity: d.severity },
  });

  return NextResponse.json({ id: fr.id, status: fr.status }, { status: 201 });
}
