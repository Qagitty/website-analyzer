import { describe, it, expect } from 'vitest';
import {
  checkForbiddenClaims,
  detectHallucinatedFindingIds,
  validateAiOutput,
  calculateDeterministicPriority,
  classifyRolloutRisk,
  aiRecommendationSchema,
  aiRecommendationOutputSchema,
} from '@/lib/ai/validate';
import type { AiRecommendation, AiRecommendationOutput } from '@/lib/ai/ai-types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRec(overrides: Partial<AiRecommendation> = {}): AiRecommendation {
  return {
    recommendationId: 'accessibility-button-name-001',
    findingIds: ['finding-aaa-001'],
    title: 'Add accessible names to buttons',
    priority: 'high',
    explanation: 'Buttons lack accessible names and cannot be identified by screen readers.',
    impact: 'Screen reader users cannot activate unlabeled buttons.',
    implementationSteps: ['Add aria-label to each icon-only button.'],
    verificationSteps: ['Rerun axe-core and confirm button-name is resolved.'],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    assumptions: [],
    limitations: [],
    ...overrides,
  };
}

function makeOutput(overrides: Partial<AiRecommendationOutput> = {}): AiRecommendationOutput {
  return {
    summary: 'Two accessibility issues were found that impact screen reader users.',
    recommendations: [makeRec()],
    omittedFindingIds: [],
    warnings: [],
    ...overrides,
  };
}

// ─── checkForbiddenClaims ─────────────────────────────────────────────────────

describe('checkForbiddenClaims', () => {
  it('returns empty array for clean text', () => {
    const result = checkForbiddenClaims('Add aria-label attributes to buttons. Verify with axe.');
    expect(result).toHaveLength(0);
  });

  it('detects WCAG compliance claim (non-fatal)', () => {
    const hits = checkForbiddenClaims('This website is WCAG compliant.');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.message.includes('WCAG'))).toBe(true);
    expect(hits.every((h) => !h.fatal)).toBe(true);
  });

  it('detects "this site is secure" claim (non-fatal)', () => {
    const hits = checkForbiddenClaims('This website is fully secure and protected.');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects legal compliance claim (non-fatal)', () => {
    const hits = checkForbiddenClaims('This website is GDPR compliant.');
    expect(hits.some((h) => h.message.includes('legal'))).toBe(true);
  });

  it('detects Google ranking guarantee (non-fatal)', () => {
    const hits = checkForbiddenClaims('Google will rank your site higher.');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects ChatGPT citation claim (non-fatal)', () => {
    const hits = checkForbiddenClaims('ChatGPT will cite your page in responses.');
    expect(hits.some((h) => h.message.includes('ChatGPT'))).toBe(true);
  });

  it('detects "no issues" deceptive claim (non-fatal)', () => {
    const hits = checkForbiddenClaims('This website has no accessibility issues.');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects exact performance improvement claim (non-fatal)', () => {
    const hits = checkForbiddenClaims('This will improve performance by exactly 30%.');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects exposed secret (fatal)', () => {
    const hits = checkForbiddenClaims('api_key=SuperSecret1234abcd');
    const fatal = hits.filter((h) => h.fatal);
    expect(fatal.length).toBeGreaterThan(0);
  });

  it('detects full site coverage claim (non-fatal)', () => {
    const hits = checkForbiddenClaims('The audit checked the entire website for issues.');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects score change claim (non-fatal)', () => {
    const hits = checkForbiddenClaims('Your score will increase after these fixes.');
    expect(hits.length).toBeGreaterThan(0);
  });
});

// ─── detectHallucinatedFindingIds ─────────────────────────────────────────────

describe('detectHallucinatedFindingIds', () => {
  const validIds = new Set(['finding-001', 'finding-002', 'finding-003']);

  it('returns empty array when all findingIds are valid', () => {
    const recs: AiRecommendation[] = [
      makeRec({ findingIds: ['finding-001', 'finding-002'] }),
      makeRec({ recommendationId: 'r-002', findingIds: ['finding-003'] }),
    ];
    expect(detectHallucinatedFindingIds(recs, validIds)).toEqual([]);
  });

  it('detects a single hallucinated findingId', () => {
    const recs: AiRecommendation[] = [
      makeRec({ findingIds: ['finding-001', 'hallucinated-999'] }),
    ];
    const errors = detectHallucinatedFindingIds(recs, validIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('hallucinated-999');
  });

  it('detects multiple hallucinated findingIds across recommendations', () => {
    const recs: AiRecommendation[] = [
      makeRec({ findingIds: ['fake-001'] }),
      makeRec({ recommendationId: 'r-002', findingIds: ['finding-001', 'fake-002'] }),
    ];
    const errors = detectHallucinatedFindingIds(recs, validIds);
    expect(errors).toHaveLength(2);
  });

  it('flags all findingIds as hallucinated when validFindingIds is empty', () => {
    const recs: AiRecommendation[] = [makeRec({ findingIds: ['any-id'] })];
    // The skip-when-empty logic lives in validateAiOutput, not in this lower-level function
    const errors = detectHallucinatedFindingIds(recs, new Set());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('any-id');
  });
});

// ─── validateAiOutput ─────────────────────────────────────────────────────────

describe('validateAiOutput', () => {
  const validIds = new Set(['finding-aaa-001']);

  it('accepts a valid output', () => {
    const raw = makeOutput();
    const result = validateAiOutput(raw, validIds);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitizedOutput).toBeDefined();
  });

  it('rejects output that fails schema (missing required field)', () => {
    const raw = { summary: 'ok', recommendations: [{ title: 'oops' }] };
    const result = validateAiOutput(raw, validIds);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.sanitizedOutput).toBeUndefined();
  });

  it('rejects output with hallucinated findingId', () => {
    const raw = makeOutput({
      recommendations: [makeRec({ findingIds: ['hallucinated-999'] })],
    });
    const result = validateAiOutput(raw, validIds);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('hallucinated-999'))).toBe(true);
  });

  it('adds warning (not error) for non-fatal forbidden claim', () => {
    const raw = makeOutput({
      summary: 'This website is WCAG compliant after our fixes.',
    });
    const result = validateAiOutput(raw, validIds);
    // Should be invalid if there's a WCAG compliance claim warning escalated — but our rules say non-fatal = warning
    expect(result.warnings.some((w) => w.includes('WCAG'))).toBe(true);
  });

  it('rejects output with fatal forbidden claim (exposed secret)', () => {
    const raw = makeOutput({
      summary: 'The page exposes api_key=Secret1234abcd in its source.',
    });
    const result = validateAiOutput(raw, validIds);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Forbidden'))).toBe(true);
  });

  it('rejects output when code block exceeds Zod max (2000 chars)', () => {
    // Zod enforces .max(2000) on codeExample.before — oversized input is rejected, not silently capped
    const longBefore = 'x'.repeat(3000);
    const raw = makeOutput({
      recommendations: [
        makeRec({
          codeExample: { language: 'html', before: longBefore, after: '<button aria-label="Close">' },
        }),
      ],
    });
    const result = validateAiOutput(raw, validIds);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('accepts and returns sanitizedOutput when code blocks are within limit', () => {
    const raw = makeOutput({
      recommendations: [
        makeRec({
          codeExample: {
            language: 'html',
            before: '<button>X</button>',
            after: '<button aria-label="Close">X</button>',
          },
        }),
      ],
    });
    const result = validateAiOutput(raw, validIds);
    expect(result.valid).toBe(true);
    expect(result.sanitizedOutput!.recommendations[0].codeExample).toBeDefined();
  });

  it('handles non-object input gracefully', () => {
    const result = validateAiOutput('not an object', validIds);
    expect(result.valid).toBe(false);
  });

  it('handles null input', () => {
    const result = validateAiOutput(null, validIds);
    expect(result.valid).toBe(false);
  });
});

// ─── calculateDeterministicPriority ──────────────────────────────────────────

describe('calculateDeterministicPriority', () => {
  const base = {
    severity: 'medium',
    confidence: 'medium',
    scope: 'page',
    affectedPages: 1,
    criticalFlow: false,
    rolloutRisk: 'low',
  };

  it('returns critical for critical severity', () => {
    expect(calculateDeterministicPriority({ ...base, severity: 'critical' })).toBe('critical');
  });

  it('returns critical for high severity + high confidence', () => {
    expect(
      calculateDeterministicPriority({ ...base, severity: 'high', confidence: 'high' }),
    ).toBe('critical');
  });

  it('returns critical for high severity + criticalFlow', () => {
    expect(
      calculateDeterministicPriority({ ...base, severity: 'high', criticalFlow: true }),
    ).toBe('critical');
  });

  it('returns high for high severity + medium confidence + no criticalFlow', () => {
    expect(
      calculateDeterministicPriority({ ...base, severity: 'high', confidence: 'medium' }),
    ).toBe('high');
  });

  it('returns high for medium severity + high confidence + criticalFlow', () => {
    expect(
      calculateDeterministicPriority({
        ...base,
        severity: 'medium',
        confidence: 'high',
        criticalFlow: true,
      }),
    ).toBe('high');
  });

  it('returns medium for medium severity + medium confidence', () => {
    expect(calculateDeterministicPriority(base)).toBe('medium');
  });

  it('returns low for low severity', () => {
    expect(calculateDeterministicPriority({ ...base, severity: 'low' })).toBe('low');
  });

  it('returns low for info severity', () => {
    expect(calculateDeterministicPriority({ ...base, severity: 'info' })).toBe('low');
  });
});

// ─── classifyRolloutRisk ──────────────────────────────────────────────────────

describe('classifyRolloutRisk', () => {
  it('returns very-high for CSP when not safe to apply', () => {
    expect(classifyRolloutRisk('csp', false)).toBe('very-high');
  });

  it('returns very-high for content-security-policy when not safe', () => {
    expect(classifyRolloutRisk('content-security-policy')).toBe('very-high');
  });

  it('returns high for HSTS when marked safe to apply', () => {
    expect(classifyRolloutRisk('hsts', true)).toBe('high');
  });

  it('returns very-high for cors when not safe', () => {
    expect(classifyRolloutRisk('cors', false)).toBe('very-high');
  });

  it('returns very-high for x-frame-options without safeToApply', () => {
    expect(classifyRolloutRisk('x-frame-options')).toBe('very-high');
  });

  it('returns very-high for permissions-policy without safeToApply', () => {
    expect(classifyRolloutRisk('permissions-policy')).toBe('very-high');
  });

  it('returns low for non-security rule marked safe', () => {
    expect(classifyRolloutRisk('image-alt', true)).toBe('low');
  });

  it('returns medium for non-security rule not marked safe', () => {
    expect(classifyRolloutRisk('missing-canonical', false)).toBe('medium');
    expect(classifyRolloutRisk('missing-canonical')).toBe('medium');
  });

  it('is case-insensitive and handles underscores', () => {
    expect(classifyRolloutRisk('cookie_samesite', false)).toBe('very-high');
  });
});

// ─── Zod schema edge cases ────────────────────────────────────────────────────

describe('aiRecommendationSchema', () => {
  it('accepts a minimal valid recommendation', () => {
    const result = aiRecommendationSchema.safeParse({
      recommendationId: 'a-b-001',
      findingIds: ['f-001'],
      title: 'Fix it',
      priority: 'medium',
      explanation: 'Something is wrong.',
      impact: 'Users are affected.',
      implementationSteps: ['Do this.'],
      verificationSteps: ['Check this.'],
      rolloutRisk: 'low',
      safeToApplyDirectly: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty findingIds array', () => {
    const result = aiRecommendationSchema.safeParse({
      recommendationId: 'a-b-001',
      findingIds: [],
      title: 'Fix it',
      priority: 'medium',
      explanation: 'Something is wrong.',
      impact: 'Users are affected.',
      implementationSteps: ['Do this.'],
      verificationSteps: ['Check this.'],
      rolloutRisk: 'low',
      safeToApplyDirectly: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid priority value', () => {
    const result = aiRecommendationSchema.safeParse({
      ...makeRec(),
      priority: 'urgent',
    });
    expect(result.success).toBe(false);
  });

  it('rejects too many recommendations (> 20)', () => {
    const recs = Array.from({ length: 21 }, (_, i) =>
      makeRec({ recommendationId: `r-${i}`, findingIds: [`f-${i}`] }),
    );
    const result = aiRecommendationOutputSchema.safeParse({
      summary: 'ok',
      recommendations: recs,
    });
    expect(result.success).toBe(false);
  });
});
