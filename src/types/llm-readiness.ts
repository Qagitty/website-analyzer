// LLM Readiness Audit types — version llm-readiness-v2

export type LlmReadinessStatus =
  | 'passed'
  | 'failed'
  | 'warning'
  | 'manual-review'
  | 'not-applicable'
  | 'unavailable';

export type LlmReadinessSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type LlmReadinessCategory =
  | 'crawlability'
  | 'content-accessibility'
  | 'semantic-structure'
  | 'entity-clarity'
  | 'structured-data'
  | 'authorship'
  | 'citation-readiness'
  | 'freshness'
  | 'machine-guidance'
  | 'other';

export type LlmReadinessSource =
  | 'raw-html'
  | 'http-header'
  | 'robots-txt'
  | 'llms-txt'
  | 'structured-data'
  | 'content-analysis'
  | 'heuristic';

export interface LlmReadinessEvidence {
  url?: string;
  selector?: string;
  html?: string;
  expected?: string;
  actual?: string;
  source?: LlmReadinessSource;
  confidence?: 'high' | 'medium' | 'low';
}

export interface LlmReadinessFinding {
  id: string;
  ruleId: string;
  category: LlmReadinessCategory;
  title: string;
  description: string;
  status: LlmReadinessStatus;
  severity: LlmReadinessSeverity;
  confidence: 'high' | 'medium' | 'low';
  source: LlmReadinessSource;
  affectedPages: string[];
  evidence: LlmReadinessEvidence[];
  recommendation: string;
  experimental: boolean;
}

export interface LlmReadinessCategoryScore {
  category: LlmReadinessCategory;
  label: string;
  weight: number;
  score: number | null;
  weightedContribution: number | null;
  passedSignals: number;
  failedSignals: number;
  warningSignals: number;
  unavailableSignals: number;
  reason: string;
}

export interface LlmReadinessCoverage {
  supportedSignals: number;
  executedSignals: number;
  passedSignals: number;
  failedSignals: number;
  warningSignals: number;
  unavailableSignals: number;
  manualReviewSignals: number;
  percentage: number;
  limitations: string[];
}

export type AiCrawlerCategory =
  | 'search-retrieval'
  | 'model-training'
  | 'answer-generation'
  | 'user-browsing'
  | 'general-indexing'
  | 'unknown';

export interface AiCrawlerAccess {
  crawlerName: string;
  userAgent: string;
  category: AiCrawlerCategory;
  provider: string;
  allowed: boolean | null;
  matchedGroup: string | null;
  matchedRule: string | null;
  confidence: 'high' | 'medium' | 'low';
  configVersion: string;
}

export interface LlmDetectedSignals {
  hasJsonLd: boolean;
  schemaTypes: string[];
  hasOrganizationSchema: boolean;
  hasArticleSchema: boolean;
  hasBreadcrumbSchema: boolean;
  hasAuthorSignal: boolean;
  hasDateSignal: boolean;
  hasSameAsLinks: boolean;
  rawTextLength: number;
  headingCount: number;
  h1Count: number;
  internalLinkCount: number;
  hasMetaDescription: boolean;
  metaDescriptionLength: number;
  hasOpenGraph: boolean;
  hasCanonical: boolean;
  canonicalUrl: string | null;
  isHttps: boolean;
  robotsMetaDirectives: string[];
  xRobotsDirectives: string[];
  contentType: string | null;
  lastModifiedHeader: string | null;
  hasMainLandmark: boolean;
  hasArticleLandmark: boolean;
  hasNavLandmark: boolean;
  llmsTxtStatus: 'found' | 'not-found' | 'error' | 'unchecked';
  llmsTxtSize: number | null;
  aiCrawlerAccess: AiCrawlerAccess[];
  robotsTxtFetched: boolean;
  pageType: string;
}

export interface LlmReadinessAuditError {
  code:
    | 'TIMEOUT'
    | 'BLOCKED'
    | 'DNS_ERROR'
    | 'TLS_ERROR'
    | 'HTTP_ERROR'
    | 'ROBOTS_ERROR'
    | 'CONTENT_EXTRACTION_ERROR'
    | 'SCHEMA_ERROR'
    | 'INVALID_RESULT'
    | 'UNKNOWN';
  message: string;
  retryable: boolean;
}

export interface LlmReadinessAuditResult {
  score: number | null;
  scoreVersion: string;
  auditMode: 'fetch-only' | 'rendered' | 'hybrid';
  testedUrl: string;
  finalUrl: string;
  measuredAt: string;
  findings: LlmReadinessFinding[];
  categoryScores: LlmReadinessCategoryScore[];
  coverage: LlmReadinessCoverage;
  detectedSignals: LlmDetectedSignals;
  warnings: string[];
  errors: LlmReadinessAuditError[];
}

export interface LlmReadinessPageResult {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  auditMode: 'fetch-only';
  title: string | null;
  h1: string | null;
  canonical: string | null;
  schemaTypes: string[];
  hasAuthorSignal: boolean;
  hasDateSignal: boolean;
  isIndexable: boolean;
  score: number | null;
  coverage: number;
  auditLabel: string;
  topIssue: string | null;
}
