/**
 * Canonical AI pipeline types.
 *
 * §3  — normalized input model
 * §7  — structured output schema
 * §9  — validation result
 * §13 — deterministic priority
 * §14 — implementation effort
 * §17 — recommendation template
 * §21 — safety classification
 * §25 — generation metadata
 * §27 — token usage
 * §28 — generation mode
 * §30 — recommendation lifecycle
 */

// ─── Input model (§3) ────────────────────────────────────────────────────────

export interface AiEvidenceInput {
  type: 'node' | 'value' | 'url' | 'header' | 'metric' | 'selector';
  /** Sanitized content — max 300 chars, secrets redacted. */
  content: string;
  /** Optional surrounding context — max 150 chars. */
  context?: string;
}

export interface AiFindingInput {
  findingId: string;
  ruleId: string;
  title: string;
  /** 'confirmed' | 'likely' | 'manual-review' | 'not-applicable' */
  status: string;
  /** 'critical' | 'high' | 'medium' | 'low' | 'info' */
  severity: string;
  /** 'high' | 'medium' | 'low' */
  confidence: string;
  source: string;
  /** 'site' | 'page' | 'component' */
  scope: string;
  description: string;
  evidence: AiEvidenceInput[];
  /** Pre-computed deterministic recommendation text (from template). */
  deterministicRecommendation?: string;
  /** 'low' | 'medium' | 'high' | 'very-high' */
  rolloutRisk?: string;
  safeToApplyDirectly?: boolean;
}

export interface AiWebsiteContext {
  /** Origin only — no path, no query params. */
  origin: string;
  /** Page URL with query params that contain secrets stripped. */
  testedUrl: string;
  pageType?: string;
  /** Detected framework ('react' | 'nextjs' | 'vue' | 'plain-html' | 'unknown'). */
  framework?: string;
}

export interface AiAuditContext {
  auditMode: string;
  score: number | null;
  coverage: number | null;
  confidence: 'high' | 'medium' | 'low' | null;
  limitations: string[];
}

export interface AiGenerationConstraints {
  maxRecommendations: number;
  mode: AiRecommendationMode;
  frameworkContext?: string;
  temperature: number;
}

export interface AiRecommendationInput {
  analysisId: string;
  reportVersion: string;
  promptVersion: string;
  category: string;
  website: AiWebsiteContext;
  auditContext: AiAuditContext;
  findings: AiFindingInput[];
  constraints: AiGenerationConstraints;
}

// ─── Output schema (§7) ──────────────────────────────────────────────────────

export interface AiCodeExample {
  language: string;
  before?: string;
  after?: string;
}

export interface AiRecommendation {
  /** Stable ID: category-ruleId-NNN pattern. */
  recommendationId: string;
  /** Must reference findingIds that exist in the input. */
  findingIds: string[];
  title: string;
  /** Deterministically assigned before generation — Claude may explain but must preserve. */
  priority: 'critical' | 'high' | 'medium' | 'low';
  explanation: string;
  impact: string;
  implementationSteps: string[];
  verificationSteps: string[];
  codeExample?: AiCodeExample;
  rolloutRisk: 'low' | 'medium' | 'high' | 'very-high';
  safeToApplyDirectly: boolean;
  assumptions: string[];
  limitations: string[];
  effort?: ImplementationEffort;
  /** Categories this recommendation addresses (for cross-category grouping). */
  categories?: string[];
}

export interface AiRecommendationOutput {
  summary: string;
  recommendations: AiRecommendation[];
  omittedFindingIds: string[];
  warnings: string[];
}

// ─── Validation result (§9) ──────────────────────────────────────────────────

export interface AiOutputValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedOutput?: AiRecommendationOutput;
}

// ─── Deterministic priority (§13) ────────────────────────────────────────────

export interface RecommendationPriorityInput {
  severity: string;
  confidence: string;
  scope: string;
  affectedPages: number;
  criticalFlow: boolean;
  rolloutRisk: string;
}

// ─── Implementation effort (§14) ─────────────────────────────────────────────

export type ImplementationEffort = 'quick-win' | 'small' | 'medium' | 'large' | 'unknown';

// ─── Safety classification (§21) ─────────────────────────────────────────────

export interface RecommendationSafety {
  safeToApplyDirectly: boolean;
  rolloutRisk: 'low' | 'medium' | 'high' | 'very-high';
  requiresStaging: boolean;
  requiresManualReview: boolean;
  potentialSideEffects: string[];
}

// ─── Generation metadata (§25) ───────────────────────────────────────────────

export interface AiGenerationMetadata {
  provider: 'anthropic';
  model: string;
  promptVersion: string;
  schemaVersion: string;
  generatedAt: string;
  temperature: number;
  inputTokens?: number;
  outputTokens?: number;
  attempts: number;
  fallbackUsed?: boolean;
  validationErrors?: string[];
}

// ─── Token usage (§27) ───────────────────────────────────────────────────────

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost?: number;
  findingsIncluded: number;
  findingsOmitted: number;
}

// ─── Generation mode (§28) ───────────────────────────────────────────────────

export type AiRecommendationMode = 'disabled' | 'summary-only' | 'priority-findings' | 'full-report';

// ─── Recommendation lifecycle (§30) ──────────────────────────────────────────

export type RecommendationState =
  | 'open'
  | 'acknowledged'
  | 'in-progress'
  | 'resolved'
  | 'dismissed'
  | 'regressed';

// ─── Recommendation template (§17) ───────────────────────────────────────────

export interface RecommendationTemplate {
  ruleId: string;
  titleTemplate: string;
  explanationTemplate: string;
  implementationSteps: string[];
  verificationSteps: string[];
  rolloutRisk: 'low' | 'medium' | 'high' | 'very-high';
  safeToApplyDirectly: boolean;
  effort: ImplementationEffort;
  categories?: string[];
}
