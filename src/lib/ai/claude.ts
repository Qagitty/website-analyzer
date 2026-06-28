import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AI_PROMPTS } from './prompts';
import {
  sanitizeAxeIssues,
  sanitizeDescription,
  sanitizeTitle,
  sanitizeEvidenceItems,
  sanitizeEvidence,
  INJECTION_RESISTANCE_SYSTEM_PROMPT,
} from './sanitize';
import { validateAiOutput, checkForbiddenClaims } from './validate';
import type {
  AiRecommendationInput,
  AiRecommendationOutput,
  AiGenerationMetadata,
  AiUsage,
  AiRecommendationMode,
} from './ai-types';

// ─── Versioning constants (§25) ───────────────────────────────────────────────

export const AI_PROVIDER = 'anthropic' as const;
export const AI_MODEL = 'claude-sonnet-4-6';
/** Increment when prompts change in a way that affects output meaning. */
export const PROMPT_VERSION = '2.1';
/** Increment when AiRecommendationOutput schema changes. */
export const SCHEMA_VERSION = '1.0';

// ─── Mode limits (§28) ────────────────────────────────────────────────────────

const MAX_TOKENS_BY_MODE: Record<AiRecommendationMode, number> = {
  disabled: 0,
  'summary-only': 512,
  'priority-findings': 1024,
  'full-report': 2048,
};

// ─── Anthropic client ─────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Zod schemas — validate every AI response at the boundary ────────────────

const issueBaseSchema = z.object({
  category: z.string().default('ux'),
  severity: z.string().optional(),
  priority: z.string().optional(),
  title: z.string().default(''),
  description: z.string().default(''),
  recommendation: z.string().default(''),
  effortLevel: z.enum(['low', 'medium', 'high']).nullable().optional(),
  impactScore: z.number().min(1).max(10).nullable().optional(),
  beforeCode: z.string().nullable().optional(),
  afterCode: z.string().nullable().optional(),
  codeExample: z.string().nullable().optional(),
  frameworkNotes: z.record(z.string()).nullable().optional(),
  estimatedImpact: z.string().default(''),
}).passthrough();

const screenshotSchema = z.object({
  overallUXScore: z.number().min(0).max(100).optional(),
  issues: z.array(issueBaseSchema).default([]),
  positives: z.array(z.string()).default([]),
  quickWins: z.array(z.string()).default([]),
}).passthrough();

const performanceSchema = z.object({
  summary: z.string().default(''),
  criticalIssues: z.array(z.object({
    metric: z.string(),
    currentValue: z.string().optional(),
    targetValue: z.string().optional(),
    fix: z.string().default(''),
    effortLevel: z.enum(['low', 'medium', 'high']).optional(),
    impactScore: z.number().min(1).max(10).optional(),
    beforeCode: z.string().nullable().optional(),
    afterCode: z.string().nullable().optional(),
    codeExample: z.string().nullable().optional(),
    expectedImprovement: z.string().optional(),
  }).passthrough()).default([]),
  recommendations: z.array(z.string()).default([]),
  quickWins: z.array(z.string()).default([]),
  architecturalImprovements: z.array(z.string()).default([]),
  estimatedScoreAfterFixes: z.number().min(0).max(100).optional(),
}).passthrough();

const accessibilityIssueSchema = z.object({
  originalId: z.string().default(''),
  plainEnglish: z.string().default(''),
  affectedUsers: z.string().default(''),
  beforeCode: z.string().nullable().optional(),
  afterCode: z.string().nullable().optional(),
  codeExample: z.string().nullable().optional(),
  wcagReference: z.string().nullable().optional(),
  wcagLevel: z.enum(['A', 'AA', 'AAA']).optional(),
  effortLevel: z.enum(['low', 'medium', 'high']).optional(),
  impactScore: z.number().min(1).max(10).optional(),
  frameworkNotes: z.record(z.string()).nullable().optional(),
  estimatedFixTime: z.string().optional(),
}).passthrough();

const accessibilitySchema = z.object({
  overallAccessibilityLevel: z.enum(['A', 'AA', 'AAA', 'non-compliant']).default('non-compliant'),
  criticalCount: z.number().default(0),
  interpretedIssues: z.array(accessibilityIssueSchema).default([]),
  prioritizedFixes: z.array(z.string()).default([]),
}).passthrough();

const errorsSchema = z.object({
  totalErrors: z.number().default(0),
  criticalErrors: z.number().default(0),
  errorGroups: z.array(z.object({
    pattern: z.string(),
    count: z.number(),
    severity: z.enum(['critical', 'warning', 'info']).optional(),
    plainExplanation: z.string().default(''),
    likelyRootCause: z.string().default(''),
    fixSuggestion: z.string().default(''),
    effortLevel: z.enum(['low', 'medium', 'high']).optional(),
    impactScore: z.number().min(1).max(10).optional(),
    beforeCode: z.string().nullable().optional(),
    afterCode: z.string().nullable().optional(),
    affectsUsers: z.boolean().default(false),
  }).passthrough()).default([]),
  hasBlockingErrors: z.boolean().default(false),
  summary: z.string().default(''),
}).passthrough();

// ─── Observability (§38) ─────────────────────────────────────────────────────

export function logAiEvent(event: {
  analysisId?: string;
  category?: string;
  promptVersion?: string;
  schemaVersion?: string;
  model?: string;
  attempt?: number;
  inputTokens?: number;
  outputTokens?: number;
  findingsIncluded?: number;
  findingsOmitted?: number;
  validationStatus?: 'valid' | 'invalid' | 'fallback';
  hallucinationRuleHits?: number;
  fallbackUsed?: boolean;
  generationDurationMs?: number;
  error?: string;
  [key: string]: unknown;
}): void {
  // Structured log line — do not log full prompts or secrets
  console.info('[ai:event]', JSON.stringify({
    ts: new Date().toISOString(),
    ...event,
  }));
}

// ─── Retry helper with jitter (§24) ───────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  label = 'ai-call',
  meta?: { analysisId?: string; category?: string },
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const retryable = err?.status === 529 || err?.status === 503 || err?.status === 429;
      if (!retryable || attempt === retries) {
        logAiEvent({
          ...meta,
          event: 'ai.call.failed',
          label,
          attempt: attempt + 1,
          error: err?.message ?? 'unknown',
        });
        throw err;
      }
      // Exponential backoff + jitter: 1s±0.5s, 2s±0.5s, 4s±0.5s …
      const baseDelay = 1000 * Math.pow(2, attempt);
      const jitterMs = Math.floor(Math.random() * 500);
      const delayMs = baseDelay + jitterMs;
      console.warn(`[ai] ${label} retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('unreachable');
}

// ─── Parse + validate helper ─────────────────────────────────────────────────

function parseJSON(text: string): unknown {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  const tryParse = (s: string): unknown | null => {
    try { return JSON.parse(s); } catch { return null; }
  };

  const result = tryParse(stripped);
  if (result !== null) return result;

  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return {};

  const direct = tryParse(match[0]);
  if (direct !== null) return direct;

  const sanitized = match[0].replace(/[\x00-\x1F\x7F]/g, (c) => {
    if (c === '\n') return '\\n';
    if (c === '\r') return '\\r';
    if (c === '\t') return '\\t';
    return '';
  });

  return tryParse(sanitized) ?? {};
}

function parseAndValidate<T>(
  text: string,
  schema: z.ZodType<T>,
  fallback: T,
  label: string,
): T {
  const raw = parseJSON(text);
  const result = schema.safeParse(raw);
  if (!result.success) {
    console.warn(`[ai] ${label} response failed validation:`, result.error.issues.slice(0, 3));
    return fallback;
  }
  return result.data;
}

// ─── Forbidden-claim post-processing for legacy outputs ──────────────────────

/**
 * Check legacy free-form AI output for forbidden claims and log warnings.
 * Does not reject the output — adds warning metadata.
 */
function auditLegacyOutput(data: unknown, label: string): void {
  const text = typeof data === 'string' ? data : JSON.stringify(data ?? '');
  const hits = checkForbiddenClaims(text);
  for (const { message, fatal } of hits) {
    if (fatal) {
      console.error(`[ai] ${label} FATAL forbidden claim: ${message}`);
    } else {
      console.warn(`[ai] ${label} forbidden claim warning: ${message}`);
    }
  }
}

// ─── Public exports ───────────────────────────────────────────────────────────

interface AnalysisInput {
  screenshotBase64: string | null;
  lighthouseScores: any;
  consoleErrors: any[];
  accessibilityIssues: any[];
  networkSummary?: any;
  resourceAudit?: any;
  /** Controls AI generation depth. Defaults to 'full-report'. */
  mode?: AiRecommendationMode;
  analysisId?: string;
}

export async function analyzeWithAI(input: AnalysisInput) {
  const mode = input.mode ?? 'full-report';
  const startTs = Date.now();

  if (mode === 'disabled') {
    return {
      screenshot: null,
      performance: null,
      accessibility: ACCESSIBILITY_FALLBACK,
      errors: ERRORS_FALLBACK,
      insights: [],
      summary: null,
      quickWins: [],
      generationMetadata: buildMetadata(0, 0, false, mode),
    };
  }

  const resourceAudit = input.resourceAudit ?? input.networkSummary?.resourceAudit;
  const ls = input.lighthouseScores;

  const rawOpportunities: any[] = ls?.opportunities ?? [];
  const opportunitiesForPrompt = rawOpportunities.slice(0, 10).map((o: any) => ({
    id: o.id,
    title: sanitizeDescription(o.title ?? ''),
    severity: o.severity,
    confidence: o.confidence,
    evidence: (o.evidence ?? []).slice(0, 2).map((e: string) => sanitizeEvidence(String(e))),
    estimatedSavingsMs: o.estimatedSavingsMs,
    estimatedSavingsBytes: o.estimatedSavingsBytes,
  }));

  const perfData = ls ? {
    performance:        ls.performance,
    scoreVersion:       ls.scoreVersion ?? '1.0',
    measurementMode:    ls.measurementMode ?? 'fetch-only',
    ttfb:               ls.ttfb,
    estimatedLcp:       ls.estimatedLcp ?? ls.lcp ?? undefined,
    htmlBytes:          input.networkSummary?.totalBytes ?? undefined,
    renderBlockingCount: resourceAudit?.renderBlocking?.length ?? 0,
    imageIssueCount:     resourceAudit?.imageIssues?.length ?? 0,
    thirdPartyCount:     resourceAudit?.thirdParty?.length ?? 0,
    opportunities:      opportunitiesForPrompt.length > 0 ? opportunitiesForPrompt : undefined,
  } : null;

  const maxTokens = MAX_TOKENS_BY_MODE[mode];
  const meta = { analysisId: input.analysisId, category: 'multi' };

  const [screenshotResult, performanceResult, accessibilityResult, errorsResult] =
    await Promise.allSettled([
      withRetry(() => analyzeScreenshot(input.screenshotBase64, maxTokens), 2, 'screenshot', meta),
      withRetry(() => analyzePerformance(perfData, maxTokens),             2, 'performance', meta),
      withRetry(() => analyzeAccessibility(input.accessibilityIssues, maxTokens), 2, 'accessibility', meta),
      withRetry(() => analyzeErrors(input.consoleErrors, maxTokens),       2, 'errors', meta),
    ]);

  const screenshotAnalysis =
    screenshotResult.status === 'fulfilled' ? screenshotResult.value : null;
  const performanceAnalysis =
    performanceResult.status === 'fulfilled' ? performanceResult.value : null;
  const accessibilityAnalysis =
    accessibilityResult.status === 'fulfilled'
      ? accessibilityResult.value
      : { overallAccessibilityLevel: 'AA' as const, criticalCount: 0, interpretedIssues: [], prioritizedFixes: [] };
  const errorsAnalysis =
    errorsResult.status === 'fulfilled'
      ? errorsResult.value
      : ERRORS_FALLBACK;

  [screenshotResult, performanceResult, accessibilityResult, errorsResult].forEach(
    (r, i) => r.status === 'rejected' &&
      console.error(`[ai] analyzeWithAI partial failure [${i}]:`, r.reason),
  );

  const rawIssues: any[] = screenshotAnalysis?.issues ?? [];
  const screenshotInsights = rawIssues.map((issue: any) => ({
    category: issue.category ?? 'ux',
    priority: issue.priority ?? issue.severity ?? 'low',
    title: issue.title ?? '',
    description: issue.description ?? '',
    recommendation: issue.recommendation ?? '',
    codeExample: issue.codeExample ?? issue.afterCode ?? null,
    beforeCode: issue.beforeCode ?? null,
    afterCode: issue.afterCode ?? issue.codeExample ?? null,
    effortLevel: issue.effortLevel ?? null,
    impactScore: issue.impactScore ?? null,
    frameworkNotes: issue.frameworkNotes ?? null,
    estimatedImpact: issue.estimatedImpact ?? '',
  }));

  const accessibilityInsights = (accessibilityAnalysis?.interpretedIssues ?? []).map((issue: any) => ({
    category: 'accessibility' as const,
    priority: issue.wcagLevel === 'A' ? 'high' : 'medium',
    title: (issue.originalId ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    description: issue.plainEnglish ?? '',
    recommendation: issue.affectedUsers ?? '',
    codeExample: issue.afterCode ?? issue.codeExample ?? null,
    beforeCode: issue.beforeCode ?? null,
    afterCode: issue.afterCode ?? null,
    effortLevel: issue.effortLevel ?? null,
    impactScore: issue.impactScore ?? null,
    wcagReference: issue.wcagReference ?? null,
    frameworkNotes: issue.frameworkNotes ?? null,
    estimatedImpact: issue.estimatedFixTime ? `Fix time: ${issue.estimatedFixTime}` : '',
  }));

  const insights = screenshotInsights.length > 0 ? screenshotInsights : accessibilityInsights;

  const screenshotQuickWins: string[] = [
    ...(screenshotAnalysis?.quickWins ?? []),
    ...(performanceAnalysis?.recommendations?.slice(0, 2) ?? []),
  ];
  const quickWins = screenshotQuickWins.length > 0
    ? screenshotQuickWins
    : (accessibilityAnalysis?.prioritizedFixes ?? []).slice(0, 3);

  const durationMs = Date.now() - startTs;
  logAiEvent({
    analysisId: input.analysisId,
    category: 'multi',
    promptVersion: PROMPT_VERSION,
    model: AI_MODEL,
    generationDurationMs: durationMs,
    fallbackUsed: [screenshotResult, performanceResult, accessibilityResult, errorsResult].some(
      (r) => r.status === 'rejected',
    ),
  });

  return {
    screenshot: screenshotAnalysis,
    performance: performanceAnalysis,
    accessibility: accessibilityAnalysis,
    errors: errorsAnalysis,
    insights,
    summary: performanceAnalysis?.summary ?? screenshotAnalysis?.summary ?? null,
    quickWins,
    generationMetadata: buildMetadata(durationMs, 0, false, mode),
  };
}

// ─── New structured recommendation generation (§3, §7, §8, §9) ───────────────

/**
 * Generate structured recommendations from a normalized AiRecommendationInput.
 * Output is validated against AiRecommendationOutput schema with hallucination
 * detection and forbidden-claim rules applied before returning.
 */
export async function generateCategoryRecommendations(
  input: AiRecommendationInput,
): Promise<{
  output: AiRecommendationOutput | null;
  metadata: AiGenerationMetadata;
  usage: AiUsage;
  validationErrors: string[];
  validationWarnings: string[];
}> {
  const mode = input.constraints.mode;

  if (mode === 'disabled') {
    return {
      output: null,
      metadata: buildMetadata(0, 0, false, mode),
      usage: { inputTokens: 0, outputTokens: 0, findingsIncluded: 0, findingsOmitted: 0 },
      validationErrors: [],
      validationWarnings: [],
    };
  }

  const maxTokens = MAX_TOKENS_BY_MODE[mode];
  const validFindingIds = new Set(input.findings.map((f) => f.findingId));
  const startTs = Date.now();

  let attempts = 0;
  let lastValidationErrors: string[] = [];
  let lastValidationWarnings: string[] = [];
  let usedFallback = false;
  let usage: AiUsage = {
    inputTokens: 0,
    outputTokens: 0,
    findingsIncluded: input.findings.length,
    findingsOmitted: 0,
  };

  const systemPrompt = [
    INJECTION_RESISTANCE_SYSTEM_PROMPT,
    '',
    'SCORING RULES:',
    '- Do NOT produce numeric scores. Scores are computed deterministically by the analysis engine.',
    '- Do NOT change severity, confidence, coverage, or audit status of any finding.',
    '- Do NOT remove or hide limitations.',
    '- Do NOT claim findings that are not in the input.',
    '- Claude may explain the priority but must preserve it exactly as given in each finding.',
  ].join('\n');

  const userPrompt = buildCategoryPrompt(input);

  for (attempts = 1; attempts <= 3; attempts++) {
    try {
      const response = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: maxTokens,
        temperature: input.constraints.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const inputTok = response.usage?.input_tokens ?? 0;
      const outputTok = response.usage?.output_tokens ?? 0;
      usage = {
        inputTokens: inputTok,
        outputTokens: outputTok,
        estimatedCost: estimateCost(inputTok, outputTok),
        findingsIncluded: input.findings.length,
        findingsOmitted: 0,
      };

      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      const raw = parseJSON(text);
      const validation = validateAiOutput(raw, validFindingIds);

      lastValidationErrors = validation.errors;
      lastValidationWarnings = validation.warnings;

      if (validation.valid && validation.sanitizedOutput) {
        const durationMs = Date.now() - startTs;
        logAiEvent({
          analysisId: input.analysisId,
          category: input.category,
          promptVersion: PROMPT_VERSION,
          schemaVersion: SCHEMA_VERSION,
          model: AI_MODEL,
          attempt: attempts,
          inputTokens: inputTok,
          outputTokens: outputTok,
          findingsIncluded: input.findings.length,
          findingsOmitted: 0,
          validationStatus: 'valid',
          hallucinationRuleHits: 0,
          fallbackUsed: false,
          generationDurationMs: durationMs,
        });

        return {
          output: validation.sanitizedOutput,
          metadata: buildMetadata(durationMs, attempts, false, mode, inputTok, outputTok),
          usage,
          validationErrors: [],
          validationWarnings: validation.warnings,
        };
      }

      // On validation failure, only retry for schema errors (not hallucination — those won't fix on retry)
      const hasHallucination = validation.errors.some((e) => e.includes('unknown findingId'));
      if (hasHallucination || attempts === 3) break;

      console.warn(`[ai] ${input.category} recommendation output invalid (attempt ${attempts}), retrying...`);
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));

    } catch (err: any) {
      const retryable = err?.status === 529 || err?.status === 503 || err?.status === 429;
      if (!retryable || attempts === 3) {
        logAiEvent({
          analysisId: input.analysisId,
          category: input.category,
          model: AI_MODEL,
          attempt: attempts,
          error: err?.message ?? 'unknown',
          validationStatus: 'fallback',
          fallbackUsed: true,
        });
        usedFallback = true;
        break;
      }
      const delay = 1000 * Math.pow(2, attempts - 1) + Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // Deterministic fallback (§23)
  usedFallback = true;
  const durationMs = Date.now() - startTs;
  logAiEvent({
    analysisId: input.analysisId,
    category: input.category,
    promptVersion: PROMPT_VERSION,
    model: AI_MODEL,
    attempt: attempts,
    validationStatus: 'fallback',
    fallbackUsed: true,
    generationDurationMs: durationMs,
  });

  return {
    output: buildFallbackOutput(input),
    metadata: buildMetadata(durationMs, attempts, true, mode, usage.inputTokens, usage.outputTokens, lastValidationErrors),
    usage,
    validationErrors: lastValidationErrors,
    validationWarnings: lastValidationWarnings,
  };
}

// ─── Design comparison (unchanged) ───────────────────────────────────────────

export async function compareWithDesign(
  designBase64: string,
  designMimeType: string,
  liveScreenshotBase64: string,
) {
  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 2048,
    system: INJECTION_RESISTANCE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: designMimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
              data: designBase64,
            },
          },
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: liveScreenshotBase64 },
          },
          { type: 'text', text: AI_PROMPTS.designComparison() },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return parseJSON(text);
}

// ─── Private per-domain analysis functions ───────────────────────────────────

const SCREENSHOT_FALLBACK = screenshotSchema.parse({});
const PERFORMANCE_FALLBACK = performanceSchema.parse({});
const ACCESSIBILITY_FALLBACK = accessibilitySchema.parse({});
const ERRORS_FALLBACK = errorsSchema.parse({});

async function analyzeScreenshot(screenshotBase64: string | null, maxTokens = 2048) {
  if (!screenshotBase64) return null;

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system: INJECTION_RESISTANCE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 },
          },
          { type: 'text', text: AI_PROMPTS.screenshotAnalysis() },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const result = parseAndValidate(text, screenshotSchema, SCREENSHOT_FALLBACK, 'screenshot');
  auditLegacyOutput(result, 'screenshot');
  return result;
}

async function analyzePerformance(scores: any, maxTokens = 1024) {
  if (!scores) return null;

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system: INJECTION_RESISTANCE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: AI_PROMPTS.performanceAnalysis(scores) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const result = parseAndValidate(text, performanceSchema, PERFORMANCE_FALLBACK, 'performance');
  auditLegacyOutput(result, 'performance');
  return result;
}

async function analyzeAccessibility(issues: any[], maxTokens = 2048) {
  if (!issues?.length) return ACCESSIBILITY_FALLBACK;

  // Sanitize node selectors before sending to Claude (§4)
  const sanitizedIssues = sanitizeAxeIssues(issues);

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system: INJECTION_RESISTANCE_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: AI_PROMPTS.accessibilityAnalysis(sanitizedIssues as any) },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const result = parseAndValidate(text, accessibilitySchema, ACCESSIBILITY_FALLBACK, 'accessibility');
  auditLegacyOutput(result, 'accessibility');
  return result;
}

async function analyzeErrors(errors: any[], maxTokens = 1024) {
  if (!errors?.length) return ERRORS_FALLBACK;

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system: INJECTION_RESISTANCE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: AI_PROMPTS.consoleErrorsAnalysis(errors) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const result = parseAndValidate(text, errorsSchema, ERRORS_FALLBACK, 'errors');
  auditLegacyOutput(result, 'errors');
  return result;
}

// ─── Category prompt builder (§3, §6, §12) ───────────────────────────────────

function buildCategoryPrompt(input: AiRecommendationInput): string {
  const { category, website, auditContext, findings, constraints } = input;

  const findingsText = findings.map((f) => {
    const cleanEvidence = sanitizeEvidenceItems(f.evidence ?? []);
    const evidenceText = cleanEvidence
      .map((e) => `    [${e.type}] ${e.content}${e.context ? ` (context: ${e.context})` : ''}`)
      .join('\n');
    return [
      `Finding ID: ${f.findingId}`,
      `Rule ID: ${f.ruleId}`,
      `Title: ${sanitizeTitle(f.title)}`,
      `Status: ${f.status} | Severity: ${f.severity} | Confidence: ${f.confidence}`,
      `Source: ${f.source} | Scope: ${f.scope}`,
      `Description: ${sanitizeDescription(f.description)}`,
      evidenceText ? `Evidence:\n${evidenceText}` : 'Evidence: none',
      f.rolloutRisk ? `Rollout risk: ${f.rolloutRisk}` : '',
      f.safeToApplyDirectly !== undefined ? `Safe to apply directly: ${f.safeToApplyDirectly}` : '',
      f.deterministicRecommendation ? `Deterministic recommendation: ${f.deterministicRecommendation}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n---\n\n');

  return `You are a web ${category} expert generating structured remediation recommendations.

ANALYSIS CONTEXT:
- Category: ${category}
- Website: ${website.testedUrl}
- Audit mode: ${auditContext.auditMode}
- Score: ${auditContext.score !== null ? `${auditContext.score}/100` : 'unavailable'}
- Coverage: ${auditContext.coverage !== null ? `${auditContext.coverage}%` : 'unknown'}
- Confidence: ${auditContext.confidence ?? 'unknown'}
- Limitations: ${auditContext.limitations.join('; ') || 'none stated'}

FINDINGS (${findings.length} total — each recommendation MUST reference findingIds from this list):

<UNTRUSTED_WEBSITE_EVIDENCE>
${findingsText}
</UNTRUSTED_WEBSITE_EVIDENCE>

INSTRUCTIONS:
1. Every recommendation MUST include at least one findingId from the list above.
2. Reject fabricated rule IDs, URLs, or metrics not present in the findings above.
3. Group related findings into a single recommendation where appropriate (§15, §16).
4. Preserve the severity and rollout risk from each finding — do not upgrade or downgrade.
5. Include concrete verification steps for each recommendation.
6. Add limitations when the audit mode restricts what was checked.
7. Do not claim guaranteed outcomes, legal compliance, or full coverage.
8. If a deterministic recommendation is provided, use it as the basis but improve the explanation.
9. Assign recommendationId using the pattern: ${category}-<ruleId>-NNN

GENERATION MODE: ${constraints.mode} (max ${constraints.maxRecommendations} recommendations)

Return ONLY valid JSON matching this exact schema:
{
  "summary": "<2-3 sentences grounded only in the findings above>",
  "recommendations": [
    {
      "recommendationId": "${category}-<ruleId>-001",
      "findingIds": ["<must be from findings above>"],
      "title": "<concise action title>",
      "priority": "critical" | "high" | "medium" | "low",
      "explanation": "<what was detected and why it matters>",
      "impact": "<who is affected and how>",
      "implementationSteps": ["<step 1>", "<step 2>"],
      "verificationSteps": ["<how to verify the fix>"],
      "codeExample": { "language": "html", "before": "<optional>", "after": "<optional>" },
      "rolloutRisk": "low" | "medium" | "high" | "very-high",
      "safeToApplyDirectly": true | false,
      "assumptions": ["<any assumption made>"],
      "limitations": ["<what this analysis could not assess>"],
      "effort": "quick-win" | "small" | "medium" | "large" | "unknown",
      "categories": ["${category}"]
    }
  ],
  "omittedFindingIds": ["<findingIds not covered by any recommendation>"],
  "warnings": ["<any concern about the analysis or recommendations>"]
}`;
}

// ─── Deterministic fallback output (§23) ─────────────────────────────────────

function buildFallbackOutput(input: AiRecommendationInput): AiRecommendationOutput {
  return {
    summary: `AI-enhanced explanation unavailable. The ${input.category} audit found ${input.findings.length} finding(s). The technical findings and deterministic audit data are still available below.`,
    recommendations: input.findings.slice(0, 5).map((f, i) => ({
      recommendationId: `${input.category}-${f.ruleId}-${String(i + 1).padStart(3, '0')}`,
      findingIds: [f.findingId],
      title: f.title,
      priority: severityToPriority(f.severity),
      explanation: f.description,
      impact: 'See deterministic audit data for details.',
      implementationSteps: f.deterministicRecommendation
        ? [f.deterministicRecommendation]
        : ['Review the deterministic audit finding for remediation guidance.'],
      verificationSteps: ['Rerun the analysis after applying the fix and compare results.'],
      rolloutRisk: (f.rolloutRisk ?? 'medium') as 'low' | 'medium' | 'high' | 'very-high',
      safeToApplyDirectly: f.safeToApplyDirectly ?? false,
      assumptions: [],
      limitations: [
        'AI-enhanced explanation was unavailable — this is a deterministic fallback.',
      ],
    })),
    omittedFindingIds: input.findings.slice(5).map((f) => f.findingId),
    warnings: ['AI generation failed or was invalid. Showing deterministic fallback content.'],
  };
}

function severityToPriority(severity: string): 'critical' | 'high' | 'medium' | 'low' {
  const map: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    critical: 'critical',
    high: 'high',
    serious: 'high',
    medium: 'medium',
    moderate: 'medium',
    low: 'low',
    minor: 'low',
    info: 'low',
  };
  return map[severity?.toLowerCase()] ?? 'medium';
}

// ─── Metadata builder (§25) ──────────────────────────────────────────────────

function buildMetadata(
  durationMs: number,
  attempts: number,
  fallbackUsed: boolean,
  mode: AiRecommendationMode,
  inputTokens?: number,
  outputTokens?: number,
  validationErrors?: string[],
): AiGenerationMetadata {
  return {
    provider: AI_PROVIDER,
    model: AI_MODEL,
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    temperature: mode === 'summary-only' ? 0.3 : 0,
    inputTokens,
    outputTokens,
    attempts,
    fallbackUsed,
    validationErrors: validationErrors?.length ? validationErrors : undefined,
  };
}

// ─── Cost estimation ──────────────────────────────────────────────────────────

function estimateCost(inputTokens: number, outputTokens: number): number {
  // claude-sonnet-4-6 pricing: $3/MTok input, $15/MTok output (approximate)
  return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
}
