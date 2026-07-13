/**
 * POST /api/accessibility/profiles/[id]/assess
 * Create a new accessibility assessment for the profile.
 * Resolves page scope, creates assessment_pages, and enqueues jobs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAccessibilityEntitlement } from '@/lib/billing/limits';
import { normalizePageUrl } from '@/lib/accessibility/fingerprint';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  type:       z.enum(['baseline', 'scheduled', 'manual', 'verification', 'single_page', 'multi_page']).default('baseline'),
  pageUrls:   z.array(z.string().url()).optional(),
});

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: profileId } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership check
  const { data: profile } = await supabase
    .from('accessibility_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Plan entitlement check
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = sub?.plan ?? 'free';
  const entitlement = getAccessibilityEntitlement(plan);

  if (!entitlement.enabled) {
    return NextResponse.json(
      { error: 'Accessibility assessments require a Pro plan or higher.', code: 'FEATURE_GATE_ACCESSIBILITY', requiredPlan: 'pro' },
      { status: 403 },
    );
  }

  // Check if an assessment is already running for this profile
  const { data: running } = await supabase
    .from('accessibility_assessments')
    .select('id')
    .eq('profile_id', profileId)
    .in('status', ['pending', 'running'])
    .limit(1);

  if (running && running.length > 0) {
    return NextResponse.json(
      { error: 'An assessment is already running for this profile. Wait for it to complete before starting a new one.' },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { type } = parsed.data;

  // Resolve pages based on assessment_page_mode
  let pageUrls: string[] = [];
  const pageMode = (profile as Record<string, unknown>).assessment_page_mode as string ?? 'homepage';

  if (parsed.data.pageUrls && parsed.data.pageUrls.length > 0) {
    // Caller explicitly provided pages
    pageUrls = parsed.data.pageUrls;
  } else if (pageMode === 'homepage') {
    // Use the monitor's root URL or profile's linked site
    const monitorId = (profile as Record<string, unknown>).monitor_id as string | null;
    if (monitorId) {
      const { data: monitor } = await supabase
        .from('monitors')
        .select('url')
        .eq('id', monitorId)
        .single();
      if (monitor?.url) pageUrls = [monitor.url as string];
    }
    // Fall back to an empty list — user must provide URLs
  } else if (pageMode === 'all' || pageMode === 'important') {
    const monitorId = (profile as Record<string, unknown>).monitor_id as string | null;
    if (monitorId) {
      const { data: monitorPages } = await supabase
        .from('monitor_pages')
        .select('url')
        .eq('monitor_id', monitorId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(entitlement.pagesPerAssessment);
      pageUrls = (monitorPages ?? []).map((p: any) => p.url as string);
    }
  }

  // Enforce page limit from plan
  if (pageUrls.length > entitlement.pagesPerAssessment) {
    pageUrls = pageUrls.slice(0, entitlement.pagesPerAssessment);
  }

  if (pageUrls.length === 0) {
    return NextResponse.json(
      { error: 'No pages to assess. Provide pageUrls or link a monitor to the profile.' },
      { status: 400 },
    );
  }

  // Snapshot current standards and jurisdictions
  const { data: regions } = await supabase
    .from('accessibility_profile_regions')
    .select('jurisdiction_id, profile_version')
    .eq('profile_id', profileId)
    .eq('is_active', true);

  const standardsSnapshot = { standards: (profile as Record<string, unknown>).selected_standard_ids ?? [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jurisdictionsSnapshot = { jurisdictions: (regions ?? []).map((r: any) => r.jurisdiction_id) };

  // Create assessment record
  const { data: assessment, error: assessmentErr } = await supabase
    .from('accessibility_assessments')
    .insert({
      profile_id:              profileId,
      user_id:                 user.id,
      assessment_type:         type,
      type,
      status:                  'pending',
      url:                     pageUrls[0] ?? '',
      pages_requested:         pageUrls.length,
      page_count:              pageUrls.length,
      pages_completed:         0,
      pages_failed:            0,
      standards_snapshot:      standardsSnapshot,
      jurisdictions_snapshot:  jurisdictionsSnapshot,
      engine_version:          '1.0',
      ruleset_version:         '1.0',
      coverage_percent:        0,
      manual_coverage_percent: 0,
      journey_coverage_percent: 0,
      manual_checks_required:  0,
      manual_checks_completed: 0,
    })
    .select()
    .single();

  if (assessmentErr || !assessment) {
    return NextResponse.json({ error: assessmentErr?.message ?? 'Failed to create assessment' }, { status: 500 });
  }

  // Create assessment page records
  const pageInserts = pageUrls.map((url) => ({
    assessment_id:   assessment.id,
    page_url:        url,
    normalized_url:  normalizePageUrl(url),
    status:          'pending' as const,
    automated_findings_count: 0,
    finding_count:   0,
    critical_count:  0,
    assessed_at:     new Date().toISOString(),
  }));

  const { error: pagesErr } = await supabase
    .from('accessibility_assessment_pages')
    .insert(pageInserts);

  if (pagesErr) {
    // Clean up assessment on failure
    await supabase.from('accessibility_assessments').delete().eq('id', assessment.id);
    return NextResponse.json({ error: pagesErr.message }, { status: 500 });
  }

  // Log activity
  await supabase.from('accessibility_activities').insert({
    profile_id:    profileId,
    assessment_id: assessment.id,
    user_id:       user.id,
    event_type:    'assessment_started',
    event_data:    { type, pageCount: pageUrls.length },
  });

  return NextResponse.json(assessment, { status: 201 });
}
