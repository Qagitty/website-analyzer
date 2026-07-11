/**
 * Types for the Regional Accessibility Risk Assessment feature.
 *
 * Conceptual separation:
 *  1. Technical accessibility findings  — machine-detected evidence
 *  2. Standards mapping                 — findings mapped to WCAG / EN 301 549
 *  3. Regional regulatory context       — jurisdiction guidance (NOT legal advice)
 *  4. Conformance evidence              — what was checked, when, by whom
 *
 * These four concepts are deliberately kept separate.
 * Do not combine them into one unexplained "legal compliance score."
 */

// ── Jurisdiction identifiers ──────────────────────────────────────────────────

export type AccessibilityJurisdictionId =
  | 'eu_eaa'
  | 'eu_public_sector'
  | 'us_ada_title_ii'
  | 'us_ada_title_iii_guidance'
  | 'us_section_508'
  | 'uk_public_sector'
  | 'canada_federal'
  | 'canada_ontario'
  | 'australia_digital_accessibility'
  | 'international_wcag';

export type JurisdictionSupportLevel =
  | 'full'                 // questionnaire + mapping + sources + tests + reviewed language
  | 'technical_mapping_only' // WCAG mapping exists; legal context not fully curated
  | 'guidance_only'        // general guidance only; applicability logic limited
  | 'planned';             // on roadmap; not yet available

export type JurisdictionReviewStatus =
  | 'current'
  | 'review_due'
  | 'under_review'
  | 'deprecated';

// ── Standards identifiers ─────────────────────────────────────────────────────

export type AccessibilityStandardId =
  | 'wcag_2_1_a'
  | 'wcag_2_1_aa'
  | 'wcag_2_1_aaa'
  | 'wcag_2_2_a'
  | 'wcag_2_2_aa'
  | 'wcag_2_2_aaa'
  | 'en_301_549_relevant_web'
  | 'section_508_web';

// ── Organization and service categories ──────────────────────────────────────

export type AccessibilityOrganizationType =
  | 'private_company'
  | 'public_sector'
  | 'nonprofit'
  | 'government_agency'
  | 'educational_institution'
  | 'healthcare_provider'
  | 'financial_institution'
  | 'sole_trader'
  | 'unknown';

export type AccessibilityServiceCategory =
  | 'ecommerce'
  | 'financial_services'
  | 'transport'
  | 'telecommunications'
  | 'media_audiovisual'
  | 'education'
  | 'healthcare'
  | 'government_services'
  | 'consumer_general'
  | 'enterprise_b2b'
  | 'ebook_publishing'
  | 'computing_hardware'
  | 'other';

// ── Technical assessment status (replaces binary Compliant/Non-Compliant) ────

export type AccessibilityTechnicalStatus =
  | 'no_automated_blockers_detected'
  | 'potential_gaps_detected'
  | 'high_risk_gaps_detected'
  | 'manual_review_required'
  | 'insufficient_coverage';

export const TECHNICAL_STATUS_LABELS: Record<AccessibilityTechnicalStatus, string> = {
  no_automated_blockers_detected: 'No automated blockers detected',
  potential_gaps_detected:        'Potential accessibility gaps',
  high_risk_gaps_detected:        'High-risk accessibility gaps',
  manual_review_required:         'Manual review required',
  insufficient_coverage:          'Insufficient test coverage',
};

export const TECHNICAL_STATUS_QUALIFIER =
  'Automated assessment only — manual testing still required. Not a legal certification.';

// ── Risk levels ────────────────────────────────────────────────────────────────

export type AccessibilityRiskLevel =
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical'
  | 'insufficient_evidence';

export const RISK_LEVEL_LABELS: Record<AccessibilityRiskLevel, string> = {
  low:                  'Low observed technical risk',
  moderate:             'Moderate observed technical risk',
  high:                 'High observed technical risk',
  critical:             'Critical accessibility risk indicators',
  insufficient_evidence: 'Insufficient evidence',
};

// ── Manual check status ───────────────────────────────────────────────────────

export type ManualCheckStatus =
  | 'not_started'
  | 'pass'
  | 'fail'
  | 'not_applicable'
  | 'needs_expert_review';

// ── Finding lifecycle ─────────────────────────────────────────────────────────

export type FindingLifecycleStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'verification_required'  // developer marked resolved; awaiting re-scan or manual check
  | 'verified'               // fix confirmed by a new passing assessment
  | 'accepted_risk'          // documented accepted risk — NOT counted as conformance
  | 'not_applicable';

// ── Assessment types ──────────────────────────────────────────────────────────

export type AssessmentType =
  | 'single_page'
  | 'multi_page'
  | 'scheduled'
  | 'manual_review'
  | 'verification'
  | 'baseline';

export type AssessmentStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ── Applicability output ──────────────────────────────────────────────────────

export type ApplicabilityResultCode =
  | 'potentially_applicable'
  | 'likely_relevant'
  | 'may_apply'
  | 'not_enough_information'
  | 'review_recommended'
  | 'not_applicable_likely';

export const APPLICABILITY_LABELS: Record<ApplicabilityResultCode, string> = {
  potentially_applicable: 'Potentially applicable',
  likely_relevant:        'Likely relevant',
  may_apply:              'May apply depending on business circumstances',
  not_enough_information: 'Not enough information — professional review recommended',
  review_recommended:     'Professional review recommended',
  not_applicable_likely:  'Unlikely to apply based on provided information',
};

export interface AccessibilityApplicabilityResult {
  jurisdictionId:      AccessibilityJurisdictionId;
  result:              ApplicabilityResultCode;
  label:               string;
  explanation:         string;
  caveats:             string[];
  requiresExpertReview: boolean;
  profileVersion:      string;
  assessedAt:          string;
}

// ── Risk model dimensions ─────────────────────────────────────────────────────

export interface RegionalAccessibilityRisk {
  /** 0–100: proportion of automated findings that are critical or serious */
  technicalSeverity: number;
  /** 0–100: percentage of tested pages with any finding */
  affectedPageCoverage: number;
  /** 0–100: same rules failing across multiple pages */
  issueRecurrence: number;
  /** 0–100: percentage of critical journeys containing high-severity findings */
  criticalJourneyExposure: number;
  /** 0–100: percentage of required manual checks not yet completed */
  manualCoverageGap: number;
  /** 0–100: score based on age of unresolved findings (older = higher) */
  remediationAge: number;
  /** 0–100: completeness of evidence record (higher = more complete = LOWER risk) */
  evidenceCompleteness: number;
}

export interface AccessibilityRiskAssessment {
  dimensions:  RegionalAccessibilityRisk;
  riskLevel:   AccessibilityRiskLevel;
  riskLabel:   string;
  /** Always explains what was and was not tested */
  scopeNote:   string;
  calculatedAt: string;
}

// ── Profile input ─────────────────────────────────────────────────────────────

export interface AccessibilityProfileInput {
  name:        string;
  siteId?:     string;
  monitorId?:  string;

  targetMarkets:       string[];
  organizationType:    AccessibilityOrganizationType;
  serviceCategories:   AccessibilityServiceCategory[];

  publicSector:          boolean | null;
  ecommerce:             boolean | null;
  financialServices:     boolean | null;
  transportServices:     boolean | null;
  telecommunications:    boolean | null;
  mediaServices:         boolean | null;
  education:             boolean | null;
  healthcare:            boolean | null;

  employeeCountRange?:        string;
  annualRevenueRange?:        string;
  providesConsumerServices?:  boolean | null;

  selectedStandards?:  AccessibilityStandardId[];
  preferredLanguage?:  string;
}

// ── Jurisdiction registry types ───────────────────────────────────────────────

export interface OfficialSourceReference {
  title:            string;
  issuingAuthority: string;
  identifier:       string;
  lastReviewedDate: string;
  summary:          string;
  documentationKey?: string;
}

export interface AccessibilityStandardReference {
  standardId: AccessibilityStandardId;
  clause?:    string;
  note?:      string;
}

export interface ApplicabilityQuestion {
  id:            string;
  questionText:  string;
  helpText?:     string;
  whyAsked:      string;
  answerType:    'boolean_with_unsure' | 'single_select' | 'multi_select' | 'size_range';
  options?:      Array<{ value: string; label: string }>;
  affectsApplicability: boolean;
}

export interface ManualReviewRequirement {
  id:                  string;
  title:               string;
  description:         string;
  steps:               string[];
  expectedResult:      string;
  assistiveTechnology?: string;
  wcagCriteria:        string[];
  wcagLevel:           'A' | 'AA' | 'AAA';
  manualOnly:          boolean;
}

export interface AccessibilityStatementRequirement {
  required:                boolean;
  recommendedContent:      string[];
  enforcementEscalation?:  string;
  reviewPeriodMonths?:     number;
  draftWarning:            string;
}

export interface AccessibilityJurisdictionProfile {
  id:            AccessibilityJurisdictionId;
  version:       string;

  name:          string;
  region:        string;
  supportLevel:  JurisdictionSupportLevel;
  reviewStatus:  JurisdictionReviewStatus;
  contentOwner:  string;
  changeNotes?:  string;

  applicableOrganizationTypes:  AccessibilityOrganizationType[];
  applicableServiceCategories:  AccessibilityServiceCategory[];

  technicalStandards:        AccessibilityStandardReference[];
  targetConformanceLevel?:   'A' | 'AA' | 'AAA';

  effectiveFrom?:  string;
  lastReviewedAt:  string;
  nextReviewAt?:   string;

  applicabilityQuestions:     ApplicabilityQuestion[];
  statementRequirements:      AccessibilityStatementRequirement;
  manualReviewRequirements:   ManualReviewRequirement[];

  officialSourceReferences:   OfficialSourceReference[];

  /** Always shown prominently — not hidden in fine print */
  disclaimers: string[];
}

// ── Standards registry types ──────────────────────────────────────────────────

export type WcagPrinciple = 'perceivable' | 'operable' | 'understandable' | 'robust';

export type AutomatedCoverageLevel =
  | 'automated'    // reliably detected by static/dynamic automated tools
  | 'partial'      // partially detectable; manual verification needed
  | 'manual_only'; // cannot be reliably detected automatically

export interface AccessibilityRuleMapping {
  engineRuleId:         string;
  wcagCriteria:         string[];
  wcagLevel:            'A' | 'AA' | 'AAA' | null;
  wcagVersion:          '2.1' | '2.2' | 'both';
  principles:           WcagPrinciple[];
  automatedCoverage:    AutomatedCoverageLevel;
  relatedJurisdictions: AccessibilityJurisdictionId[];
  remediationCategory:  string;
  severity:             'critical' | 'serious' | 'moderate' | 'minor';
}

export interface AccessibilityStandardSpec {
  id:              AccessibilityStandardId;
  name:            string;
  shortName:       string;
  version:         string;
  conformanceLevel?: 'A' | 'AA' | 'AAA';
  issuingBody:     string;
  effectiveDate?:  string;
  relatedStandards?: AccessibilityStandardId[];
  summary:         string;
}

// ── Accessibility statement ───────────────────────────────────────────────────

export type StatementStatus =
  | 'draft'
  | 'ready_for_review'
  | 'approved'
  | 'published'
  | 'review_due'
  | 'archived';

export interface AccessibilityStatementData {
  profileId:          string;
  jurisdictionId:     AccessibilityJurisdictionId;
  standardIds:        AccessibilityStandardId[];
  siteUrl:            string;
  organizationName:   string;
  assessmentDate:     string;
  statementDate:      string;
  nextReviewDate?:    string;
  contactEmail?:      string;
  contactFormUrl?:    string;
  knownIssues:        Array<{ wcagCriteria: string; description: string; impact: string }>;
  remediationPlan?:   string;
  exclusions?:        string;
  customContent?:     string;
}

// ── Fix request payload ───────────────────────────────────────────────────────

export interface AccessibilityFixRequestPayload {
  findingId:            string;
  assessmentId:         string;
  siteId:               string;
  pageUrl:              string;
  title:                string;
  severity:             string;
  ruleId:               string;
  wcagCriteria:         string[];
  affectedSelector?:    string;
  sanitizedHtmlExcerpt?: string;
  description:          string;
  userImpact:           string;
  recommendedFix:       string;
  codeExample?:         string;
  relevantRegions:      AccessibilityJurisdictionId[];
  verificationSteps:    string[];
  sourceReportUrl:      string;
}

// ── Audit event types ─────────────────────────────────────────────────────────

export type AccessibilityAuditEventType =
  | 'profile_created'
  | 'profile_updated'
  | 'assessment_started'
  | 'assessment_completed'
  | 'assessment_failed'
  | 'finding_created'
  | 'finding_status_changed'
  | 'finding_regressed'
  | 'finding_resolved'
  | 'finding_verified'
  | 'manual_check_completed'
  | 'evidence_attached'
  | 'statement_generated'
  | 'statement_versioned'
  | 'report_exported'
  | 'accepted_risk_recorded'
  | 'jurisdiction_version_used';

// ── Plan entitlements ─────────────────────────────────────────────────────────

export interface RegionalAccessibilityEntitlement {
  enabled:                       boolean;
  regionalProfiles:              number;
  jurisdictionsPerProfile:       number;
  monitoredPages:                number;
  automatedAssessmentsPerMonth:  number;
  manualChecks:                  boolean;
  statementBuilder:              boolean;
  auditTrail:                    boolean;
  evidenceAttachments:           boolean;
  compliancePdf:                 boolean;
  scheduledMonitoring:           boolean;
  teamReview:                    boolean;
  whiteLabel:                    boolean;
  retentionDays:                 number;
}
