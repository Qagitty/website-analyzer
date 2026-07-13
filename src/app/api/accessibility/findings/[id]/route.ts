/**
 * PATCH /api/accessibility/findings/[id]
 * Status transition for an accessibility finding — enforces valid transitions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Valid transitions: from → allowed next states
const VALID_TRANSITIONS: Record<string, string[]> = {
  open:                  ['in_progress', 'not_applicable', 'accepted_risk'],
  in_progress:           ['resolved', 'not_applicable', 'accepted_risk'],
  resolved:              ['verification_required'],
  verification_required: ['verified', 'open'],
  verified:              ['open'],
  accepted_risk:         ['open'],
  not_applicable:        ['open'],
};

const patchSchema = z.object({
  status:                z.enum(['open', 'in_progress', 'resolved', 'verification_required', 'verified', 'accepted_risk', 'not_applicable']),
  acceptedRiskReason:    z.string().min(1).optional(),
  notApplicableReason:   z.string().min(1).optional(),
}).refine(
  (d) => d.status !== 'accepted_risk' || (d.acceptedRiskReason && d.acceptedRiskReason.length > 0),
  { message: 'acceptedRiskReason is required when status is accepted_risk', path: ['acceptedRiskReason'] },
).refine(
  (d) => d.status !== 'not_applicable' || (d.notApplicableReason && d.notApplicableReason.length > 0),
  { message: 'notApplicableReason is required when status is not_applicable', path: ['notApplicableReason'] },
);

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Load finding with ownership check
  const { data: finding } = await supabase
    .from('accessibility_findings')
    .select('id, status, profile_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { status: newStatus, acceptedRiskReason, notApplicableReason } = parsed.data;
  const currentStatus = (finding as Record<string, unknown>).status as string;

  // Enforce transition rules
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}` },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status:       newStatus,
    last_seen_at: now,
  };
  if (newStatus === 'verified')       updates.verified_at = now;
  if (newStatus === 'resolved')       updates.resolved_at = now;
  if (acceptedRiskReason)             updates.accepted_risk_reason = acceptedRiskReason;
  if (notApplicableReason)            updates.not_applicable_reason = notApplicableReason;

  const { data: updated, error } = await supabase
    .from('accessibility_findings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log activity
  await supabase.from('accessibility_activities').insert({
    profile_id:  (finding as Record<string, unknown>).profile_id as string,
    finding_id:  id,
    user_id:     user.id,
    event_type:  'finding_status_changed',
    event_data:  { from: currentStatus, to: newStatus },
  });

  return NextResponse.json(updated);
}
