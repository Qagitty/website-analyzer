/**
 * Single source of truth for all plan limits and feature flags.
 * Every backend gate and UI check should import from here.
 */

import type { PlanId } from '@/lib/stripe/plans';
import { planAtLeast } from '@/lib/stripe/plans';

// ─────────────────────────────────────────────────────────────────
// Per-plan limits
// ─────────────────────────────────────────────────────────────────

export interface PlanLimits {
  /** Monthly analysis credits */
  creditsPerMonth: number;
  /** Max monitored websites */
  monitors: number;
  /** Max team members (including owner) */
  teamMembers: number;
  /** Max active API keys */
  apiKeys: number;
  /** Max active webhooks */
  webhooks: number;
  /** Max pages crawled per analysis */
  crawlPages: number;
  /** API requests per day (0 = no access) */
  apiRequestsPerDay: number;
  /** Competitor URLs allowed per analysis (0 = no access) */
  competitorUrls: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    creditsPerMonth:  3,
    monitors:         0,
    teamMembers:      1,
    apiKeys:          0,
    webhooks:         0,
    crawlPages:       1,   // single-page only
    apiRequestsPerDay: 0,
    competitorUrls:   0,
  },
  pro: {
    creditsPerMonth:  100,
    monitors:         5,
    teamMembers:      1,
    apiKeys:          0,
    webhooks:         0,
    crawlPages:       10,
    apiRequestsPerDay: 0,
    competitorUrls:   1,
  },
  agency: {
    creditsPerMonth:  99_999,  // fair-use unlimited
    monitors:         50,
    teamMembers:      10,
    apiKeys:          5,
    webhooks:         10,
    crawlPages:       50,
    apiRequestsPerDay: 1_000,
    competitorUrls:   3,
  },
  compliance: {
    creditsPerMonth:  99_999,
    monitors:         100,
    teamMembers:      20,
    apiKeys:          10,
    webhooks:         20,
    crawlPages:       100,
    apiRequestsPerDay: 5_000,
    competitorUrls:   5,
  },
};

// ─────────────────────────────────────────────────────────────────
// Feature flags
// ─────────────────────────────────────────────────────────────────

export interface PlanFeatures {
  pdfExport:           boolean;
  compliancePdf:       boolean;
  monitoring:          boolean;
  remediationBoard:    boolean;
  teamMembers:         boolean;
  apiAccess:           boolean;
  webhooks:            boolean;
  whiteLabelPdf:       boolean;
  competitorCompare:   boolean;
  beforeAfterCompare:  boolean;
  multiPageCrawl:      boolean;
  fixRoadmap:          boolean;
  reportSharing:       boolean;
  /** Embeddable lead-capture widget (hosted page + JS snippet) */
  leadWidget:          boolean;
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: {
    pdfExport:          false,
    compliancePdf:      false,
    monitoring:         false,
    remediationBoard:   false,
    teamMembers:        false,
    apiAccess:          false,
    webhooks:           false,
    whiteLabelPdf:      false,
    competitorCompare:  false,
    beforeAfterCompare: false,
    multiPageCrawl:     false,
    fixRoadmap:         true,
    reportSharing:      false,
    leadWidget:         false,
  },
  pro: {
    pdfExport:          true,
    compliancePdf:      false,
    monitoring:         true,
    remediationBoard:   true,
    teamMembers:        false,
    apiAccess:          false,
    webhooks:           false,
    whiteLabelPdf:      false,
    competitorCompare:  true,
    beforeAfterCompare: true,
    multiPageCrawl:     true,
    fixRoadmap:         true,
    reportSharing:      true,
    leadWidget:         false,
  },
  agency: {
    pdfExport:          true,
    compliancePdf:      false,
    monitoring:         true,
    remediationBoard:   true,
    teamMembers:        true,
    apiAccess:          true,
    webhooks:           true,
    whiteLabelPdf:      true,
    competitorCompare:  true,
    beforeAfterCompare: true,
    multiPageCrawl:     true,
    fixRoadmap:         true,
    reportSharing:      true,
    leadWidget:         true,
  },
  compliance: {
    pdfExport:          true,
    compliancePdf:      true,
    monitoring:         true,
    remediationBoard:   true,
    teamMembers:        true,
    apiAccess:          true,
    webhooks:           true,
    whiteLabelPdf:      true,
    competitorCompare:  true,
    beforeAfterCompare: true,
    multiPageCrawl:     true,
    fixRoadmap:         true,
    reportSharing:      true,
    leadWidget:         true,
  },
};

// ─────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────

/** Get limits for a given plan (falls back to free if unknown). */
export function getLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.free;
}

/** Get feature flags for a given plan (falls back to free if unknown). */
export function getFeatures(plan: string): PlanFeatures {
  return PLAN_FEATURES[plan as PlanId] ?? PLAN_FEATURES.free;
}

/** Check if a plan has a specific feature enabled. */
export function hasFeature(plan: string, feature: keyof PlanFeatures): boolean {
  return getFeatures(plan)[feature];
}

/** Check if a plan has at least a given limit value. */
export function withinLimit(plan: string, limitKey: keyof PlanLimits, current: number): boolean {
  const limit = getLimits(plan)[limitKey];
  return current < limit;
}

/**
 * Returns a 403 JSON response body for a blocked feature.
 * Usage: return NextResponse.json(featureGateError('pdfExport'), { status: 403 })
 */
export function featureGateError(
  feature: keyof PlanFeatures,
  requiredPlan: PlanId = 'pro',
): { error: string; code: string; requiredPlan: PlanId } {
  const messages: Record<keyof PlanFeatures, string> = {
    pdfExport:          'PDF export requires a Pro plan or higher.',
    compliancePdf:      'Compliance PDF requires a Compliance plan.',
    monitoring:         'Website monitoring requires a Pro plan or higher.',
    remediationBoard:   'Remediation tracking requires a Pro plan or higher.',
    teamMembers:        'Team members require an Agency plan or higher.',
    apiAccess:          'API access requires an Agency plan or higher.',
    webhooks:           'Webhooks require an Agency plan or higher.',
    whiteLabelPdf:      'White-label PDF requires an Agency plan or higher.',
    competitorCompare:  'Competitor comparison requires a Pro plan or higher.',
    beforeAfterCompare: 'Before/after comparison requires a Pro plan or higher.',
    multiPageCrawl:     'Multi-page crawl requires a Pro plan or higher.',
    fixRoadmap:         'Fix roadmap is available on all plans.',
    reportSharing:      'Report sharing requires a Pro plan or higher.',
    leadWidget:         'The lead capture widget requires an Agency plan or higher.',
  };
  return {
    error: messages[feature],
    code: `FEATURE_GATE_${feature.toUpperCase()}`,
    requiredPlan,
  };
}

export { planAtLeast };
