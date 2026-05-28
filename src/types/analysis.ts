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
  lcp: number;
  fid: number;
  cls: number;
  ttfb: number;
  ttfbSamples?: number[];
  performanceVariance?: number;
  llmReadiness?: number;
  llmChecks?: Record<string, boolean>;
  llmSignals?: string[];
  securityHeaders?: SecurityHeaderResult[];
  scoreBreakdown?: ScoreBreakdown;
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
