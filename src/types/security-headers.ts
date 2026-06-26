// Security Headers Audit — Type System (security-headers-v2)

export type SecurityHeaderStatus =
  | 'strong'        // Header present with a well-configured value
  | 'present'       // Header present but with minor weaknesses or partial configuration
  | 'weak'          // Header present but with significant weaknesses
  | 'malformed'     // Header present but value is syntactically invalid
  | 'conflicting'   // Multiple headers or directives contradict each other
  | 'missing'       // Header is not present
  | 'not-applicable'// Header is not relevant for this response type or protocol
  | 'unavailable'   // Header could not be assessed (network error, etc.)
  | 'manual-review';// Header requires manual inspection — tool cannot determine quality

export type SecurityHeaderSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SecurityHeaderRolloutRisk = 'low' | 'medium' | 'high' | 'very-high';
export type SecurityHeaderApplicability = 'required' | 'recommended' | 'optional' | 'not-applicable';

export interface RedirectHop {
  url: string;
  status: number;
  location?: string;
  headers: Record<string, string[]>;
}

export interface ParsedCSP {
  directives: Record<string, string[]>;
  parseErrors: string[];
}

/** Per-header analysis result (v2 format — not backward compatible with analysis.ts SecurityHeaderResult) */
export interface SecurityHeaderAnalysisResult {
  headerName: string;
  displayName: string;
  status: SecurityHeaderStatus;
  severity: SecurityHeaderSeverity;
  applicability: SecurityHeaderApplicability;
  /** Points weight — 0 for informational-only headers */
  weight: number;
  earnedPoints: number;
  rawValues: string[];
  normalizedValue: string | null;
  parsedDetails?: Record<string, unknown>;
  source: 'final-response' | 'meta-http-equiv' | 'unavailable';
  rolloutRisk: SecurityHeaderRolloutRisk;
  safeToApplyDirectly: boolean;
  reason: string;
  recommendation: string;
}

export interface SecurityHeaderFinding {
  id: string;
  ruleId: string;
  headerName: string;
  title: string;
  description: string;
  status: SecurityHeaderStatus;
  severity: SecurityHeaderSeverity;
  confidence: 'high' | 'medium' | 'low';
  affectedOrigins: string[];
  affectedPages: string[];
  recommendation: string;
  rolloutRisk: SecurityHeaderRolloutRisk;
  safeToApplyDirectly: boolean;
  verificationSteps: string[];
  detectedValues?: string[];
  weaknesses?: string[];
}

export interface SecurityHeaderScoreBreakdown {
  headerName: string;
  displayName: string;
  applicability: SecurityHeaderApplicability;
  weight: number;
  earnedPoints: number;
  status: SecurityHeaderStatus;
  reason: string;
}

export interface SecurityHeadersCoverage {
  supportedChecks: number;
  executedChecks: number;
  unavailableChecks: number;
  notApplicableChecks: number;
  percentage: number;
  limitations: string[];
}

export interface SecurityHeadersAuditResult {
  score: number | null;
  scoreVersion: string;
  testedUrl: string;
  finalUrl: string;
  measuredAt: string;
  isHttps: boolean;
  redirectChain: RedirectHop[];
  headers: Record<string, SecurityHeaderAnalysisResult>;
  findings: SecurityHeaderFinding[];
  scoreBreakdown: SecurityHeaderScoreBreakdown[];
  coverage: SecurityHeadersCoverage;
  summary: {
    strong: number;
    present: number;
    weak: number;
    malformed: number;
    conflicting: number;
    missing: number;
    unavailable: number;
    notApplicable: number;
  };
  warnings: string[];
  errors: string[];
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface SecurityHeadersAuditError {
  code:
    | 'TIMEOUT'
    | 'BLOCKED'
    | 'DNS_ERROR'
    | 'TLS_ERROR'
    | 'HTTP_ERROR'
    | 'REDIRECT_LOOP'
    | 'TOO_MANY_REDIRECTS'
    | 'HEADER_ACCESS_ERROR'
    | 'INVALID_RESULT'
    | 'UNKNOWN';
  message: string;
  retryable: boolean;
}
