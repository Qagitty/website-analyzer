/**
 * Alert evaluation pipeline (Sprint 12).
 *
 * Orchestrates the full alert lifecycle for a completed monitor analysis:
 *  1. Idempotency gate — one evaluation per (monitor_id, analysis_id)
 *  2. Load the monitor's alert policy (DB or default)
 *  3. Build MonitorScoreChange[] from baseline vs current scores
 *  4. Load active incident fingerprints for cooldown / dedup
 *  5. Call evaluateAlerts()
 *  6. Persist incidents (upsert) for all triggered + suppressed alerts
 *  7. Send email notifications for triggered alerts only
 *  8. Update the evaluation record with final counts
 *
 * Security:
 *  - User email is resolved from auth.admin here, never from the Worker payload.
 *  - Runs as service role (Supabase client passed in from the callback route).
 *  - Infrastructure errors (e.g. email send failure) are logged but never
 *    re-raised — the analysis record is already complete at this point.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { evaluateAlerts, defaultAlertPolicy } from './alert-evaluation';
import type { MonitorScoreChange, MonitorAlertPolicy, AlertFingerprint } from './types';
import { sendScoreDropAlert, sendMonitorSummary } from '@/lib/email/resend';

export interface AlertPipelineInput {
  supabase: SupabaseClient;
  monitorId: string;
  analysisId: string;
  monitorRunId: string | undefined;
  monitorUserId: string;
  /** Baseline scores from the previous successful run. Null on first run. */
  monitorLastScores: Record<string, number | null> | null | undefined;
  /** Current scores from the just-completed analysis. */
  newScores: Record<string, number | null | undefined>;
  /** Canonical URL for display in notification emails. */
  url: string;
}

export async function runAlertPipeline(input: AlertPipelineInput): Promise<void> {
  // ── 1. Idempotency gate ──────────────────────────────────────────────────────
  // INSERT the evaluation record. A unique constraint on (monitor_id, analysis_id)
  // means a second call for the same pair returns a 23505 conflict — we abort early.
  const { error: evalInsertError } = await input.supabase
    .from('monitor_alert_evaluations')
    .insert({
      monitor_id:  input.monitorId,
      analysis_id: input.analysisId,
      run_id:      input.monitorRunId ?? null,
    });

  if (evalInsertError) {
    if (evalInsertError.code === '23505') {
      console.info(
        `[alert-pipeline] Already evaluated — monitor=${input.monitorId} analysis=${input.analysisId}`,
      );
      return;
    }
    // Unexpected error — log and continue; the evaluation is best-effort.
    console.error('[alert-pipeline] Evaluation record insert failed:', evalInsertError.message);
  }

  // ── 2. Load alert policy ─────────────────────────────────────────────────────
  const { data: monitorRow } = await input.supabase
    .from('monitors')
    .select('alert_policy')
    .eq('id', input.monitorId)
    .single();

  const policy: MonitorAlertPolicy =
    (monitorRow?.alert_policy as MonitorAlertPolicy | null) ?? defaultAlertPolicy();

  // ── 3. Build score changes ────────────────────────────────────────────────────
  const scoreChanges = buildScoreChanges(input.monitorLastScores, input.newScores);

  // ── 4. Load active incident fingerprints ──────────────────────────────────────
  const { data: incidents } = await input.supabase
    .from('monitor_incidents')
    .select('fingerprint, created_at, last_detected_at, occurrence_count')
    .eq('monitor_id', input.monitorId)
    .in('status', ['open', 'acknowledged', 'muted', 'reopened']);

  const activeFingerprints = new Map<string, AlertFingerprint>();
  for (const inc of incidents ?? []) {
    activeFingerprints.set(inc.fingerprint, {
      fingerprint:      inc.fingerprint,
      firstDetectedAt:  inc.created_at,
      lastDetectedAt:   inc.last_detected_at,
      occurrenceCount:  inc.occurrence_count,
    });
  }

  // ── 5. Evaluate ───────────────────────────────────────────────────────────────
  const now = new Date();
  const evalResult = evaluateAlerts({
    monitorId:          input.monitorId,
    runId:              input.monitorRunId ?? input.analysisId,
    policy,
    scoreChanges,
    findingChanges:     [],
    metricRegressions:  [],
    coverageChanges:    [],
    now,
    activeFingerprints,
  });

  // ── 6. Persist incidents ──────────────────────────────────────────────────────
  // Upsert for both triggered and suppressed alerts so in-app incident history
  // is always accurate even when external notification is muted (§35 rule).
  const allAlerts = [...evalResult.alertsTriggered, ...evalResult.alertsSuppressed];
  for (const alert of allAlerts) {
    try {
      await input.supabase.rpc('upsert_monitor_incident', {
        p_monitor_id:     input.monitorId,
        p_fingerprint:    alert.fingerprint,
        p_title:          alert.title,
        p_severity:       alert.severity,
        p_run_id:         input.monitorRunId ?? null,
        p_affected_pages: alert.affectedPages,
        p_event_entry: {
          eventId:    crypto.randomUUID(),
          runId:      input.monitorRunId ?? input.analysisId,
          eventType:  alert.eventType,
          severity:   alert.severity,
          detectedAt: now.toISOString(),
          summary:    alert.summary,
        },
      });
    } catch (e) {
      console.error('[alert-pipeline] Failed to upsert incident for fingerprint', alert.fingerprint, e);
    }
  }

  // ── 7. Notifications ──────────────────────────────────────────────────────────
  // Only send email for *triggered* alerts (not suppressed).
  if (evalResult.alertsTriggered.length > 0 || evalResult.alertsSuppressed.length === 0) {
    // Resolve email from auth.admin — not from Worker payload (PII policy).
    let userEmail: string | undefined;
    try {
      const { data: userData } = await input.supabase.auth.admin.getUserById(input.monitorUserId);
      userEmail = userData?.user?.email;
    } catch (e) {
      console.error('[alert-pipeline] Failed to resolve user email:', e);
    }

    if (userEmail) {
      if (evalResult.alertsTriggered.length > 0) {
        // Build the drops list that the score-drop email template expects.
        const drops = evalResult.alertsTriggered
          .filter((a) => a.eventType.startsWith('score-drop:'))
          .map((a) => ({
            metric:   (a.evidence.previousScore !== undefined)
                        ? a.stableKey.replace('score:', '')
                        : a.stableKey,
            previous: (a.evidence.previousScore as number) ?? 0,
            current:  (a.evidence.currentScore as number) ?? 0,
            delta:    ((a.evidence.previousScore as number) ?? 0) -
                      ((a.evidence.currentScore as number) ?? 0),
          }));

        if (drops.length > 0) {
          sendScoreDropAlert({
            to:         userEmail,
            url:        input.url,
            analysisId: input.analysisId,
            drops,
          }).catch((e) => console.error('[alert-pipeline] score drop email failed:', e));
        }
      } else {
        // No alerts of any kind — send the regular monitor summary.
        const scores: Record<string, number> = {};
        for (const [k, v] of Object.entries(input.newScores)) {
          if (v !== null && v !== undefined) scores[k] = v as number;
        }
        sendMonitorSummary({
          to:         userEmail,
          url:        input.url,
          analysisId: input.analysisId,
          scores,
        }).catch((e) => console.error('[alert-pipeline] summary email failed:', e));
      }
    }
  }

  // ── 8. Update evaluation record with final counts ─────────────────────────────
  await input.supabase
    .from('monitor_alert_evaluations')
    .update({
      alerts_triggered:  evalResult.alertsTriggered.length,
      alerts_suppressed: evalResult.alertsSuppressed.length,
      result:            evalResult as unknown as Record<string, unknown>,
    })
    .eq('monitor_id', input.monitorId)
    .eq('analysis_id', input.analysisId);
}

// ─── Score change builder ─────────────────────────────────────────────────────

const SCORE_CATEGORIES = ['performance', 'accessibility', 'seo', 'bestPractices'] as const;

function buildScoreChanges(
  baseline: Record<string, number | null> | null | undefined,
  current:  Record<string, number | null | undefined>,
): MonitorScoreChange[] {
  return SCORE_CATEGORIES.map((category) => {
    const prev = (baseline?.[category] ?? null) as number | null;
    const curr = (current[category] ?? null) as number | null;
    const comparable = prev !== null && curr !== null;
    const delta = comparable ? curr - prev : null;

    return {
      category,
      previousScore: prev,
      currentScore:  curr,
      delta,
      comparable,
      causes: [],
    } satisfies MonitorScoreChange;
  });
}
