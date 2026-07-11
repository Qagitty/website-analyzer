/**
 * Tests for the accessibility jurisdiction registry, standards registry,
 * risk model, and applicability logic.
 */

import { describe, it, expect } from 'vitest';
import {
  JURISDICTION_REGISTRY,
  getJurisdictionProfile,
  getAvailableJurisdictions,
  getPlannedJurisdictions,
  REGISTRY_VERSION,
} from '@/lib/accessibility/jurisdictions';
import {
  ACCESSIBILITY_STANDARDS,
  getStandard,
  getStandardShortName,
  ALL_STANDARD_IDS,
} from '@/lib/accessibility/standards';
import {
  calculateRiskDimensions,
  calculateRiskScore,
  scoreToRiskLevel,
  assessRisk,
  RISK_WEIGHTS,
} from '@/lib/accessibility/risk-model';
import {
  assessApplicability,
  assessMultipleJurisdictions,
} from '@/lib/accessibility/applicability';
import type { AccessibilityJurisdictionId } from '@/types/accessibility-profile';

// ── Standards registry ────────────────────────────────────────────────────────

describe('accessibility standards registry', () => {
  it('contains all expected standard IDs', () => {
    expect(ALL_STANDARD_IDS).toContain('wcag_2_1_aa');
    expect(ALL_STANDARD_IDS).toContain('wcag_2_2_aa');
    expect(ALL_STANDARD_IDS).toContain('en_301_549_relevant_web');
    expect(ALL_STANDARD_IDS).toContain('section_508_web');
  });

  it('each standard has required fields', () => {
    for (const id of ALL_STANDARD_IDS) {
      const std = getStandard(id);
      expect(std.id, `${id} missing id`).toBeTruthy();
      expect(std.name, `${id} missing name`).toBeTruthy();
      expect(std.shortName, `${id} missing shortName`).toBeTruthy();
      expect(std.issuingBody, `${id} missing issuingBody`).toBeTruthy();
      expect(std.summary, `${id} missing summary`).toBeTruthy();
    }
  });

  it('getStandardShortName returns shortName', () => {
    expect(getStandardShortName('wcag_2_1_aa')).toBe('WCAG 2.1 AA');
    expect(getStandardShortName('en_301_549_relevant_web')).toBe('EN 301 549 (web)');
  });

  it('no standard summary claims to be a legal compliance certification', () => {
    for (const id of ALL_STANDARD_IDS) {
      const std = ACCESSIBILITY_STANDARDS[id];
      expect(std.summary.toLowerCase()).not.toContain('legal compliance certification');
      expect(std.summary.toLowerCase()).not.toContain('guaranteed');
    }
  });
});

// ── Jurisdiction registry ─────────────────────────────────────────────────────

describe('jurisdiction registry', () => {
  const allIds: AccessibilityJurisdictionId[] = Object.keys(JURISDICTION_REGISTRY) as AccessibilityJurisdictionId[];

  it('contains all expected jurisdiction IDs', () => {
    const expected: AccessibilityJurisdictionId[] = [
      'eu_eaa', 'eu_public_sector', 'us_ada_title_ii', 'us_section_508',
      'uk_public_sector', 'international_wcag',
    ];
    for (const id of expected) {
      expect(JURISDICTION_REGISTRY[id], `Missing ${id}`).toBeDefined();
    }
  });

  it('each profile has required fields', () => {
    for (const id of allIds) {
      const p = JURISDICTION_REGISTRY[id];
      expect(p.id, `${id} missing id`).toBeTruthy();
      expect(p.version, `${id} missing version`).toBeTruthy();
      expect(p.name, `${id} missing name`).toBeTruthy();
      expect(p.disclaimers.length, `${id} missing disclaimers`).toBeGreaterThan(0);
    }
  });

  it('all profiles have at least one disclaimer', () => {
    for (const id of allIds) {
      const p = JURISDICTION_REGISTRY[id];
      expect(p.disclaimers.length).toBeGreaterThan(0);
      // First disclaimer must be the universal disclaimer
      expect(p.disclaimers[0]).toContain('not legal advice');
    }
  });

  it('all profiles have a version string matching YYYY-MM-DD.N format', () => {
    for (const id of allIds) {
      const p = JURISDICTION_REGISTRY[id];
      expect(p.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    }
  });

  it('REGISTRY_VERSION matches expected format', () => {
    expect(REGISTRY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it('getAvailableJurisdictions returns only non-planned profiles', () => {
    const available = getAvailableJurisdictions();
    expect(available.length).toBeGreaterThan(0);
    for (const p of available) {
      expect(p.supportLevel).not.toBe('planned');
    }
  });

  it('getPlannedJurisdictions returns only planned profiles', () => {
    const planned = getPlannedJurisdictions();
    for (const p of planned) {
      expect(p.supportLevel).toBe('planned');
    }
  });

  it('full-support profiles have applicability questions', () => {
    for (const id of allIds) {
      const p = JURISDICTION_REGISTRY[id];
      if (p.supportLevel === 'full') {
        expect(p.applicabilityQuestions.length, `${id} missing questions`).toBeGreaterThan(0);
      }
    }
  });

  it('no profile name claims to guarantee compliance or certification', () => {
    for (const id of allIds) {
      const p = JURISDICTION_REGISTRY[id];
      expect(p.name.toLowerCase()).not.toContain('certified');
      expect(p.name.toLowerCase()).not.toContain('compliant');
      expect(p.name.toLowerCase()).not.toContain('guarantee');
    }
  });

  it('getJurisdictionProfile returns the correct profile', () => {
    const p = getJurisdictionProfile('eu_eaa');
    expect(p.id).toBe('eu_eaa');
    expect(p.region).toBe('European Union');
  });

  it('EU EAA profile references EN 301 549 standard', () => {
    const p = getJurisdictionProfile('eu_eaa');
    const stdIds = p.technicalStandards.map((s) => s.standardId);
    expect(stdIds).toContain('en_301_549_relevant_web');
  });

  it('statement requirements draftWarning is never empty for profiles with required=true', () => {
    for (const id of allIds) {
      const p = JURISDICTION_REGISTRY[id];
      if (p.statementRequirements.required) {
        expect(p.statementRequirements.draftWarning, `${id} missing draftWarning`).toBeTruthy();
      }
    }
  });
});

// ── Risk model ────────────────────────────────────────────────────────────────

describe('risk model', () => {
  it('RISK_WEIGHTS sum to 1.0', () => {
    const sum = Object.values(RISK_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it('zero findings = low risk', () => {
    const result = assessRisk({
      findings: [],
      totalPages: 5,
      manualChecks: { total: 3, completed: 3 },
      evidence: {
        hasBaselineAssessment: true,
        hasManualChecks: true,
        hasRemediationPlan: true,
        hasAccessibilityStatement: true,
        assessmentAgeInDays: 7,
      },
    });
    expect(['low', 'moderate']).toContain(result.riskLevel);
  });

  it('many critical findings on many pages = high or critical risk', () => {
    const findings = Array.from({ length: 20 }, (_, i) => ({
      impact: 'critical' as const,
      pageUrl: `https://example.com/page-${i}`,
      ruleId: `rule-${i % 3}`,
      ageInDays: 120,
      isCriticalJourney: true,
      status: 'open',
    }));
    const result = assessRisk({
      findings,
      totalPages: 20,
      manualChecks: { total: 5, completed: 0 },
      evidence: {
        hasBaselineAssessment: false,
        hasManualChecks: false,
        hasRemediationPlan: false,
        hasAccessibilityStatement: false,
        assessmentAgeInDays: null,
      },
    });
    expect(['high', 'critical']).toContain(result.riskLevel);
  });

  it('risk score is clamped between 0 and 100', () => {
    const dims = calculateRiskDimensions({
      findings: [],
      totalPages: 0,
      manualChecks: { total: 0, completed: 0 },
      evidence: {
        hasBaselineAssessment: false,
        hasManualChecks: false,
        hasRemediationPlan: false,
        hasAccessibilityStatement: false,
        assessmentAgeInDays: null,
      },
    });
    const score = calculateRiskScore(dims);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scoreToRiskLevel returns correct levels at boundaries', () => {
    expect(scoreToRiskLevel(0)).toBe('low');
    expect(scoreToRiskLevel(24)).toBe('low');
    expect(scoreToRiskLevel(25)).toBe('moderate');
    expect(scoreToRiskLevel(50)).toBe('high');
    expect(scoreToRiskLevel(75)).toBe('critical');
    expect(scoreToRiskLevel(100)).toBe('critical');
  });

  it('risk assessment always includes a scopeNote', () => {
    const result = assessRisk({
      findings: [],
      totalPages: 1,
      manualChecks: { total: 0, completed: 0 },
      evidence: {
        hasBaselineAssessment: false,
        hasManualChecks: false,
        hasRemediationPlan: false,
        hasAccessibilityStatement: false,
        assessmentAgeInDays: null,
      },
    });
    expect(result.scopeNote).toBeTruthy();
    expect(result.scopeNote).toContain('automated scanning');
  });

  it('completed evidence reduces risk relative to no evidence', () => {
    const base = {
      findings: [],
      totalPages: 5,
      manualChecks: { total: 3, completed: 3 },
    };
    const withEvidence = assessRisk({
      ...base,
      evidence: {
        hasBaselineAssessment: true,
        hasManualChecks: true,
        hasRemediationPlan: true,
        hasAccessibilityStatement: true,
        assessmentAgeInDays: 7,
      },
    });
    const withoutEvidence = assessRisk({
      ...base,
      evidence: {
        hasBaselineAssessment: false,
        hasManualChecks: false,
        hasRemediationPlan: false,
        hasAccessibilityStatement: false,
        assessmentAgeInDays: null,
      },
    });
    const withScore    = calculateRiskScore(withEvidence.dimensions);
    const withoutScore = calculateRiskScore(withoutEvidence.dimensions);
    expect(withScore).toBeLessThanOrEqual(withoutScore);
  });
});

// ── Applicability ─────────────────────────────────────────────────────────────

describe('applicability assessment', () => {
  it('EU EAA: not applicable when clearly not serving EU', () => {
    const result = assessApplicability('eu_eaa', { eu_eaa_q1: false });
    expect(result.result).toBe('not_applicable_likely');
    expect(result.requiresExpertReview).toBe(false);
  });

  it('EU EAA: potentially_applicable when serving EU with covered services', () => {
    const result = assessApplicability('eu_eaa', {
      eu_eaa_q1: true,
      eu_eaa_q2: false,
      eu_eaa_q3: ['ecommerce'],
    });
    expect(result.result).toBe('potentially_applicable');
    expect(result.requiresExpertReview).toBe(true);
  });

  it('EU EAA: review_recommended when micro-enterprise', () => {
    const result = assessApplicability('eu_eaa', {
      eu_eaa_q1: true,
      eu_eaa_q2: true,
      eu_eaa_q3: ['ecommerce'],
    });
    expect(result.result).toBe('review_recommended');
    expect(result.requiresExpertReview).toBe(true);
  });

  it('EU EAA: not_enough_information when no answers', () => {
    const result = assessApplicability('eu_eaa', {});
    expect(result.result).toBe('not_enough_information');
  });

  it('US Section 508: potentially_applicable when federal agency', () => {
    const result = assessApplicability('us_section_508', {
      us_508_q1: true,
      us_508_q2: false,
    });
    expect(result.result).toBe('potentially_applicable');
  });

  it('US Section 508: not_applicable_likely when no federal relationship', () => {
    const result = assessApplicability('us_section_508', {
      us_508_q1: false,
      us_508_q2: false,
    });
    expect(result.result).toBe('not_applicable_likely');
  });

  it('UK public sector: not_applicable_likely for private company', () => {
    const result = assessApplicability('uk_public_sector', { uk_pub_q1: false });
    expect(result.result).toBe('not_applicable_likely');
  });

  it('international WCAG: always at least may_apply', () => {
    const result = assessApplicability('international_wcag', {});
    expect(result.result).toBe('may_apply');
  });

  it('planned jurisdictions return not_enough_information', () => {
    const result = assessApplicability('canada_federal', {});
    expect(result.result).toBe('not_enough_information');
    expect(result.requiresExpertReview).toBe(true);
  });

  it('all results include universal disclaimer caveats', () => {
    const jurisdictions: AccessibilityJurisdictionId[] = ['eu_eaa', 'us_section_508', 'international_wcag'];
    for (const id of jurisdictions) {
      const result = assessApplicability(id, {});
      const text = result.caveats.join(' ').toLowerCase();
      expect(text.includes('legal advice') || text.includes('legal counsel')).toBe(true);
    }
  });

  it('all results include profileVersion', () => {
    const result = assessApplicability('eu_eaa', { eu_eaa_q1: true });
    expect(result.profileVersion).toBeTruthy();
    expect(result.profileVersion).toContain('2026-07-11');
  });

  it('assessMultipleJurisdictions returns one result per jurisdiction', () => {
    const results = assessMultipleJurisdictions(['eu_eaa', 'international_wcag'], {
      eu_eaa_q1: true,
    });
    expect(results).toHaveLength(2);
    expect(results[0].jurisdictionId).toBe('eu_eaa');
    expect(results[1].jurisdictionId).toBe('international_wcag');
  });

  it('no applicability result claims compliance or certification', () => {
    const jurisdictions: AccessibilityJurisdictionId[] = ['eu_eaa', 'eu_public_sector', 'us_ada_title_ii', 'international_wcag'];
    for (const id of jurisdictions) {
      const result = assessApplicability(id, { [Object.keys({})[0] ?? 'x']: true });
      expect(result.explanation.toLowerCase()).not.toContain('legally compliant');
      expect(result.explanation.toLowerCase()).not.toContain('certified');
      expect(result.explanation.toLowerCase()).not.toContain('guarantees');
    }
  });
});

// ── ComplianceLevel migration ──────────────────────────────────────────────────

describe('compliance level migration', () => {
  it('getComplianceLevel returns no_blockers for empty issues', async () => {
    const { getComplianceLevel } = await import('@/lib/compliance');
    expect(getComplianceLevel([])).toBe('no_blockers');
  });

  it('getComplianceLevel returns gaps for moderate issues only', async () => {
    const { getComplianceLevel } = await import('@/lib/compliance');
    const issues = [{ id: 'x', impact: 'moderate' as const, description: '', nodes: [], wcagCriteria: [] }];
    expect(getComplianceLevel(issues)).toBe('gaps');
  });

  it('getComplianceLevel returns blockers for critical issues', async () => {
    const { getComplianceLevel } = await import('@/lib/compliance');
    const issues = [{ id: 'x', impact: 'critical' as const, description: '', nodes: [], wcagCriteria: [] }];
    expect(getComplianceLevel(issues)).toBe('blockers');
  });

  it('COMPLIANCE_CONFIG uses correct new keys', async () => {
    const { COMPLIANCE_CONFIG } = await import('@/lib/compliance');
    expect(COMPLIANCE_CONFIG.no_blockers).toBeDefined();
    expect(COMPLIANCE_CONFIG.gaps).toBeDefined();
    expect(COMPLIANCE_CONFIG.blockers).toBeDefined();
  });

  it('COMPLIANCE_CONFIG labels are not overbroad legal claims', async () => {
    const { COMPLIANCE_CONFIG } = await import('@/lib/compliance');
    for (const [, cfg] of Object.entries(COMPLIANCE_CONFIG)) {
      expect(cfg.label.toLowerCase()).not.toBe('compliant');
      expect(cfg.label.toLowerCase()).not.toContain('legally compliant');
      expect(cfg.label.toLowerCase()).not.toContain('certified');
    }
  });
});
