import { describe, it, expect } from 'vitest';
import {
  generateStatementDraft,
  STATEMENT_DISCLAIMER,
  STATEMENT_TEMPLATES,
  type GenerateStatementOpts,
} from '@/lib/accessibility/statement-generator';

const BASE_OPTS: GenerateStatementOpts = {
  profile: {
    name:             'Test Site',
    targetMarkets:    ['eu_eaa'],
    selectedStandards: ['wcag21_aa'],
  },
  assessment: {
    completedAt:     '2026-07-13',
    coveragePercent: 80,
    riskResult:      null,
  },
  jurisdiction: {
    id:   'eu_eaa',
    name: 'EU — European Accessibility Act',
  },
  knownFindings: [],
  contactInfo:   {},
};

describe('STATEMENT_DISCLAIMER', () => {
  it('is non-empty', () => {
    expect(STATEMENT_DISCLAIMER.length).toBeGreaterThan(50);
  });

  it('contains DRAFT marker', () => {
    expect(STATEMENT_DISCLAIMER).toContain('DRAFT');
  });

  it('contains "review" language', () => {
    expect(STATEMENT_DISCLAIMER.toLowerCase()).toContain('review');
  });

  it('never uses forbidden language', () => {
    const text = STATEMENT_DISCLAIMER.toLowerCase();
    expect(text).not.toContain('guaranteed legal compliance');
    expect(text).not.toContain('immunity from lawsuits');
    expect(text).not.toContain('certified by a government');
    expect(text).not.toContain('100% compliant');
  });
});

describe('STATEMENT_TEMPLATES', () => {
  it('has at least 3 templates', () => {
    expect(Object.keys(STATEMENT_TEMPLATES).length).toBeGreaterThanOrEqual(3);
  });

  it('each template has jurisdictionId and requiredSections', () => {
    for (const [, tpl] of Object.entries(STATEMENT_TEMPLATES)) {
      expect(typeof tpl.jurisdictionId).toBe('string');
      expect(Array.isArray(tpl.requiredSections)).toBe(true);
    }
  });

  it('each template embeds the STATEMENT_DISCLAIMER', () => {
    for (const [, tpl] of Object.entries(STATEMENT_TEMPLATES)) {
      expect(tpl.disclaimer).toBe(STATEMENT_DISCLAIMER);
    }
  });
});

describe('generateStatementDraft', () => {
  it('returns an object with a disclaimer field', () => {
    const draft = generateStatementDraft(BASE_OPTS);
    expect(draft.disclaimer).toBe(STATEMENT_DISCLAIMER);
  });

  it('always includes the DRAFT disclaimer regardless of jurisdiction', () => {
    const draft1 = generateStatementDraft(BASE_OPTS);
    const draft2 = generateStatementDraft({
      ...BASE_OPTS,
      jurisdiction: { id: 'us_section_508', name: 'US Section 508' },
    });
    expect(draft1.disclaimer).toBe(STATEMENT_DISCLAIMER);
    expect(draft2.disclaimer).toBe(STATEMENT_DISCLAIMER);
  });

  it('caps knownIssues at 20', () => {
    const findings = Array.from({ length: 30 }, (_, i) => ({
      title:  `Finding ${i}`,
      impact: 'serious',
    }));
    const draft = generateStatementDraft({ ...BASE_OPTS, knownFindings: findings });
    expect((draft.knownIssues ?? []).length).toBeLessThanOrEqual(20);
  });

  it('never claims certification or 100% compliance', () => {
    const draft = generateStatementDraft(BASE_OPTS);
    const text = JSON.stringify(draft).toLowerCase();
    expect(text).not.toContain('certified by a government');
    expect(text).not.toContain('100% compliant');
    expect(text).not.toContain('guaranteed legal compliance');
    expect(text).not.toContain('immunity from lawsuits');
  });

  it('works with unknown jurisdiction', () => {
    expect(() =>
      generateStatementDraft({
        ...BASE_OPTS,
        jurisdiction: { id: 'unknown_jurisdiction', name: 'Unknown' },
      }),
    ).not.toThrow();
  });
});
