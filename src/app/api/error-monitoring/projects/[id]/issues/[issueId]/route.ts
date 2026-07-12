/**
 * GET   /api/error-monitoring/projects/[id]/issues/[issueId] — get issue detail
 * PATCH /api/error-monitoring/projects/[id]/issues/[issueId] — update issue status/assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { ErrorIssueUpdate } from '@/types/database';
import { z } from 'zod';

type Params = { params: Promise<{ id: string; issueId: string }> };

const patchSchema = z.object({
  status:     z.enum(['unresolved', 'investigating', 'resolved', 'ignored', 'archived']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest, props: Params) {
  void req;
  const { id, issueId } = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership check via project
  const { data: project } = await supabase
    .from('error_projects')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: issue, error } = await supabase
    .from('error_issues')
    .select('*')
    .eq('id', issueId)
    .eq('error_project_id', id)
    .single();

  if (error || !issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

  // Fetch recent events for the issue
  const { data: events } = await supabase
    .from('error_events')
    .select('id,event_type,level,message,stack_frames,breadcrumbs,page_url_sanitized,browser,device_category,environment,received_at,is_test_event')
    .eq('issue_id', issueId)
    .order('received_at', { ascending: false })
    .limit(10);

  // Fetch activity log
  const { data: activities } = await supabase
    .from('error_issue_activities')
    .select('*')
    .eq('error_issue_id', issueId)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ data: issue, recentEvents: events ?? [], activities: activities ?? [] });
}

export async function PATCH(req: NextRequest, props: Params) {
  const { id, issueId } = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership check via project
  const { data: project } = await supabase
    .from('error_projects')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body   = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Fetch current issue for activity logging
  const { data: current } = await supabase
    .from('error_issues')
    .select('status,assigned_to')
    .eq('id', issueId)
    .eq('error_project_id', id)
    .single();
  if (!current) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

  const update: ErrorIssueUpdate = {};
  if (parsed.data.status !== undefined) {
    update.status = parsed.data.status;
    if (parsed.data.status === 'resolved') update.resolved_at = new Date().toISOString();
    else update.resolved_at = null;
  }
  if ('assignedTo' in parsed.data) update.assigned_to = parsed.data.assignedTo;

  const { data, error } = await supabase
    .from('error_issues')
    .update(update)
    .eq('id', issueId)
    .eq('error_project_id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 });

  // Log activity
  const activityInserts: Array<{
    error_issue_id: string;
    actor_user_id:  string;
    event_type:     string;
    previous_value?: string;
    new_value?:      string;
  }> = [];

  if (parsed.data.status && parsed.data.status !== (current as { status: string }).status) {
    activityInserts.push({
      error_issue_id: issueId,
      actor_user_id:  user.id,
      event_type:     'status_changed',
      previous_value: (current as { status: string }).status,
      new_value:      parsed.data.status,
    });
  }
  if ('assignedTo' in parsed.data && parsed.data.assignedTo !== (current as { assigned_to: string | null }).assigned_to) {
    activityInserts.push({
      error_issue_id: issueId,
      actor_user_id:  user.id,
      event_type:     'assigned',
      previous_value: (current as { assigned_to: string | null }).assigned_to ?? undefined,
      new_value:      parsed.data.assignedTo ?? undefined,
    });
  }

  if (activityInserts.length > 0) {
    await supabase.from('error_issue_activities').insert(activityInserts);
  }

  return NextResponse.json({ data });
}
