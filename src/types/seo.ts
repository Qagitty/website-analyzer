// SEO Audit Type System — v1
// Covers sections 3, 22, 23, 30 of the SEO Audit Improvement spec.

export type SeoFindingStatus =
  | 'passed'
  | 'failed'
  | 'warning'
  | 'manual-review'
  | 'not-applicable'
  | 'unavailable';

export type SeoSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type SeoFindingSource =
  | 'html'
  | 'http-header'
  | 'robots-txt'
  | 'sitemap'
  | 'json-ld'
  | 'crawler'
  | 'heuristic';

export type SeoCategory =
  | 'metadata'
  | 'indexability'
  | 'canonical'
  | 'hreflang'
  | 'headings'
  | 'structured-data'
  | 'internal-links'
  | 'crawlability'
  | 'images'
  | 'social'
  | 'url'
  | 'mobile'
  | 'content'
  | 'other';

export interface SeoEvidence {
  selector?: string;
  html?: string;
  url?: string;
  expected?: string;
  actual?: string;
  source?: SeoFindingSource;
  confidence?: 'high' | 'medium' | 'low';
}

export interface SeoFinding {
  id: string;
  ruleId: string;
  category: SeoCategory;
  title: string;
  description: string;
  status: SeoFindingStatus;
  severity: SeoSeverity;
  confidence: 'high' | 'medium' | 'low';
  affectedPages: string[];
  evidence: SeoEvidence[];
  recommendation: string;
  howToVerify?: string;
}

export interface SeoScoreBreakdown {
  category: string;
  weight: number;
  score: number | null;
  weightedContribution: number | null;
  passedChecks: number;
  failedChecks: number;
  unavailableChecks: number;
  reason: string;
}

export interface SeoAuditCoverage {
  supportedChecks: number;
  executedChecks: number;
  unavailableChecks: number;
  skippedChecks: number;
  percentage: number;
  limitations: string[];
}

export interface SeoMetadataResult {
  title: string | null;
  titleLength: number | null;
  titleStatus: 'good' | 'too-short' | 'too-long' | 'missing' | 'multiple' | 'empty';
  description: string | null;
  descriptionLength: number | null;
  descriptionStatus: 'good' | 'too-short' | 'too-long' | 'missing' | 'multiple' | 'empty';
  h1: string | null;
  h1Count: number;
  headingStructure: Array<{ level: number; text: string }>;
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  htmlLang: string | null;
}

export interface SeoIndexabilityResult {
  isIndexable: boolean;
  robotsMeta: string[];
  xRobotsTag: string[];
  effectiveDirectives: string[];
  noindex: boolean;
  nofollow: boolean;
  conflictingDirectives: boolean;
}

export interface StructuredDataItem {
  type: string | string[];
  hasValidSyntax: boolean;
  isRecognizedType: boolean;
  hasRequiredProps: boolean;
  errors: string[];
  raw?: string;
}

export interface StructuredDataResult {
  found: boolean;
  count: number;
  types: string[];
  items: StructuredDataItem[];
  hasGraph: boolean;
  syntaxErrors: number;
  templateVarErrors: number;
}

export interface HreflangEntry {
  lang: string;
  url: string;
  isValidLang: boolean;
  isXDefault: boolean;
}

export interface InternationalSeoResult {
  hasHreflang: boolean;
  entries: HreflangEntry[];
  hasXDefault: boolean;
  hasSelfReference: boolean;
  invalidCodes: string[];
  clusters: string[][];
}

export interface InternalLinkResult {
  totalLinks: number;
  uniqueTargets: number;
  brokenLinks: number;
  redirectedLinks: number;
  noFollowLinks: number;
  crawlDepth: number | null;
  inboundLinksToPage: number | null;
  sampleLimited: boolean;
}

export interface SitemapResult {
  found: boolean;
  discoveredAt: 'robots-txt' | '/sitemap.xml' | 'not-found';
  httpStatus: number | null;
  urlCount: number | null;
  hasValidXml: boolean;
  isSitemapIndex: boolean;
  errors: string[];
  sampled: boolean;
}

export interface RobotsTxtResult {
  found: boolean;
  httpStatus: number | null;
  allowsCrawling: boolean;
  hasSitemapDeclaration: boolean;
  matchedRule: string | null;
  errors: string[];
  userAgentRules: Array<{ userAgent: string; disallowed: string[]; allowed: string[] }>;
}

export interface SeoAuditError {
  code:
    | 'TIMEOUT'
    | 'BLOCKED'
    | 'DNS_ERROR'
    | 'TLS_ERROR'
    | 'HTTP_ERROR'
    | 'HTML_PARSE_ERROR'
    | 'ROBOTS_PARSE_ERROR'
    | 'SITEMAP_PARSE_ERROR'
    | 'RENDER_ERROR'
    | 'INVALID_RESULT'
    | 'UNKNOWN';
  message: string;
  retryable: boolean;
}

export interface SeoAuditResult {
  version: 'seo-v1';
  score: number | null;
  scoreVersion: string;
  auditMode: 'fetch-only' | 'rendered' | 'hybrid';
  testedUrl: string;
  finalUrl: string;
  measuredAt: string;
  findings: SeoFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    passed: number;
    manualReview: number;
  };
  scoreBreakdown: SeoScoreBreakdown[];
  coverage: SeoAuditCoverage;
  metadata: SeoMetadataResult;
  indexability: SeoIndexabilityResult;
  structuredData: StructuredDataResult;
  international: InternationalSeoResult;
  internalLinks: InternalLinkResult | null;
  sitemap: SitemapResult | null;
  robots: RobotsTxtResult | null;
  warnings: string[];
  errors: SeoAuditError[];
}

// Lightweight result for crawled pages (no async fetches)
export interface SeoPageResult {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  title: string | null;
  titleLength: number | null;
  titleStatus: SeoMetadataResult['titleStatus'];
  description: string | null;
  descriptionLength: number | null;
  descriptionStatus: SeoMetadataResult['descriptionStatus'];
  h1: string | null;
  h1Count: number;
  canonical: string | null;
  canonicalStatus: 'self' | 'cross-domain' | 'mismatch' | 'missing' | 'multiple' | 'relative-resolved';
  isIndexable: boolean;
  noindex: boolean;
  robotsDirectives: string[];
  structuredDataTypes: string[];
  score: number | null;
  auditLabel: 'Full SEO audit' | 'Lightweight SEO scan' | 'Fetch status only' | 'Not analyzed' | 'Audit failed';
  coverage: number | null;
}
