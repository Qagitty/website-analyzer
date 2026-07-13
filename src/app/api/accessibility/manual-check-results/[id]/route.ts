/**
 * PATCH /api/accessibility/manual-check-results/[id]
 * Update a manual check result (status, notes, evidence).
 * Does NOT allow bulk auto-pass.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.enum(['not_started', 'pass', 'fail', 'not_applicable', 'needs_expert_review']),
  notes:  z.string().max(5000).optional(),
  evidence: z.array(z.record(z.unknown())).max(10).optional(),
}).strict();

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership check via user_id on the result row
  const { data: existing } = await supabase
    .from('accessibility_manual_check_results')
    .select('id, assessment_id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Manual check result not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Guard: never allow a 'bulk' flag that would auto-pass all checks
  if ((body as Record<string, unknown>).bulk === true) {
    return NextResponse.json(
      { error: 'Bulk auto-pass is not allowed. Each manual check must be reviewed individually.' },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { status, notes, evidence } = parsed.data;
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    status,
    updated_at:  now,
  };
  if (status !== 'not_started') updates.reviewed_at = now;
  if (notes !== undefined)      updates.notes = notes;
  if (evidence !== undefined)   updates.evidence = evidence;

  const { data: updated, error } = await supabase
    .from('accessibility_manual_check_results')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}
