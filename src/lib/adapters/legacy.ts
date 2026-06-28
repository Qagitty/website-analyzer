/**
 * §27 — Legacy report adapters.
 *
 * Adapts historic report shapes to the current normalized Analysis type
 * without fabricating modern detail (§28).
 *
 * Adapters MUST:
 *  - preserve original values
 *  - mark unknown fields unavailable / null
 *  - add explicit legacy limitations
 *  - NOT invent coverage, confidence, audit mode, or score version
 *  - NOT recalculate historic scores
 *
 * §44 — Compatibility policy:
 *   The application reads analysis-result-v1 and v2.
 *   New analyses are written only as v2.
 *   v1 reports remain viewable but do not receive fabricated v2 metadata.
 */

import type { Analysis, LighthouseScores } from '@/types/analysis';

// ─── Adapter interface (§27) ───────────────────────────────────────────────────

export interface LegacyAdapter<TLegacy, TDomain> {
  /** Returns true when this adapter can handle the given input. */
  canHandle(input: unknown): boolean;
  /** Transforms legacy shape → current domain shape. */
  adapt(input: TLegacy): TDomain;
}

// ─── V1 flat-score adapter ─────────────────────────────────────────────────────

/**
 * Handles analyses with only flat numeric scores in lighthouse_scores
 * (no audit objects, no coverage, no confidence).
 *
 * §28 — The following fields are explicitly NOT fabricated for legacy reports:
 *   coverage, confidence, auditMode, scoreVersion, finding source, exact evidence.
 */
export const LegacyFlatScoreAdapter: LegacyAdapter<Analysis, Analysis> = {
  canHandle(input: unknown): boolean {
    if (!input || typeof input !== 'object') return false;
    const a = input as Record<string, unknown>;
    const ls = a.lighthouse_scores as Record<string, unknown> | null | undefined;
    if (!ls || typeof ls !== 'object') return false;
    return (
      !ls.performanceAudit &&
      !ls.seoAudit &&
      !ls.accessibilityAudit &&
      !ls.bestPracticesAudit &&
      !ls.llmReadinessAudit &&
      !ls.securityHeadersAudit &&
      (typeof ls.performance === 'number' ||
        ls.performance === null ||
        ls.performance === undefined)
    );
  },

  adapt(input: Analysis): Analysis {
    const ls = input.lighthouse_scores;
    if (!ls) return input;

    const adapted: LighthouseScores = {
      ...ls,
      // Preserve whatever measurementMode was stored; default to 'fetch-only'
      measurementMode: ls.measurementMode ?? 'fetch-only',
      // Mark score version as legacy so comparisons are not made across versions
      scoreVersion: ls.scoreVersion ?? 'v1-legacy',
      // §28 — Do NOT populate audit objects — they are unavailable in v1 reports
      performanceAudit: undefined,
      seoAudit: undefined,
      accessibilityAudit: undefined,
      bestPracticesAudit: undefined,
      llmReadinessAudit: undefined,
      securityHeadersAudit: undefined,
    };

    return { ...input, lighthouse_scores: adapted };
  },
};

// ─── Missing page IDs adapter ──────────────────────────────────────────────────

/**
 * Handles analyses where crawl_pages exists but some entries lack pageId.
 * Generates deterministic IDs from URL + array index (§14).
 *
 * §28 — pageId is generated deterministically from URL; no audit data is invented.
 */
export const LegacyCrawledPagesAdapter: LegacyAdapter<Analysis, Analysis> = {
  canHandle(input: unknown): boolean {
    if (!input || typeof input !== 'object') return false;
    const a = input as Record<string, unknown>;
    const pages = a.crawl_pages as unknown[] | null | undefined;
    if (!Array.isArray(pages) || pages.length === 0) return false;
    return pages.some(
      (p) => p && typeof p === 'object' && !(p as Record<string, unknown>).pageId,
    );
  },

  adapt(input: Analysis): Analysis {
    if (!Array.isArray(input.crawl_pages)) return input;

    const adaptedPages = input.crawl_pages.map((page, index) => {
      if (page.pageId) return page;
      const urlBase = Buffer.from(page.url ?? '').toString('base64url').slice(0, 16);
      return { ...page, pageId: `legacy-${urlBase}-${index}` };
    });

    return { ...input, crawl_pages: adaptedPages };
  },
};

// ─── Compose adapters ──────────────────────────────────────────────────────────

const ALL_ADAPTERS: LegacyAdapter<Analysis, Analysis>[] = [
  LegacyFlatScoreAdapter,
  LegacyCrawledPagesAdapter,
];

/**
 * Applies all applicable legacy adapters in sequence.
 * Each adapter runs only when `canHandle` returns true.
 * Order matters for overlapping cases.
 */
export function applyLegacyAdapters(analysis: Analysis): Analysis {
  return ALL_ADAPTERS.reduce((current, adapter) => {
    if (adapter.canHandle(current)) {
      return adapter.adapt(current);
    }
    return current;
  }, analysis);
}

/**
 * Returns true when the analysis appears to be a legacy v1 report
 * (flat scores, no structured audit objects).
 */
export function isLegacyAnalysis(analysis: Analysis): boolean {
  return LegacyFlatScoreAdapter.canHandle(analysis);
}
