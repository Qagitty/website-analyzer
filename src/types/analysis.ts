import type { PerformanceAuditResult, PerformanceOpportunity, ResourceSummaryData } from './performance';
import type { AccessibilityAuditResult } from './accessibility';
import type { SeoAuditResult, SeoPageResult } from './seo';
import type { BestPracticesAuditResult, BestPracticesPageResult } from './best-practices';

export type AnalysisStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';

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
export type MonitorFrequency = 'daily' | 'weekly';

export interface Monitor {
  id: string;
  user_id: string;
  url: string;
  frequency: MonitorFrequency;
  is_active: boolean;
  notify_on_score_drop: boolean;
  score_drop_threshold: number;
  last_run_at: string | null;
  next_run_at: string;
  last_analysis_id: string | null;
  last_scores: LighthouseScores | null;
  created_at: string;
  updated_at: string;
}

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  /** @deprecated use estimatedLcp — kept for backward compat with stored reports */
  lcp?: number | null;
  /** Estimated LCP from TTFB + HTML size formula. Low confidence — not a real browser measurement. */
  estimatedLcp?: number;
  /** Not measured — requires real browser interaction. Always null in fetch-only mode. */
  fid?: number | null;
  /** Not measured — requires browser layout observation. Always null in fetch-only mode. */
  cls?: number | null;
  ttfb: number;
  ttfbSamples?: number[];
  performanceVariance?: number;
  /** Describes what kind of analysis produced the scores */
  measurementMode?: 'fetch-only' | 'browser' | 'hybrid';
  /** Scoring formula version, for result comparability across deployments */
  scoreVersion?: string;
  /** Full structured performance audit — present on analyses created with score v2+ */
  performanceAudit?: PerformanceAuditResult;
  /** Evidence-based performance improvement opportunities */
  opportunities?: PerformanceOpportunity[];
  /** Full structured accessibility audit — present on analyses created with accessibility-v2+ */
  accessibilityAudit?: AccessibilityAuditResult;
  /** Full structured SEO audit — present on analyses created with SEO-v1+ */
  seoAudit?: SeoAuditResult;
  /** Full structured Best Practices audit — present on analyses created with bp-v1+ */
  bestPracticesAudit?: BestPracticesAuditResult;
  llmReadiness?: number;
  llmChecks?: Record<string, boolean>;
  llmSignals?: string[];
  securityHeaders?: SecurityHeaderResult[];
  scoreBreakdown?: ScoreBreakdown;
}

export interface CrawledPage {
  url: string;
  /** URL before any redirects */
  requestedUrl?: string;
  /** Final URL after redirects (may differ from url) */
  finalUrl?: string;
  statusCode: number;
  ttfb: number;
  bytes: number;
  title: string;
  performance: number;
  seo: number;
  accessibility: number;
  llmReadiness: number;
  securityHeaders?: SecurityHeaderResult[];
  /** What kind of audit was performed on this page */
  measurementMode?: 'full-fetch' | 'lightweight-fetch' | 'fetch-status-only';
  /** Human-readable label shown in the crawled-pages table */
  auditLabel?: 'Full fetch audit' | 'Lightweight fetch audit' | 'Fetch status only' | 'Measurement failed';
  /** Total accessibility findings count for this page (from accessibility-v2 audit) */
  accessibilityFindingCount?: number;
  /** Label for the accessibility audit method used on this page */
  accessibilityAuditLabel?: string;
  /** Structured failure reason when measurementMode is unavailable */
  measurementError?: {
    code: 'TIMEOUT' | 'BLOCKED' | 'DNS_ERROR' | 'TLS_ERROR' | 'HTTP_ERROR' | 'BROWSER_ERROR' | 'EMPTY_PAGE' | 'UNSUPPORTED' | 'UNKNOWN';
    message: string;
    retryable: boolean;
  };
  /** Lightweight per-page SEO scan result — present on crawled pages after SEO-v1+ */
  seoResult?: SeoPageResult;
  /** Lightweight per-page Best Practices scan result — present on crawled pages after bp-v1+ */
  bestPracticesResult?: BestPracticesPageResult;
}

export interface ConsoleError {
  message: string;
  type: 'error' | 'warning' | 'info';
  source: string;
  line?: number;
  timestamp: number;
}

export interface AccessibilityIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  nodes: string[];
  wcagCriteria: string[];
}

export interface ResourceAuditItem {
  url: string;
  type: 'script' | 'stylesheet';
}
export interface ImageAuditItem {
  src: string;
  issues: string[];
}
export interface ThirdPartyGroup {
  domain: string;
  count: number;
  types: string[];
}
export interface MixedContentItem {
  url: string;
  tag: string;
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
  detectedResources?: import('./performance').DetectedResource[];
}
export interface SecurityHeaderResult {
  header: string;
  present: boolean;
  value: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export interface NetworkSummary {
  totalRequests: number;
  totalBytes: number;
  failedRequests: number;
  slowRequests: number;
  resourceAudit?: ResourceAudit;
  resourceSummary?: ResourceSummaryData;
}

export interface AIInsight {
  category: 'performance' | 'accessibility' | 'ux' | 'seo' | 'security';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  codeExample?: string | null;
  beforeCode?: string | null;
  afterCode?: string | null;
  effortLevel?: 'low' | 'medium' | 'high';
  impactScore?: number;
  frameworkNotes?: {
    react?: string;
    nextjs?: string;
    vue?: string;
  } | null;
  wcagReference?: string | null;
  estimatedImpact: string;
}

export interface AIInsights {
  summary: string;
  overallScore: number;
  insights: AIInsight[];
  quickWins: string[];
  screenshot?: any;
  performance?: any;
  accessibility?: any;
  errors?: any;
}

export interface DesignMismatch {
  area: string;                  // e.g. "Hero section", "Navigation"
  severity: 'critical' | 'major' | 'minor';
  /** What the design mockup shows (preferred) */
  designExpects?: string;
  /** What the live site shows (preferred) */
  liveSiteShows?: string;
  /** CSS / code fix suggestion (preferred) */
  cssFix?: string;
  /** @deprecated use designExpects */
  designExpected?: string;
  /** @deprecated use liveSiteShows */
  liveSite?: string;
  /** @deprecated use cssFix */
  suggestion?: string;
}

export interface DesignComparison {
  fidelityScore: number;            // 0–100
  summary: string;
  mismatches: DesignMismatch[];
  matchingAreas: string[];          // things that look correct
}

export interface Analysis {
  id: string;
  user_id: string;
  url: string;
  status: AnalysisStatus;
  screenshot_url: string | null;
  design_screenshot_url: string | null;
  design_comparison: DesignComparison | null;
  lighthouse_scores: LighthouseScores | null;
  console_errors: ConsoleError[] | null;
  accessibility_issues: AccessibilityIssue[] | null;
  network_requests: NetworkSummary | null;
  ai_insights: AIInsights | null;
  ai_summary: string | null;
  is_public: boolean;
  error_message: string | null;
  queue_position: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  crawl_pages?: CrawledPage[] | null;
}
