// Best Practices Audit Type System — v1
// Covers sections 3, 4, 5, 36 of the Best Practices Audit spec.

export type BestPracticeFindingStatus =
  | 'passed'
  | 'failed'
  | 'warning'
  | 'manual-review'
  | 'not-applicable'
  | 'unavailable';

export type BestPracticeSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type BestPracticeSource =
  | 'http-header'
  | 'browser-console'
  | 'rendered-dom'
  | 'network'
  | 'html'
  | 'javascript'
  | 'manifest'
  | 'service-worker'
  | 'heuristic';

export type BestPracticeCategory =
  | 'security-headers'
  | 'https'
  | 'mixed-content'
  | 'third-party'
  | 'external-links'
  | 'deprecated-api'
  | 'resource-integrity'
  | 'cookies'
  | 'iframes'
  | 'pwa'
  | 'runtime'
  | 'resilience'
  | 'other';

export interface BestPracticeEvidence {
  url?: string;
  resourceUrl?: string;
  headerName?: string;
  expected?: string;
  actual?: string;
  consoleMessage?: string;
  lineNumber?: number;
  columnNumber?: number;
  selector?: string;
  html?: string;
  source?: BestPracticeSource;
}

export interface BestPracticeFinding {
  id: string;
  ruleId: string;
  category: BestPracticeCategory;
  title: string;
  description: string;
  status: BestPracticeFindingStatus;
  severity: BestPracticeSeverity;
  confidence: 'high' | 'medium' | 'low';
  source: BestPracticeSource;
  affectedPages: string[];
  evidence: BestPracticeEvidence[];
  recommendation: string;
  safeToApplyDirectly: boolean;
  verificationSteps: string[];
}

export interface BestPracticeScoreBreakdown {
  category: string;
  weight: number;
  score: number | null;
  weightedContribution: number | null;
  passedChecks: number;
  failedChecks: number;
  unavailableChecks: number;
  reason: string;
}

export interface BestPracticeCoverage {
  supportedChecks: number;
  executedChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  unavailableChecks: number;
  manualReviewChecks: number;
  percentage: number;
  limitations: string[];
}

export interface BestPracticesAuditError {
  code:
    | 'TIMEOUT'
    | 'BLOCKED'
    | 'DNS_ERROR'
    | 'TLS_ERROR'
    | 'HTTP_ERROR'
    | 'BROWSER_ERROR'
    | 'HEADER_ERROR'
    | 'NETWORK_ERROR'
    | 'INVALID_RESULT'
    | 'UNKNOWN';
  message: string;
  retryable: boolean;
}

export interface SecurityHeaderDetail {
  header: string;
  present: boolean;
  value: string | null;
  status: 'present-strong' | 'present-weak' | 'present-malformed' | 'absent' | 'not-applicable' | 'manual-review';
  strength: 'strong' | 'moderate' | 'weak' | 'absent' | 'unknown';
  recommendation: string;
  rolloutRisk: 'low' | 'medium' | 'high';
  safeToApplyDirectly: boolean;
  notes?: string;
}

export interface BestPracticesAuditResult {
  version: 'bp-v1';
  score: number | null;
  scoreVersion: string;
  auditMode: 'static' | 'browser' | 'hybrid';
  testedUrl: string;
  finalUrl: string;
  measuredAt: string;
  findings: BestPracticeFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    passed: number;
    manualReview: number;
    warnings: number;
  };
  categoryScores: BestPracticeScoreBreakdown[];
  coverage: BestPracticeCoverage;
  securityHeaders: SecurityHeaderDetail[];
  isHttps: boolean;
  redirectChain: string[];
  warnings: string[];
  errors: BestPracticesAuditError[];
}

// Lightweight result for each crawled page (no async fetches beyond what's already done)
export interface BestPracticesPageResult {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  isHttps: boolean;
  score: number | null;
  coverage: number | null;
  auditLabel: 'Full BP audit' | 'Lightweight BP scan' | 'Fetch status only' | 'Not analyzed' | 'Audit failed';
  securityHeadersPresent: number;
  securityHeadersTotal: number;
  criticalFindings: number;
  highFindings: number;
}
