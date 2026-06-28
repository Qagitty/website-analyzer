/**
 * AI output validation, hallucination detection, and forbidden-claim rules.
 *
 * §9  — output validation
 * §10 — hallucination detection
 * §11 — forbidden-claim rules
 */

import { z } from 'zod';
import type { AiRecommendationOutput, AiOutputValidationResult, AiRecommendation } from './ai-types';

// ─── Output Zod schema (§7, §9) ───────────────────────────────────────────────

const codeExampleSchema = z
  .object({
    language: z.string().max(30).default('html'),
    before: z.string().max(2000).optional(),
    after: z.string().max(2000).optional(),
  })
  .optional();

export const aiRecommendationSchema = z.object({
  recommendationId: z.string().min(1).max(100),
  findingIds: z.array(z.string().min(1)).min(1).max(20),
  title: z.string().min(1).max(200),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  explanation: z.string().min(1).max(1500),
  impact: z.string().min(1).max(800),
  implementationSteps: z.array(z.string().max(600)).min(1).max(10),
  verificationSteps: z.array(z.string().max(600)).min(1).max(8),
  codeExample: codeExampleSchema,
  rolloutRisk: z.enum(['low', 'medium', 'high', 'very-high']),
  safeToApplyDirectly: z.boolean(),
  assumptions: z.array(z.string().max(400)).max(5).default([]),
  limitations: z.array(z.string().max(400)).max(5).default([]),
  categories: z.array(z.string().max(50)).max(5).optional(),
  effort: z.enum(['quick-win', 'small', 'medium', 'large', 'unknown']).optional(),
});

export const aiRecommendationOutputSchema = z.object({
  summary: z.string().min(1).max(1500),
  recommendations: z.array(aiRecommendationSchema).max(20),
  omittedFindingIds: z.array(z.string()).max(100).default([]),
  warnings: z.array(z.string().max(400)).max(10).default([]),
});

// ─── Forbidden claims (§11) ───────────────────────────────────────────────────

interface ForbiddenClaimRule {
  pattern: RegExp;
  message: string;
  fatal: boolean; // true = reject output; false = add to warnings
}

const FORBIDDEN_CLAIM_RULES: ForbiddenClaimRule[] = [
  // Security guarantees
  {
    pattern: /this (website|site|page) is (fully |100% )?(secure|protected)/i,
    message: 'Claims site is secure',
    fatal: false,
  },
  // Compliance claims
  {
    pattern: /this (website|site|page) is (wcag|fully) (compliant|conformant)/i,
    message: 'Claims WCAG compliance',
    fatal: false,
  },
  {
    pattern: /this (website|site|page) is (gdpr|ccpa|hipaa|pci|eaa) (compliant|conformant)/i,
    message: 'Claims legal/regulatory compliance',
    fatal: false,
  },
  // Ranking guarantees
  {
    pattern: /google (will|would|should) (rank|index|penali[sz]e)/i,
    message: 'Claims Google ranking outcome',
    fatal: false,
  },
  {
    pattern: /(guarantees?|will definitely|will certainly) (better|higher|improved) rank/i,
    message: 'Claims ranking guarantee',
    fatal: false,
  },
  // AI citation claims
  {
    pattern: /chatgpt (will|would|can|should) cite/i,
    message: 'Claims ChatGPT citation',
    fatal: false,
  },
  {
    pattern: /(claude|gemini|perplexity|gpt-?4?|llm|ai) (will|would|can|cannot) (read|cite|find|index|see) (this|your) (site|page|content)/i,
    message: 'Claims specific AI system behavior',
    fatal: false,
  },
  // Vulnerability claims
  {
    pattern: /this is (an? )?(confirmed |active |known )?(security )?vulnerability/i,
    message: 'Claims confirmed vulnerability without penetration test',
    fatal: false,
  },
  // Legal requirement claims
  {
    pattern: /this is (legally |legally )?required( by law)?/i,
    message: 'Claims legal requirement',
    fatal: false,
  },
  // Exact improvement promises
  {
    pattern: /will (improve|increase|boost) (performance|score|lcp|ttfb|cls|fid) by exactly/i,
    message: 'Claims exact performance improvement',
    fatal: false,
  },
  // Full site coverage claims
  {
    pattern: /the audit (checked|covered|analyzed) the (entire|full|whole|complete) (website|site)/i,
    message: 'Claims full site coverage',
    fatal: false,
  },
  // Penetration test claims
  {
    pattern: /this (is|represents|constitutes) (an? )?(penetration test|pentest|security assessment|security audit)/i,
    message: 'Claims penetration test',
    fatal: false,
  },
  // Score change claims (score is deterministic — Claude must not claim to change it)
  {
    pattern: /(?:your|the) (?:score|rating) (?:will|would|should) (?:increase|improve|go up|rise)/i,
    message: 'Claims score will change (scores are deterministic)',
    fatal: false,
  },
  // Exposed secrets (fatal — reject immediately)
  {
    pattern: /(?:api[_\-]?key|secret|password|token)\s*[=:]\s*[^\s"']{8,}/i,
    message: 'Output contains what appears to be an exposed secret',
    fatal: true,
  },
  // The website has no issues (deceptive)
  {
    pattern: /this (website|site|page) has no (accessibility|a11y|seo|security|performance) issues/i,
    message: 'Claims site has no issues',
    fatal: false,
  },
];

/**
 * Check a block of text for forbidden claims.
 * Returns an array of triggered rule messages.
 */
export function checkForbiddenClaims(text: string): Array<{ message: string; fatal: boolean }> {
  return FORBIDDEN_CLAIM_RULES
    .filter(({ pattern }) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    })
    .map(({ message, fatal }) => ({ message, fatal }));
}

// ─── Hallucination detection (§10) ───────────────────────────────────────────

/**
 * Detect hallucinated finding references in AI output.
 * Every findingId in recommendations must appear in validFindingIds.
 */
export function detectHallucinatedFindingIds(
  recommendations: AiRecommendation[],
  validFindingIds: Set<string>,
): string[] {
  const issues: string[] = [];
  for (const rec of recommendations) {
    for (const fid of rec.findingIds) {
      if (!validFindingIds.has(fid)) {
        issues.push(
          `Recommendation "${rec.recommendationId}" references unknown findingId "${fid}"`,
        );
      }
    }
  }
  return issues;
}

// ─── Output sanitization ──────────────────────────────────────────────────────

function sanitizeRecommendation(rec: AiRecommendation): AiRecommendation {
  const codeExample = rec.codeExample
    ? {
        ...rec.codeExample,
        before: rec.codeExample.before?.slice(0, 2000),
        after: rec.codeExample.after?.slice(0, 2000),
      }
    : undefined;

  return { ...rec, codeExample };
}

// ─── Main validation function (§9) ───────────────────────────────────────────

/**
 * Validate AI output against the schema, check finding ID references,
 * and detect forbidden claims.
 *
 * Returns a validation result with optional sanitized output.
 * Do not persist output unless `valid === true`.
 */
export function validateAiOutput(
  raw: unknown,
  validFindingIds: Set<string>,
): AiOutputValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Schema validation
  const parseResult = aiRecommendationOutputSchema.safeParse(raw);
  if (!parseResult.success) {
    errors.push(
      ...parseResult.error.issues
        .slice(0, 5)
        .map((i) => `Schema: ${i.path.join('.')} — ${i.message}`),
    );
    return { valid: false, errors, warnings };
  }

  const output = parseResult.data as AiRecommendationOutput;

  // 2. Hallucination detection — finding ID references (§10)
  if (validFindingIds.size > 0) {
    errors.push(...detectHallucinatedFindingIds(output.recommendations, validFindingIds));
  }

  // 3. Forbidden claim rules (§11) across all text fields
  const allText = [
    output.summary,
    ...output.recommendations.flatMap((r) => [
      r.explanation,
      r.impact,
      ...r.implementationSteps,
      ...r.verificationSteps,
      ...(r.assumptions ?? []),
    ]),
    ...output.warnings,
  ].join('\n');

  const forbiddenHits = checkForbiddenClaims(allText);
  for (const { message, fatal } of forbiddenHits) {
    if (fatal) {
      errors.push(`Forbidden: ${message}`);
    } else {
      warnings.push(`Forbidden claim: ${message}`);
    }
  }

  // 4. Sanitize output (cap code block sizes)
  const sanitizedOutput: AiRecommendationOutput = {
    ...output,
    recommendations: output.recommendations.map(sanitizeRecommendation),
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitizedOutput,
  };
}

// ─── Deterministic priority (§13) ────────────────────────────────────────────

/**
 * Calculate recommendation priority deterministically from finding attributes.
 * Claude may explain the priority but must not change it.
 */
export function calculateDeterministicPriority(input: {
  severity: string;
  confidence: string;
  scope: string;
  affectedPages: number;
  criticalFlow: boolean;
  rolloutRisk: string;
}): 'critical' | 'high' | 'medium' | 'low' {
  const { severity, confidence, criticalFlow } = input;

  if (severity === 'critical') return 'critical';

  if (severity === 'high') {
    if (confidence === 'high' || criticalFlow) return 'critical';
    return 'high';
  }

  if (severity === 'medium') {
    if (confidence === 'high' && criticalFlow) return 'high';
    return 'medium';
  }

  return 'low';
}

// ─── Rollout risk classification (§21) ───────────────────────────────────────

const HIGH_RISK_RULE_IDS = new Set([
  'csp', 'content-security-policy',
  'hsts', 'strict-transport-security',
  'permissions-policy', 'feature-policy',
  'coop', 'cross-origin-opener-policy',
  'coep', 'cross-origin-embedder-policy',
  'cors',
  'cookie-samesite',
  'iframe-sandbox',
  'x-frame-options',
]);

/**
 * Classify rollout risk for a given ruleId.
 * Security header changes are always high or very-high risk.
 */
export function classifyRolloutRisk(
  ruleId: string,
  safeToApplyDirectly?: boolean,
): 'low' | 'medium' | 'high' | 'very-high' {
  const normalised = ruleId.toLowerCase().replace(/_/g, '-');
  if (HIGH_RISK_RULE_IDS.has(normalised)) {
    return safeToApplyDirectly ? 'high' : 'very-high';
  }
  if (safeToApplyDirectly) return 'low';
  return 'medium';
}
