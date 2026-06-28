/**
 * Monitoring domain model (§2–§22, §31, §47–§49).
 *
 * All types are plain TypeScript interfaces — no Zod here.
 * Zod schemas live in contracts/schemas.ts; these are the domain layer.
 *
 * Rules:
 *  - MonitorStatus is not reused for AnalysisStatus (separate lifecycles, §2)
 *  - MonitorSchedule always carries an IANA timezone (§3)
 *  - MonitorRun stores a complete configuration snapshot (§6)
 *  - FindingChangeStatus distinguishes not-evaluated from resolved (§13)
 *  - MonitorFailureOrigin distinguishes site failure from analyzer failure (§47)
 */

// ─── Monitor lifecycle (§2) ───────────────────────────────────────────────────

export type MonitorStatus =
  | 'active'
  | 'paused'
  | 'disabled'
  | 'error'
  | 'deleted';

export interface WebsiteMonitor {
  monitorId: string;
  schemaVersion: string;
  ownerId: string;
  organizationId?: string;
  name: string;
  rootUrl: string;
  normalizedRootUrl: string;
  status: MonitorStatus;
  schedule: MonitorSchedule;
  scope: MonitorScope;
  comparisonPolicy: MonitorComparisonPolicy;
  alertPolicy: MonitorAlertPolicy;
  notificationChannels: NotificationChannelConfig[];
  baselinePolicy: MonitorBaselinePolicy;
  retentionPolicy: MonitorRetentionPolicy;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastRunId?: string;
}

// ─── Schedule model (§3) ──────────────────────────────────────────────────────

export interface MonitorSchedule {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  /** IANA timezone string, e.g. "America/New_York". Required — never omit. */
  timezone: string;
  /** 0–23 hour in the target timezone. */
  hour?: number;
  /** 0–59 minute. */
  minute?: number;
  /** 0 = Sunday … 6 = Saturday. Only for weekly. */
  dayOfWeek?: number[];
  /** 1–28 (capped to avoid month-length issues). Only for monthly. */
  dayOfMonth?: number;
  /** cron expression — only for custom type. Validated on creation. */
  cronExpression?: string;
  /** Random jitter applied to avoid thundering-herd. Max 30 min. */
  jitterWindowMinutes?: number;
}

// ─── Scope model (§7–§8) ──────────────────────────────────────────────────────

/**
 * What pages to analyze per run.
 * Separates the comparison page set from newly discovered pages (§8).
 */
export interface MonitorScope {
  mode:
    | 'root-only'
    | 'pinned-pages'
    | 'representative-pages'
    | 'sitemap-sample'
    | 'dynamic-site-sample';
  /** Explicit URLs pinned for comparison. Never silently replaced. */
  pinnedUrls: string[];
  maxPages: number;
  maxDepth: number;
  includePatterns: string[];
  excludePatterns: string[];
}

// ─── Execution lease (§4) ─────────────────────────────────────────────────────

/** Prevents duplicate execution across scheduler instances. */
export interface MonitorExecutionLease {
  monitorId: string;
  runId: string;
  claimedAt: string;
  expiresAt: string;
  claimedBy: string;
}

// ─── Run model (§5) ───────────────────────────────────────────────────────────

export type MonitorRunStatus =
  | 'scheduled'
  | 'claimed'
  | 'queued'
  | 'running'
  | 'partial'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'superseded';

export interface MonitorRun {
  runId: string;
  monitorId: string;
  analysisId?: string;
  scheduledFor: string;
  startedAt?: string;
  completedAt?: string;
  status: MonitorRunStatus;
  trigger: 'schedule' | 'manual' | 'deployment' | 'retry';
  attempt: number;
  configurationSnapshot: MonitorRunConfiguration;
  baselineRunId?: string;
  comparisonResult?: MonitorComparisonResult;
  alertEvaluation?: AlertEvaluationResult;
  failureOrigin?: MonitorFailureOrigin;
  errors: AnalysisRunError[];
  usage?: MonitorRunUsage;
}

// ─── Configuration snapshot (§6) ─────────────────────────────────────────────

/**
 * Frozen at dispatch time. Stored with every run so historical comparisons
 * remain explainable even after the monitor is reconfigured.
 */
export interface MonitorRunConfiguration {
  analyzerVersion: string;
  scoreVersions: Record<string, string>;
  ruleRegistryVersions: Record<string, string>;
  deviceProfile: string;
  auditModes: Record<string, string>;
  crawlStrategy: string;
  maxPages: number;
  locale?: string;
  browserVersion?: string;
  aiCrawlerConfigVersion?: string;
  featureFlags?: Record<string, boolean>;
  /** SHA-256 of the canonical JSON of the above fields. */
  configurationFingerprint: string;
}

// ─── Baseline policy (§9) ────────────────────────────────────────────────────

export type MonitorBaselinePolicy =
  | 'previous-comparable-run'
  | 'last-successful-run'
  | 'fixed-run'
  | 'rolling-median'
  | 'deployment-baseline';

// ─── Comparability validation (§10) ──────────────────────────────────────────

export type MonitorConfigurationDifferenceLevel = 'incompatible' | 'limited' | 'info';

export interface MonitorConfigurationDifference {
  field: string;
  baselineValue: unknown;
  currentValue: unknown;
  level: MonitorConfigurationDifferenceLevel;
  reason: string;
}

export interface MonitorComparabilityResult {
  comparable: boolean;
  level: 'full' | 'limited' | 'not-comparable';
  differences: MonitorConfigurationDifference[];
  comparableCategories: string[];
  excludedCategories: string[];
  warning?: string;
}

export interface MonitorComparisonPolicy {
  baselinePolicy: MonitorBaselinePolicy;
  fixedBaselineRunId?: string;
  rollingWindowRuns?: number;
  /** If false, score deltas are not shown when non-comparable. */
  allowLimitedComparison: boolean;
}

export interface MonitorComparisonResult {
  comparability: MonitorComparabilityResult;
  scoreChanges: MonitorScoreChange[];
  findingChanges: FindingChangeRecord[];
  metricChanges: MetricChangeRecord[];
  pageSampleChanged: boolean;
  newlyDiscoveredPages: string[];
  removedPages: string[];
  coverageChanges: CoverageChangeRecord[];
}

// ─── Score change attribution (§22) ──────────────────────────────────────────

export type ScoreChangeCause =
  | 'finding-introduced'
  | 'finding-resolved'
  | 'metric-improved'
  | 'metric-regressed'
  | 'page-sample-changed'
  | 'coverage-changed'
  | 'score-version-changed'
  | 'audit-mode-changed'
  | 'analyzer-behavior-changed';

export interface MonitorScoreChange {
  category: string;
  previousScore: number | null;
  currentScore: number | null;
  delta: number | null;
  comparable: boolean;
  causes: ScoreChangeCause[];
}

// ─── Finding identity (§12) ───────────────────────────────────────────────────

export interface FindingIdentity {
  stableKey: string;
  ruleId: string;
  scope: string;
  pageId?: string;
  normalizedTarget?: string;
}

// ─── Finding lifecycle states (§13) ──────────────────────────────────────────

/**
 * Status of a finding across two comparable runs.
 *
 * not-evaluated: the check did not execute this run — do NOT treat as resolved.
 * unknown: no baseline exists to compare against.
 */
export type FindingChangeStatus =
  | 'new'
  | 'persistent'
  | 'resolved'
  | 'regressed'
  | 'changed'
  | 'not-evaluated'
  | 'unknown';

export interface FindingChangeRecord {
  identity: FindingIdentity;
  changeStatus: FindingChangeStatus;
  baselineSeverity?: string;
  currentSeverity?: string;
}

// ─── Metric regression (§14) ──────────────────────────────────────────────────

export interface MetricSeverityThreshold {
  severity: MonitorEventSeverity;
  absoluteThreshold?: number;
  relativeThresholdPercent?: number;
}

export interface MetricRegressionRule {
  metricId: string;
  absoluteThreshold?: number;
  relativeThresholdPercent?: number;
  minimumBaselineValue?: number;
  direction: 'increase-is-bad' | 'decrease-is-bad';
  requiredConfirmations: number;
  severityMapping: MetricSeverityThreshold[];
}

export interface MetricChangeRecord {
  metricId: string;
  baselineValue: number | null;
  currentValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
  exceedsThreshold: boolean;
  rule?: MetricRegressionRule;
}

// ─── Coverage change (§23) ───────────────────────────────────────────────────

export interface CoverageChangeRecord {
  category: string;
  baselineCoverage: number | null;
  currentCoverage: number | null;
  delta: number | null;
  regressionDetected: boolean;
}

// ─── Persistence confirmation (§16) ──────────────────────────────────────────

export interface RegressionConfirmationPolicy {
  requiredConsecutiveRuns: number;
  confirmationWindowHours?: number;
  resetAfterHealthyRun: boolean;
}

// ─── Alert policy (§17) ──────────────────────────────────────────────────────

export interface ScoreDropAlertRule {
  category: string;
  thresholdPoints: number;
  requiredConfirmations: number;
  severity: MonitorEventSeverity;
}

export interface MetricAlertRule {
  metricId: string;
  rule: MetricRegressionRule;
  confirmationPolicy: RegressionConfirmationPolicy;
}

export interface FindingAlertRule {
  severity: string[];
  categories: string[];
  statuses: FindingChangeStatus[];
  confirmationPolicy: RegressionConfirmationPolicy;
}

export interface AvailabilityAlertRule {
  httpErrorCodes: number[];
  redirectChanges: boolean;
  tlsFailure: boolean;
  severity: MonitorEventSeverity;
}

export interface ContentChangeAlertRule {
  fields: string[];
  ignorePatterns: string[];
  severity: MonitorEventSeverity;
}

export interface QuietHoursConfig {
  timezone: string;
  startHour: number;
  endHour: number;
  daysOfWeek: number[];
  allowCriticalOverride: boolean;
}

export interface MonitorAlertPolicy {
  scoreDrops: ScoreDropAlertRule[];
  metricRegressions: MetricAlertRule[];
  findingChanges: FindingAlertRule[];
  availability: AvailabilityAlertRule[];
  contentChanges?: ContentChangeAlertRule[];
  notificationCooldownMinutes: number;
  quietHours?: QuietHoursConfig;
}

// ─── Event severity (§18) ────────────────────────────────────────────────────

export type MonitorEventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// ─── Alert deduplication (§19) ────────────────────────────────────────────────

export interface AlertFingerprint {
  fingerprint: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrenceCount: number;
}

// ─── Alert evaluation result ──────────────────────────────────────────────────

export interface AlertEvent {
  eventType: string;
  severity: MonitorEventSeverity;
  stableKey: string;
  affectedPages: string[];
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  fingerprint: string;
}

export interface AlertEvaluationResult {
  alertsTriggered: AlertEvent[];
  alertsSuppressed: AlertEvent[];
  incidentsCreated: string[];
  incidentsUpdated: string[];
  incidentsResolved: string[];
}

// ─── Incident lifecycle (§20) ────────────────────────────────────────────────

export type MonitorIncidentStatus =
  | 'open'
  | 'acknowledged'
  | 'resolved'
  | 'muted'
  | 'reopened';

export interface MonitorEvent {
  eventId: string;
  runId: string;
  eventType: string;
  severity: MonitorEventSeverity;
  detectedAt: string;
  summary: string;
}

export interface MonitorIncident {
  incidentId: string;
  monitorId: string;
  fingerprint: string;
  title: string;
  severity: MonitorEventSeverity;
  status: MonitorIncidentStatus;
  firstDetectedRunId: string;
  lastDetectedRunId: string;
  resolvedRunId?: string;
  affectedPages: string[];
  eventHistory: MonitorEvent[];
  occurrenceCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Notification channels (§31) ──────────────────────────────────────────────

export interface NotificationChannelConfig {
  channelId: string;
  type: 'email' | 'webhook' | 'slack' | 'in-app';
  destination: string;
  severityThreshold: MonitorEventSeverity;
  categories?: string[];
  quietHoursOverride?: boolean;
  digestMode?: 'immediate' | 'daily' | 'weekly';
}

export interface MonitorNotification {
  notificationId: string;
  monitorId: string;
  incidentId?: string;
  severity: MonitorEventSeverity;
  title: string;
  summary: string;
  affectedPages: string[];
  detectedAt: string;
  reportUrl: string;
  comparisonUrl?: string;
}

// ─── Failure origin (§47) ────────────────────────────────────────────────────

export type MonitorFailureOrigin =
  | 'target-site'
  | 'analyzer'
  | 'browser-provider'
  | 'notification-provider'
  | 'configuration'
  | 'unknown';

// ─── Usage accounting (§48) ───────────────────────────────────────────────────

export interface MonitorRunUsage {
  pagesFetched: number;
  pagesAnalyzed: number;
  browserAudits: number;
  aiTokens?: number;
  notificationsSent: number;
  workerCpuMs?: number;
}

// ─── Retention policy (§49) ───────────────────────────────────────────────────

export interface MonitorRetentionPolicy {
  detailedRunsDays: number;
  summaryRunsDays: number;
  screenshotsDays: number;
  notificationLogsDays: number;
}

// ─── Analysis run error (internal) ────────────────────────────────────────────

export interface AnalysisRunError {
  code: string;
  message: string;
  origin: MonitorFailureOrigin;
  occurredAt: string;
  retryable: boolean;
}
