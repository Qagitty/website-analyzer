/**
 * GET  /api/accessibility/profiles — list profiles for authenticated user
 * POST /api/accessibility/profiles — create a new accessibility profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAccessibilityEntitlement } from '@/lib/billing/limits';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Field names are snake_case to match the wizard's payload. Renaming either
// side silently drops data: every field below has a default, so a mismatched
// key parses clean and lands in the DB as an empty default.
const createSchema = z.object({
  name:                       z.string().min(1).max(200),
  site_url:                   z.string().url(),
  description:                z.string().max(2000).nullable().default(null),
  selected_standards:         z.array(z.string()).default([]),
  jurisdiction_ids:           z.array(z.string()).default([]),
  public_sector:              z.boolean().nullable().default(null),
  provides_consumer_services: z.boolean().nullable().default(null),
  assessment_page_mode:       z.enum(['homepage', 'important', 'all', 'custom', 'sitemap', 'crawl']).default('sitemap'),
  schedule:                   z.enum(['weekly', 'monthly']).nullable().default(null),
  page_urls:                  z.array(z.string()).default([]),
  journeys:                   z.array(z.object({
    name:        z.string().min(1).max(200),
    description: z.string().max(2000).optional().default(''),
  })).default([]),
  target_markets:             z.array(z.string()).default([]),
  organization_type:          z.string().default('unknown'),
  service_categories:         z.array(z.string()).default([]),
  monitor_id:                 z.string().uuid().optional(),
  connected_site_id:          z.string().uuid().optional(),
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
      user_id:                    user.id,
      name:                       d.name,
      site_url:                   d.site_url,
      description:                d.description,
      target_markets:             d.target_markets,
      organization_type:          d.organization_type,
      service_categories:         d.service_categories,
      public_sector:              d.public_sector,
      provides_consumer_services: d.provides_consumer_services,
      selected_standards:         d.selected_standards,
      jurisdiction_ids:           d.jurisdiction_ids,
      assessment_page_mode:       d.assessment_page_mode,
      page_urls:                  d.page_urls,
      schedule:                   d.schedule,
      monitor_id:                 d.monitor_id ?? null,
      connected_site_id:          d.connected_site_id ?? null,
      // Legacy required fields from 029 schema
      selected_standard_ids:      d.selected_standards,
      applicability_answers:      {},
      is_active:                  true,
      status:                     'active',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Journeys live in their own table. A failure here would otherwise leave a
  // profile that silently lost the journeys the user entered, so roll back.
  if (d.journeys.length > 0) {
    const { error: journeyError } = await supabase
      .from('accessibility_critical_journeys')
      .insert(d.journeys.map((j, i) => ({
        profile_id:  profile.id,
        name:        j.name,
        description: j.description || null,
        priority:    Math.min(i + 1, 10),
      })));

    if (journeyError) {
      await supabase.from('accessibility_profiles').delete().eq('id', profile.id);
      return NextResponse.json({ error: journeyError.message }, { status: 500 });
    }
  }

  return NextResponse.json(profile, { status: 201 });
}
