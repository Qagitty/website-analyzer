/**
 * SE9 — discriminated union makes `html`, `response`, `ttfb` non-optional
 * in the success branch, removing the need for non-null assertions at call sites.
 * Previously `isValid:boolean` + optional fields let developers access `.html!`
 * without checking `isValid` first.
 */
export type UrlValidationResult =
  | {
      isValid: true;
      statusCode?: number;
      finalUrl?: string;
      /** Reuse from validation — avoids a second identical fetch (strong bot signal). */
      html: string;
      response: Response;
      ttfb: number;
    }
  | {
      isValid: false;
      reason: string;
      statusCode?: number;
      finalUrl?: string;
      errorType:
        | 'http_error'
        | 'navigation_error'
        | 'empty_page'
        | 'browser_error_page'
        | 'unknown';
    };

export interface Env {
  WORKER_AUTH_TOKEN: string;
  WORKER_CALLBACK_SECRET: string;
}

export interface AnalysisRequest {
  analysisId: string;
  url: string;
  callbackUrl: string;
  /** §7 — Deprecated; Worker now reads WORKER_CALLBACK_SECRET from env. Ignored if present. */
  authToken?: string;
  /** Monitor context forwarded to callback (Gap 2 fix). Optional — absent for non-monitor analyses. */
  monitorId?: string;
  monitorRunId?: string;
  monitorUserId?: string;
}

export interface ScoreCheckItem {
  label: string;
  passed: boolean;
  details?: string;
}

export interface ScoreBreakdown {
  performance: ScoreCheckItem[];
  bestPractices: ScoreCheckItem[];
  seo: ScoreCheckItem[];
  accessibility: ScoreCheckItem[];
}

export interface ResourceHints {
  renderBlockingCount: number;
  imageIssueCount: number;
  totalImages: number;
  thirdPartyCount: number;
}

export interface Scores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  estimatedLcp: number;
  scoreBreakdown: ScoreBreakdown;
  /** Rich per-factor breakdown from the versioned perf-score module — used by index.ts to build performanceAudit */
  perfBreakdown: import('./perf-score').PerformanceScoreBreakdown[];
  scoreVersion: string;
}

export interface LLMReadiness {
  score: number;
  checks: {
    hasStructuredData: boolean;
    hasMetaDescription: boolean;
    hasOpenGraph: boolean;
    hasSitemap: boolean;
    allowsAIBots: boolean;
    hasCleanHeadings: boolean;
    hasSufficientContent: boolean;
    hasCanonical: boolean;
  };
  signals: string[];
}

/**
 * Tiered audit levels per the multi-page analysis spec.
 * Describes what data collection method was used, not which analysis modules ran.
 */
export type PageAuditLevel =
  | 'full-browser'   // Full Playwright browser audit (not yet implemented)
  | 'hybrid'         // Browser DOM + static analysis
  | 'static'         // Static HTML analysis only
  | 'fetch-only'     // HTTP fetch + static HTML analysis + response headers
  | 'status-only'    // HTTP status + redirect chain only (page failed or HTTP error)
  | 'not-analyzed';  // Discovered but not audited (skipped, deduplicated, over limit)

/** A URL discovered during crawling, with its discovery context. */
export interface DiscoveredLink {
  url: string;
  depth: number;
  discoveredFrom: string;
}

/**
 * Coverage summary for a multi-page crawl job.
 * Stored in lighthouse_scores.crawlCoverage so no DB migration is needed.
 */
export interface CrawlCoverage {
  discoveredUrls: number;
  queuedUrls: number;
  analyzedPages: number;
  failedPages: number;
  skippedPages: number;
  deduplicatedUrls: number;
  auditLevel: 'fetch-only';
  limitations: string[];
}

export interface CrawledPage {
  url: string;
  requestedUrl?: string;
  finalUrl?: string;
  statusCode: number;
  ttfb: number;
  bytes: number;
  title: string;
  /** null when the page was not successfully analyzed (HTTP error, network error) */
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  llmReadiness: number | null;
  securityHeaders?: SecurityHeaderResult[];
  /** Stable identifier for this page within the analysis job */
  pageId?: string;
  /** Discovery depth (0 = root, 1 = directly linked from root, …) */
  depth?: number;
  /** URL of the page this link was found on; null for the root page */
  discoveredFrom?: string | null;
  /** Coarse page type classification based on URL path */
  pageType?: string;
  /** Tiered audit level — replaces measurementMode for new consumers */
  auditLevel?: PageAuditLevel;
  measurementMode?: 'full-fetch' | 'lightweight-fetch' | 'fetch-status-only';
  auditLabel?: 'Full fetch audit' | 'Lightweight fetch audit' | 'Fetch status only' | 'Measurement failed';
  accessibilityFindingCount?: number;
  accessibilityAuditLabel?: string;
  measurementError?: {
    code: 'TIMEOUT' | 'BLOCKED' | 'DNS_ERROR' | 'TLS_ERROR' | 'HTTP_ERROR' | 'BROWSER_ERROR' | 'EMPTY_PAGE' | 'UNSUPPORTED' | 'UNKNOWN';
    message: string;
    retryable: boolean;
  };
  seoResult?: import('../../types/seo').SeoPageResult;
  bestPracticesResult?: import('../../types/best-practices').BestPracticesPageResult;
  llmReadinessResult?: import('../../types/llm-readiness').LlmReadinessPageResult;
}

export interface ResourceAuditItem { url: string; type: 'script' | 'stylesheet'; }
export interface ImageAuditItem { src: string; issues: string[]; }
export interface ThirdPartyGroup { domain: string; count: number; types: string[]; }
export interface MixedContentItem { url: string; tag: string; }

export interface DetectedResource {
  url: string;
  type: 'script' | 'stylesheet' | 'image' | 'iframe' | 'font' | 'other';
  isRenderBlocking: boolean;
  isThirdParty: boolean;
  initiator: 'head' | 'body' | 'unknown';
  hasWidth?: boolean;
  hasHeight?: boolean;
  hasLazy?: boolean;
  hasModernFormat?: boolean;
  hasSrcset?: boolean;
  transferredBytes: null;
  decodedBytes: null;
  durationMs: null;
}

export interface ResourceAudit {
  renderBlocking: ResourceAuditItem[];
  imageIssues: ImageAuditItem[];
  thirdParty: ThirdPartyGroup[];
  mixedContent: MixedContentItem[];
  totalScripts: number;
  asyncScripts: number;
  deferScripts: number;
  totalStylesheets: number;
  totalImages: number;
  lazyImages: number;
  inlineScriptCount: number;
  /** Top resources detected from HTML — sanitized URLs, sizes unavailable in fetch-only */
  detectedResources: DetectedResource[];
}

export interface SecurityHeaderResult {
  header: string;
  present: boolean;
  value: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}
