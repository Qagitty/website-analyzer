import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature } from '@/lib/billing/limits';
import { validateTransition } from '@/lib/fix-request/state-machine';
import type { FixRequestStatus } from '@/types/fix-request';
import { z } from 'zod';

const patchSchema = z.object({
  title:       z.string().min(3).max(200).optional(),
  summary:     z.string().max(1000).optional(),
  technicalDescription: z.string().max(10_000).optional(),
  severity:    z.enum(['critical', 'high', 'medium', 'low', 'informational']).optional(),
  category:    z.string().max(100).optional(),
  recommendedFix: z.string().max(10_000).optional(),
  codeExample:    z.string().max(20_000).optional(),
  affectedUrls:   z.array(z.string().url()).max(20).optional(),
  reproductionSteps: z.array(z.string().max(500)).max(20).optional(),
  verificationSteps: z.array(z.string().max(500)).max(20).optional(),
  requestedDueDate:  z.string().date().optional(),
  requestedPriority: z.enum(['urgent', 'high', 'normal', 'low']).optional(),
  coverMessage:      z.string().max(5_000).optional().nullable(),
  status:            z.string().optional(),
  isArchived:        z.boolean().optional(),
});

async function getAuthorizedRequest(supabase: ReturnType<typeof createServerClient>, userId: string, id: string) {
  const { data, error } = await supabase
    .from('fix_requests')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data: error ? null : data, error };
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await supabase.from('user_settings').select('plan').eq('user_id', user.id).single();
  if (!hasFeature(settings?.plan ?? 'free', 'fixRequests')) {
    return NextResponse.json({ error: 'Fix requests require a Pro plan or higher.' }, { status: 403 });
  }

  const { data, error } = await getAuthorizedRequest(supabase, user.id, params.id);
  if (error || !data) return NextResponse.json({ error: 'Fix request not found' }, { status: 404 });

  // Strip internal_notes from public response
  const { internal_notes: _internal, ...safeData } = data;
  return NextResponse.json(safeData);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await supabase.from('user_settings').select('plan').eq('user_id', user.id).single();
  if (!hasFeature(settings?.plan ?? 'free', 'fixRequests')) {
    return NextResponse.json({ error: 'Fix requests require a Pro plan or higher.' }, { status: 403 });
  }

  const { data: existing, error: fetchErr } = await getAuthorizedRequest(supabase, user.id, params.id);
  if (fetchErr || !existing) return NextResponse.json({ error: 'Fix request not found' }, { status: 404 });

  if (['closed', 'cancelled'].includes(existing.status)) {
    return NextResponse.json({ error: `Fix request is ${existing.status} and cannot be modified.` }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const d = parsed.data;
  const update: Record<string, unknown> = {};

  if (d.title !== undefined)               update.title = d.title;
  if (d.summary !== undefined)             update.summary = d.summary;
  if (d.technicalDescription !== undefined) update.technical_description = d.technicalDescription;
  if (d.severity !== undefined)            update.severity = d.severity;
  if (d.category !== undefined)            update.category = d.category;
  if (d.recommendedFix !== undefined)      update.recommended_fix = d.recommendedFix;
  if (d.codeExample !== undefined)         update.code_example = d.codeExample;
  if (d.affectedUrls !== undefined)        update.affected_urls = d.affectedUrls;
  if (d.reproductionSteps !== undefined)   update.reproduction_steps = d.reproductionSteps;
  if (d.verificationSteps !== undefined)   update.verification_steps = d.verificationSteps;
  if (d.requestedDueDate !== undefined)    update.requested_due_date = d.requestedDueDate;
  if (d.requestedPriority !== undefined)   update.requested_priority = d.requestedPriority;
  if (d.coverMessage !== undefined)        update.cover_message = d.coverMessage;
  if (d.isArchived !== undefined)          update.is_archived = d.isArchived;

  // Status transitions validated
  if (d.status !== undefined) {
    const validation = validateTransition(existing.status as FixRequestStatus, d.status as FixRequestStatus);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error, code: validation.code }, { status: 409 });
    }
    update.status = d.status;
    update.updated_at = new Date().toISOString();

    await supabase.from('fix_request_activities').insert({
      fix_request_id: params.id,
      user_id:        user.id,
      event_type:     'status_changed',
      previous_status: existing.status,
      new_status:      d.status,
      metadata:        {},
    });
  }

  const { data: updated, error: updateErr } = await supabase
    .from('fix_requests')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(update as any)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, status, severity, updated_at')
    .single();

  if (updateErr || !updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing, error: fetchErr } = await getAuthorizedRequest(supabase, user.id, params.id);
  if (fetchErr || !existing) return NextResponse.json({ error: 'Fix request not found' }, { status: 404 });

  // Only allow delete of draft or cancelled requests
  if (!['draft', 'cancelled'].includes(existing.status)) {
    return NextResponse.json({ error: `Cannot delete a fix request in status '${existing.status}'. Archive it instead.` }, { status: 409 });
  }

  const { error: deleteErr } = await supabase
    .from('fix_requests')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (deleteErr) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
