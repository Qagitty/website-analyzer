/**
 * Versioned jurisdiction profiles for regional accessibility risk assessment.
 *
 * IMPORTANT — what these profiles are:
 *  - A curated summary of publicly available regulatory context
 *  - A starting point for understanding which technical standards are
 *    commonly referenced in a given region
 *  - Always presented with disclaimers that professional legal review is needed
 *
 * IMPORTANT — what these profiles are NOT:
 *  - Legal advice
 *  - A guarantee of legal compliance or immunity
 *  - A comprehensive legal analysis
 *  - A substitute for professional accessibility and legal review
 *  - An authoritative interpretation of any law or regulation
 *
 * Registry version: '2026-07-11.1'
 * Next review due:  '2026-10-01'
 */

import type {
  AccessibilityJurisdictionId,
  AccessibilityJurisdictionProfile,
  AccessibilityOrganizationType,
  AccessibilityServiceCategory,
} from '@/types/accessibility-profile';

// ── Shared disclaimer text ────────────────────────────────────────────────────

const UNIVERSAL_DISCLAIMER =
  'This profile is a technical reference summary, not legal advice. Regulatory applicability depends on your specific organization, services, markets, and legal circumstances. Consult a qualified accessibility specialist and legal counsel before making any compliance claims.';

const AUTOMATED_COVERAGE_DISCLAIMER =
  'Automated testing covers a subset of WCAG success criteria. Manual testing with assistive technologies is required for comprehensive evaluation.';

const APPLICABILITY_DISCLAIMER =
  'The applicability questions below help identify likely relevance, but cannot determine your legal obligations with certainty. Only a qualified legal professional can determine whether specific regulations apply to your organization.';

// ── Profile registry ──────────────────────────────────────────────────────────

const EU_EAA: AccessibilityJurisdictionProfile = {
  id:           'eu_eaa',
  version:      '2026-07-11.1',
  name:         'European Accessibility Act (EAA)',
  region:       'European Union',
  supportLevel: 'full',
  reviewStatus: 'current',
  contentOwner: 'webscore-internal',
  lastReviewedAt: '2026-07-11',
  nextReviewAt:   '2026-10-01',
  changeNotes:  'Initial versioned profile. Revised disclaimer language throughout.',

  applicableOrganizationTypes: [
    'private_company',
    'nonprofit',
    'financial_institution',
    'educational_institution',
    'healthcare_provider',
    'sole_trader',
  ],
  applicableServiceCategories: [
    'ecommerce',
    'financial_services',
    'transport',
    'telecommunications',
    'media_audiovisual',
    'education',
    'ebook_publishing',
    'computing_hardware',
    'consumer_general',
  ],

  technicalStandards: [
    { standardId: 'wcag_2_1_aa', note: 'Referenced as the primary web accessibility technical standard via EN 301 549' },
    { standardId: 'en_301_549_relevant_web', note: 'The harmonized European standard for digital accessibility' },
  ],
  targetConformanceLevel: 'AA',

  effectiveFrom: '2025-06-28',

  applicabilityQuestions: [
    {
      id:           'eu_eaa_q1',
      questionText: 'Does your organization provide products or services to consumers in EU member states?',
      helpText:     'This includes online sales, software downloads, or digital service subscriptions available to EU residents.',
      whyAsked:     'The EAA applies to economic operators placing covered products and services on the EU market.',
      answerType:   'boolean_with_unsure',
      affectsApplicability: true,
    },
    {
      id:           'eu_eaa_q2',
      questionText: 'Is your organization a micro-enterprise (fewer than 10 employees AND annual turnover/balance sheet ≤ €2 million)?',
      helpText:     'Micro-enterprises providing services may be exempt from certain EAA service requirements. Product obligations may still apply.',
      whyAsked:     'The EAA includes an exemption for micro-enterprises providing services, though conditions apply.',
      answerType:   'boolean_with_unsure',
      affectsApplicability: true,
    },
    {
      id:           'eu_eaa_q3',
      questionText: 'Do any of the following describe your organization\'s primary website activity?',
      whyAsked:     'The EAA covers specific categories of services. Identifying your category helps determine likely coverage.',
      answerType:   'multi_select',
      options: [
        { value: 'ecommerce', label: 'E-commerce (selling goods or services online to consumers)' },
        { value: 'banking',   label: 'Consumer banking or financial services' },
        { value: 'transport', label: 'Passenger transport booking or information services' },
        { value: 'media',     label: 'Audiovisual media services or electronic communications' },
        { value: 'ebooks',    label: 'E-books or e-book reading software' },
        { value: 'computing', label: 'Consumer computing hardware or operating systems' },
        { value: 'none',      label: 'None of the above' },
      ],
      affectsApplicability: true,
    },
  ],

  statementRequirements: {
    required:           true,
    recommendedContent: [
      'Date of statement and next scheduled review',
      'Scope: which parts of the service were assessed',
      'Technical standard used (e.g., WCAG 2.1 AA / EN 301 549)',
      'Known accessibility gaps and their current remediation status',
      'Contact mechanism for users to report accessibility issues',
      'Feedback and enforcement escalation procedure',
    ],
    enforcementEscalation: 'National market surveillance and enforcement authorities (varies by EU member state)',
    reviewPeriodMonths:    12,
    draftWarning:          'This statement is a draft for internal review only. Do not publish without legal review and accessibility specialist sign-off. Publishing a false or misleading accessibility statement may have legal consequences.',
  },

  manualReviewRequirements: [
    {
      id:                  'eaa_manual_keyboard',
      title:               'Keyboard Navigation',
      description:         'Verify all functionality is operable without a mouse using keyboard only.',
      steps: [
        'Tab through all interactive elements on a representative page',
        'Confirm visible focus indicators are present at all times',
        'Confirm logical focus order',
        'Test all modal dialogs, dropdowns, and date pickers',
        'Confirm no keyboard traps exist',
      ],
      expectedResult:      'All interactive elements reachable and operable via keyboard; visible focus indicator always present.',
      wcagCriteria:        ['2.1.1', '2.1.2', '2.4.3', '2.4.7'],
      wcagLevel:           'AA',
      manualOnly:          true,
    },
    {
      id:                  'eaa_manual_screenreader',
      title:               'Screen Reader Compatibility',
      description:         'Test core user journeys with a screen reader.',
      steps: [
        'Complete the primary conversion flow (e.g., purchase, sign-up, contact) using VoiceOver (macOS/iOS) or NVDA/JAWS (Windows)',
        'Verify all form fields have accessible names',
        'Verify error messages are announced',
        'Verify dynamic content updates are announced',
        'Verify images have appropriate alt text',
      ],
      expectedResult:      'Screen reader user can complete the primary user journey without sighted assistance.',
      assistiveTechnology: 'VoiceOver (macOS/iOS) or NVDA with Firefox (Windows)',
      wcagCriteria:        ['1.1.1', '1.3.1', '4.1.2', '4.1.3'],
      wcagLevel:           'AA',
      manualOnly:          true,
    },
    {
      id:                  'eaa_manual_colour',
      title:               'Colour and Contrast',
      description:         'Verify colour is not used as the sole means of conveying information, and that contrast ratios meet WCAG 2.1 AA.',
      steps: [
        'Review all form validation states (error, warning, success) — ensure text or icon supplements colour',
        'Check link text colour against surrounding text',
        'Use a colour contrast checker on body text, headings, and UI controls',
      ],
      expectedResult:      'Body text ≥4.5:1 contrast ratio; large text ≥3:1; no information conveyed by colour alone.',
      wcagCriteria:        ['1.3.3', '1.4.1', '1.4.3', '1.4.11'],
      wcagLevel:           'AA',
      manualOnly:          false,
    },
  ],

  officialSourceReferences: [
    {
      title:            'Directive (EU) 2019/882 — European Accessibility Act',
      issuingAuthority: 'European Parliament and of the Council',
      identifier:       'OJ L 151, 7.6.2019, pp. 70–115',
      lastReviewedDate: '2026-07-11',
      summary:          'The primary EU legislative instrument requiring accessibility of specified products and services. Applies to economic operators placing covered products and services on the EU market from 28 June 2025.',
    },
    {
      title:            'EN 301 549 V3.2.1 — Accessibility requirements for ICT products and services',
      issuingAuthority: 'ETSI / CEN / CENELEC',
      identifier:       'ETSI EN 301 549 V3.2.1 (2021-03)',
      lastReviewedDate: '2026-07-11',
      summary:          'The harmonized European technical standard referenced in the EAA. Web content requirements in Clause 9 correspond to WCAG 2.1 Level AA.',
    },
  ],

  disclaimers: [
    UNIVERSAL_DISCLAIMER,
    AUTOMATED_COVERAGE_DISCLAIMER,
    APPLICABILITY_DISCLAIMER,
    'The micro-enterprise exemption and disproportionate burden provisions in the EAA involve complex factual and legal assessments. Do not self-certify these exemptions without professional legal advice.',
    'National transpositions of the EAA may introduce additional requirements or variations. Check applicable national law in each EU member state where you operate.',
  ],
};

const EU_PUBLIC_SECTOR: AccessibilityJurisdictionProfile = {
  id:           'eu_public_sector',
  version:      '2026-07-11.1',
  name:         'EU Web Accessibility Directive (Public Sector)',
  region:       'European Union — Public Sector',
  supportLevel: 'full',
  reviewStatus: 'current',
  contentOwner: 'webscore-internal',
  lastReviewedAt: '2026-07-11',
  nextReviewAt:   '2026-10-01',

  applicableOrganizationTypes: [
    'public_sector',
    'government_agency',
  ],
  applicableServiceCategories: [
    'government_services',
    'education',
    'healthcare',
  ],

  technicalStandards: [
    { standardId: 'wcag_2_1_aa' },
    { standardId: 'en_301_549_relevant_web' },
  ],
  targetConformanceLevel: 'AA',

  effectiveFrom: '2018-09-23',

  applicabilityQuestions: [
    {
      id:           'eu_pub_q1',
      questionText: 'Is your organization a public sector body as defined under EU law (e.g., a government agency, public authority, or body governed by public law)?',
      whyAsked:     'The EU Web Accessibility Directive applies specifically to public sector bodies. Private organizations are covered by the EAA, not this directive.',
      answerType:   'boolean_with_unsure',
      affectsApplicability: true,
    },
    {
      id:           'eu_pub_q2',
      questionText: 'Does your organization operate websites or mobile applications that provide public services?',
      whyAsked:     'The directive covers websites and mobile apps of public sector bodies. Internal systems and third-party content may have different treatment.',
      answerType:   'boolean_with_unsure',
      affectsApplicability: true,
    },
  ],

  statementRequirements: {
    required:           true,
    recommendedContent: [
      'Compliance status (fully conformant / partially conformant / non-conformant)',
      'Non-accessible content and reasons (disproportionate burden / not in scope / technical limitations)',
      'Contact details for accessibility queries and feedback',
      'Enforcement procedure link',
      'Date of most recent assessment',
    ],
    enforcementEscalation: 'National enforcement body (varies by EU member state); contact details must appear in the statement.',
    reviewPeriodMonths:    12,
    draftWarning:          'This statement is a draft. EU member state regulations require a specific accessibility statement format. Review against national transposition requirements before publishing.',
  },

  manualReviewRequirements: EU_EAA.manualReviewRequirements,

  officialSourceReferences: [
    {
      title:            'Directive (EU) 2016/2102 — Web Accessibility Directive',
      issuingAuthority: 'European Parliament and of the Council',
      identifier:       'OJ L 327, 2.12.2016, pp. 1–15',
      lastReviewedDate: '2026-07-11',
      summary:          'Requires public sector bodies in EU member states to make their websites and mobile apps accessible. Technical requirements reference EN 301 549 / WCAG 2.1 AA.',
    },
  ],

  disclaimers: [
    UNIVERSAL_DISCLAIMER,
    AUTOMATED_COVERAGE_DISCLAIMER,
    'Whether your organization qualifies as a "public sector body" under the directive requires legal analysis of your national transposition law.',
    'The directive provides exemptions for certain content types (live video, archived content, maps, third-party content). Applicability of these exemptions requires professional review.',
  ],
};

const US_ADA_TITLE_II: AccessibilityJurisdictionProfile = {
  id:           'us_ada_title_ii',
  version:      '2026-07-11.1',
  name:         'ADA Title II — US State and Local Government',
  region:       'United States — State and Local Government',
  supportLevel: 'guidance_only',
  reviewStatus: 'current',
  contentOwner: 'webscore-internal',
  lastReviewedAt: '2026-07-11',
  nextReviewAt:   '2026-10-01',
  changeNotes:  'guidance_only: US law applicability involves complex factual questions. No automated applicability logic.',

  applicableOrganizationTypes: [
    'public_sector',
    'government_agency',
  ],
  applicableServiceCategories: [
    'government_services',
    'education',
    'healthcare',
  ],

  technicalStandards: [
    { standardId: 'wcag_2_1_aa', note: 'Referenced in DOJ final rule (April 2024) as the technical standard for ADA Title II web content' },
  ],
  targetConformanceLevel: 'AA',

  effectiveFrom: '2026-04-24',

  applicabilityQuestions: [
    {
      id:           'us_t2_q1',
      questionText: 'Is your organization a US state or local government entity (e.g., a city, county, state agency, public school, public university)?',
      whyAsked:     'ADA Title II covers state and local government entities. Federal agencies are covered by Rehabilitation Act Section 508, not ADA Title II.',
      answerType:   'boolean_with_unsure',
      affectsApplicability: true,
    },
    {
      id:           'us_t2_q2',
      questionText: 'What is your organization\'s approximate population served or annual expenditure?',
      helpText:     'Compliance deadlines vary by entity size under the 2024 DOJ final rule.',
      whyAsked:     'The DOJ final rule introduced tiered compliance deadlines based on population and budget.',
      answerType:   'single_select',
      options: [
        { value: 'large',   label: 'Population ≥ 50,000 or significant budget (DOJ deadline April 2026)' },
        { value: 'small',   label: 'Population < 50,000 (DOJ deadline April 2027)' },
        { value: 'special', label: 'Special district or other entity (consult legal counsel for applicable deadline)' },
        { value: 'unknown', label: 'Not sure' },
      ],
      affectsApplicability: true,
    },
  ],

  statementRequirements: {
    required:           false,
    recommendedContent: [
      'Accessibility contact information',
      'Known accessibility limitations and remediation timeline',
      'Grievance procedure for ADA complaints',
    ],
    draftWarning:       'A formal ADA Title II accessibility statement format is not mandated by the 2024 DOJ final rule, but including accessible contact information and a grievance procedure is strongly recommended. Consult legal counsel.',
  },

  manualReviewRequirements: EU_EAA.manualReviewRequirements,

  officialSourceReferences: [
    {
      title:            'ADA Title II Web Accessibility Final Rule (2024)',
      issuingAuthority: 'US Department of Justice',
      identifier:       '28 CFR Part 35, RIN 1190-AA79',
      lastReviewedDate: '2026-07-11',
      summary:          'DOJ final rule (April 2024) requiring state and local government entities to meet WCAG 2.1 Level AA for web content and mobile apps, with tiered compliance deadlines.',
    },
  ],

  disclaimers: [
    UNIVERSAL_DISCLAIMER,
    AUTOMATED_COVERAGE_DISCLAIMER,
    APPLICABILITY_DISCLAIMER,
    'This profile provides general technical context only. US accessibility law involves complex enforcement mechanisms, including private lawsuits, DOJ complaints, and federal agency enforcement. Consult a US accessibility attorney for legal advice.',
    'The ADA is enforced through both DOJ complaints and private litigation. Passing automated scans does not provide a safe harbor against legal claims.',
  ],
};

const US_SECTION_508: AccessibilityJurisdictionProfile = {
  id:           'us_section_508',
  version:      '2026-07-11.1',
  name:         'Section 508 — US Federal Agencies and Contractors',
  region:       'United States — Federal',
  supportLevel: 'guidance_only',
  reviewStatus: 'current',
  contentOwner: 'webscore-internal',
  lastReviewedAt: '2026-07-11',
  nextReviewAt:   '2026-10-01',

  applicableOrganizationTypes: [
    'government_agency',
    'private_company',
    'nonprofit',
  ],
  applicableServiceCategories: [
    'government_services',
    'enterprise_b2b',
    'computing_hardware',
  ],

  technicalStandards: [
    { standardId: 'section_508_web', note: 'Incorporates WCAG 2.0 Level A and AA by reference' },
    { standardId: 'wcag_2_1_aa',    note: 'WCAG 2.1 AA is the widely recommended target even though 508 incorporates 2.0; many agencies expect 2.1 AA in practice' },
  ],
  targetConformanceLevel: 'AA',

  effectiveFrom: '2018-01-18',

  applicabilityQuestions: [
    {
      id:           'us_508_q1',
      questionText: 'Is your organization a US federal agency, or does it develop, procure, maintain, or use electronic and information technology under a federal contract?',
      whyAsked:     'Section 508 of the Rehabilitation Act applies to federal agencies and, in certain contexts, to contractors and vendors providing ICT to federal agencies.',
      answerType:   'boolean_with_unsure',
      affectsApplicability: true,
    },
    {
      id:           'us_508_q2',
      questionText: 'Does your organization provide software, websites, or digital content to US federal agencies under contract or grant?',
      whyAsked:     'Section 508 obligations for contractors depend on the nature of the federal relationship. Voluntary compliance is common even outside direct applicability.',
      answerType:   'boolean_with_unsure',
      affectsApplicability: true,
    },
  ],

  statementRequirements: {
    required:           false,
    recommendedContent: [
      'Voluntary Product Accessibility Template (VPAT) / Accessibility Conformance Report (ACR)',
      'Known accessibility gaps and remediation plan',
      'Contact for accessibility questions',
    ],
    draftWarning:       'A VPAT/ACR is typically required for federal procurement. Accuracy is essential — false claims in procurement documentation can have legal consequences. Have an accessibility specialist review before submission.',
  },

  manualReviewRequirements: EU_EAA.manualReviewRequirements,

  officialSourceReferences: [
    {
      title:            'Section 508 of the Rehabilitation Act (2017 Refresh)',
      issuingAuthority: 'US Access Board',
      identifier:       '36 CFR Part 1194',
      lastReviewedDate: '2026-07-11',
      summary:          'Federal accessibility requirements for ICT developed, procured, maintained, or used by US federal agencies. Web requirements incorporate WCAG 2.0 Level A and AA by reference.',
    },
  ],

  disclaimers: [
    UNIVERSAL_DISCLAIMER,
    AUTOMATED_COVERAGE_DISCLAIMER,
    'Section 508 applicability to private organizations depends on their specific federal procurement relationships and contract terms. Consult a US federal procurement attorney.',
    'Many federal agencies now expect WCAG 2.1 AA in practice even though the 2017 refresh references WCAG 2.0. Check specific solicitation requirements.',
  ],
};

const UK_PUBLIC_SECTOR: AccessibilityJurisdictionProfile = {
  id:           'uk_public_sector',
  version:      '2026-07-11.1',
  name:         'UK Public Sector Bodies Accessibility Regulations (PSBAR)',
  region:       'United Kingdom',
  supportLevel: 'guidance_only',
  reviewStatus: 'current',
  contentOwner: 'webscore-internal',
  lastReviewedAt: '2026-07-11',
  nextReviewAt:   '2026-10-01',

  applicableOrganizationTypes: [
    'public_sector',
    'government_agency',
  ],
  applicableServiceCategories: [
    'government_services',
    'education',
    'healthcare',
  ],

  technicalStandards: [
    { standardId: 'wcag_2_1_aa' },
  ],
  targetConformanceLevel: 'AA',

  effectiveFrom: '2018-09-23',

  applicabilityQuestions: [
    {
      id:           'uk_pub_q1',
      questionText: 'Is your organization a public sector body in the UK (e.g., a central government department, NHS body, local authority, public higher education institution)?',
      whyAsked:     'UK PSBAR applies to public sector bodies. Private sector organizations are not covered by PSBAR, though they may be covered by the Equality Act 2010.',
      answerType:   'boolean_with_unsure',
      affectsApplicability: true,
    },
  ],

  statementRequirements: {
    required:           true,
    recommendedContent: [
      'Compliance status (fully compliant / partially compliant / not compliant)',
      'Known non-accessible content and reasons',
      'Contact information for accessibility requests',
      'Date of next statement review (recommended annually)',
    ],
    enforcementEscalation: 'Central Digital and Data Office (CDDO) / Government Digital Service (GDS) — reporting portal',
    reviewPeriodMonths:    12,
    draftWarning:          'The UK accessibility statement must follow GDS guidance. Review the GOV.UK accessibility statement template before publishing. Do not publish a draft statement.',
  },

  manualReviewRequirements: EU_EAA.manualReviewRequirements,

  officialSourceReferences: [
    {
      title:            'Public Sector Bodies (Websites and Mobile Applications) (No. 2) Accessibility Regulations 2018',
      issuingAuthority: 'UK Government (Cabinet Office)',
      identifier:       'SI 2018/952',
      lastReviewedDate: '2026-07-11',
      summary:          'UK domestic implementation of the EU Web Accessibility Directive, retained post-Brexit. Requires public sector bodies to meet WCAG 2.1 AA and publish an accessibility statement.',
    },
  ],

  disclaimers: [
    UNIVERSAL_DISCLAIMER,
    AUTOMATED_COVERAGE_DISCLAIMER,
    'Whether your organization is a "public sector body" under PSBAR requires legal analysis. Some arm\'s-length bodies and publicly-funded organizations may fall outside scope. Consult legal counsel.',
    'Private organizations in the UK may have obligations under the Equality Act 2010 (service providers must make reasonable adjustments). PSBAR does not cover private organizations.',
  ],
};

const PLANNED_PROFILE_BASE = {
  supportLevel: 'planned' as const,
  reviewStatus: 'under_review' as const,
  contentOwner: 'webscore-internal',
  lastReviewedAt: '2026-07-11',
  applicableOrganizationTypes: [] as AccessibilityOrganizationType[],
  applicableServiceCategories: [] as AccessibilityServiceCategory[],
  technicalStandards: [{ standardId: 'wcag_2_1_aa' as const }],
  targetConformanceLevel: 'AA' as const,
  applicabilityQuestions: [],
  statementRequirements: {
    required: false,
    recommendedContent: [],
    draftWarning: 'This jurisdiction profile is not yet fully curated. Do not rely on this for compliance planning.',
  },
  manualReviewRequirements: [],
  officialSourceReferences: [],
  disclaimers: [UNIVERSAL_DISCLAIMER, 'This jurisdiction profile is in development. It does not yet include full applicability logic or official source references. Professional legal review is essential.'],
};

const CANADA_FEDERAL: AccessibilityJurisdictionProfile = {
  ...PLANNED_PROFILE_BASE,
  id:      'canada_federal',
  version: '2026-07-11.1',
  name:    'Canada — Accessible Canada Act (Federal)',
  region:  'Canada — Federal',
  changeNotes: 'Planned — not yet fully curated.',
};

const CANADA_ONTARIO: AccessibilityJurisdictionProfile = {
  ...PLANNED_PROFILE_BASE,
  id:      'canada_ontario',
  version: '2026-07-11.1',
  name:    'Canada — AODA (Ontario)',
  region:  'Canada — Ontario',
  changeNotes: 'Planned — not yet fully curated.',
};

const AUSTRALIA_DIGITAL: AccessibilityJurisdictionProfile = {
  ...PLANNED_PROFILE_BASE,
  id:      'australia_digital_accessibility',
  version: '2026-07-11.1',
  name:    'Australia — Digital Accessibility',
  region:  'Australia',
  changeNotes: 'Planned — not yet fully curated.',
};

const INTERNATIONAL_WCAG: AccessibilityJurisdictionProfile = {
  id:           'international_wcag',
  version:      '2026-07-11.1',
  name:         'International — WCAG 2.1 AA Technical Standard',
  region:       'International',
  supportLevel: 'full',
  reviewStatus: 'current',
  contentOwner: 'webscore-internal',
  lastReviewedAt: '2026-07-11',
  nextReviewAt:   '2027-01-01',

  applicableOrganizationTypes: [
    'private_company', 'public_sector', 'nonprofit', 'government_agency',
    'educational_institution', 'healthcare_provider', 'financial_institution', 'sole_trader',
  ],
  applicableServiceCategories: [
    'ecommerce', 'financial_services', 'transport', 'telecommunications',
    'media_audiovisual', 'education', 'healthcare', 'government_services',
    'consumer_general', 'enterprise_b2b', 'ebook_publishing', 'other',
  ],

  technicalStandards: [
    { standardId: 'wcag_2_1_aa', note: 'The most widely adopted web accessibility standard internationally' },
  ],
  targetConformanceLevel: 'AA',

  applicabilityQuestions: [
    {
      id:           'wcag_q1',
      questionText: 'Do you want to use WCAG 2.1 AA as your primary technical benchmark, independent of any specific regulatory jurisdiction?',
      whyAsked:     'WCAG 2.1 AA is a neutral technical target used globally, regardless of specific legal requirements.',
      answerType:   'boolean_with_unsure',
      affectsApplicability: false,
    },
  ],

  statementRequirements: {
    required:           false,
    recommendedContent: [
      'Technical standard targeted (WCAG 2.1 Level AA)',
      'Assessment methodology (automated + manual)',
      'Known gaps and remediation plan',
      'Contact for accessibility feedback',
    ],
    draftWarning: 'Publishing a WCAG conformance claim without completing both automated and manual testing may mislead users. Only publish after comprehensive testing.',
  },

  manualReviewRequirements: EU_EAA.manualReviewRequirements,

  officialSourceReferences: [
    {
      title:            'Web Content Accessibility Guidelines (WCAG) 2.1',
      issuingAuthority: 'W3C Web Accessibility Initiative (WAI)',
      identifier:       'W3C Recommendation 05 June 2018',
      lastReviewedDate: '2026-07-11',
      summary:          'The W3C WCAG 2.1 recommendation. The definitive technical standard. Level AA is the most commonly targeted conformance level.',
    },
  ],

  disclaimers: [
    UNIVERSAL_DISCLAIMER,
    AUTOMATED_COVERAGE_DISCLAIMER,
    'This profile uses WCAG 2.1 AA as a technical benchmark only, without reference to any specific regulatory jurisdiction. Legal obligations in your region may differ. Consult legal counsel to understand your specific obligations.',
  ],
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const JURISDICTION_REGISTRY: Record<
  AccessibilityJurisdictionId,
  AccessibilityJurisdictionProfile
> = {
  eu_eaa:                       EU_EAA,
  eu_public_sector:             EU_PUBLIC_SECTOR,
  us_ada_title_ii:              US_ADA_TITLE_II,
  us_ada_title_iii_guidance:    US_ADA_TITLE_II, // same technical standard; title III is private sector
  us_section_508:               US_SECTION_508,
  uk_public_sector:             UK_PUBLIC_SECTOR,
  canada_federal:               CANADA_FEDERAL,
  canada_ontario:               CANADA_ONTARIO,
  australia_digital_accessibility: AUSTRALIA_DIGITAL,
  international_wcag:           INTERNATIONAL_WCAG,
};

export function getJurisdictionProfile(
  id: AccessibilityJurisdictionId,
): AccessibilityJurisdictionProfile {
  return JURISDICTION_REGISTRY[id];
}

export function getAvailableJurisdictions(): AccessibilityJurisdictionProfile[] {
  return Object.values(JURISDICTION_REGISTRY).filter(
    (p) => p.supportLevel !== 'planned',
  );
}

export function getPlannedJurisdictions(): AccessibilityJurisdictionProfile[] {
  return Object.values(JURISDICTION_REGISTRY).filter(
    (p) => p.supportLevel === 'planned',
  );
}

export const REGISTRY_VERSION = '2026-07-11.1';
