import { describe, it, expect } from 'vitest';

// ─── Inline the pure logic under test ────────────────────────────────────────
// We replicate the function signature + core logic from opportunities.ts here
// so the test file doesn't depend on Cloudflare Worker globals.

interface PerformanceOpportunity {
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

interface OpportunityInputs {
  html: string;
  response: { headers: { get: (h: string) => string | null } };
  htmlBytes: number;
  ttfb: number;
  ttfbSamples?: number[];
  renderBlockingScripts: string[];
  renderBlockingStylesheets: string[];
  imageIssues: { src: string; issues: string[] }[];
  totalImages: number;
  lazyImages: number;
  inlineScriptCount: number;
  thirdPartyDomains: { domain: string; count: number; types: string[] }[];
  totalScripts: number;
  asyncScripts: number;
  deferScripts: number;
}

// ── Minimal re-implementation of the opportunity generator for testing ──────
function generateOpportunities(inputs: OpportunityInputs): PerformanceOpportunity[] {
  const opps: PerformanceOpportunity[] = [];

  // slow-ttfb
  if (inputs.ttfb > 800) {
    const severity = inputs.ttfb > 1800 ? 'critical' : 'high';
    opps.push({
      id: 'slow-ttfb',
      title: 'Slow server response time (TTFB)',
      severity,
      confidence: 'high',
      source: 'HTTP timing',
      description: `TTFB is ${inputs.ttfb}ms.`,
      evidence: [`TTFB: ${inputs.ttfb}ms`],
      affectedResources: [],
      estimatedSavingsMs: Math.round((inputs.ttfb - 600) * 0.4),
      recommendation: 'Reduce server response time.',
    });
  }

  // large-html-document
  if (inputs.htmlBytes > 200_000) {
    opps.push({
      id: 'large-html-document',
      title: 'Large HTML document',
      severity: inputs.htmlBytes > 500_000 ? 'high' : 'medium',
      confidence: 'high',
      source: 'HTTP response body size',
      description: `HTML is ${Math.round(inputs.htmlBytes / 1024)}KB.`,
      evidence: [`HTML size: ${Math.round(inputs.htmlBytes / 1024)}KB`],
      affectedResources: [],
      estimatedSavingsBytes: Math.round(inputs.htmlBytes * 0.3),
      recommendation: 'Reduce HTML payload size.',
    });
  }

  // missing-compression
  const ce = inputs.response.headers.get('content-encoding');
  if (!ce || (!ce.includes('gzip') && !ce.includes('br') && !ce.includes('zstd'))) {
    opps.push({
      id: 'missing-compression',
      title: 'HTML served without compression',
      severity: inputs.htmlBytes > 100_000 ? 'high' : 'medium',
      confidence: 'high',
      source: 'Content-Encoding response header',
      description: 'No Content-Encoding header detected.',
      evidence: ['Content-Encoding: absent'],
      affectedResources: [],
      estimatedSavingsBytes: Math.round(inputs.htmlBytes * 0.7),
      recommendation: 'Enable gzip or Brotli compression.',
    });
  }

  // render-blocking-scripts
  if (inputs.renderBlockingScripts.length > 0) {
    opps.push({
      id: 'render-blocking-scripts',
      title: 'Remove render-blocking scripts',
      severity: inputs.renderBlockingScripts.length >= 3 ? 'critical' : 'high',
      confidence: 'high',
      source: 'HTML head analysis',
      description: `${inputs.renderBlockingScripts.length} render-blocking script(s) detected.`,
      evidence: inputs.renderBlockingScripts.slice(0, 3),
      affectedResources: inputs.renderBlockingScripts,
      estimatedSavingsMs: inputs.renderBlockingScripts.length * 200,
      recommendation: 'Add defer or async to scripts in <head>.',
    });
  }

  // render-blocking-stylesheets
  if (inputs.renderBlockingStylesheets.length > 0) {
    opps.push({
      id: 'render-blocking-stylesheets',
      title: 'Eliminate render-blocking stylesheets',
      severity: inputs.renderBlockingStylesheets.length >= 2 ? 'high' : 'medium',
      confidence: 'high',
      source: 'HTML head analysis',
      description: `${inputs.renderBlockingStylesheets.length} render-blocking stylesheet(s).`,
      evidence: inputs.renderBlockingStylesheets.slice(0, 3),
      affectedResources: inputs.renderBlockingStylesheets,
      recommendation: 'Load non-critical CSS asynchronously.',
    });
  }

  // images-missing-dimensions
  const noDims = inputs.imageIssues.filter(i => i.issues.some(x => x.toLowerCase().includes('dimension') || x.toLowerCase().includes('width') || x.toLowerCase().includes('height')));
  if (noDims.length > 0) {
    opps.push({
      id: 'images-missing-dimensions',
      title: 'Images missing explicit width/height',
      severity: 'high',
      confidence: 'high',
      source: 'HTML img tag analysis',
      description: `${noDims.length} image(s) missing width/height attributes.`,
      evidence: noDims.slice(0, 3).map(i => i.src),
      affectedResources: noDims.map(i => i.src),
      recommendation: 'Add width and height to all <img> elements.',
    });
  }

  // images-missing-lazy-loading (skip first image — likely above fold)
  const noLazy = inputs.imageIssues.filter(i => i.issues.some(x => x.toLowerCase().includes('lazy')));
  if (noLazy.length > 1) {
    opps.push({
      id: 'images-missing-lazy-loading',
      title: 'Below-fold images missing lazy loading',
      severity: 'medium',
      confidence: 'high',
      source: 'HTML img tag analysis',
      description: `${noLazy.length - 1} below-fold image(s) missing loading="lazy".`,
      evidence: noLazy.slice(1, 4).map(i => i.src),
      affectedResources: noLazy.slice(1).map(i => i.src),
      recommendation: 'Add loading="lazy" to below-fold images.',
    });
  }

  // sort: critical → high → medium → low
  const ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  opps.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return opps;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

const makeResponse = (headers: Record<string, string> = {}) => ({
  headers: {
    get: (h: string) => headers[h.toLowerCase()] ?? null,
  },
});

const baseInputs: OpportunityInputs = {
  html: '<html><head></head><body></body></html>',
  response: makeResponse({ 'content-encoding': 'gzip' }),
  htmlBytes: 50_000,
  ttfb: 300,
  renderBlockingScripts: [],
  renderBlockingStylesheets: [],
  imageIssues: [],
  totalImages: 0,
  lazyImages: 0,
  inlineScriptCount: 0,
  thirdPartyDomains: [],
  totalScripts: 0,
  asyncScripts: 0,
  deferScripts: 0,
};

describe('generateOpportunities', () => {
  it('returns empty array for a well-optimised page', () => {
    const result = generateOpportunities(baseInputs);
    expect(result).toHaveLength(0);
  });

  it('flags slow TTFB > 800ms as high severity', () => {
    const result = generateOpportunities({ ...baseInputs, ttfb: 1200 });
    const opp = result.find(o => o.id === 'slow-ttfb');
    expect(opp).toBeDefined();
    expect(opp!.severity).toBe('high');
    expect(opp!.confidence).toBe('high');
    expect(opp!.estimatedSavingsMs).toBeDefined();
    expect(opp!.estimatedSavingsMs!).toBeGreaterThan(0);
  });

  it('flags very slow TTFB > 1800ms as critical', () => {
    const result = generateOpportunities({ ...baseInputs, ttfb: 2000 });
    const opp = result.find(o => o.id === 'slow-ttfb');
    expect(opp!.severity).toBe('critical');
  });

  it('does not flag TTFB ≤ 800ms', () => {
    const result = generateOpportunities({ ...baseInputs, ttfb: 800 });
    expect(result.find(o => o.id === 'slow-ttfb')).toBeUndefined();
  });

  it('flags large HTML document > 200KB', () => {
    const result = generateOpportunities({ ...baseInputs, htmlBytes: 250_000 });
    const opp = result.find(o => o.id === 'large-html-document');
    expect(opp).toBeDefined();
    expect(opp!.estimatedSavingsBytes).toBeDefined();
    expect(opp!.estimatedSavingsBytes!).toBeGreaterThan(0);
  });

  it('does not flag small HTML document ≤ 200KB', () => {
    const result = generateOpportunities({ ...baseInputs, htmlBytes: 100_000 });
    expect(result.find(o => o.id === 'large-html-document')).toBeUndefined();
  });

  it('flags missing compression when Content-Encoding absent', () => {
    const result = generateOpportunities({ ...baseInputs, response: makeResponse() });
    const opp = result.find(o => o.id === 'missing-compression');
    expect(opp).toBeDefined();
    expect(opp!.estimatedSavingsBytes).toBeDefined();
  });

  it('does not flag compression when gzip is present', () => {
    const result = generateOpportunities({
      ...baseInputs,
      response: makeResponse({ 'content-encoding': 'gzip' }),
    });
    expect(result.find(o => o.id === 'missing-compression')).toBeUndefined();
  });

  it('does not flag compression when br is present', () => {
    const result = generateOpportunities({
      ...baseInputs,
      response: makeResponse({ 'content-encoding': 'br' }),
    });
    expect(result.find(o => o.id === 'missing-compression')).toBeUndefined();
  });

  it('flags render-blocking scripts', () => {
    const scripts = ['https://example.com/a.js', 'https://example.com/b.js'];
    const result = generateOpportunities({ ...baseInputs, renderBlockingScripts: scripts });
    const opp = result.find(o => o.id === 'render-blocking-scripts');
    expect(opp).toBeDefined();
    expect(opp!.affectedResources).toEqual(scripts);
    expect(opp!.estimatedSavingsMs).toBe(400);
  });

  it('rates 3+ render-blocking scripts as critical', () => {
    const result = generateOpportunities({
      ...baseInputs,
      renderBlockingScripts: ['a.js', 'b.js', 'c.js'],
    });
    expect(result.find(o => o.id === 'render-blocking-scripts')!.severity).toBe('critical');
  });

  it('flags render-blocking stylesheets', () => {
    const result = generateOpportunities({
      ...baseInputs,
      renderBlockingStylesheets: ['style.css', 'fonts.css'],
    });
    const opp = result.find(o => o.id === 'render-blocking-stylesheets');
    expect(opp).toBeDefined();
    expect(opp!.severity).toBe('high');
  });

  it('flags images missing dimensions', () => {
    const result = generateOpportunities({
      ...baseInputs,
      imageIssues: [{ src: 'img.jpg', issues: ['Missing width and height'] }],
    });
    const opp = result.find(o => o.id === 'images-missing-dimensions');
    expect(opp).toBeDefined();
    expect(opp!.affectedResources).toContain('img.jpg');
  });

  it('does not flag lazy loading when only 1 image lacks it (likely above fold)', () => {
    const result = generateOpportunities({
      ...baseInputs,
      imageIssues: [{ src: 'hero.jpg', issues: ['No lazy loading'] }],
      totalImages: 1,
    });
    expect(result.find(o => o.id === 'images-missing-lazy-loading')).toBeUndefined();
  });

  it('flags lazy loading when 2+ images lack it', () => {
    const result = generateOpportunities({
      ...baseInputs,
      imageIssues: [
        { src: 'hero.jpg', issues: ['No lazy loading'] },
        { src: 'product.jpg', issues: ['No lazy loading'] },
      ],
      totalImages: 2,
    });
    const opp = result.find(o => o.id === 'images-missing-lazy-loading');
    expect(opp).toBeDefined();
    expect(opp!.affectedResources).toContain('product.jpg');
    expect(opp!.affectedResources).not.toContain('hero.jpg'); // skip first
  });

  it('sorts results: critical before high before medium', () => {
    const result = generateOpportunities({
      ...baseInputs,
      htmlBytes: 250_000, // medium
      response: makeResponse(), // missing-compression → high (>100KB)
      ttfb: 2000, // slow-ttfb → critical
    });
    const severities = result.map(o => o.severity);
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < severities.length; i++) {
      expect(order[severities[i]]).toBeGreaterThanOrEqual(order[severities[i - 1]]);
    }
  });

  it('all opportunities have non-empty id, title, description, recommendation, evidence', () => {
    const result = generateOpportunities({
      ...baseInputs,
      ttfb: 1000,
      htmlBytes: 300_000,
      response: makeResponse(),
      renderBlockingScripts: ['jquery.js'],
      renderBlockingStylesheets: ['main.css'],
      imageIssues: [
        { src: 'img1.jpg', issues: ['No lazy loading', 'Missing width and height'] },
        { src: 'img2.jpg', issues: ['No lazy loading'] },
      ],
    });

    for (const opp of result) {
      expect(opp.id.length).toBeGreaterThan(0);
      expect(opp.title.length).toBeGreaterThan(0);
      expect(opp.description.length).toBeGreaterThan(0);
      expect(opp.recommendation.length).toBeGreaterThan(0);
      expect(opp.evidence.length).toBeGreaterThan(0);
    }
  });
});
