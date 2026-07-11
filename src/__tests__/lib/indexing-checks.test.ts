import { describe, it, expect } from 'vitest';
import {
  analyzeObservation,
  buildCrawlerAccessMatrix,
  buildIndexingDiagnostics,
  type IndexabilityObservation,
} from '@/lib/site-connect/indexing-checks';
import { checkRobotsAccess, CRAWLERS_BY_ID } from '@/lib/site-connect/crawler-registry';

// ── analyzeObservation ────────────────────────────────────────────────────────

describe('analyzeObservation', () => {
  const goodObs: IndexabilityObservation = {
    hasTitle:            true,
    titleLength:         40,
    hasCanonical:        true,
    hasNoindex:          false,
    hasMetaDesc:         true,
    metaDescLength:      120,
    hasH1:               true,
    openGraphPresent:    true,
    structuredDataTypes: ['Organization'],
  };

  it('returns no issues for a perfect page', () => {
    expect(analyzeObservation(goodObs)).toHaveLength(0);
  });

  it('flags missing title as error', () => {
    const obs = { ...goodObs, hasTitle: false };
    const issues = analyzeObservation(obs);
    expect(issues.some(i => i.type === 'missing_title' && i.severity === 'error')).toBe(true);
  });

  it('flags noindex as error', () => {
    const obs = { ...goodObs, hasNoindex: true };
    const issues = analyzeObservation(obs);
    expect(issues.some(i => i.type === 'noindex_directive' && i.severity === 'error')).toBe(true);
  });

  it('flags missing canonical as warning', () => {
    const obs = { ...goodObs, hasCanonical: false };
    const issues = analyzeObservation(obs);
    expect(issues.some(i => i.type === 'missing_canonical' && i.severity === 'warning')).toBe(true);
  });

  it('flags very short title as warning', () => {
    const obs = { ...goodObs, titleLength: 5 };
    const issues = analyzeObservation(obs);
    expect(issues.some(i => i.type === 'title_too_short')).toBe(true);
  });

  it('flags long title as info', () => {
    const obs = { ...goodObs, titleLength: 80 };
    const issues = analyzeObservation(obs);
    expect(issues.some(i => i.type === 'title_too_long' && i.severity === 'info')).toBe(true);
  });

  it('flags missing H1 as warning', () => {
    const obs = { ...goodObs, hasH1: false };
    const issues = analyzeObservation(obs);
    expect(issues.some(i => i.type === 'missing_h1')).toBe(true);
  });
});

// ── crawler registry / robots.txt ─────────────────────────────────────────────

describe('checkRobotsAccess', () => {
  const googlebot = CRAWLERS_BY_ID['googlebot'];
  const gptbot    = CRAWLERS_BY_ID['gptbot'];

  it('allows by default when no disallow', () => {
    const robots = 'User-agent: *\nAllow: /\n';
    expect(checkRobotsAccess(robots, googlebot, '/')).toBe('allowed');
  });

  it('disallows when * rule blocks everything', () => {
    const robots = 'User-agent: *\nDisallow: /\n';
    expect(checkRobotsAccess(robots, googlebot, '/')).toBe('disallowed');
  });

  it('allows specific bot when * is blocked but specific is allowed', () => {
    const robots = [
      'User-agent: *',
      'Disallow: /',
      '',
      'User-agent: Googlebot',
      'Allow: /',
    ].join('\n');
    expect(checkRobotsAccess(robots, googlebot, '/')).toBe('allowed');
  });

  it('disallows GPTBot when explicitly blocked', () => {
    const robots = [
      'User-agent: GPTBot',
      'Disallow: /',
    ].join('\n');
    expect(checkRobotsAccess(robots, gptbot, '/')).toBe('disallowed');
  });

  it('returns unknown for null robots.txt', () => {
    expect(checkRobotsAccess(null as any, googlebot, '/')).toBe('unknown');
  });
});

// ── buildCrawlerAccessMatrix ──────────────────────────────────────────────────

describe('buildCrawlerAccessMatrix', () => {
  it('returns an entry for every registered crawler', () => {
    const matrix = buildCrawlerAccessMatrix('User-agent: *\nAllow: /\n');
    const ids = Object.keys(CRAWLERS_BY_ID);
    expect(matrix.length).toBeGreaterThanOrEqual(ids.length);
  });

  it('marks all as unknown when robotsTxt is null', () => {
    const matrix = buildCrawlerAccessMatrix(null);
    expect(matrix.every(r => r.access === 'unknown')).toBe(true);
  });

  it('classifies googlebot as search_engine', () => {
    const matrix = buildCrawlerAccessMatrix('');
    const g = matrix.find(r => r.crawlerId === 'googlebot');
    expect(g?.group).toBe('search_engine');
  });

  it('classifies gptbot as ai_bot', () => {
    const matrix = buildCrawlerAccessMatrix('');
    const g = matrix.find(r => r.crawlerId === 'gptbot');
    expect(g?.group).toBe('ai_bot');
  });
});

// ── buildIndexingDiagnostics ──────────────────────────────────────────────────

describe('buildIndexingDiagnostics', () => {
  const goodObs: IndexabilityObservation = {
    hasTitle: true, titleLength: 40, hasCanonical: true, hasNoindex: false,
    hasMetaDesc: true, metaDescLength: 100, hasH1: true, openGraphPresent: true,
    structuredDataTypes: [],
  };

  it('builds diagnostics with no issues on good page', () => {
    const diag = buildIndexingDiagnostics({
      url: 'https://example.com',
      observation: goodObs,
      robotsTxt: 'User-agent: *\nAllow: /\n',
    });
    expect(diag.observationIssues).toHaveLength(0);
    expect(diag.indexabilityScore).toBe(100);
    expect(diag.disclaimer).toContain('does not guarantee');
  });

  it('penalises score for errors', () => {
    const diag = buildIndexingDiagnostics({
      url: 'https://example.com',
      observation: { ...goodObs, hasTitle: false, hasNoindex: true },
      robotsTxt: null,
    });
    expect(diag.indexabilityScore).toBeLessThan(50);
  });

  it('returns 50 when observation is null', () => {
    const diag = buildIndexingDiagnostics({ url: 'https://example.com', observation: null, robotsTxt: null });
    expect(diag.indexabilityScore).toBe(50);
  });

  it('includes crawlerAccessSummary', () => {
    const diag = buildIndexingDiagnostics({
      url: 'https://example.com',
      observation: goodObs,
      robotsTxt: 'User-agent: *\nAllow: /\n',
    });
    expect(typeof diag.crawlerAccessSummary.allowedSearch).toBe('number');
  });
});
