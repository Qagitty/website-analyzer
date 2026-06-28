/**
 * Centralized shared contract schemas (§3–§5, §7–§8, §11–§13, §16–§19, §21, §32–§33).
 *
 * All Zod schemas live here. TypeScript types are derived via z.infer.
 * This is the single source of truth for cross-boundary contracts:
 *   Worker → backend, backend → frontend, backend → PDF, public API.
 *
 * Rules:
 *  - Every top-level payload carries schemaVersion (§4).
 *  - Null / unavailable / zero / not-applicable are distinct (§12).
 *  - Discriminated unions replace optional-field soup (§30).
 *  - Do not maintain independent handwritten types — derive from schemas (§5).
 */

import { z } from 'zod';

// ─── Schema version constants (§4) ────────────────────────────────────────────

export const SCHEMA_VERSIONS = {
  WORKER_JOB:          'worker-job-v2',
  WORKER_CALLBACK:     'worker-callback-v2',
  ANALYSIS_RESULT:     'analysis-result-v2',
  PAGE_RESULT:         'page-result-v2',
  SCORE_RESULT:        'score-result-v2',
  AI_RECOMMENDATION:   'ai-recommendation-v2',
  PDF_VIEW_MODEL:      'pdf-view-model-v2',
  REPORT_API:          'report-api-v2',
} as const;

export type SchemaVersionKey = keyof typeof SCHEMA_VERSIONS;
export type SchemaVersionValue = (typeof SCHEMA_VERSIONS)[SchemaVersionKey];

/** §44 — Versions accepted for read. New analyses are written only as v2. */
export const SUPPORTED_READ_VERSIONS = new Set([
  'analysis-result-v1',
  'analysis-result-v2',
]);

/** §44 — Canonical write version for all new analyses. */
export const CURRENT_WRITE_VERSION = SCHEMA_VERSIONS.ANALYSIS_RESULT;

// ─── Status types (§11) ───────────────────────────────────────────────────────

/** Top-level analysis statuses. Includes legacy 'pending' alias for 'created'. */
export const AnalysisStatusSchema = z.enum([
  'pending',     // legacy alias — treated as 'created' by new code
  'created',     // record exists, not yet dispatched
  'queued',      // dispatched to Worker
  'running',     // Worker actively analyzing
  'partial',     // some page results in, others still processing
  'completed',   // all results available
  'failed',      // unrecoverable error
  'cancelled',   // user or system cancelled
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

/** Page-level audit statuses. */
export const PageAnalysisStatusSchema = z.enum([
  'discovered',
  'queued',
  'fetching',
  'analyzing',
  'completed',
  'partial',
  'failed',
  'skipped',
  'deduplicated',
  'cancelled',
]);
export type PageAnalysisStatus = z.infer<typeof PageAnalysisStatusSchema>;

/** Category-level audit statuses. */
export const CategoryAnalysisStatusSchema = z.enum([
  'completed',
  'partial',
  'failed',
  'unavailable',
  'not-applicable',
  'not-executed',
]);
export type CategoryAnalysisStatus = z.infer<typeof CategoryAnalysisStatusSchema>;

// ─── Null / unavailable / zero semantics (§12) ────────────────────────────────

/**
 * Explicit representation of a numeric audit value.
 *
 *  zero          → audit ran and produced a real 0
 *  null          → no numeric score exists
 *  unavailable   → audit could not produce the result
 *  not-applicable → check does not apply to this page/context
 *  not-executed  → check was skipped or unsupported
 *
 * Do NOT use 0 as a fallback for any of the above.
 */
export const NumericAuditValueSchema = z.object({
  value: z.number().nullable(),
  status: z.enum(['available', 'unavailable', 'not-applicable', 'not-executed']),
  reason: z.string().optional(),
});
export type NumericAuditValue = z.infer<typeof NumericAuditValueSchema>;

// ─── Structured error model (§18) ─────────────────────────────────────────────

export const AnalysisErrorSchema = z.object({
  errorId: z.string(),
  scope: z.enum(['analysis', 'page', 'category', 'callback', 'ai', 'pdf']),
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  pageId: z.string().optional(),
  category: z.string().optional(),
  occurredAt: z.string().datetime(),
  /** Reference to internal diagnostic log entry — never exposed publicly */
  internalDetailsRef: z.string().optional(),
});
export type AnalysisError = z.infer<typeof AnalysisErrorSchema>;

// ─── Structured limitation model (§19) ────────────────────────────────────────

/**
 * Explicit limitation attached to an analysis, page, category, or finding.
 * Do NOT bury limitations inside free-form AI text.
 *
 * Examples: limited crawl sample, browser unavailable, sitemap not found,
 * rendered content unavailable, legacy report, low audit coverage.
 */
export const AnalysisLimitationSchema = z.object({
  limitationId: z.string(),
  scope: z.enum(['analysis', 'page', 'category', 'finding']),
  code: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'warning']),
  pageId: z.string().optional(),
  category: z.string().optional(),
});
export type AnalysisLimitation = z.infer<typeof AnalysisLimitationSchema>;

// ─── Normalized finding model (§13) ───────────────────────────────────────────

/**
 * One shared finding shape used across all audit categories.
 * Category-specific evidence uses discriminated unions.
 * Do NOT create incompatible finding shapes per UI component.
 */
export const NormalizedFindingSchema = z.object({
  findingId: z.string(),
  ruleId: z.string(),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  confidence: z.enum(['high', 'medium', 'low']),
  source: z.string(),
  scope: z.enum(['page', 'site']),
  affectedPageIds: z.array(z.string()),
  evidence: z.array(z.unknown()),
  recommendationId: z.string().optional(),
  scoreImpact: z.object({ category: z.string(), points: z.number() }).optional(),
  experimental: z.boolean(),
  createdAt: z.string().datetime(),
});
export type NormalizedFinding = z.infer<typeof NormalizedFindingSchema>;

// ─── Score result model (§16, §17) ────────────────────────────────────────────

/**
 * Rich stored score result — includes enough data to reproduce the score.
 * Do NOT persist only final integers for new reports.
 */
export const AuditCoverageSchema = z.object({
  supportedChecks: z.number().int(),
  applicableChecks: z.number().int(),
  executedChecks: z.number().int(),
  passed: z.number().int(),
  failed: z.number().int(),
  warnings: z.number().int(),
  manualReview: z.number().int(),
  unavailable: z.number().int(),
  notExecuted: z.number().int(),
  percentage: z.number(),
});
export type AuditCoverage = z.infer<typeof AuditCoverageSchema>;

export const ScoreCheckResultSchema = z.object({
  id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  skipped: z.boolean(),
  weight: z.number(),
  details: z.string().optional(),
});

export const StoredScoreResultSchema = z.object({
  score: z.number().nullable(),
  scoreVersion: z.string(),
  rawPoints: z.number(),
  availablePoints: z.number(),
  maximumPoints: z.number(),
  coverage: AuditCoverageSchema,
  confidence: z.string(),
  auditMode: z.string(),
  checks: z.array(ScoreCheckResultSchema),
  limitations: z.array(z.string()),
});
export type StoredScoreResult = z.infer<typeof StoredScoreResultSchema>;

// ─── AI persistence model (§20) ───────────────────────────────────────────────

/**
 * AI-generated recommendations stored separately from deterministic findings.
 * Allows AI regeneration without altering technical audit data.
 * Do NOT merge AI-generated descriptions into deterministic findings destructively.
 */
export const StoredAiRecommendationSetSchema = z.object({
  schemaVersion: z.string(),
  promptVersion: z.string(),
  model: z.string(),
  generatedAt: z.string().datetime(),
  recommendations: z.array(z.unknown()),
  validationStatus: z.string(),
  inputFindingIds: z.array(z.string()),
});
export type StoredAiRecommendationSet = z.infer<typeof StoredAiRecommendationSetSchema>;

// ─── Worker job request contract (§7) ─────────────────────────────────────────

/**
 * Versioned request sent from backend to Cloudflare Worker.
 *
 * §7 — authToken is NOT in the body; it belongs in the Authorization header.
 * The callback URL carries signatureVersion so the Worker knows how to sign.
 */
export const WorkerJobRequestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.WORKER_JOB),
  analysisId: z.string().uuid(),
  rootUrl: z.string().url(),
  requestedBy: z.object({
    userIdHash: z.string(),   // SHA-256 of user ID — never the raw UUID
    plan: z.string(),
  }),
  config: z.object({
    crawlStrategy: z.string(),
    maxPages: z.number().int().positive(),
    maxDepth: z.number().int().nonnegative(),
    auditLevels: z.record(z.string(), z.string()),
    deviceProfile: z.string(),
    locale: z.string().optional(),
  }),
  callback: z.object({
    url: z.string().url(),
    signatureVersion: z.string(),
  }),
  idempotencyKey: z.string(),
  createdAt: z.string().datetime(),
});
export type WorkerJobRequest = z.infer<typeof WorkerJobRequestSchema>;

// ─── Worker callback envelope (§8) ────────────────────────────────────────────

/**
 * Versioned callback envelope sent from Worker to backend.
 *
 * Validate the payload based on resultType.
 * Reject: unknown analysis IDs, mismatched URLs, stale versions,
 *   duplicate idempotency keys, malformed timestamps.
 *
 * payload is z.unknown() here — the handler narrows by resultType.
 */
export const WorkerCallbackEnvelopeSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.WORKER_CALLBACK),
  analysisId: z.string().uuid(),
  pageId: z.string().optional(),
  category: z.string().optional(),
  resultType: z.enum([
    'analysis-started',
    'page-discovered',
    'page-result',
    'sitewide-result',
    'analysis-progress',
    'analysis-completed',
    'analysis-failed',
  ]),
  resultVersion: z.string(),
  idempotencyKey: z.string(),
  producedAt: z.string().datetime(),
  payload: z.unknown(),
});
export type WorkerCallbackEnvelope = z.infer<typeof WorkerCallbackEnvelopeSchema>;

// ─── Legacy v1 callback schema (backward compatibility) ───────────────────────

/**
 * Permissive schema for legacy Worker callbacks (pre-v2).
 * §29 — Forward compatibility: do not reject an entire report because a new
 * producer added a harmless field.
 */
export const LegacyWorkerCallbackSchema = z.object({
  analysisId: z.string(),
  error: z.string().optional(),
  screenshotBase64: z.string().nullable().optional(),
  lighthouseScores: z.record(z.string(), z.unknown()).nullable().optional(),
  consoleErrors: z.array(z.unknown()).nullable().optional(),
  accessibilityIssues: z.array(z.unknown()).nullable().optional(),
  networkSummary: z.record(z.string(), z.unknown()).nullable().optional(),
  crawledPages: z.array(z.unknown()).nullable().optional(),
  crawlCoverage: z.record(z.string(), z.unknown()).nullable().optional(),
  monitorId: z.string().optional(),
  monitorUserId: z.string().optional(),
  monitorLastScores: z.record(z.string(), z.unknown()).nullable().optional(),
  monitorNotify: z.boolean().optional(),
  monitorThreshold: z.number().optional(),
  url: z.string().optional(),
}).catchall(z.unknown());
export type LegacyWorkerCallback = z.infer<typeof LegacyWorkerCallbackSchema>;

// ─── Pagination contract (§33) ────────────────────────────────────────────────

export function PaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().optional(),
    total: z.number().int().nonnegative().optional(),
  });
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

// ─── Truncation metadata (§32) ────────────────────────────────────────────────

/**
 * Attach to any collection that was cut short.
 * Do NOT truncate silently.
 */
export const TruncationMetaSchema = z.object({
  truncated: z.boolean(),
  originalCount: z.number().int(),
  includedCount: z.number().int(),
});
export type TruncationMeta = z.infer<typeof TruncationMetaSchema>;

// ─── API response envelope (§21) ─────────────────────────────────────────────

export const ApiResponseEnvelopeSchema = z.object({
  schemaVersion: z.string(),
  data: z.unknown(),
});
export type ApiResponseEnvelope<T> = {
  schemaVersion: string;
  data: T;
};

export function makeApiResponse<T>(data: T, version: string = SCHEMA_VERSIONS.REPORT_API): ApiResponseEnvelope<T> {
  return { schemaVersion: version, data };
}
