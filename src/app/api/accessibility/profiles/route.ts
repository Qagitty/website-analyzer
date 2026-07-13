/**
 * GET  /api/accessibility/profiles — list profiles for authenticated user
 * POST /api/accessibility/profiles — create a new accessibility profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAccessibilityEntitlement } from '@/lib/billing/limits';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name:                      z.string().min(1).max(200),
  targetMarkets:             z.array(z.string()).default([]),
  organizationType:          z.string().default('unknown'),
  serviceCategories:         z.array(z.string()).default([]),
  publicSector:              z.boolean().nullable().default(null),
  providesConsumerServices:  z.boolean().nullable().default(null),
  selectedStandards:         z.array(z.string()).default([]),
  assessmentPageMode:        z.enum(['homepage', 'important', 'all', 'custom']).default('homepage'),
  monitorId:                 z.string().uuid().optional(),
  connectedSiteId:           z.string().uuid().optional(),
});

// GET /api/accessibility/profiles
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('accessibility_profiles')
    .select('*, accessibility_assessments(id, status, coverage_percent, completed_at, risk_level)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/accessibility/profiles
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Check plan entitlement
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = sub?.plan ?? 'free';
  const entitlement = getAccessibilityEntitlement(plan);

  if (!entitlement.enabled) {
    return NextResponse.json(
      { error: 'Accessibility profiles require a Pro plan or higher.', code: 'FEATURE_GATE_ACCESSIBILITY', requiredPlan: 'pro' },
      { status: 403 },
    );
  }

  // Check profile count limit
  const { count } = await supabase
    .from('accessibility_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);

  if ((count ?? 0) >= entitlement.profiles) {
    return NextResponse.json(
      { error: `Your plan allows up to ${entitlement.profiles} accessibility profile${entitlement.profiles !== 1 ? 's' : ''}. Upgrade to add more.` },
      { status: 402 },
    );
  }

  const d = parsed.data;
  const { data: profile, error: insertError } = await supabase
    .from('accessibility_profiles')
    .insert({
      user_id:                   user.id,
      name:                      d.name,
      target_markets:            d.targetMarkets,
      organization_type:         d.organizationType,
      service_categories:        d.serviceCategories,
      public_sector:             d.publicSector,
      provides_consumer_services: d.providesConsumerServices,
      selected_standards:        d.selectedStandards,
      assessment_page_mode:      d.assessmentPageMode,
      monitor_id:                d.monitorId ?? null,
      connected_site_id:         d.connectedSiteId ?? null,
      // Legacy required fields from 029 schema
      selected_standard_ids:     d.selectedStandards,
      applicability_answers:     {},
      is_active:                 true,
      status:                    'active',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(profile, { status: 201 });
}
