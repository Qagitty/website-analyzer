/**
 * Handler: retention.cleanup
 *
 * Prunes old analyses, expired monitor runs, and stale queue entries.
 * Runs at MAINTENANCE priority — runs daily.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { QueueJobHandler, QueueJobResult } from '../types';

export interface RetentionCleanupPayload {
  // All fields optional — handler uses server-side defaults
  analysisRetentionDays?: number;
  monitorRunRetentionDays?: number;
}

export const retentionCleanupHandler: QueueJobHandler<RetentionCleanupPayload> = async (ctx, payload) => {
  const supabase = createServiceRoleClient();

  const analysisDays    = payload.analysisRetentionDays    ?? 90;
  const monitorRunDays  = payload.monitorRunRetentionDays  ?? 30;

  const analysisThreshold   = new Date(Date.now() - analysisDays   * 86_400_000).toISOString();
  const monitorRunThreshold = new Date(Date.now() - monitorRunDays * 86_400_000).toISOString();

  const results: Record<string, number> = {};

  // Delete old failed/completed analyses (keeps recent ones for reports)
  const { count: deletedAnalyses } = await supabase
    .from('analyses')
    .delete({ count: 'exact' })
    .in('status', ['failed'])
    .lt('created_at', analysisThreshold);

  results.deletedFailedAnalyses = deletedAnalyses ?? 0;

  // Delete old monitor runs
  const { count: deletedRuns } = await supabase
    .from('monitor_runs')
    .delete({ count: 'exact' })
    .lt('created_at', monitorRunThreshold);

  results.deletedMonitorRuns = deletedRuns ?? 0;

  return {
    status: 'completed',
    metadata: results,
  } satisfies QueueJobResult;
};
