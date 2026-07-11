/**
 * Accessibility applicability assessment.
 *
 * Takes a set of questionnaire answers and a jurisdiction profile,
 * and returns a conservative applicability result.
 *
 * CRITICAL DESIGN PRINCIPLE:
 *  This module must NEVER determine that a jurisdiction definitely does not apply.
 *  When in doubt, return 'review_recommended' rather than 'not_applicable_likely'.
 *  Only return 'not_applicable_likely' when there is strong affirmative evidence
 *  that the jurisdiction cannot apply (e.g., US federal law asked about EU-only org).
 *
 * This module does NOT provide legal advice.
 */

import type {
  AccessibilityJurisdictionId,
  ApplicabilityResultCode,
  AccessibilityApplicabilityResult,
} from '@/types/accessibility-profile';
import { APPLICABILITY_LABELS } from '@/types/accessibility-profile';
import { getJurisdictionProfile } from './jurisdictions';
import { REGISTRY_VERSION } from './jurisdictions';

// ── Answer types ──────────────────────────────────────────────────────────────

export type QuestionAnswer = boolean | string | string[] | null | undefined;

export interface ApplicabilityAnswers {
  [questionId: string]: QuestionAnswer;
}

// ── Per-jurisdiction logic ────────────────────────────────────────────────────

function assessEuEaa(answers: ApplicabilityAnswers): ApplicabilityResultCode {
  const servesEu   = answers['eu_eaa_q1'];
  const isMicro    = answers['eu_eaa_q2'];
  const activities = answers['eu_eaa_q3'] as string[] | undefined;

  if (servesEu === false) return 'not_applicable_likely';
  if (servesEu !== true)  return 'not_enough_information';

  // Serves EU confirmed
  const coveredActivities = (activities ?? []).filter((a) => a !== 'none');
  if (coveredActivities.length === 0) return 'may_apply';
  if (isMicro === true)  return 'review_recommended'; // micro-enterprise exemption needs legal review
  return 'potentially_applicable';
}

function assessEuPublicSector(answers: ApplicabilityAnswers): ApplicabilityResultCode {
  const isPublicSector = answers['eu_pub_q1'];
  const hasWebServices = answers['eu_pub_q2'];

  if (isPublicSector === false) return 'not_applicable_likely';
  if (isPublicSector !== true)  return 'not_enough_information';
  if (hasWebServices === false)  return 'review_recommended';
  return 'potentially_applicable';
}

function assessUsAdaTitleIi(answers: ApplicabilityAnswers): ApplicabilityResultCode {
  const isGovt = answers['us_t2_q1'];
  if (isGovt === false) return 'not_applicable_likely';
  if (isGovt !== true)  return 'not_enough_information';
  return 'potentially_applicable';
}

function assessUsSection508(answers: ApplicabilityAnswers): ApplicabilityResultCode {
  const isFederal    = answers['us_508_q1'];
  const hasFedContract = answers['us_508_q2'];

  if (isFederal === false && hasFedContract === false) return 'not_applicable_likely';
  if (isFederal === true || hasFedContract === true)   return 'potentially_applicable';
  return 'not_enough_information';
}

function assessUkPublicSector(answers: ApplicabilityAnswers): ApplicabilityResultCode {
  const isPublicSector = answers['uk_pub_q1'];
  if (isPublicSector === false) return 'not_applicable_likely';
  if (isPublicSector !== true)  return 'not_enough_information';
  return 'potentially_applicable';
}

function assessInternationalWcag(_answers: ApplicabilityAnswers): ApplicabilityResultCode {
  // WCAG is a voluntary technical standard — always at least "may apply"
  return 'may_apply';
}

// ── Caveats per result code ───────────────────────────────────────────────────

const UNIVERSAL_CAVEATS = [
  'This assessment is based on the answers you provided and does not constitute legal advice.',
  'Applicability depends on your specific business circumstances, organizational structure, and the legal systems in your relevant markets.',
  'Consult a qualified accessibility specialist and legal counsel for a definitive determination.',
];

function getJurisdictionCaveats(
  jurisdictionId: AccessibilityJurisdictionId,
  result: ApplicabilityResultCode,
): string[] {
  const specific: string[] = [];

  if (jurisdictionId === 'eu_eaa') {
    specific.push('The EAA micro-enterprise exemption requires legal analysis of your specific employee count, turnover, and balance sheet.');
    if (result !== 'not_applicable_likely') {
      specific.push('EAA implementation varies by EU member state — check national transposition laws in each market you serve.');
    }
  }
  if (jurisdictionId === 'us_ada_title_ii' || jurisdictionId === 'us_ada_title_iii_guidance') {
    specific.push('US accessibility law can be enforced through both DOJ complaints and private litigation. Passing automated scans does not provide a legal safe harbor.');
  }
  if (jurisdictionId === 'us_section_508') {
    specific.push('Section 508 obligations for contractors depend on specific contract terms. Review your federal contracts and solicitations.');
  }
  if (result === 'not_applicable_likely') {
    specific.push('Even where a specific regulation may not apply, implementing accessible design is a widely recognized best practice and reduces legal risk.');
  }

  return specific;
}

// ── Main function ─────────────────────────────────────────────────────────────

export function assessApplicability(
  jurisdictionId: AccessibilityJurisdictionId,
  answers: ApplicabilityAnswers,
): AccessibilityApplicabilityResult {
  const profile = getJurisdictionProfile(jurisdictionId);

  if (profile.supportLevel === 'planned') {
    return {
      jurisdictionId,
      result:              'not_enough_information',
      label:               APPLICABILITY_LABELS['not_enough_information'],
      explanation:         `The ${profile.name} jurisdiction profile is not yet fully curated. Applicability assessment is not available.`,
      caveats:             UNIVERSAL_CAVEATS,
      requiresExpertReview: true,
      profileVersion:      profile.version,
      assessedAt:          new Date().toISOString(),
    };
  }

  let result: ApplicabilityResultCode;

  switch (jurisdictionId) {
    case 'eu_eaa':
      result = assessEuEaa(answers);
      break;
    case 'eu_public_sector':
      result = assessEuPublicSector(answers);
      break;
    case 'us_ada_title_ii':
    case 'us_ada_title_iii_guidance':
      result = assessUsAdaTitleIi(answers);
      break;
    case 'us_section_508':
      result = assessUsSection508(answers);
      break;
    case 'uk_public_sector':
      result = assessUkPublicSector(answers);
      break;
    case 'canada_federal':
    case 'canada_ontario':
    case 'australia_digital_accessibility':
      result = 'not_enough_information';
      break;
    case 'international_wcag':
      result = assessInternationalWcag(answers);
      break;
    default:
      result = 'not_enough_information';
  }

  const requiresExpertReview =
    result === 'potentially_applicable' ||
    result === 'likely_relevant' ||
    result === 'review_recommended' ||
    result === 'not_enough_information';

  const explanations: Record<ApplicabilityResultCode, string> = {
    potentially_applicable: `Based on your answers, ${profile.name} appears potentially applicable to your organization. Professional legal and accessibility review is required to confirm obligations and plan conformance activities.`,
    likely_relevant:        `Based on your answers, ${profile.name} is likely relevant to your organization. Professional review is recommended.`,
    may_apply:              `${profile.name} may apply to your organization depending on circumstances not fully addressed by the questionnaire. Professional review is recommended.`,
    not_enough_information: `Not enough information was provided to assess applicability of ${profile.name}. Consult a qualified professional.`,
    review_recommended:     `Your answers suggest ${profile.name} may apply, but there are factors that require professional review before a determination can be made.`,
    not_applicable_likely:  `Based on your answers, ${profile.name} is unlikely to apply to your organization. Note that this is based solely on the answers provided and does not constitute legal advice.`,
  };

  return {
    jurisdictionId,
    result,
    label:               APPLICABILITY_LABELS[result],
    explanation:         explanations[result],
    caveats:             [...UNIVERSAL_CAVEATS, ...getJurisdictionCaveats(jurisdictionId, result)],
    requiresExpertReview,
    profileVersion:      `${profile.version} (registry: ${REGISTRY_VERSION})`,
    assessedAt:          new Date().toISOString(),
  };
}

export function assessMultipleJurisdictions(
  jurisdictionIds: AccessibilityJurisdictionId[],
  answers: ApplicabilityAnswers,
): AccessibilityApplicabilityResult[] {
  return jurisdictionIds.map((id) => assessApplicability(id, answers));
}
