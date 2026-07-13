import { describe, it, expect } from 'vitest';
import { generateStatementDraft, STATEMENT_DISCLAIMER, type GenerateStatementOpts } from '@/lib/accessibility/statement-generator';

// Strings that must NEVER appear in any generated accessibility statement
const FORBIDDEN_PHRASES = [
  'guaranteed legal compliance',
  'immunity from lawsuits',
  'certified by a government authority',
  'certified by a government',
  '100% compliant',
  'guaranteed protection from fines',
  'full certification',
  'legally certified',
  'government certified',
];

// Strings that MUST appear in every generated statement
const REQUIRED_PHRASES = [
  'draft',
  'review',
];

const JURISDICTION_IDS = [
  'eu_eaa',
  'eu_public_sector',
  'uk_public_sector',
  'us_section_508',
  'us_ada_title_ii',
  'unknown_jurisdiction',
];

function makeOpts(jurisdictionId: string): GenerateStatementOpts {
  return {
    profile: {
      name:             'Safety Test Site',
      targetMarkets:    [jurisdictionId],
      selectedStandards: ['wcag21_aa'],
    },
    assessment: {
      completedAt:     '2026-07-13',
      coveragePercent: 90,
      riskResult:      null,
    },
    jurisdiction: {
      id:   jurisdictionId,
      name: jurisdictionId,
    },
    knownFindings: [],
    contactInfo:   {},
  };
}

describe('Statement safety invariants (language constraints)', () => {
  for (const jurisdictionId of JURISDICTION_IDS) {
    describe(`jurisdiction: ${jurisdictionId}`, () => {
      const draft = generateStatementDraft(makeOpts(jurisdictionId));
      const text  = JSON.stringify(draft).toLowerCase();

      it('disclaimer is always present and equals STATEMENT_DISCLAIMER', () => {
        expect(draft.disclaimer).toBe(STATEMENT_DISCLAIMER);
      });

      for (const phrase of FORBIDDEN_PHRASES) {
        it(`does not contain "${phrase}"`, () => {
          expect(text).not.toContain(phrase.toLowerCase());
        });
      }

      for (const phrase of REQUIRED_PHRASES) {
        it(`contains required phrase "${phrase}"`, () => {
          expect(text).toContain(phrase.toLowerCase());
        });
      }
    });
  }

  it('disclaimer alone is present even with empty findings', () => {
    const draft = generateStatementDraft(makeOpts('eu_eaa'));
    expect(draft.disclaimer).toBe(STATEMENT_DISCLAIMER);
  });

  it('25+ findings are capped at 20 in knownIssues', () => {
    const findings = Array.from({ length: 25 }, (_, i) => ({
      title:  `Finding ${i}`,
      impact: 'critical',
    }));
    const opts = { ...makeOpts('eu_eaa'), knownFindings: findings };
    const draft = generateStatementDraft(opts);
    expect((draft.knownIssues ?? []).length).toBeLessThanOrEqual(20);
  });
});
