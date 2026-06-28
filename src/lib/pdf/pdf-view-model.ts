/**
 * §2 — PDF presentation model.
 *
 * Maps the normalized ReportViewModel (same source as the web UI) to a
 * PDF-specific presentation layer.
 *
 * Rules:
 *  - All scores come from buildReportViewModel() — never recalculated here.
 *  - ScoreUnavailable states are preserved; they are NEVER rendered as 0.
 *  - URL sensitive query params are stripped before inclusion in the PDF.
 *  - Filename is sanitized to a safe predictable pattern.
 */

import type {
  ReportViewModel,
  CategoryScore,
} from '@/lib/report/view-model';
import type { Analysis } from '@/types/analysis';

export const PDF_TEMPLATE_VERSION = '2.0.0';

// ─── Score display ─────────────────────────────────────────────────────────────

export interface PdfScoreDisplay {
  /** Numeric value; null means the score is unavailable */
  value: number | null;
  /** Text for PDF: '85' | '—' | 'N/A' */
  displayText: string;
  /** Descriptive label: 'Good' | 'Unavailable' | 'Not applicable' | … */
  statusLabel: string;
  /** Hex color for the score number */
  colorHex: string;
  /** True when the score could not be measured */
  isUnavailable: boolean;
  /** Human-readable reason for unavailability; null when score is available */
  unavailableLabel: string | null;
}

// ─── Per-category metadata ─────────────────────────────────────────────────────

export interface PdfCategoryMeta {
  id: string;
  label: string;
  score: PdfScoreDisplay;
  /** e.g. '84% coverage' — null when not measured */
  coverageText: string | null;
  /** e.g. 'High confidence' — null when not determined */
  confidenceText: string | null;
  /** e.g. 'Fetch-only' — null when not applicable */
  auditModeText: string | null;
  isLegacy: boolean;
  criticalCount: number;
  highCount: number;
  passCount: number;
  manualReviewCount: number;
  topLimitation: string | null;
}

// ─── Report metadata ───────────────────────────────────────────────────────────

export interface PdfReportMeta {
  /** Clean hostname without protocol */
  domain: string;
  /** Full tested URL with sensitive query params stripped */
  testedUrl: string;
  /** Human-readable analysis date, e.g. '27 June 2026' */
  analysisDateStr: string;
  /** First 8 hex chars of the report UUID (uppercased) */
  safeReportId: string;
  pagesAnalyzed: number;
  isLegacy: boolean;
  pdfTemplateVersion: string;
  generatedAt: string;
}

// ─── Top-level PDF view model ──────────────────────────────────────────────────

export interface PdfViewModel {
  meta: PdfReportMeta;
  overallScore: number | null;
  grade: string;
  gradeLabel: string;
  criticalFindings: number;
  highFindings: number;
  manualReviewCount: number;
  aiSummary: string | null;
  limitations: string[];
  categories: PdfCategoryMeta[];
}

// ─── URL sanitization ──────────────────────────────────────────────────────────

const SENSITIVE_PARAMS = new Set([
  'token', 'key', 'auth', 'secret', 'password', 'pass', 'pw',
  'session', 'sid', 'sessid', 'sig', 'signature', 'nonce',
  'access_token', 'refresh_token', 'api_key', 'apikey',
]);

/** Strips well-known sensitive query params before embedding URLs in the PDF. */
export function sanitizePdfUrl(url: string): string {
  try {
    const u = new URL(url);
    const toDelete: string[] = [];
    u.searchParams.forEach((_, key) => {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) toDelete.push(key);
    });
    toDelete.forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return url;
  }
}

// ─── Filename sanitization ─────────────────────────────────────────────────────

/**
 * Returns a safe, predictable PDF filename.
 * Pattern: website-analysis-{domain}-{YYYY-MM-DD}.pdf
 *
 * §37 — never use raw hostname; always apply this function.
 */
export function sanitizePdfFilename(domain: string, dateStr: string): string {
  const safeDomain = domain
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 50);
  const safeDate = dateStr
    .replace(/[^0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 10);
  return `website-analysis-${safeDomain || 'unknown'}-${safeDate || 'nodate'}.pdf`;
}

// ─── Internal: score → display ─────────────────────────────────────────────────

function categoryScoreToDisplay(score: CategoryScore): PdfScoreDisplay {
  if (!score.available) {
    return {
      value: null,
      displayText: score.reason === 'not-applicable' ? 'N/A' : '—',
      statusLabel: score.label,
      colorHex: '#9ca3af',
      isUnavailable: true,
      unavailableLabel: score.label,
    };
  }
  const v = score.value;
  const hex = v >= 90 ? '#16a34a' : v >= 50 ? '#d97706' : '#dc2626';
  return {
    value: v,
    displayText: String(v),
    statusLabel: score.label,
    colorHex: hex,
    isUnavailable: false,
    unavailableLabel: null,
  };
}

// ─── Public builder ────────────────────────────────────────────────────────────

/**
 * §2 — Derives the PDF presentation model from the same normalized view model
 * used by the web report.  Scores, coverage, confidence, and audit modes are
 * taken directly from `vm`; the PDF layer only applies display adaptations
 * (truncation, label formatting) without touching score values.
 */
export function buildPdfViewModel(vm: ReportViewModel, analysis: Analysis): PdfViewModel {
  const sanitizedUrl = sanitizePdfUrl(analysis.url);

  const rawDate = analysis.completed_at ?? analysis.created_at;
  const analysisDateStr = rawDate
    ? new Date(rawDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Unknown date';

  const safeId = analysis.id.replace(/-/g, '').slice(0, 8).toUpperCase();

  const meta: PdfReportMeta = {
    domain: vm.domain,
    testedUrl: sanitizedUrl,
    analysisDateStr,
    safeReportId: safeId,
    pagesAnalyzed: vm.overview.pagesAnalyzed,
    isLegacy: vm.overview.isLegacy,
    pdfTemplateVersion: PDF_TEMPLATE_VERSION,
    generatedAt: new Date().toISOString(),
  };

  const categories: PdfCategoryMeta[] = vm.categories.map(cat => ({
    id: cat.id,
    label: cat.label,
    score: categoryScoreToDisplay(cat.score),
    coverageText: cat.coverage != null ? `${cat.coverage}% coverage` : null,
    confidenceText: cat.confidence?.label ?? null,
    auditModeText: cat.auditModeLabel ?? null,
    isLegacy: cat.isLegacy,
    criticalCount: cat.criticalCount,
    highCount: cat.highCount,
    passCount: cat.passCount,
    manualReviewCount: cat.manualReviewCount,
    topLimitation: cat.topLimitation,
  }));

  return {
    meta,
    overallScore: vm.overview.overallScore,
    grade: vm.overview.grade,
    gradeLabel: vm.overview.gradeLabel,
    criticalFindings: vm.overview.criticalFindings,
    highFindings: vm.overview.highFindings,
    manualReviewCount: vm.overview.manualReviewCount,
    aiSummary: vm.overview.aiSummary,
    limitations: vm.overview.limitations,
    categories,
  };
}
