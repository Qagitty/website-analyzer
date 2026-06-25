/**
 * Performance analysis types for the Next.js application layer.
 * These mirror the shapes produced by src/workers/analyzer/perf-score.ts
 * and stored as JSONB in lighthouse_scores.performanceAudit.
 */

export type MetricStatus = 'good' | 'needs-improvement' | 'poor' | 'unavailable';

// ── Opportunities ─────────────────────────────────────────────────────────────

export interface PerformanceOpportunity {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  source: string;
  description: string;
  evidence: string[];
  affectedResources: string[];
  estimatedSavingsMs?: number;
  estimatedSavingsBytes?: number;
  recommendation: string;
}

// ── Detected resources (from HTML parsing — no size/timing data) ──────────────

export type DetectedResourceType = 'script' | 'stylesheet' | 'image' | 'iframe' | 'font' | 'other';

export interface DetectedResource {
  url: string;
  type: DetectedResourceType;
  isRenderBlocking: boolean;
  isThirdParty: boolean;
  initiator: 'head' | 'body' | 'unknown';
  /** Images only */
  hasWidth?: boolean;
  hasHeight?: boolean;
  hasLazy?: boolean;
  hasModernFormat?: boolean;
  hasSrcset?: boolean;
  /** Size data is NOT available in fetch-only mode */
  transferredBytes: null;
  decodedBytes: null;
  durationMs: null;
}

// ── Resource summary ──────────────────────────────────────────────────────────

export interface ResourceSummaryData {
  /** Mode that produced this summary */
  measurementMode: 'fetch-only' | 'browser' | 'hybrid';
  /** Resources detected from HTML parsing */
  detectedRequestCount: number;
  /** HTML document transferred bytes (real measurement) */
  htmlTransferredBytes: number;
  /** Sub-resource byte breakdown — null in fetch-only mode */
  jsBytes: number | null;
  cssBytes: number | null;
  imageBytes: number | null;
  fontBytes: number | null;
  thirdPartyBytes: number | null;
  /** Detected script counts */
  totalScripts: number;
  asyncScripts: number;
  deferScripts: number;
  inlineScriptCount: number;
  totalStylesheets: number;
  totalImages: number;
  lazyImages: number;
  thirdPartyDomainCount: number;
  /** Top detected resources — sanitized URLs, no size data */
  detectedResources: DetectedResource[];
}

// ── Structured measurement failure ───────────────────────────────────────────

export interface PerformanceMeasurementError {
  code:
    | 'TIMEOUT'
    | 'BLOCKED'
    | 'DNS_ERROR'
    | 'TLS_ERROR'
    | 'HTTP_ERROR'
    | 'BROWSER_ERROR'
    | 'EMPTY_PAGE'
    | 'UNSUPPORTED'
    | 'UNKNOWN';
  message: string;
  retryable: boolean;
}

// ── Crawled-page measurement label ───────────────────────────────────────────

export type AuditLabel =
  | 'full-fetch'         // root page — 3× TTFB + full resourceAudit
  | 'lightweight-fetch'  // crawled page — single fetch + resourceAudit
  | 'fetch-status-only'  // minimal — status code only, no score
  | 'failed';            // measurement failed

export type MeasurementSource =
  | 'browser-lab'   // real browser, lab conditions
  | 'fetch-timing'  // real HTTP timing
  | 'estimated'     // derived via a formula from other measurements
  | 'not-measured'; // requires browser — unavailable in fetch-only mode

export type MeasurementConfidence = 'high' | 'medium' | 'low' | 'none';

export type MeasurementMode = 'browser' | 'fetch-only' | 'hybrid';

export interface PerformanceMetric {
  name: string;
  value: number | null;
  unit: 'ms' | 'score' | 'bytes';
  status: MetricStatus;
  threshold: { good: number; poor: number; unit: string } | null;
  source: MeasurementSource;
  confidence: MeasurementConfidence;
  isMeasured: boolean;
  description: string;
}

/**
 * Explains how a single factor contributed to the final performance score.
 * The frontend should render one row per item so users can see exactly why
 * they received a particular score.
 */
export interface PerformanceScoreBreakdown {
  category: string;
  weight: number;
  normalizedScore: number | null;
  weightedContribution: number | null;
  reason: string;
}

export interface PerformanceAuditResult {
  score: number;
  scoreVersion: string;
  measurementMode: MeasurementMode;
  measuredAt: string;
  testedUrl: string;
  finalUrl: string;
  metrics: {
    lcp:  PerformanceMetric;
    cls:  PerformanceMetric;
    ttfb: PerformanceMetric;
    tbt:  PerformanceMetric;
    fcp:  PerformanceMetric;
    inp:  PerformanceMetric;
  };
  scoreBreakdown: PerformanceScoreBreakdown[];
  resources: {
    requestCount: number | null;
    transferredBytes: number | null;
    jsBytes: number | null;
    cssBytes: number | null;
    imageBytes: number | null;
    fontBytes: number | null;
    thirdPartyBytes: number | null;
  };
  warnings: string[];
}
