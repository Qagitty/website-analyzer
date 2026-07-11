/**
 * Indexing diagnostics — combines browser-observed signals with synthetic
 * crawler-access checks derived from the crawler registry.
 *
 * Important: the product does NOT promise ranking or guaranteed indexing.
 * This module surfaces diagnostic signals only.
 */

import {
  CRAWLERS_BY_ID,
  SEARCH_ENGINE_CRAWLERS,
  AI_BOT_CRAWLERS,
  checkRobotsAccess,
  type CrawlerDefinition,
} from './crawler-registry';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IndexabilityObservation {
  hasTitle:        boolean;
  titleLength?:    number;
  hasCanonical:    boolean;
  canonicalUrl?:   string;
  hasNoindex:      boolean;
  hasMetaDesc:     boolean;
  metaDescLength?: number;
  hasH1:           boolean;
  openGraphPresent: boolean;
  structuredDataTypes: string[];
}

export type AccessStatus = 'allowed' | 'disallowed' | 'unknown';

export interface CrawlerAccessResult {
  crawlerId:   string;
  crawlerName: string;
  group:       'search_engine' | 'ai_bot' | 'other';
  access:      AccessStatus;
  robotsAgent: string;
}

export interface IndexingDiagnostics {
  url:          string;
  checkedAt:    string;
  // From browser observations
  observation:  IndexabilityObservation | null;
  // Issues derived from observation
  observationIssues: ObservationIssue[];
  // Crawler access matrix derived from robots.txt
  crawlerAccess: CrawlerAccessResult[];
  crawlerAccessSummary: {
    allowedSearch:    number;
    disallowedSearch: number;
    allowedAI:        number;
    disallowedAI:     number;
  };
  // Combined signal
  indexabilityScore: number; // 0–100
  disclaimer: string;
}

export interface ObservationIssue {
  type:     string;
  severity: 'error' | 'warning' | 'info';
  message:  string;
}

// ── Observation analysis ──────────────────────────────────────────────────────

export function analyzeObservation(obs: IndexabilityObservation): ObservationIssue[] {
  const issues: ObservationIssue[] = [];

  if (!obs.hasTitle) {
    issues.push({ type: 'missing_title', severity: 'error', message: 'Page is missing a <title> tag.' });
  } else if (obs.titleLength !== undefined) {
    if (obs.titleLength < 10) {
      issues.push({ type: 'title_too_short', severity: 'warning', message: 'Title tag is very short (< 10 chars).' });
    } else if (obs.titleLength > 60) {
      issues.push({ type: 'title_too_long', severity: 'info', message: 'Title tag is long (> 60 chars); search engines may truncate it.' });
    }
  }

  if (obs.hasNoindex) {
    issues.push({ type: 'noindex_directive', severity: 'error', message: 'Page has a noindex directive — it will be excluded from search results.' });
  }

  if (!obs.hasCanonical) {
    issues.push({ type: 'missing_canonical', severity: 'warning', message: 'No canonical URL specified; search engines may choose a different URL.' });
  }

  if (!obs.hasMetaDesc) {
    issues.push({ type: 'missing_meta_desc', severity: 'info', message: 'No meta description found; search engines will generate their own snippet.' });
  } else if (obs.metaDescLength !== undefined && obs.metaDescLength > 160) {
    issues.push({ type: 'meta_desc_too_long', severity: 'info', message: 'Meta description is long (> 160 chars); may be truncated.' });
  }

  if (!obs.hasH1) {
    issues.push({ type: 'missing_h1', severity: 'warning', message: 'No H1 heading found on this page.' });
  }

  return issues;
}

// ── Robots.txt crawler access matrix ─────────────────────────────────────────

export function buildCrawlerAccessMatrix(robotsTxt: string | null): CrawlerAccessResult[] {
  const results: CrawlerAccessResult[] = [];
  const allCrawlers: CrawlerDefinition[] = Object.values(CRAWLERS_BY_ID);

  for (const crawler of allCrawlers) {
    const access = robotsTxt
      ? checkRobotsAccess(robotsTxt, crawler, '/')
      : 'unknown';

    const isSearch = SEARCH_ENGINE_CRAWLERS.some(c => c.id === crawler.id);
    const isAI     = AI_BOT_CRAWLERS.some(c => c.id === crawler.id);
    results.push({
      crawlerId:   crawler.id,
      crawlerName: crawler.name,
      group: isSearch ? 'search_engine' : isAI ? 'ai_bot' : 'other',
      access,
      robotsAgent: crawler.robotsName,
    });
  }

  return results;
}

// ── Score calculation ─────────────────────────────────────────────────────────

function calcIndexabilityScore(
  obs: IndexabilityObservation | null,
  issues: ObservationIssue[],
): number {
  if (!obs) return 50; // no observation data — neutral

  let score = 100;

  const errorPenalty   = 30;
  const warningPenalty = 10;
  const infoPenalty    = 0;

  for (const issue of issues) {
    if (issue.severity === 'error')   score -= errorPenalty;
    if (issue.severity === 'warning') score -= warningPenalty;
    if (issue.severity === 'info')    score -= infoPenalty;
  }

  return Math.max(0, Math.min(100, score));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildIndexingDiagnostics(input: {
  url:        string;
  observation: IndexabilityObservation | null;
  robotsTxt:  string | null;
}): IndexingDiagnostics {
  const { url, observation, robotsTxt } = input;
  const observationIssues = observation ? analyzeObservation(observation) : [];
  const crawlerAccess     = buildCrawlerAccessMatrix(robotsTxt);

  const searchResults = crawlerAccess.filter(r => r.group === 'search_engine');
  const aiResults     = crawlerAccess.filter(r => r.group === 'ai_bot');

  return {
    url,
    checkedAt:   new Date().toISOString(),
    observation,
    observationIssues,
    crawlerAccess,
    crawlerAccessSummary: {
      allowedSearch:    searchResults.filter(r => r.access === 'allowed').length,
      disallowedSearch: searchResults.filter(r => r.access === 'disallowed').length,
      allowedAI:        aiResults.filter(r => r.access === 'allowed').length,
      disallowedAI:     aiResults.filter(r => r.access === 'disallowed').length,
    },
    indexabilityScore: calcIndexabilityScore(observation, observationIssues),
    disclaimer: 'WebScore provides technical diagnostics only. It does not guarantee search engine indexing, crawl frequency, or search rankings.',
  };
}
