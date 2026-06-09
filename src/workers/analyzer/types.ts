export type UrlValidationResult = {
  isValid: boolean;
  reason?: string;
  statusCode?: number;
  finalUrl?: string;
  errorType?:
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
  authToken: string;
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

export interface Scores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  estimatedLcp: number;
  scoreBreakdown: ScoreBreakdown;
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

export interface CrawledPage {
  url: string;
  statusCode: number;
  ttfb: number;
  bytes: number;
  title: string;
  performance: number;
  seo: number;
  accessibility: number;
  llmReadiness: number;
}

export interface ResourceAuditItem { url: string; type: 'script' | 'stylesheet'; }
export interface ImageAuditItem { src: string; issues: string[]; }
export interface ThirdPartyGroup { domain: string; count: number; types: string[]; }
export interface MixedContentItem { url: string; tag: string; }

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
}

export interface SecurityHeaderResult {
  header: string;
  present: boolean;
  value: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}
