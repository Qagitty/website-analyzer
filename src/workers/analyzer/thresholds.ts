/**
 * Single source of truth for all performance thresholds and score weights.
 * All other modules must import from here — never hardcode these values elsewhere.
 *
 * Thresholds follow Core Web Vitals definitions from https://web.dev/vitals/
 * Score weights are specific to our fetch-only heuristic formula (performance-v2).
 */

export type MetricStatus = 'good' | 'needs-improvement' | 'poor' | 'unavailable';

export interface Threshold {
  /** Value must be ≤ this for "good" */
  good: number;
  /** Value > good and ≤ poor = "needs-improvement"; value > poor = "poor" */
  poor: number;
  unit: 'ms' | 'score' | 'bytes' | 'count';
}

// ── Core Web Vitals (browser lab / field) ────────────────────────────────────

export const CWV_THRESHOLDS: Record<string, Threshold> = {
  lcp:  { good: 2500,  poor: 4000,  unit: 'ms'    },  // Largest Contentful Paint
  cls:  { good: 0.1,   poor: 0.25,  unit: 'score' },  // Cumulative Layout Shift
  ttfb: { good: 800,   poor: 1800,  unit: 'ms'    },  // Time to First Byte
  tbt:  { good: 200,   poor: 600,   unit: 'ms'    },  // Total Blocking Time (lab proxy for INP)
  fcp:  { good: 1800,  poor: 3000,  unit: 'ms'    },  // First Contentful Paint
  inp:  { good: 200,   poor: 500,   unit: 'ms'    },  // Interaction to Next Paint (field only)
};

/** Classify a metric value against its threshold (lower is better for all CWV). */
export function classify(key: string, value: number): MetricStatus {
  const t = CWV_THRESHOLDS[key];
  if (!t) return 'unavailable';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

// ── Fetch-only score weights (performance-v2) ─────────────────────────────────
// These weights govern how the 6 heuristic factors combine into a 0–100 score.
// Must sum to exactly 1.0.

export interface ScoreWeightEntry {
  weight: number;
  label: string;
}

export const FETCH_SCORE_WEIGHTS: Record<string, ScoreWeightEntry> = {
  ttfb:           { weight: 0.30, label: 'Time to First Byte (real measurement)' },
  estimatedLcp:   { weight: 0.20, label: 'Estimated LCP (heuristic)' },
  htmlSize:       { weight: 0.15, label: 'HTML document size' },
  renderBlocking: { weight: 0.20, label: 'Render-blocking resources' },
  imageOpt:       { weight: 0.10, label: 'Image optimization' },
  thirdParty:     { weight: 0.05, label: 'Third-party resource domains' },
} as const;

/** Canonical score version identifier — increment when the formula changes. */
export const SCORE_VERSION = 'performance-v2' as const;

// ── Normalize a raw metric value to a 0–100 normalized score ─────────────────

/** Standard 3-tier step normalization (95 / 65 / 30) used for CWV-equivalent metrics. */
export function normalize3tier(value: number, t: Threshold): number {
  if (value <= t.good) return 95;
  if (value <= t.poor) return 65;
  return 30;
}
