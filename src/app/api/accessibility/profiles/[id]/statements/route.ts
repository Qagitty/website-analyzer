/**
 * POST /api/accessibility/profiles/[id]/statements
 * Generate an accessibility statement draft for the profile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAccessibilityEntitlement } from '@/lib/billing/limits';
import { generateStatementDraft } from '@/lib/accessibility/statement-generator';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  jurisdictionId:   z.string().min(1),
  jurisdictionName: z.string().min(1),
  assessmentId:     z.string().uuid().optional(),
  organizationName: z.string().optional(),
  siteUrl:          z.string().url().optional(),
  contactEmail:     z.string().email().optional(),
  contactFormUrl:   z.string().url().optional(),
  remediationPlan:  z.string().optional(),
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

  // Plan entitlement
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = sub?.plan ?? 'free';
  const entitlement = getAccessibilityEntitlement(plan);

  if (!entitlement.statementBuilder) {
    return NextResponse.json(
      { error: 'Accessibility statement builder requires an Agency plan or higher.', code: 'FEATURE_GATE_STATEMENT_BUILDER', requiredPlan: 'agency' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const d = parsed.data;

  // Load latest completed assessment if assessmentId not specified
  let assessment: { completedAt: string | undefined; coveragePercent: number; riskResult: { label: string } | null } = { completedAt: undefined, coveragePercent: 0, riskResult: null };
  if (d.assessmentId) {
    const { data: a } = await supabase
      .from('accessibility_assessments')
      .select('completed_at, coverage_percent, risk_level')
      .eq('id', d.assessmentId)
      .eq('profile_id', profileId)
      .single();
    if (a) {
      assessment = {
        completedAt:     a.completed_at ?? undefined,
        coveragePercent: Number(a.coverage_percent ?? 0),
        riskResult:      a.risk_level ? { label: String(a.risk_level) } : null,
      };
    }
  }

  // Load open critical/serious findings
  const { data: findings } = await supabase
    .from('accessibility_findings')
    .select('title, severity, impact')
    .eq('profile_id', profileId)
    .in('status', ['open', 'in_progress'])
    .in('severity', ['critical', 'serious'])
    .order('created_at', { ascending: false })
    .limit(20);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const knownFindings = (findings ?? []).map((f: any) => ({
    title:  String(f.title ?? ''),
    impact: String(f.impact ?? f.severity ?? 'serious'),
  }));

  const profileRecord = profile as Record<string, unknown>;
  const content = generateStatementDraft({
    profile: {
      name:              String(profileRecord.name ?? ''),
      targetMarkets:     Array.isArray(profileRecord.target_markets) ? profileRecord.target_markets as string[] : [],
      selectedStandards: Array.isArray(profileRecord.selected_standard_ids) ? profileRecord.selected_standard_ids as string[] : [],
    },
    assessment,
    jurisdiction: {
      id:   d.jurisdictionId,
      name: d.jurisdictionName,
    },
    knownFindings,
    contactInfo: {
      organizationName: d.organizationName,
      siteUrl:          d.siteUrl,
      contactEmail:     d.contactEmail,
      contactFormUrl:   d.contactFormUrl,
      remediationPlan:  d.remediationPlan,
    },
  });

  // Create statement record
  const { data: statement, error: stmtErr } = await supabase
    .from('accessibility_statements')
    .insert({
      profile_id:       profileId,
      user_id:          user.id,
      jurisdiction_id:  d.jurisdictionId,
      assessment_id:    d.assessmentId ?? null,
      status:           'draft',
      content:          content as unknown as Record<string, unknown>,
      version:          1,
      template_version: content.templateVersion,
      created_by:       user.id,
      statement_date:   content.statementDate,
      next_review_date: content.nextReviewDate,
    })
    .select()
    .single();

  if (stmtErr || !statement) {
    return NextResponse.json({ error: stmtErr?.message ?? 'Failed to create statement' }, { status: 500 });
  }

  // Create version 1
  await supabase.from('accessibility_statement_versions').insert({
    statement_id:   statement.id,
    version:        1,
    version_number: 1,
    content:        content as unknown as Record<string, unknown>,
    source_snapshot: { assessmentId: d.assessmentId ?? null, generatedAt: new Date().toISOString() },
    changed_by:     user.id,
    created_by:     user.id,
  });

  return NextResponse.json(statement, { status: 201 });
}
