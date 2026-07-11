/**
 * Accessibility standards registry.
 *
 * Each entry is a versioned technical standard — not a legal requirement.
 * Whether a standard applies to a specific organization in a specific
 * jurisdiction is a separate determination outside this registry.
 */

import type { AccessibilityStandardId, AccessibilityStandardSpec } from '@/types/accessibility-profile';

export const ACCESSIBILITY_STANDARDS: Record<AccessibilityStandardId, AccessibilityStandardSpec> = {
  wcag_2_1_a: {
    id:              'wcag_2_1_a',
    name:            'Web Content Accessibility Guidelines 2.1 — Level A',
    shortName:       'WCAG 2.1 A',
    version:         '2.1',
    conformanceLevel: 'A',
    issuingBody:     'W3C Web Accessibility Initiative (WAI)',
    effectiveDate:   '2018-06-05',
    relatedStandards: ['wcag_2_1_aa', 'wcag_2_2_a'],
    summary:         'Level A conformance: the minimum set of success criteria that must be satisfied for web content to be accessible to people with disabilities. Level A does not claim full accessibility — it is the floor, not the ceiling.',
  },
  wcag_2_1_aa: {
    id:              'wcag_2_1_aa',
    name:            'Web Content Accessibility Guidelines 2.1 — Level AA',
    shortName:       'WCAG 2.1 AA',
    version:         '2.1',
    conformanceLevel: 'AA',
    issuingBody:     'W3C Web Accessibility Initiative (WAI)',
    effectiveDate:   '2018-06-05',
    relatedStandards: ['wcag_2_1_a', 'wcag_2_2_aa', 'en_301_549_relevant_web', 'section_508_web'],
    summary:         'Level AA conformance: the most commonly referenced conformance target. Includes all Level A and Level AA success criteria. Referenced by many accessibility regulations worldwide as the technical standard, although regulatory applicability varies by jurisdiction.',
  },
  wcag_2_1_aaa: {
    id:              'wcag_2_1_aaa',
    name:            'Web Content Accessibility Guidelines 2.1 — Level AAA',
    shortName:       'WCAG 2.1 AAA',
    version:         '2.1',
    conformanceLevel: 'AAA',
    issuingBody:     'W3C Web Accessibility Initiative (WAI)',
    effectiveDate:   '2018-06-05',
    relatedStandards: ['wcag_2_1_aa'],
    summary:         'Level AAA conformance: the highest conformance level. W3C does not recommend Level AAA as a general conformance target for entire websites, as it is not possible to satisfy all criteria for all types of content.',
  },
  wcag_2_2_a: {
    id:              'wcag_2_2_a',
    name:            'Web Content Accessibility Guidelines 2.2 — Level A',
    shortName:       'WCAG 2.2 A',
    version:         '2.2',
    conformanceLevel: 'A',
    issuingBody:     'W3C Web Accessibility Initiative (WAI)',
    effectiveDate:   '2023-10-05',
    relatedStandards: ['wcag_2_2_aa', 'wcag_2_1_a'],
    summary:         'WCAG 2.2 Level A. Backwards-compatible with WCAG 2.1 A, with one criterion (4.1.1 Parsing) removed and new criteria added. Regulatory adoption of WCAG 2.2 varies by jurisdiction as of this writing.',
  },
  wcag_2_2_aa: {
    id:              'wcag_2_2_aa',
    name:            'Web Content Accessibility Guidelines 2.2 — Level AA',
    shortName:       'WCAG 2.2 AA',
    version:         '2.2',
    conformanceLevel: 'AA',
    issuingBody:     'W3C Web Accessibility Initiative (WAI)',
    effectiveDate:   '2023-10-05',
    relatedStandards: ['wcag_2_2_a', 'wcag_2_1_aa'],
    summary:         'WCAG 2.2 Level AA. Includes 9 new success criteria over WCAG 2.1 AA, primarily focusing on cognitive accessibility and mobile. Removes 4.1.1 Parsing. Regulatory adoption varies — consult jurisdiction profiles for specific requirements.',
  },
  wcag_2_2_aaa: {
    id:              'wcag_2_2_aaa',
    name:            'Web Content Accessibility Guidelines 2.2 — Level AAA',
    shortName:       'WCAG 2.2 AAA',
    version:         '2.2',
    conformanceLevel: 'AAA',
    issuingBody:     'W3C Web Accessibility Initiative (WAI)',
    effectiveDate:   '2023-10-05',
    relatedStandards: ['wcag_2_2_aa'],
    summary:         'WCAG 2.2 Level AAA. The highest conformance level for WCAG 2.2.',
  },
  en_301_549_relevant_web: {
    id:          'en_301_549_relevant_web',
    name:        'EN 301 549 V3.2.1 — Web requirements (Clauses 9 and 10)',
    shortName:   'EN 301 549 (web)',
    version:     '3.2.1',
    issuingBody: 'European Telecommunications Standards Institute (ETSI)',
    relatedStandards: ['wcag_2_1_aa'],
    summary:     'European Standard for accessibility requirements for ICT products and services. Web content requirements in Clause 9 correspond to WCAG 2.1 Level AA. Referenced by the EU Web Accessibility Directive and incorporated into the European Accessibility Act. EN 301 549 applicability to specific organizations is governed by EU directives and national transpositions — not by this standard alone.',
  },
  section_508_web: {
    id:           'section_508_web',
    name:         'Section 508 of the Rehabilitation Act — Web ICT (2017 Refresh)',
    shortName:    'Section 508 (web)',
    version:      '2017',
    issuingBody:  'US Access Board',
    effectiveDate: '2018-01-18',
    relatedStandards: ['wcag_2_1_aa'],
    summary:      'The 2017 Section 508 refresh incorporates WCAG 2.0 Level A and AA by reference for web ICT. Section 508 applies specifically to US federal agencies and certain contractors. Whether Section 508 applies to a private organization depends on their federal contract relationships — not on technical website characteristics alone.',
  },
};

export function getStandard(id: AccessibilityStandardId): AccessibilityStandardSpec {
  return ACCESSIBILITY_STANDARDS[id];
}

export function getStandardShortName(id: AccessibilityStandardId): string {
  return ACCESSIBILITY_STANDARDS[id]?.shortName ?? id;
}

export function getRelatedStandards(id: AccessibilityStandardId): AccessibilityStandardSpec[] {
  const spec = ACCESSIBILITY_STANDARDS[id];
  if (!spec?.relatedStandards) return [];
  return spec.relatedStandards.map((rid) => ACCESSIBILITY_STANDARDS[rid]).filter(Boolean);
}

export const ALL_STANDARD_IDS = Object.keys(ACCESSIBILITY_STANDARDS) as AccessibilityStandardId[];
