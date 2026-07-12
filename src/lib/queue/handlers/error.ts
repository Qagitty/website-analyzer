/**
 * Handler: error_event.process
 *
 * Calculates fingerprint for a staged error event, upserts the issue,
 * links the event to the issue, and logs regressions.
 */

import type { QueueJobHandler, QueueJobResult } from '../types';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateFingerprint, normalizeStackTitle } from '@/lib/error-projects/fingerprint';
import { createLogger } from '@/lib/logger';

const log = createLogger({ category: 'queue:error' });

export interface ErrorEventProcessPayload {
  eventDbId:    string;
  projectId:    string;
  userId:       string;
  fingerprint?: string[];
  message:      string;
  exceptionType?: string;
  level:        string;
  isTest:       boolean;
}

export const errorEventProcessHandler: QueueJobHandler<ErrorEventProcessPayload> = async (
  _ctx,
  payload,
) => {
  const supabase = createServiceRoleClient();

  // Load staged event
  const { data: event } = await supabase
    .from('error_events')
    .select('*')
    .eq('id', payload.eventDbId)
    .single();

  if (!event) {
    log.warn('event_not_found', { eventDbId: payload.eventDbId });
    return { status: 'completed' } satisfies QueueJobResult;
  }

  if ((event as Record<string, unknown>)['processed_at']) {
    log.info('already_processed', { eventDbId: payload.eventDbId });
    return { status: 'completed' } satisfies QueueJobResult;
  }

  // Calculate fingerprint
  const stackFrames = ((event as Record<string, unknown>)['stack_frames'] as Array<Record<string, unknown>>) ?? [];
  const topFrame    = stackFrames.find(
    (f) => typeof f['filename'] === 'string' && !f['filename'].includes('webscore-errors'),
  );

  const fp = calculateFingerprint({
    projectId:        payload.projectId,
    exceptionType:    payload.exceptionType,
    message:          payload.message,
    topFrame:         topFrame
      ? { filename: topFrame['filename'] as string | undefined, function: topFrame['function'] as string | undefined }
      : undefined,
    customFingerprint: payload.fingerprint,
  });

  const title = normalizeStackTitle(payload.exceptionType, payload.message);

  // Upsert issue
  const { data: result } = await supabase
    .rpc('upsert_error_issue', {
      p_project_id:     payload.projectId,
      p_user_id:        payload.userId,
      p_fingerprint:    fp,
      p_title:          title,
      p_exception_type: payload.exceptionType ?? null,
      p_level:          payload.level,
      p_event_id:       payload.eventDbId,
    })
    .single();

  if (!result) {
    log.error('upsert_failed', { eventDbId: payload.eventDbId });
    return {
      status:      'retry',
      errorCode:   'UPSERT_FAILED',
      failureType: 'transient',
    } satisfies QueueJobResult;
  }

  const issueResult = result as { issue_id: string; is_regression: boolean };

  // Update event with fingerprint and issue_id
  await supabase
    .from('error_events')
    .update({
      fingerprint:  fp,
      issue_id:     issueResult.issue_id,
      processed_at: new Date().toISOString(),
    })
    .eq('id', payload.eventDbId);

  // Log regression activity
  if (issueResult.is_regression) {
    await supabase.from('error_issue_activities').insert({
      error_issue_id: issueResult.issue_id,
      event_type:     'regressed',
      previous_value: 'resolved',
      new_value:      'unresolved',
    });
    log.info('issue_regressed', {
      projectId: payload.projectId,
      issueId:   issueResult.issue_id,
    });
  }

  log.info('event_processed', {
    projectId:   payload.projectId,
    issueId:     issueResult.issue_id,
    fingerprint: fp.slice(0, 12),
  });

  return { status: 'completed' } satisfies QueueJobResult;
};
