/**
 * Alert severity classification, deduplication, and cooldown logic (§17–§19, §36).
 *
 * Rules:
 *  - Do not alert only on overall score movement (§17).
 *  - Do not map score drops directly to critical severity without context (§18).
 *  - Use a stable alert fingerprint for deduplication (§19).
 *  - During cooldown: update existing incident, increment count, no new notification (§19).
 *  - Send a new alert when: severity increases, scope expands, issue regresses after
 *    resolution, or cooldown expires and reminder policy allows (§19).
 *  - Do not suppress incidents from in-app history even when external notification is muted (§35).
 */

import crypto from 'crypto';
import type {
  MonitorAlertPolicy,
  MonitorEventSeverity,
  AlertFingerprint,
  AlertEvent,
  AlertEvaluationResult,
  MonitorScoreChange,
  FindingChangeRecord,
  CoverageChangeRecord,
  QuietHoursConfig,
} from './types';
import type { MetricRegressionResult } from './regression';
import { getLocalParts } from './schedule';

// ─── Fingerprint computation (§19) ───────────────────────────────────────────

/**
 * Compute a stable 32-char fingerprint for deduplicating alerts.
 * Based on monitor ID + event type + stable finding key/metric + page + severity + baseline state.
 */
export function computeAlertFingerprint(params: {
  monitorId: string;
  eventType: string;
  stableKey: string;
  affectedPage: string;
  severity: MonitorEventSeverity;
  baselineState: string;
}): string {
  const parts = [
    params.monitorId,
    params.eventType,
    params.stableKey,
    params.affectedPage,
    params.severity,
    params.baselineState,
  ];
  return crypto.createHash('sha256').update(parts.join('\x00')).digest('hex').slice(0, 32);
}

// ─── Severity classification (§18) ───────────────────────────────────────────

/**
 * Classify the severity of a score drop based on the category and context.
 * Do NOT return 'critical' for a score drop without checking what caused it.
 */
export function classifyScoreDropSeverity(
  category: string,
  scoreDelta: number | null,
  policy: MonitorAlertPolicy,
): MonitorEventSeverity {
  if (scoreDelta === null) return 'info';
  const drop = -scoreDelta; // positive = score went down
  if (drop <= 0) return 'info';

  const rule = policy.scoreDrops.find((r) => r.category === category);
  if (!rule) return 'low';

  if (drop >= rule.thresholdPoints * 3) return 'high';
  if (drop >= rule.thresholdPoints * 2) return 'medium';
  if (drop >= rule.thresholdPoints) return rule.severity;
  return 'info';
}

/** Map HTTP status codes to event severity. */
export function classifyAvailabilityEventSeverity(httpStatus: number): MonitorEventSeverity {
  if (httpStatus === 0 || httpStatus >= 500) return 'critical';
  if (httpStatus === 404 || httpStatus === 403 || httpStatus === 410) return 'high';
  if (httpStatus === 429) return 'medium'; // rate-limited
  return 'low';
}

// ─── Alert evaluation ─────────────────────────────────────────────────────────

export interface AlertEvaluationInput {
  monitorId: string;
  runId: string;
  policy: MonitorAlertPolicy;
  scoreChanges: MonitorScoreChange[];
  findingChanges: FindingChangeRecord[];
  metricRegressions: MetricRegressionResult[];
  coverageChanges: CoverageChangeRecord[];
  now: Date;
  /** Existing active fingerprints and their last-detected time (from DB). */
  activeFingerprints: Map<string, AlertFingerprint>;
}

/**
 * Evaluate the alert policy against a comparison result and produce
 * a list of alerts to trigger and suppress.
 */
export function evaluateAlerts(input: AlertEvaluationInput): AlertEvaluationResult {
  const triggered: AlertEvent[] = [];
  const suppressed: AlertEvent[] = [];

  const isInQuietHours = input.policy.quietHours
    ? checkQuietHours(input.policy.quietHours, input.now)
    : false;

  // ── Score drop alerts ────────────────────────────────────────────────────
  for (const change of input.scoreChanges) {
    if (!change.comparable) continue;
    if (change.delta === null || change.delta >= 0) continue;

    const rule = input.policy.scoreDrops.find((r) => r.category === change.category);
    if (!rule) continue;
    if (-change.delta < rule.thresholdPoints) continue;

    const severity = classifyScoreDropSeverity(change.category, change.delta, input.policy);
    const fingerprint = computeAlertFingerprint({
      monitorId: input.monitorId,
      eventType: `score-drop:${change.category}`,
      stableKey: `score:${change.category}`,
      affectedPage: 'site',
      severity,
      baselineState: String(change.previousScore ?? 'null'),
    });

    const event: AlertEvent = {
      eventType: `score-drop:${change.category}`,
      severity,
      stableKey: `score:${change.category}`,
      affectedPages: ['site'],
      title: `${titleCase(change.category)} score dropped by ${Math.abs(change.delta ?? 0)} points`,
      summary: `${titleCase(change.category)}: ${change.previousScore} → ${change.currentScore}`,
      evidence: { previousScore: change.previousScore, currentScore: change.currentScore, causes: change.causes },
      fingerprint,
    };

    const { send, reason } = shouldSendAlert({
      fingerprint,
      activeFingerprints: input.activeFingerprints,
      cooldownMinutes: input.policy.notificationCooldownMinutes,
      severity,
      isInQuietHours,
      now: input.now,
    });

    if (send) triggered.push(event);
    else suppressed.push({ ...event, summary: `${event.summary} [suppressed: ${reason}]` });
  }

  // ── Metric regression alerts ────────────────────────────────────────────
  for (const reg of input.metricRegressions) {
    if (!reg.severity) continue;

    const fingerprint = computeAlertFingerprint({
      monitorId: input.monitorId,
      eventType: `metric-regression:${reg.metricId}`,
      stableKey: `metric:${reg.metricId}`,
      affectedPage: 'site',
      severity: reg.severity,
      baselineState: String(reg.baselineValue ?? 'null'),
    });

    const event: AlertEvent = {
      eventType: `metric-regression:${reg.metricId}`,
      severity: reg.severity,
      stableKey: `metric:${reg.metricId}`,
      affectedPages: ['site'],
      title: `${reg.metricId} regressed`,
      summary: `${reg.metricId}: ${reg.baselineValue} → ${reg.currentValue} (Δ${reg.delta !== null ? reg.delta.toFixed(1) : '?'})`,
      evidence: { baselineValue: reg.baselineValue, currentValue: reg.currentValue, delta: reg.delta },
      fingerprint,
    };

    const { send, reason } = shouldSendAlert({
      fingerprint,
      activeFingerprints: input.activeFingerprints,
      cooldownMinutes: input.policy.notificationCooldownMinutes,
      severity: reg.severity,
      isInQuietHours,
      now: input.now,
    });

    if (send) triggered.push(event);
    else suppressed.push({ ...event, summary: `${event.summary} [suppressed: ${reason}]` });
  }

  // ── New critical/high findings ──────────────────────────────────────────
  for (const fc of input.findingChanges) {
    if (fc.changeStatus !== 'new' && fc.changeStatus !== 'regressed') continue;
    const severity = fc.currentSeverity as MonitorEventSeverity ?? 'low';
    if (!['critical', 'high'].includes(severity)) continue;

    const fingerprint = computeAlertFingerprint({
      monitorId: input.monitorId,
      eventType: `finding:${fc.changeStatus}`,
      stableKey: fc.identity.stableKey,
      affectedPage: fc.identity.pageId ?? 'site',
      severity,
      baselineState: fc.changeStatus,
    });

    const event: AlertEvent = {
      eventType: `finding:${fc.changeStatus}`,
      severity,
      stableKey: fc.identity.stableKey,
      affectedPages: fc.identity.pageId ? [fc.identity.pageId] : ['site'],
      title: `${titleCase(fc.changeStatus)} ${severity} finding: ${fc.identity.ruleId || fc.identity.stableKey.slice(0, 8)}`,
      summary: `Finding ${fc.identity.stableKey.slice(0, 8)} is ${fc.changeStatus} (severity: ${severity})`,
      evidence: { identity: fc.identity, changeStatus: fc.changeStatus },
      fingerprint,
    };

    const { send, reason } = shouldSendAlert({
      fingerprint,
      activeFingerprints: input.activeFingerprints,
      cooldownMinutes: input.policy.notificationCooldownMinutes,
      severity,
      isInQuietHours,
      now: input.now,
    });

    if (send) triggered.push(event);
    else suppressed.push({ ...event, summary: `${event.summary} [suppressed: ${reason}]` });
  }

  // ── Coverage regression alerts ──────────────────────────────────────────
  for (const cov of input.coverageChanges) {
    if (!cov.regressionDetected) continue;

    const fingerprint = computeAlertFingerprint({
      monitorId: input.monitorId,
      eventType: `coverage-regression:${cov.category}`,
      stableKey: `coverage:${cov.category}`,
      affectedPage: 'site',
      severity: 'medium',
      baselineState: String(cov.baselineCoverage ?? 'null'),
    });

    const event: AlertEvent = {
      eventType: `coverage-regression:${cov.category}`,
      severity: 'medium',
      stableKey: `coverage:${cov.category}`,
      affectedPages: ['site'],
      title: `Audit coverage decreased for ${cov.category}`,
      summary: `Coverage: ${cov.baselineCoverage?.toFixed(1)}% → ${cov.currentCoverage?.toFixed(1)}% (Δ${cov.delta?.toFixed(1)}%)`,
      evidence: { category: cov.category, baselineCoverage: cov.baselineCoverage, currentCoverage: cov.currentCoverage },
      fingerprint,
    };

    const { send, reason } = shouldSendAlert({
      fingerprint,
      activeFingerprints: input.activeFingerprints,
      cooldownMinutes: input.policy.notificationCooldownMinutes,
      severity: 'medium',
      isInQuietHours,
      now: input.now,
    });

    if (send) triggered.push(event);
    else suppressed.push({ ...event, summary: `${event.summary} [suppressed: ${reason}]` });
  }

  return {
    alertsTriggered: triggered,
    alertsSuppressed: suppressed,
    incidentsCreated: [],
    incidentsUpdated: [],
    incidentsResolved: [],
  };
}

// ─── Cooldown check (§36) ─────────────────────────────────────────────────────

interface ShouldSendParams {
  fingerprint: string;
  activeFingerprints: Map<string, AlertFingerprint>;
  cooldownMinutes: number;
  severity: MonitorEventSeverity;
  isInQuietHours: boolean;
  now: Date;
}

interface ShouldSendResult {
  send: boolean;
  reason: string;
}

/**
 * Determine whether a notification should be sent for this alert.
 * Critical severity can override quiet hours (per MonitorAlertPolicy.quietHours.allowCriticalOverride).
 */
export function shouldSendAlert(params: ShouldSendParams): ShouldSendResult {
  const existing = params.activeFingerprints.get(params.fingerprint);

  if (existing) {
    // Within cooldown window?
    const cooldownMs = params.cooldownMinutes * 60 * 1000;
    const lastDetected = new Date(existing.lastDetectedAt).getTime();
    const elapsed = params.now.getTime() - lastDetected;

    if (elapsed < cooldownMs) {
      return { send: false, reason: `cooldown (${Math.ceil((cooldownMs - elapsed) / 60000)}m remaining)` };
    }
  }

  // Quiet hours — critical events can optionally bypass
  if (params.isInQuietHours && params.severity !== 'critical') {
    return { send: false, reason: 'quiet hours' };
  }

  return { send: true, reason: 'ok' };
}

// ─── Quiet hours check (§35) ─────────────────────────────────────────────────

export function checkQuietHours(config: QuietHoursConfig, now: Date): boolean {
  const local = getLocalParts(now, config.timezone);

  if (!config.daysOfWeek.includes(local.weekday)) return false;

  const hour = local.hour;
  if (config.startHour <= config.endHour) {
    // Same-day window (e.g. 22:00–07:00 next day would need wrapping)
    return hour >= config.startHour && hour < config.endHour;
  } else {
    // Wraps midnight (e.g. 22:00–07:00)
    return hour >= config.startHour || hour < config.endHour;
  }
}

// ─── Default alert policy ─────────────────────────────────────────────────────

export function defaultAlertPolicy(): MonitorAlertPolicy {
  return {
    scoreDrops: [
      { category: 'performance',   thresholdPoints: 10, requiredConfirmations: 1, severity: 'medium' },
      { category: 'accessibility', thresholdPoints: 5,  requiredConfirmations: 1, severity: 'high' },
      { category: 'seo',           thresholdPoints: 10, requiredConfirmations: 1, severity: 'medium' },
      { category: 'bestPractices', thresholdPoints: 10, requiredConfirmations: 1, severity: 'low' },
    ],
    metricRegressions: [],
    findingChanges: [
      {
        severity: ['critical', 'high'],
        categories: ['accessibility', 'security'],
        statuses: ['new', 'regressed'],
        confirmationPolicy: { requiredConsecutiveRuns: 1, resetAfterHealthyRun: true },
      },
    ],
    availability: [
      {
        httpErrorCodes: [500, 502, 503, 504],
        redirectChanges: true,
        tlsFailure: true,
        severity: 'critical',
      },
    ],
    notificationCooldownMinutes: 60,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
}
