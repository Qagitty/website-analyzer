/**
 * §3 — Normalized report view model.
 *
 * This module is the single transformation layer between the raw database
 * `Analysis` type and UI components.  Components must consume this view model
 * instead of binding directly to DB payloads.
 *
 * Rules:
 *  - Scores are NEVER recalculated here — only stored values are surfaced.
 *  - Legacy reports (no v2 audit objects) render with explicit unavailable states.
 *  - All identifiers are stable across re-renders (deterministic from stored IDs).
 */

import type { Analysis, LighthouseScores, CrawledPage } from '@/types/analysis';
import type { AccessibilityAuditResult } from '@/types/accessibility';
import type { SeoAuditResult } from '@/types/seo';
import type { BestPracticesAuditResult } from '@/types/best-practices';
import type { SecurityHeadersAuditResult } from '@/types/security-headers';

// ─── Score display ─────────────────────────────────────────────────────────────

export type ScoreColorClass = 'text-emerald-400' | 'text-amber-400' | 'text-red-400';
export type ScoreBarColor = 'bg-emerald-500' | 'bg-amber-500' | 'bg-red-500';

export function scoreColorClass(score: number): ScoreColorClass {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export function scoreBarColor(score: number): ScoreBarColor {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 45) return 'Poor';
  return 'Critical';
}

export function scoreGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

// ─── Score state ───────────────────────────────────────────────────────────────

export interface ScoreAvailable {
  available: true;
  value: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  colorClass: ScoreColorClass;
  barColor: ScoreBarColor;
}

export interface ScoreUnavailable {
  available: false;
  reason: 'no-data' | 'legacy' | 'not-applicable' | 'error' | 'partial';
  label: string;
}

export type CategoryScore = ScoreAvailable | ScoreUnavailable;

function makeScore(value: number | null | undefined, reason: ScoreUnavailable['reason'] = 'no-data'): CategoryScore {
  if (value == null || !Number.isFinite(value)) {
    return { available: false, reason, label: reasonLabel(reason) };
  }
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return {
    available: true,
    value: v,
    grade: scoreGrade(v),
    label: scoreLabel(v),
    colorClass: scoreColorClass(v),
    barColor: scoreBarColor(v),
  };
}

function reasonLabel(reason: ScoreUnavailable['reason']): string {
  switch (reason) {
    case 'legacy': return 'Not available for older reports';
    case 'error': return 'Analysis error';
    case 'partial': return 'Partially available';
    case 'not-applicable': return 'Not applicable';
    default: return 'Not available';
  }
}

// ─── Confidence ────────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceViewModel {
  level: ConfidenceLevel;
  label: string;
  description: string;
  colorClass: string;
}

function confidenceViewModel(level: ConfidenceLevel | null): ConfidenceViewModel | null {
  if (!level) return null;
  const map: Record<ConfidenceLevel, Omit<ConfidenceViewModel, 'level'>> = {
    high:   { label: 'High confidence',   description: 'Results based on direct measurement',    colorClass: 'text-emerald-400' },
    medium: { label: 'Medium confidence', description: 'Some checks require manual verification', colorClass: 'text-amber-400' },
    low:    { label: 'Low confidence',    description: 'Many checks could not be fully verified', colorClass: 'text-orange-400' },
  };
  return { level, ...map[level] };
}

// ─── Category view model ───────────────────────────────────────────────────────

export interface CategoryViewModel {
  id: string;
  label: string;
  sectionId: string;
  icon: string;
  score: CategoryScore;
  coverage: number | null;
  confidence: ConfidenceViewModel | null;
  auditMode: string | null;
  auditModeLabel: string | null;
  criticalCount: number;
  highCount: number;
  findingCount: number;
  passCount: number;
  manualReviewCount: number;
  hasV2Audit: boolean;
  isLegacy: boolean;
  topLimitation: string | null;
}

// ─── Overview view model ───────────────────────────────────────────────────────

export interface OverviewViewModel {
  overallScore: number | null;
  grade: string;
  gradeLabel: string;
  gradeColor: string;
  gradeRing: string;
  criticalFindings: number;
  highFindings: number;
  quickWinCount: number;
  manualReviewCount: number;
  pagesAnalyzed: number;
  pagesDiscovered: number;
  crawlCoverage: number | null;
  auditMode: string | null;
  auditModeLabel: string | null;
  isLegacy: boolean;
  limitations: string[];
  aiSummary: string | null;
}

// ─── Top-level report view model ───────────────────────────────────────────────

export interface ReportViewModel {
  id: string;
  url: string;
  origin: string;
  domain: string;
  analyzedAt: string | null;
  overview: OverviewViewModel;
  categories: CategoryViewModel[];
  /** Whether all category audits are v2 (fully normalized) */
  isFullyV2: boolean;
}

// ─── Category builders ─────────────────────────────────────────────────────────

function buildPerformanceCategory(ls: LighthouseScores): CategoryViewModel {
  const audit = ls.performanceAudit;
  const hasV2 = !!audit;
  const score = makeScore(ls.performance, hasV2 ? undefined : 'legacy');

  let criticalCount = 0;
  let highCount = 0;
  let findingCount = 0;
  let passCount = 0;
  let manualReviewCount = 0;
  let topLimitation: string | null = null;

  if (audit) {
    // Derive issue counts from opportunities (separate field on LighthouseScores)
    const opportunities = ls.opportunities ?? [];
    for (const opp of opportunities) {
      findingCount++;
      const sev = (opp.severity ?? '').toLowerCase();
      if (sev === 'critical') criticalCount++;
      else if (sev === 'high') highCount++;
    }
    // Count "passed" metrics
    const metrics = audit.metrics ? Object.values(audit.metrics) : [];
    passCount = metrics.filter(m => m.status === 'good').length;

    topLimitation = audit.measurementMode === 'fetch-only'
      ? 'Fetch-only mode — browser timing metrics (LCP, CLS) are estimates only'
      : null;
  }

  const mode = ls.measurementMode ?? (hasV2 ? null : 'fetch-only');
  const modeLabelMap: Record<string, string> = {
    'fetch-only': 'Fetch-only (no browser)',
    'browser': 'Full browser',
    'hybrid': 'Hybrid',
  };

  return {
    id: 'performance',
    label: 'Performance',
    sectionId: 'performance',
    icon: '⚡',
    score,
    coverage: hasV2 ? null : null,
    confidence: confidenceViewModel(
      mode === 'browser' ? 'high' : mode === 'hybrid' ? 'medium' : 'low'
    ),
    auditMode: mode ?? null,
    auditModeLabel: mode ? (modeLabelMap[mode] ?? mode) : null,
    criticalCount,
    highCount,
    findingCount,
    passCount,
    manualReviewCount,
    hasV2Audit: hasV2,
    isLegacy: !hasV2,
    topLimitation,
  };
}

function buildAccessibilityCategory(ls: LighthouseScores): CategoryViewModel {
  const audit = ls.accessibilityAudit as AccessibilityAuditResult | undefined;
  const hasV2 = !!audit;
  const score = makeScore(ls.accessibility, hasV2 ? undefined : 'legacy');

  let criticalCount = 0;
  let highCount = 0;
  let findingCount = 0;
  let passCount = 0;
  let manualReviewCount = 0;
  let topLimitation: string | null = null;

  if (audit) {
    const sb = audit.scoreBreakdown;
    criticalCount = (sb?.confirmedCritical ?? 0) + (sb?.confirmedSerious ?? 0);
    highCount = (sb?.likelyCritical ?? 0) + (sb?.likelySerious ?? 0);
    findingCount = audit.findings.filter(
      f => f.status !== 'passed' && f.status !== 'not-applicable'
    ).length;
    passCount = audit.findings.filter(
      f => f.status === 'passed'
    ).length;
    manualReviewCount = sb?.manualReviewItems ?? 0;
    topLimitation = audit.mode === 'static-html-only'
      ? 'Static HTML only — dynamic content, modals, and ARIA live regions not evaluated'
      : null;
    if (audit.error?.partial) {
      topLimitation = 'Partial results — HTML was too large or analysis timed out';
    }
  }

  return {
    id: 'accessibility',
    label: 'Accessibility',
    sectionId: 'accessibility',
    icon: '♿',
    score,
    coverage: null,
    confidence: confidenceViewModel(hasV2 ? 'medium' : 'low'),
    auditMode: hasV2 ? 'static-html-only' : null,
    auditModeLabel: hasV2 ? 'Static HTML analysis' : null,
    criticalCount,
    highCount,
    findingCount,
    passCount,
    manualReviewCount,
    hasV2Audit: hasV2,
    isLegacy: !hasV2,
    topLimitation,
  };
}

function buildSeoCategory(ls: LighthouseScores): CategoryViewModel {
  const audit = ls.seoAudit as SeoAuditResult | undefined;
  const hasV2 = !!audit;
  const score = makeScore(ls.seo, hasV2 ? undefined : 'legacy');

  let criticalCount = 0;
  let highCount = 0;
  let findingCount = 0;
  let passCount = 0;
  let manualReviewCount = 0;
  let coverage: number | null = null;
  let topLimitation: string | null = null;

  if (audit) {
    const findings = audit.findings ?? [];
    for (const f of findings) {
      if (f.status === 'passed' || f.status === 'not-applicable') { passCount++; continue; }
      if (f.status === 'manual-review') { manualReviewCount++; continue; }
      findingCount++;
      const sev = (f.severity ?? '').toLowerCase();
      if (sev === 'critical') criticalCount++;
      else if (sev === 'high') highCount++;
    }
    coverage = audit.coverage?.percentage ?? null;
    const lims = audit.coverage?.limitations ?? [];
    topLimitation = lims[0] ?? null;
  }

  const modeLabel: Record<string, string> = {
    'fetch-only': 'Fetch-only',
    'rendered': 'Rendered (full browser)',
    'hybrid': 'Hybrid',
  };

  return {
    id: 'seo',
    label: 'SEO',
    sectionId: 'seo',
    icon: '🔍',
    score,
    coverage,
    confidence: confidenceViewModel(
      audit?.auditMode === 'rendered' ? 'high'
        : audit?.auditMode === 'hybrid' ? 'medium'
        : hasV2 ? 'medium'
        : 'low'
    ),
    auditMode: audit?.auditMode ?? null,
    auditModeLabel: audit?.auditMode ? (modeLabel[audit.auditMode] ?? audit.auditMode) : null,
    criticalCount,
    highCount,
    findingCount,
    passCount,
    manualReviewCount,
    hasV2Audit: hasV2,
    isLegacy: !hasV2,
    topLimitation,
  };
}

function buildBestPracticesCategory(ls: LighthouseScores): CategoryViewModel {
  const audit = ls.bestPracticesAudit as BestPracticesAuditResult | undefined;
  const hasV2 = !!audit;
  const score = makeScore(ls.bestPractices, hasV2 ? undefined : 'legacy');

  let criticalCount = 0;
  let highCount = 0;
  let findingCount = 0;
  let passCount = 0;
  let manualReviewCount = 0;
  let coverage: number | null = null;
  let topLimitation: string | null = null;

  if (audit) {
    const summary = audit.summary;
    criticalCount = summary?.critical ?? 0;
    highCount = summary?.high ?? 0;
    findingCount = (summary?.critical ?? 0) + (summary?.high ?? 0) + (summary?.medium ?? 0) + (summary?.low ?? 0);
    passCount = summary?.passed ?? 0;
    manualReviewCount = summary?.manualReview ?? 0;
    coverage = (audit.coverage as any)?.percentage ?? null;
    topLimitation = audit.auditMode === 'static'
      ? 'Static analysis only — runtime behaviour not evaluated'
      : null;
  }

  const modeLabel: Record<string, string> = {
    'static': 'Static analysis',
    'browser': 'Full browser',
    'hybrid': 'Hybrid',
  };

  return {
    id: 'best-practices',
    label: 'Best Practices',
    sectionId: 'best-practices',
    icon: '✅',
    score,
    coverage,
    confidence: confidenceViewModel(
      audit?.auditMode === 'browser' ? 'high'
        : audit?.auditMode === 'hybrid' ? 'medium'
        : hasV2 ? 'medium'
        : 'low'
    ),
    auditMode: audit?.auditMode ?? null,
    auditModeLabel: audit?.auditMode ? (modeLabel[audit.auditMode] ?? audit.auditMode) : null,
    criticalCount,
    highCount,
    findingCount,
    passCount,
    manualReviewCount,
    hasV2Audit: hasV2,
    isLegacy: !hasV2,
    topLimitation,
  };
}

function buildSecurityCategory(ls: LighthouseScores): CategoryViewModel {
  const audit = ls.securityHeadersAudit as SecurityHeadersAuditResult | undefined;
  const hasV2 = !!audit;

  const rawScore = audit?.score ?? null;
  const score = makeScore(rawScore, hasV2 ? undefined : 'not-applicable');

  let criticalCount = 0;
  let highCount = 0;
  let findingCount = 0;
  let passCount = 0;
  let manualReviewCount = 0;
  let topLimitation: string | null = null;

  if (audit) {
    const findings = audit.findings ?? [];
    for (const f of findings) {
      const sev = (f.severity ?? '').toLowerCase();
      const st = f.status ?? '';
      if (st === 'strong' || st === 'present') { passCount++; continue; }
      if (st === 'not-applicable') continue;
      if (st === 'manual-review') { manualReviewCount++; continue; }
      if (st === 'unavailable') continue;
      findingCount++;
      if (sev === 'critical') criticalCount++;
      else if (sev === 'high') highCount++;
    }
    if (audit.error) {
      topLimitation = 'Security headers could not be fully assessed';
    } else if (!audit.isHttps) {
      topLimitation = 'Site not served over HTTPS — some headers are not applicable';
    }
  }

  return {
    id: 'security',
    label: 'Security Headers',
    sectionId: 'security',
    icon: '🔒',
    score: hasV2 ? score : { available: false, reason: 'not-applicable', label: 'Requires v2 analysis' },
    coverage: null,
    confidence: confidenceViewModel(hasV2 ? 'high' : null),
    auditMode: null,
    auditModeLabel: null,
    criticalCount,
    highCount,
    findingCount,
    passCount,
    manualReviewCount,
    hasV2Audit: hasV2,
    isLegacy: !hasV2,
    topLimitation,
  };
}

function buildLlmReadinessCategory(ls: LighthouseScores): CategoryViewModel {
  const audit = ls.llmReadinessAudit;
  const hasV2 = !!audit;
  const legacyScore = typeof ls.llmReadiness === 'number' ? ls.llmReadiness : null;
  const score = makeScore(
    hasV2 ? audit!.score : legacyScore,
    legacyScore == null ? 'no-data' : 'legacy'
  );

  return {
    id: 'llm-readiness',
    label: 'AI Readiness',
    sectionId: 'llm-readiness',
    icon: '🤖',
    score,
    coverage: null,
    confidence: confidenceViewModel(hasV2 ? 'medium' : legacyScore != null ? 'low' : null),
    auditMode: null,
    auditModeLabel: null,
    criticalCount: 0,
    highCount: 0,
    findingCount: 0,
    passCount: 0,
    manualReviewCount: 0,
    hasV2Audit: hasV2,
    isLegacy: !hasV2,
    topLimitation: hasV2 ? null : legacyScore != null
      ? 'Legacy readiness score — limited detail available'
      : null,
  };
}

// ─── Overview builder ──────────────────────────────────────────────────────────

const GRADE_META: Record<string, { color: string; ring: string; label: string }> = {
  A: { color: 'text-emerald-400', ring: 'border-emerald-500', label: 'Excellent' },
  B: { color: 'text-emerald-400', ring: 'border-emerald-500', label: 'Good'      },
  C: { color: 'text-amber-400',   ring: 'border-amber-500',   label: 'Fair'      },
  D: { color: 'text-orange-400',  ring: 'border-orange-500',  label: 'Poor'      },
  F: { color: 'text-red-400',     ring: 'border-red-500',     label: 'Critical'  },
};

function buildOverview(
  ls: LighthouseScores | null,
  categories: CategoryViewModel[],
  pages: CrawledPage[] | null | undefined,
  aiSummary: string | null,
): OverviewViewModel {
  const scoredCats = categories.filter(c => c.score.available) as Array<CategoryViewModel & { score: ScoreAvailable }>;
  const coreCategories = ['performance', 'accessibility', 'seo', 'best-practices'];
  const coreCats = scoredCats.filter(c => coreCategories.includes(c.id));

  let overallScore: number | null = null;
  if (coreCats.length > 0) {
    overallScore = Math.round(
      coreCats.reduce((sum, c) => sum + (c.score as ScoreAvailable).value, 0) / coreCats.length
    );
  } else if (scoredCats.length > 0) {
    overallScore = Math.round(
      scoredCats.reduce((sum, c) => sum + (c.score as ScoreAvailable).value, 0) / scoredCats.length
    );
  }

  const grade = overallScore != null ? scoreGrade(overallScore) : 'F';
  const gradeMeta = GRADE_META[grade];

  const criticalFindings = categories.reduce((s, c) => s + c.criticalCount, 0);
  const highFindings = categories.reduce((s, c) => s + c.highCount, 0);
  const manualReviewCount = categories.reduce((s, c) => s + c.manualReviewCount, 0);

  const limitations = categories
    .map(c => c.topLimitation)
    .filter((l): l is string => l != null);

  const pagesAnalyzed = pages?.length ?? 1;
  const pagesDiscovered = pages?.length ?? 1;
  const crawlCoverage = (ls as any)?.crawlCoverage ?? null;

  const mode = ls?.measurementMode ?? null;
  const modeLabel: Record<string, string> = {
    'fetch-only': 'Fetch-only',
    'browser': 'Full browser',
    'hybrid': 'Hybrid',
  };

  const isLegacy = categories.every(c => c.isLegacy);
  const quickWinCount = 0; // populated from AI insights if available

  return {
    overallScore,
    grade,
    gradeLabel: gradeMeta.label,
    gradeColor: gradeMeta.color,
    gradeRing: gradeMeta.ring,
    criticalFindings,
    highFindings,
    quickWinCount,
    manualReviewCount,
    pagesAnalyzed,
    pagesDiscovered,
    crawlCoverage,
    auditMode: mode,
    auditModeLabel: mode ? (modeLabel[mode] ?? mode) : null,
    isLegacy,
    limitations,
    aiSummary,
  };
}

// ─── Main builder ──────────────────────────────────────────────────────────────

export function buildReportViewModel(analysis: Analysis): ReportViewModel {
  const ls = analysis.lighthouse_scores;
  const pages = analysis.crawl_pages;

  const categories: CategoryViewModel[] = ls ? [
    buildPerformanceCategory(ls),
    buildAccessibilityCategory(ls),
    buildSeoCategory(ls),
    buildBestPracticesCategory(ls),
    buildSecurityCategory(ls),
    buildLlmReadinessCategory(ls),
  ] : [];

  const overview = buildOverview(ls, categories, pages, analysis.ai_summary);

  let origin = '';
  let domain = '';
  try {
    const u = new URL(analysis.url);
    origin = u.origin;
    domain = u.hostname;
  } catch {
    domain = analysis.url;
  }

  const isFullyV2 = categories.length > 0 && categories.every(c => c.hasV2Audit);

  return {
    id: analysis.id,
    url: analysis.url,
    origin,
    domain,
    analyzedAt: analysis.completed_at,
    overview,
    categories,
    isFullyV2,
  };
}

// ─── Navigation section list ────────────────────────────────────────────────────

export interface NavSection {
  id: string;
  label: string;
  icon: string;
  score: CategoryScore | null;
  available: boolean;
}

function countScore(value: number, colorClass: ScoreColorClass): CategoryScore {
  return {
    available: true,
    value,
    grade: 'A',
    label: String(value),
    colorClass,
    barColor: 'bg-emerald-500',
  };
}

export function buildNavSections(
  vm: ReportViewModel,
  hasConsoleErrors: boolean,
  hasDesignComparison: boolean,
  crawlPageCount: number,
): NavSection[] {
  const categoryMap = Object.fromEntries(vm.categories.map(c => [c.id, c]));

  const issueCount = vm.overview.criticalFindings + vm.overview.highFindings;
  const actionPlanScore: CategoryScore | null = issueCount > 0
    ? countScore(issueCount, issueCount > 5 ? 'text-red-400' : 'text-amber-400')
    : null;

  const crawledPagesScore: CategoryScore | null = crawlPageCount > 0
    ? countScore(crawlPageCount, 'text-emerald-400')
    : null;

  const sections: NavSection[] = [
    { id: 'overview',      label: 'Overview',       icon: '📊', score: null,                                          available: true },
    { id: 'action-plan',   label: 'Action Plan',    icon: '🎯', score: actionPlanScore,                               available: issueCount > 0 },
    { id: 'performance',   label: 'Performance',    icon: '⚡', score: categoryMap['performance']?.score ?? null,     available: true },
    { id: 'accessibility', label: 'Accessibility',  icon: '♿', score: categoryMap['accessibility']?.score ?? null,  available: true },
    { id: 'seo',           label: 'SEO',            icon: '🔍', score: categoryMap['seo']?.score ?? null,            available: true },
    { id: 'best-practices',label: 'Best Practices', icon: '✅', score: categoryMap['best-practices']?.score ?? null, available: true },
    { id: 'security',      label: 'Security',       icon: '🔒', score: categoryMap['security']?.score ?? null,       available: !!categoryMap['security']?.hasV2Audit },
    { id: 'llm-readiness', label: 'AI Readiness',  icon: '🤖', score: categoryMap['llm-readiness']?.score ?? null,  available: !!categoryMap['llm-readiness'] },
    { id: 'console-errors',label: 'Console',        icon: '🐛', score: null,                                          available: hasConsoleErrors },
    { id: 'design',        label: 'Design',         icon: '🎨', score: null,                                          available: hasDesignComparison },
    { id: 'crawled-pages', label: 'Crawled Pages',  icon: '🕷️', score: crawledPagesScore,                            available: crawlPageCount > 0 },
  ];

  return sections.filter(s => s.available);
}
