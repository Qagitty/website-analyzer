import { describe, it, expect } from 'vitest';
import {
  RECOMMENDATION_TEMPLATES,
  getTemplate,
  hasTemplate,
  getAllTemplateRuleIds,
  buildTemplateRecommendation,
} from '@/lib/ai/templates';

// ─── Registry completeness ─────────────────────────────────────────────────────

describe('RECOMMENDATION_TEMPLATES registry', () => {
  it('contains at least 10 templates', () => {
    expect(Object.keys(RECOMMENDATION_TEMPLATES).length).toBeGreaterThanOrEqual(10);
  });

  it('every template has required fields', () => {
    for (const [ruleId, t] of Object.entries(RECOMMENDATION_TEMPLATES)) {
      expect(t.ruleId, `${ruleId}.ruleId`).toBe(ruleId);
      expect(t.titleTemplate, `${ruleId}.titleTemplate`).toBeTruthy();
      expect(t.explanationTemplate, `${ruleId}.explanationTemplate`).toBeTruthy();
      expect(t.implementationSteps.length, `${ruleId}.implementationSteps`).toBeGreaterThan(0);
      expect(t.verificationSteps.length, `${ruleId}.verificationSteps`).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', 'very-high']).toContain(t.rolloutRisk);
      expect(typeof t.safeToApplyDirectly).toBe('boolean');
      expect(['quick-win', 'small', 'medium', 'large', 'unknown']).toContain(t.effort);
    }
  });

  it('includes accessibility templates', () => {
    expect(RECOMMENDATION_TEMPLATES['button-name']).toBeDefined();
    expect(RECOMMENDATION_TEMPLATES['image-alt']).toBeDefined();
    expect(RECOMMENDATION_TEMPLATES['label']).toBeDefined();
    expect(RECOMMENDATION_TEMPLATES['color-contrast']).toBeDefined();
    expect(RECOMMENDATION_TEMPLATES['html-has-lang']).toBeDefined();
    expect(RECOMMENDATION_TEMPLATES['iframe-title']).toBeDefined();
  });

  it('includes SEO templates', () => {
    expect(RECOMMENDATION_TEMPLATES['missing-canonical']).toBeDefined();
    expect(RECOMMENDATION_TEMPLATES['missing-meta-description']).toBeDefined();
  });

  it('includes security / best-practices templates', () => {
    expect(RECOMMENDATION_TEMPLATES['missing-nosniff']).toBeDefined();
    expect(RECOMMENDATION_TEMPLATES['missing-x-frame-options']).toBeDefined();
  });

  it('includes performance templates', () => {
    expect(RECOMMENDATION_TEMPLATES['missing-image-dimensions']).toBeDefined();
  });
});

// ─── getTemplate ──────────────────────────────────────────────────────────────

describe('getTemplate', () => {
  it('returns template for known ruleId', () => {
    const t = getTemplate('button-name');
    expect(t).toBeDefined();
    expect(t!.ruleId).toBe('button-name');
  });

  it('returns undefined for unknown ruleId', () => {
    expect(getTemplate('unknown-rule-xyz')).toBeUndefined();
  });

  it('is consistent with RECOMMENDATION_TEMPLATES', () => {
    for (const ruleId of getAllTemplateRuleIds()) {
      expect(getTemplate(ruleId)).toBe(RECOMMENDATION_TEMPLATES[ruleId]);
    }
  });
});

// ─── hasTemplate ──────────────────────────────────────────────────────────────

describe('hasTemplate', () => {
  it('returns true for known ruleId', () => {
    expect(hasTemplate('image-alt')).toBe(true);
    expect(hasTemplate('missing-canonical')).toBe(true);
  });

  it('returns false for unknown ruleId', () => {
    expect(hasTemplate('not-a-rule')).toBe(false);
    expect(hasTemplate('')).toBe(false);
  });
});

// ─── getAllTemplateRuleIds ─────────────────────────────────────────────────────

describe('getAllTemplateRuleIds', () => {
  it('returns an array of strings', () => {
    const ids = getAllTemplateRuleIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.every((id) => typeof id === 'string')).toBe(true);
  });

  it('matches the registry keys', () => {
    expect(new Set(getAllTemplateRuleIds())).toEqual(new Set(Object.keys(RECOMMENDATION_TEMPLATES)));
  });

  it('contains at least 10 entries', () => {
    expect(getAllTemplateRuleIds().length).toBeGreaterThanOrEqual(10);
  });
});

// ─── buildTemplateRecommendation ──────────────────────────────────────────────

describe('buildTemplateRecommendation', () => {
  it('returns undefined for unknown ruleId', () => {
    const result = buildTemplateRecommendation('unknown-rule', 'f-001', 'medium', 1);
    expect(result).toBeUndefined();
  });

  it('returns a complete AiRecommendation for a known ruleId', () => {
    const rec = buildTemplateRecommendation('button-name', 'f-acc-001', 'high', 1);
    expect(rec).toBeDefined();
    expect(rec!.findingIds).toEqual(['f-acc-001']);
    expect(rec!.priority).toBe('high');
    expect(rec!.title).toBe(RECOMMENDATION_TEMPLATES['button-name'].titleTemplate);
    expect(rec!.explanation).toBe(RECOMMENDATION_TEMPLATES['button-name'].explanationTemplate);
    expect(rec!.implementationSteps).toEqual(RECOMMENDATION_TEMPLATES['button-name'].implementationSteps);
    expect(rec!.verificationSteps).toEqual(RECOMMENDATION_TEMPLATES['button-name'].verificationSteps);
    expect(rec!.rolloutRisk).toBe('low');
    expect(rec!.safeToApplyDirectly).toBe(true);
    expect(rec!.effort).toBe('quick-win');
    expect(rec!.categories).toContain('accessibility');
  });

  it('generates stable recommendationId with 3-digit index', () => {
    const rec = buildTemplateRecommendation('image-alt', 'f-001', 'medium', 3);
    expect(rec!.recommendationId).toBe('image-alt-003');
  });

  it('includes fallback limitation note', () => {
    const rec = buildTemplateRecommendation('html-has-lang', 'f-002', 'low', 1);
    expect(rec!.limitations.length).toBeGreaterThan(0);
    expect(rec!.limitations[0]).toContain('deterministic template');
  });

  it('preserves categories from template', () => {
    const rec = buildTemplateRecommendation('missing-canonical', 'f-seo-001', 'medium', 1);
    expect(rec!.categories).toContain('seo');
  });

  it('preserves rolloutRisk from template', () => {
    const rec = buildTemplateRecommendation('missing-x-frame-options', 'f-sec-001', 'high', 1);
    expect(rec!.rolloutRisk).toBe('medium');
    expect(rec!.safeToApplyDirectly).toBe(false);
  });

  it('all templates build valid recommendations without throwing', () => {
    for (const ruleId of getAllTemplateRuleIds()) {
      const rec = buildTemplateRecommendation(ruleId, `f-${ruleId}-001`, 'medium', 1);
      expect(rec, `failed for ${ruleId}`).toBeDefined();
      expect(rec!.findingIds).toHaveLength(1);
      expect(rec!.implementationSteps.length).toBeGreaterThan(0);
      expect(rec!.verificationSteps.length).toBeGreaterThan(0);
    }
  });

  it('different index values produce different recommendationIds', () => {
    const rec1 = buildTemplateRecommendation('label', 'f-001', 'medium', 1);
    const rec2 = buildTemplateRecommendation('label', 'f-002', 'medium', 2);
    expect(rec1!.recommendationId).not.toBe(rec2!.recommendationId);
  });

  it('zero-pads single-digit indexes to 3 chars', () => {
    const rec = buildTemplateRecommendation('color-contrast', 'f-001', 'medium', 5);
    expect(rec!.recommendationId).toBe('color-contrast-005');
  });
});
