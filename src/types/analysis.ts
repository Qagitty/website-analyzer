export type AnalysisStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';
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

export interface NetworkSummary {
  totalRequests: number;
  totalBytes: number;
  failedRequests: number;
  slowRequests: number;
}

export interface AIInsight {
  category: 'performance' | 'accessibility' | 'ux' | 'seo' | 'security';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  codeExample?: string | null;
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
  area: string;           // e.g. "Hero section", "Navigation"
  severity: 'critical' | 'major' | 'minor';
  designExpected: string; // what the design shows
  liveSite: string;       // what the live site shows
  suggestion: string;     // how to fix it
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
}
