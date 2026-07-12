/**
 * POST /api/error-monitoring/projects/[id]/test-event
 * Creates a synthetic test event directly, bypassing the ingestion endpoint.
 * Used from the Installation tab to verify SDK connectivity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateFingerprint, normalizeStackTitle } from '@/lib/error-projects/fingerprint';
import { randomUUID } from 'crypto';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, props: Params) {
  void req;
  const { id } = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: project } = await supabase
    .from('error_projects')
    .select('id,user_id,event_quota_monthly,max_breadcrumbs')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const serviceSupabase = createServiceRoleClient();
  const eventId = randomUUID();
  const message = 'WebScore SDK test event — installation verified';
  const exceptionType = 'TestError';

  const { data: staged, error: stageErr } = await serviceSupabase
    .from('error_events')
    .insert({
      event_id:         eventId,
      error_project_id: id,
      user_id:          user.id,
      source:           'synthetic_analysis',
      event_type:       'exception',
      level:            'info',
      message,
      exception_type:   exceptionType,
      stack_frames:     [],
      breadcrumbs:      [],
      context:          { source: 'test-event-button' },
      environment:      'test',
      is_test_event:    true,
      occurred_at:      new Date().toISOString(),
    })
    .select('id')
    .single();

  if (stageErr) {
    return NextResponse.json({ error: 'Failed to create test event' }, { status: 500 });
  }

  // Inline grouping (no queue needed for test events)
  const fp = calculateFingerprint({
    projectId:     id,
    exceptionType,
    message,
    topFrame:      undefined,
  });
  const title = normalizeStackTitle(exceptionType, message);

  const { data: result } = await serviceSupabase
    .rpc('upsert_error_issue', {
      p_project_id:     id,
      p_user_id:        user.id,
      p_fingerprint:    fp,
      p_title:          title,
      p_exception_type: exceptionType,
      p_level:          'info',
      p_event_id:       (staged as { id: string }).id,
    })
    .single();

  if (result) {
    const issueResult = result as { issue_id: string };
    await serviceSupabase
      .from('error_events')
      .update({
        fingerprint:  fp,
        issue_id:     issueResult.issue_id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', (staged as { id: string }).id);

    return NextResponse.json({
      eventId: (staged as { id: string }).id,
      issueId: issueResult.issue_id,
    });
  }

  return NextResponse.json({ eventId: (staged as { id: string }).id });
}
