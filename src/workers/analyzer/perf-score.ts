/**
 * Versioned performance scoring for fetch-only mode.
 * Import thresholds and weights exclusively from ./thresholds — never duplicate them here.
 *
 * Browser mode scoring is not implemented in this module.
 * When browser execution is available (e.g. Cloudflare Browser Rendering, Playwright),
 * create a separate `computeBrowserScore()` function that consumes real CWV values
 * and uses the CWV_THRESHOLDS from ./thresholds with the weights in BROWSER_WEIGHTS.
 * Set measurementMode = 'browser' on the resulting PerformanceAuditResult.
 */

import {
  CWV_THRESHOLDS,
  FETCH_SCORE_WEIGHTS,
  SCORE_VERSION,
  MetricStatus,
  classify,
  normalize3tier,
} from './thresholds';

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface PerformanceScoreBreakdown {
  category: string;
  weight: number;
  normalizedScore: number | null;
  weightedContribution: number | null;
  reason: string;
}

export type MeasurementSource =
  | 'browser-lab'       // real browser, lab conditions (Lighthouse / Playwright)
  | 'fetch-timing'      // real HTTP timing from fetch()
  | 'estimated'         // derived from other measurements via a formula
  | 'not-measured';     // would require a browser — unavailable in fetch-only mode

export type MeasurementConfidence = 'high' | 'medium' | 'low' | 'none';

export interface PerformanceMetricResult {
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

export interface PerformanceAuditPayload {
  score: number;
  scoreVersion: string;
  measurementMode: 'fetch-only' | 'browser' | 'hybrid';
  measuredAt: string;
  testedUrl: string;
  finalUrl: string;
  metrics: {
    lcp:  PerformanceMetricResult;
    cls:  PerformanceMetricResult;
    ttfb: PerformanceMetricResult;
    tbt:  PerformanceMetricResult;
    fcp:  PerformanceMetricResult;
    inp:  PerformanceMetricResult;
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

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface FetchOnlyInputs {
  ttfb: number;
  ttfbSamples?: number[];
  estimatedLcp: number;
  htmlBytes: number;
  renderBlockingCount: number;
  imageIssueCount: number;
  totalImages: number;
  thirdPartyCount: number;
  testedUrl: string;
  finalUrl: string;
}

// ── Score computation ─────────────────────────────────────────────────────────

export function computeFetchOnlyScore(inputs: FetchOnlyInputs): {
  score: number;
  scoreVersion: string;
  breakdown: PerformanceScoreBreakdown[];
} {
  const {
    ttfb, estimatedLcp, htmlBytes,
    renderBlockingCount, imageIssueCount, totalImages, thirdPartyCount,
  } = inputs;

  const ttfbNorm = normalize3tier(ttfb, CWV_THRESHOLDS.ttfb);
  const lcpNorm  = normalize3tier(estimatedLcp, CWV_THRESHOLDS.lcp);
  const sizeNorm = htmlBytes < 100_000 ? 95
                 : htmlBytes < 300_000 ? 75
                 : htmlBytes < 500_000 ? 50 : 25;

  const rbNorm = renderBlockingCount === 0 ? 100
               : renderBlockingCount <= 2  ? 75
               : renderBlockingCount <= 5  ? 50 : 25;

  const imgRatio = totalImages > 0 ? imageIssueCount / totalImages : 0;
  const imgNorm  = imgRatio < 0.1 ? 100
                 : imgRatio < 0.3 ? 80
                 : imgRatio < 0.6 ? 55 : 25;

  const tpNorm = thirdPartyCount <= 2  ? 100
               : thirdPartyCount <= 5  ? 80
               : thirdPartyCount <= 10 ? 60 : 40;

  const W = FETCH_SCORE_WEIGHTS;

  const items: Array<{ key: string; norm: number; reason: string }> = [
    {
      key: 'ttfb',
      norm: ttfbNorm,
      reason: ttfbNorm >= 95
        ? `${ttfb}ms — good (target ≤${CWV_THRESHOLDS.ttfb.good}ms)`
        : ttfbNorm >= 65
          ? `${ttfb}ms — needs improvement (target ≤${CWV_THRESHOLDS.ttfb.good}ms)`
          : `${ttfb}ms — poor; add a CDN, enable server-side caching, or reduce server compute`,
    },
    {
      key: 'estimatedLcp',
      norm: lcpNorm,
      reason: `~${(estimatedLcp / 1000).toFixed(1)}s estimated (TTFB + HTML size formula, low confidence)` +
        (lcpNorm >= 95 ? '' : ` — target ≤${CWV_THRESHOLDS.lcp.good / 1000}s`),
    },
    {
      key: 'htmlSize',
      norm: sizeNorm,
      reason: sizeNorm >= 95
        ? `${Math.round(htmlBytes / 1024)}KB HTML — good`
        : `${Math.round(htmlBytes / 1024)}KB HTML — reduce inline scripts/styles, avoid large embedded SVGs`,
    },
    {
      key: 'renderBlocking',
      norm: rbNorm,
      reason: renderBlockingCount === 0
        ? 'No render-blocking resources in <head>'
        : `${renderBlockingCount} render-blocking resource(s); add async/defer to <script>, use media="print" for non-critical CSS`,
    },
    {
      key: 'imageOpt',
      norm: imgNorm,
      reason: totalImages === 0
        ? 'No images detected'
        : imgNorm >= 95
          ? `All ${totalImages} image(s) appear optimized`
          : `${imageIssueCount}/${totalImages} image(s) have issues (missing width/height → CLS, no loading="lazy", legacy format)`,
    },
    {
      key: 'thirdParty',
      norm: tpNorm,
      reason: thirdPartyCount <= 2
        ? `${thirdPartyCount} third-party domain(s) — acceptable`
        : `${thirdPartyCount} third-party domains; each adds a DNS lookup round-trip; audit and defer non-essential scripts`,
    },
  ];

  const breakdown: PerformanceScoreBreakdown[] = items.map(({ key, norm, reason }) => ({
    category: W[key].label,
    weight: W[key].weight,
    normalizedScore: norm,
    weightedContribution: Math.round(norm * W[key].weight * 10) / 10,
    reason,
  }));

  const score = Math.min(100, Math.max(0, Math.round(
    breakdown.reduce((sum, b) => sum + (b.weightedContribution ?? 0), 0),
  )));

  return { score, scoreVersion: SCORE_VERSION, breakdown };
}

// ── Full audit payload builder ────────────────────────────────────────────────

export function buildFetchOnlyAudit(
  inputs: FetchOnlyInputs,
  score: number,
  scoreVersion: string,
  breakdown: PerformanceScoreBreakdown[],
): PerformanceAuditPayload {
  const { ttfb, ttfbSamples, estimatedLcp, htmlBytes, testedUrl, finalUrl } = inputs;

  const ttfbStatus = classify('ttfb', ttfb);

  const lcp: PerformanceMetricResult = {
    name: 'Largest Contentful Paint',
    value: estimatedLcp,
    unit: 'ms',
    status: classify('lcp', estimatedLcp),
    threshold: { good: CWV_THRESHOLDS.lcp.good, poor: CWV_THRESHOLDS.lcp.poor, unit: 'ms' },
    source: 'estimated',
    confidence: 'low',
    isMeasured: false,
    description: `Estimated from TTFB + HTML size (formula: TTFB + ⌈HTML_bytes / 5000⌉ × 100ms). ` +
      `This is a rough proxy — run Chrome Lighthouse or WebPageTest for the real value.`,
  };

  const cls: PerformanceMetricResult = {
    name: 'Cumulative Layout Shift',
    value: null,
    unit: 'score',
    status: 'unavailable',
    threshold: { good: CWV_THRESHOLDS.cls.good, poor: CWV_THRESHOLDS.cls.poor, unit: 'score' },
    source: 'not-measured',
    confidence: 'none',
    isMeasured: false,
    description: 'CLS requires browser rendering to observe layout shifts. Not available in fetch-only mode.',
  };

  const ttfbMetric: PerformanceMetricResult = {
    name: 'Time to First Byte',
    value: ttfb,
    unit: 'ms',
    status: ttfbStatus,
    threshold: { good: CWV_THRESHOLDS.ttfb.good, poor: CWV_THRESHOLDS.ttfb.poor, unit: 'ms' },
    source: 'fetch-timing',
    confidence: 'high',
    isMeasured: true,
    description: ttfbSamples?.length
      ? `Median of ${ttfbSamples.length} HTTP fetches from Cloudflare edge: ${ttfbSamples.join('ms, ')}ms. ` +
        `Measures origin server response speed.`
      : 'Real HTTP response timing from Cloudflare edge. Measures origin server response speed.',
  };

  const tbt: PerformanceMetricResult = {
    name: 'Total Blocking Time',
    value: null,
    unit: 'ms',
    status: 'unavailable',
    threshold: { good: CWV_THRESHOLDS.tbt.good, poor: CWV_THRESHOLDS.tbt.poor, unit: 'ms' },
    source: 'not-measured',
    confidence: 'none',
    isMeasured: false,
    description: 'TBT measures main-thread blocking during page load. Requires browser script execution — not available in fetch-only mode.',
  };

  const fcp: PerformanceMetricResult = {
    name: 'First Contentful Paint',
    value: null,
    unit: 'ms',
    status: 'unavailable',
    threshold: { good: CWV_THRESHOLDS.fcp.good, poor: CWV_THRESHOLDS.fcp.poor, unit: 'ms' },
    source: 'not-measured',
    confidence: 'none',
    isMeasured: false,
    description: 'FCP requires browser rendering. Not available in fetch-only mode.',
  };

  const inp: PerformanceMetricResult = {
    name: 'Interaction to Next Paint',
    value: null,
    unit: 'ms',
    status: 'unavailable',
    threshold: { good: CWV_THRESHOLDS.inp.good, poor: CWV_THRESHOLDS.inp.poor, unit: 'ms' },
    source: 'not-measured',
    confidence: 'none',
    isMeasured: false,
    description: 'INP is a field metric requiring real user interactions in a browser session. Not measurable in lab or fetch-only mode.',
  };

  return {
    score,
    scoreVersion,
    measurementMode: 'fetch-only',
    measuredAt: new Date().toISOString(),
    testedUrl,
    finalUrl,
    metrics: { lcp, cls, ttfb: ttfbMetric, tbt, fcp, inp },
    scoreBreakdown: breakdown,
    resources: {
      requestCount: 1,
      transferredBytes: htmlBytes,
      jsBytes: null,
      cssBytes: null,
      imageBytes: null,
      fontBytes: null,
      thirdPartyBytes: null,
    },
    warnings: [
      'LCP is estimated, not measured. For accurate Core Web Vitals run Lighthouse in Chrome DevTools or use WebPageTest.',
      'CLS, TBT, FCP and INP require browser execution and are not available in fetch-only mode.',
    ],
  };
}
