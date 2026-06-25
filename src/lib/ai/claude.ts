import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AI_PROMPTS } from './prompts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Zod schemas — validate every AI response at the boundary ────────────────
// .passthrough() keeps unknown fields so new prompt fields don't break old code.

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
  overallUXScore: z.number().min(0).max(100).default(0),
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

// ─── Retry helper ─────────────────────────────────────────────────────────────
// Retries on transient Anthropic API errors (529 Overloaded, 503, 429).
// Uses exponential back-off: 1s, 2s, 4s …
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  label = 'ai-call',
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const retryable =
        err?.status === 529 || err?.status === 503 || err?.status === 429;
      if (!retryable || attempt === retries) {
        console.error(`[ai] ${label} failed after ${attempt + 1} attempt(s):`, err?.message ?? err);
        throw err;
      }
      const delayMs = 1000 * Math.pow(2, attempt);
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

// ─── Public exports ───────────────────────────────────────────────────────────

interface AnalysisInput {
  screenshotBase64: string | null;
  lighthouseScores: any;
  consoleErrors: any[];
  accessibilityIssues: any[];
  networkSummary?: any;
  resourceAudit?: any;
}

export async function analyzeWithAI(input: AnalysisInput) {
  const resourceAudit = input.resourceAudit ?? input.networkSummary?.resourceAudit;
  const ls = input.lighthouseScores;

  // Build a clean performance data object that accurately represents what was measured.
  // Never pass fid/cls — they're always 0 from fetch-only analysis and would mislead the AI.
  // Pass structured opportunities so Claude can reference real evidence
  // instead of generating generic advice
  const rawOpportunities: any[] = ls?.opportunities ?? [];
  const opportunitiesForPrompt = rawOpportunities.slice(0, 10).map((o: any) => ({
    id: o.id,
    title: o.title,
    severity: o.severity,
    confidence: o.confidence,
    evidence: (o.evidence ?? []).slice(0, 2),
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

  // Run all four AI calls in parallel with independent failure isolation.
  // Promise.allSettled means one failed call doesn't cancel the others —
  // the analysis is still saved with partial data rather than marked failed.
  const [screenshotResult, performanceResult, accessibilityResult, errorsResult] =
    await Promise.allSettled([
      withRetry(() => analyzeScreenshot(input.screenshotBase64), 2, 'screenshot'),
      withRetry(() => analyzePerformance(perfData),              2, 'performance'),
      withRetry(() => analyzeAccessibility(input.accessibilityIssues), 2, 'accessibility'),
      withRetry(() => analyzeErrors(input.consoleErrors),        2, 'errors'),
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
      : { totalErrors: 0, criticalErrors: 0, errorGroups: [], hasBlockingErrors: false, summary: '' };

  // Log any partial failures for observability
  [screenshotResult, performanceResult, accessibilityResult, errorsResult].forEach(
    (r, i) => r.status === 'rejected' &&
      console.error(`[ai] analyzeWithAI partial failure [${i}]:`, r.reason),
  );

  // Normalise screenshot issues → top-level insights
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

  // Fall back to accessibility findings when screenshot unavailable
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

  return {
    screenshot: screenshotAnalysis,
    performance: performanceAnalysis,
    accessibility: accessibilityAnalysis,
    errors: errorsAnalysis,
    insights,
    summary: performanceAnalysis?.summary ?? screenshotAnalysis?.summary ?? null,
    quickWins,
  };
}

export async function compareWithDesign(
  designBase64: string,
  designMimeType: string,
  liveScreenshotBase64: string,
) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
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

async function analyzeScreenshot(screenshotBase64: string | null) {
  if (!screenshotBase64) return null;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
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
  return parseAndValidate(text, screenshotSchema, SCREENSHOT_FALLBACK, 'screenshot');
}

async function analyzePerformance(scores: any) {
  if (!scores) return null;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: AI_PROMPTS.performanceAnalysis(scores) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return parseAndValidate(text, performanceSchema, PERFORMANCE_FALLBACK, 'performance');
}

function sanitizeAxeNodes(issues: any[]): any[] {
  return issues.map((issue) => ({
    ...issue,
    nodes: (issue.nodes ?? []).map((selector: string) =>
      selector.replace(/\('[^']*'\)/g, '').trim(),
    ),
  }));
}

async function analyzeAccessibility(issues: any[]) {
  if (!issues?.length) return ACCESSIBILITY_FALLBACK;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      { role: 'user', content: AI_PROMPTS.accessibilityAnalysis(sanitizeAxeNodes(issues)) },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return parseAndValidate(text, accessibilitySchema, ACCESSIBILITY_FALLBACK, 'accessibility');
}

async function analyzeErrors(errors: any[]) {
  if (!errors?.length) return ERRORS_FALLBACK;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: AI_PROMPTS.consoleErrorsAnalysis(errors) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return parseAndValidate(text, errorsSchema, ERRORS_FALLBACK, 'errors');
}
