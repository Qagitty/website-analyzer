/**
 * §23 — Safe public serialization.
 *
 * Public-share and public API responses must omit:
 *   internal IDs beyond what the consumer needs, user IDs, organization IDs,
 *   raw callback metadata, secrets, private notes, internal error details,
 *   unredacted signed asset URLs, private evidence, model cost data,
 *   debug metadata.
 *
 * Do NOT return database rows directly.
 * Use explicit serializers for every public surface.
 */

import type { Analysis, AIInsights, LighthouseScores } from '@/types/analysis';
import { SCHEMA_VERSIONS } from '@/lib/contracts/schemas';

// ─── Public score surface ──────────────────────────────────────────────────────

export interface PublicScores {
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
  bestPractices: number | null;
  llmReadiness: number | null;
}

// ─── Public report summary (for list endpoints) ────────────────────────────────

export interface PublicReportSummary {
  schemaVersion: typeof SCHEMA_VERSIONS.REPORT_API;
  id: string;
  url: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
  scores: PublicScores;
  aiSummary: string | null;
  pagesAnalyzed: number;
  measurementMode: string | null;
}

// ─── Public report detail (for share endpoints) ────────────────────────────────

export interface PublicAiInsights {
  summary: string;
  overallScore: number;
  insights: AIInsights['insights'];
  quickWins: string[];
}

export interface PublicReport extends PublicReportSummary {
  aiInsights: PublicAiInsights | null;
  /** Signed screenshot URL, only when analysis is_public=true. */
  screenshotUrl: string | null;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function extractPublicScores(ls: LighthouseScores | null): PublicScores {
  if (!ls) {
    return {
      performance: null,
      accessibility: null,
      seo: null,
      bestPractices: null,
      llmReadiness: null,
    };
  }
  return {
    performance: typeof ls.performance === 'number' ? ls.performance : null,
    accessibility: typeof ls.accessibility === 'number' ? ls.accessibility : null,
    seo: typeof ls.seo === 'number' ? ls.seo : null,
    bestPractices: typeof ls.bestPractices === 'number' ? ls.bestPractices : null,
    llmReadiness: typeof ls.llmReadiness === 'number' ? ls.llmReadiness : null,
  };
}

function countAnalyzedPages(analysis: Analysis): number {
  if (Array.isArray(analysis.crawl_pages) && analysis.crawl_pages.length > 0) {
    return analysis.crawl_pages.length;
  }
  return 1;
}

function sanitizeAiInsights(ai: AIInsights | null): PublicAiInsights | null {
  if (!ai) return null;
  // Return only the safe consumer-facing fields; strip screenshot analysis,
  // raw performance objects, cost data, and internal diagnostics.
  return {
    summary: ai.summary,
    overallScore: ai.overallScore,
    insights: ai.insights,
    quickWins: ai.quickWins,
  };
}

// ─── Public serializers ────────────────────────────────────────────────────────

/**
 * Full public report for share endpoints (/share/[id]).
 * Strips user_id, internal error details, raw signed asset paths.
 */
export function serializePublicReport(analysis: Analysis): PublicReport {
  return {
    schemaVersion: SCHEMA_VERSIONS.REPORT_API,
    id: analysis.id,
    url: analysis.url,
    status: analysis.status,
    completedAt: analysis.completed_at,
    createdAt: analysis.created_at,
    scores: extractPublicScores(analysis.lighthouse_scores),
    aiSummary: analysis.ai_summary,
    pagesAnalyzed: countAnalyzedPages(analysis),
    measurementMode: analysis.lighthouse_scores?.measurementMode ?? null,
    aiInsights: sanitizeAiInsights(analysis.ai_insights),
    // §23 — Only expose screenshot URL when the report is explicitly public
    screenshotUrl: analysis.is_public ? (analysis.screenshot_url ?? null) : null,
  };
}

/**
 * Lightweight summary for list/index endpoints.
 * No AI insights, no screenshot URL.
 */
export function serializePublicReportSummary(analysis: Analysis): PublicReportSummary {
  return {
    schemaVersion: SCHEMA_VERSIONS.REPORT_API,
    id: analysis.id,
    url: analysis.url,
    status: analysis.status,
    completedAt: analysis.completed_at,
    createdAt: analysis.created_at,
    scores: extractPublicScores(analysis.lighthouse_scores),
    aiSummary: analysis.ai_summary,
    pagesAnalyzed: countAnalyzedPages(analysis),
    measurementMode: analysis.lighthouse_scores?.measurementMode ?? null,
  };
}
