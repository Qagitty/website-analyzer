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
  telemetryRetentionDays?: number;
  fixRequestActivityRetentionDays?: number;
}

export const retentionCleanupHandler: QueueJobHandler<RetentionCleanupPayload> = async (ctx, payload) => {
  const supabase = createServiceRoleClient();

  const analysisDays       = payload.analysisRetentionDays          ?? 90;
  const monitorRunDays     = payload.monitorRunRetentionDays        ?? 30;
  const telemetryDays      = payload.telemetryRetentionDays         ?? 30;
  const fixActivityDays    = payload.fixRequestActivityRetentionDays ?? 90;

  const analysisThreshold    = new Date(Date.now() - analysisDays    * 86_400_000).toISOString();
  const monitorRunThreshold  = new Date(Date.now() - monitorRunDays  * 86_400_000).toISOString();
  const telemetryThreshold   = new Date(Date.now() - telemetryDays   * 86_400_000).toISOString();
  const fixActivityThreshold = new Date(Date.now() - fixActivityDays * 86_400_000).toISOString();

  const results: Record<string, number> = {};

  // Delete old failed analyses (keeps completed ones for reports)
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

  // Prune site telemetry events — they grow unbounded without retention
  const { count: deletedTelemetry } = await supabase
    .from('site_telemetry_events')
    .delete({ count: 'exact' })
    .lt('created_at', telemetryThreshold);

  results.deletedTelemetryEvents = deletedTelemetry ?? 0;

  // Expire stale site verification challenges that were never consumed
  const { count: expiredChallenges } = await supabase
    .from('site_verification_challenges')
    .delete({ count: 'exact' })
    .is('consumed_at', null)
    .lt('expires_at', new Date().toISOString());

  results.expiredVerificationChallenges = expiredChallenges ?? 0;

  // Prune old fix request activity log entries (keeps recent audit trail)
  const { count: deletedFixActivities } = await supabase
    .from('fix_request_activities')
    .delete({ count: 'exact' })
    .lt('created_at', fixActivityThreshold);

  results.deletedFixRequestActivities = deletedFixActivities ?? 0;

  return {
    status: 'completed',
    metadata: results,
  } satisfies QueueJobResult;
};
