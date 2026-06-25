// SEO Audit Engine tests — section 28 of the SEO Audit Improvement spec.
// Covers: type system, individual check functions, scoring, coverage, lightweight scan.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock workerLog so tests don't emit JSON to stdout ──────────────────────────
vi.mock('../../workers/analyzer/log', () => ({
  workerLog: vi.fn(),
}));

// ── Mock fetch for robots.txt / sitemap tests ──────────────────────────────────
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Import after mocks ─────────────────────────────────────────────────────────
import { checkSEO, checkSEOLightweight } from '../../workers/analyzer/seo';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResponse(overrides: {
  url?: string;
  status?: number;
  headers?: Record<string, string>;
} = {}): Response {
  const headers = new Headers(overrides.headers ?? {});
  return {
    url: overrides.url ?? 'https://example.com/',
    status: overrides.status ?? 200,
    ok: (overrides.status ?? 200) < 400,
    headers,
  } as unknown as Response;
}

function mockFetchReturn(body: string, status = 200, contentType = 'text/plain'): void {
  mockFetch.mockResolvedValueOnce({
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': contentType, 'content-length': String(body.length) }),
    text: () => Promise.resolve(body),
    body: { cancel: vi.fn() },
  } as unknown as Response);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GOOD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>A well-optimised page title that is good</title>
  <meta name="description" content="This is a solid meta description for the page that is between 70 and 155 characters long." />
  <link rel="canonical" href="https://example.com/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Example"}</script>
  <meta property="og:title" content="Example" />
  <meta property="og:description" content="Desc" />
  <meta property="og:image" content="https://example.com/img.png" />
  <meta property="og:url" content="https://example.com/" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body>
  <h1>Main Heading</h1>
  <h2>Section One</h2>
  <p>Content here</p>
</body>
</html>
`;

const MINIMAL_HTML = `<html><body><h1>Hello</h1></body></html>`;

const NOINDEX_HTML = `
<html lang="en">
<head>
  <title>Private page</title>
  <meta name="robots" content="noindex, nofollow" />
</head>
<body><h1>Private</h1></body>
</html>
`;

const BAD_SCHEMA_HTML = `
<html lang="en">
<head>
  <title>Schema error page that has enough length</title>
</head>
<body>
<h1>Heading</h1>
<script type="application/ld+json">{this is not valid json}</script>
</body>
</html>
`;

// ── checkSEOLightweight tests ─────────────────────────────────────────────────

describe('checkSEOLightweight()', () => {
  it('returns a score from 0 to 100', () => {
    const r = checkSEOLightweight(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('extracts title correctly', () => {
    const r = checkSEOLightweight(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(r.title).toContain('well-optimised page title');
    expect(r.titleLength).toBeGreaterThan(10);
    expect(r.titleStatus).toBe('good');
  });

  it('extracts description correctly', () => {
    const r = checkSEOLightweight(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(r.description).toContain('solid meta description');
    expect(r.descriptionStatus).toBe('good');
  });

  it('extracts H1', () => {
    const r = checkSEOLightweight(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(r.h1).toBe('Main Heading');
    expect(r.h1Count).toBe(1);
  });

  it('detects missing title', () => {
    const r = checkSEOLightweight(MINIMAL_HTML, makeResponse(), 'https://example.com/');
    expect(r.titleStatus).toBe('missing');
    expect(r.title).toBeNull();
  });

  it('detects noindex directive', () => {
    const r = checkSEOLightweight(NOINDEX_HTML, makeResponse(), 'https://example.com/');
    expect(r.noindex).toBe(true);
    expect(r.isIndexable).toBe(false);
  });

  it('detects self-referencing canonical', () => {
    const r = checkSEOLightweight(GOOD_HTML, makeResponse({ url: 'https://example.com/' }), 'https://example.com/');
    expect(r.canonicalStatus).toBe('self');
    expect(r.canonical).toBe('https://example.com/');
  });

  it('detects missing canonical', () => {
    const r = checkSEOLightweight(MINIMAL_HTML, makeResponse(), 'https://example.com/');
    expect(r.canonicalStatus).toBe('missing');
    expect(r.canonical).toBeNull();
  });

  it('extracts structured data types', () => {
    const r = checkSEOLightweight(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(r.structuredDataTypes).toContain('WebSite');
  });

  it('sets auditLabel to "Lightweight SEO scan"', () => {
    const r = checkSEOLightweight(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(r.auditLabel).toBe('Lightweight SEO scan');
  });

  it('scores higher for a well-formed page than a minimal one', () => {
    const good = checkSEOLightweight(GOOD_HTML, makeResponse({ url: 'https://example.com/' }), 'https://example.com/');
    const bad  = checkSEOLightweight(MINIMAL_HTML, makeResponse(), 'https://example.com/');
    expect(good.score!).toBeGreaterThan(bad.score!);
  });

  it('detects X-Robots-Tag noindex from response headers', () => {
    const r = checkSEOLightweight(
      '<html><head><title>Test</title></head><body><h1>H</h1></body></html>',
      makeResponse({ headers: { 'x-robots-tag': 'noindex' } }),
      'https://example.com/',
    );
    expect(r.noindex).toBe(true);
  });

  it('returns coverage value between 0 and 100', () => {
    const r = checkSEOLightweight(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(r.coverage).toBeGreaterThanOrEqual(0);
    expect(r.coverage).toBeLessThanOrEqual(100);
  });

  it('handles title that is too long', () => {
    const longTitle = 'A'.repeat(80);
    const html = `<html lang="en"><head><title>${longTitle}</title></head><body><h1>H</h1></body></html>`;
    const r = checkSEOLightweight(html, makeResponse(), 'https://example.com/');
    expect(r.titleStatus).toBe('too-long');
  });

  it('handles empty title tag', () => {
    const html = `<html lang="en"><head><title></title></head><body><h1>H</h1></body></html>`;
    const r = checkSEOLightweight(html, makeResponse(), 'https://example.com/');
    expect(r.titleStatus).toBe('empty');
  });
});

// ── checkSEO (full audit) tests ────────────────────────────────────────────────

describe('checkSEO() — full audit', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('resolves to a SeoAuditResult with version "seo-v1"', async () => {
    mockFetchReturn('User-agent: *\nDisallow:', 200); // robots.txt
    mockFetchReturn('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>', 200, 'application/xml'); // sitemap.xml

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(result.version).toBe('seo-v1');
  });

  it('returns a score between 0 and 100', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThanOrEqual(0);
    expect(result.score!).toBeLessThanOrEqual(100);
  });

  it('returns a higher score for a well-formed page', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');
    const goodScore = (await checkSEO(GOOD_HTML, makeResponse({ url: 'https://example.com/' }), 'https://example.com/')).score;

    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');
    const badScore = (await checkSEO(MINIMAL_HTML, makeResponse(), 'https://example.com/')).score;

    expect(goodScore!).toBeGreaterThan(badScore!);
  });

  it('detects a noindex finding for a noindex page', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(NOINDEX_HTML, makeResponse(), 'https://example.com/');
    const noindexFinding = result.findings.find(f => f.ruleId === 'page-noindex');
    expect(noindexFinding).toBeDefined();
    expect(noindexFinding!.status).toBe('manual-review');
  });

  it('does NOT flag indexability for an indexable page', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse({ url: 'https://example.com/' }), 'https://example.com/');
    const noindexFinding = result.findings.find(f => f.ruleId === 'page-noindex');
    expect(noindexFinding).toBeUndefined();
    const indexableFinding = result.findings.find(f => f.ruleId === 'page-indexable');
    expect(indexableFinding).toBeDefined();
    expect(indexableFinding!.status).toBe('passed');
  });

  it('detects JSON-LD syntax error', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(BAD_SCHEMA_HTML, makeResponse(), 'https://example.com/');
    const syntaxFinding = result.findings.find(f => f.ruleId === 'schema-syntax-error');
    expect(syntaxFinding).toBeDefined();
    expect(syntaxFinding!.status).toBe('failed');
  });

  it('passes schema validation for well-formed JSON-LD', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    const schemaValid = result.findings.find(f => f.ruleId === 'schema-valid');
    expect(schemaValid).toBeDefined();
    expect(schemaValid!.status).toBe('passed');
  });

  it('detects missing canonical', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(MINIMAL_HTML, makeResponse(), 'https://example.com/');
    const canonicalFinding = result.findings.find(f => f.ruleId === 'canonical-missing');
    expect(canonicalFinding).toBeDefined();
  });

  it('detects valid self-referencing canonical', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse({ url: 'https://example.com/' }), 'https://example.com/');
    const canonicalSelf = result.findings.find(f => f.ruleId === 'canonical-self');
    expect(canonicalSelf).toBeDefined();
    expect(canonicalSelf!.status).toBe('passed');
  });

  it('detects missing H1', async () => {
    const html = `<html lang="en"><head><title>No Heading Page Here Let Us See</title></head><body><p>No heading</p></body></html>`;
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(html, makeResponse(), 'https://example.com/');
    const h1Missing = result.findings.find(f => f.ruleId === 'h1-missing');
    expect(h1Missing).toBeDefined();
    expect(h1Missing!.status).toBe('failed');
  });

  it('detects missing viewport meta', async () => {
    const html = `<html lang="en"><head><title>No Viewport Here At All Test</title></head><body><h1>Hi</h1></body></html>`;
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(html, makeResponse(), 'https://example.com/');
    const viewportFinding = result.findings.find(f => f.ruleId === 'viewport-missing');
    expect(viewportFinding).toBeDefined();
    expect(viewportFinding!.status).toBe('failed');
  });

  it('flags page not served over HTTPS', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse({ url: 'http://example.com/' }), 'http://example.com/');
    const httpsFinding = result.findings.find(f => f.ruleId === 'url-http');
    expect(httpsFinding).toBeDefined();
    expect(httpsFinding!.status).toBe('failed');
  });

  it('flags user-scalable=no in viewport', async () => {
    const html = `<html lang="en"><head><title>Test viewport block at all times</title><meta name="viewport" content="width=device-width, user-scalable=no"></head><body><h1>H</h1></body></html>`;
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(html, makeResponse(), 'https://example.com/');
    const zoomBlocked = result.findings.find(f => f.ruleId === 'viewport-zoom-blocked');
    expect(zoomBlocked).toBeDefined();
    expect(zoomBlocked!.status).toBe('warning');
  });

  it('returns structured metadata in the result', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(result.metadata.title).toContain('well-optimised');
    expect(result.metadata.h1).toBe('Main Heading');
    expect(result.metadata.htmlLang).toBe('en');
    expect(result.indexability.isIndexable).toBe(true);
    expect(result.structuredData.found).toBe(true);
    expect(result.structuredData.types).toContain('WebSite');
  });

  it('returns audit coverage with percentage between 0 and 100', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(result.coverage.percentage).toBeGreaterThanOrEqual(0);
    expect(result.coverage.percentage).toBeLessThanOrEqual(100);
    expect(result.coverage.supportedChecks).toBeGreaterThan(0);
    expect(result.coverage.limitations.length).toBeGreaterThan(0);
  });

  it('returns a scoreBreakdown array with category entries', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(Array.isArray(result.scoreBreakdown)).toBe(true);
    expect(result.scoreBreakdown.length).toBeGreaterThan(0);
    const indexabilityRow = result.scoreBreakdown.find(b => b.category === 'indexability');
    expect(indexabilityRow).toBeDefined();
    expect(indexabilityRow!.weight).toBe(0.20);
  });

  it('detects robots.txt that blocks the page', async () => {
    mockFetchReturn('User-agent: *\nDisallow: /\n'); // blocks everything
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse({ url: 'https://example.com/' }), 'https://example.com/');
    const blockedFinding = result.findings.find(f => f.ruleId === 'robots-txt-blocked');
    expect(blockedFinding).toBeDefined();
    expect(blockedFinding!.status).toBe('warning');
  });

  it('passes crawlability when robots.txt allows crawling', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    const allowedFinding = result.findings.find(f => f.ruleId === 'robots-txt-allows');
    expect(allowedFinding).toBeDefined();
    expect(allowedFinding!.status).toBe('passed');
  });

  it('detects valid sitemap.xml', async () => {
    const sitemap = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>`;
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn(sitemap, 200, 'application/xml');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    const sitemapFinding = result.findings.find(f => f.ruleId === 'sitemap-found');
    expect(sitemapFinding).toBeDefined();
    expect(sitemapFinding!.status).toBe('passed');
    expect(result.sitemap?.found).toBe(true);
    expect(result.sitemap?.urlCount).toBe(1);
  });

  it('records sitemap 404 as not-found warning', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers(), text: () => Promise.resolve('') } as unknown as Response);

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    const notFound = result.findings.find(f => f.ruleId === 'sitemap-not-found');
    expect(notFound).toBeDefined();
  });

  it('detects missing OG tags', async () => {
    const html = `<html lang="en"><head><title>No OG tags here test case long</title></head><body><h1>H</h1></body></html>`;
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(html, makeResponse(), 'https://example.com/');
    const ogFinding = result.findings.find(f => f.ruleId === 'og-missing');
    expect(ogFinding).toBeDefined();
  });

  it('passes OG check when all required tags present', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    const ogFinding = result.findings.find(f => f.ruleId === 'og-complete');
    expect(ogFinding).toBeDefined();
    expect(ogFinding!.status).toBe('passed');
  });

  it('detects missing HTML lang attribute', async () => {
    const html = `<html><head><title>No lang on html element here at all.</title></head><body><h1>H</h1></body></html>`;
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(html, makeResponse(), 'https://example.com/');
    const langFinding = result.findings.find(f => f.ruleId === 'html-lang-missing');
    expect(langFinding).toBeDefined();
    expect(langFinding!.status).toBe('failed');
  });

  it('gracefully handles fetch errors (robots.txt timeout)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('AbortError: The operation was aborted'));
    mockFetch.mockRejectedValueOnce(new Error('AbortError: The operation was aborted'));

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(result.version).toBe('seo-v1');
    // Should still have score from synchronous checks
    expect(result.score).not.toBeNull();
  });

  it('returns summary counts that match findings', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse({ url: 'https://example.com/' }), 'https://example.com/');
    const { summary, findings } = result;

    const actualCritical = findings.filter(f => f.severity === 'critical' && f.status === 'failed').length;
    const actualPassed   = findings.filter(f => f.status === 'passed').length;

    expect(summary.critical).toBe(actualCritical);
    expect(summary.passed).toBe(actualPassed);
  });

  it('flags hreflang with invalid language codes', async () => {
    const html = `
<html lang="en"><head>
  <title>Hreflang test page with invalid code here</title>
  <link rel="alternate" hreflang="xx-BADCODE" href="https://example.com/xx/" />
</head><body><h1>H</h1></body></html>`;
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(html, makeResponse(), 'https://example.com/');
    const invalidCodes = result.findings.find(f => f.ruleId === 'hreflang-invalid-codes');
    expect(invalidCodes).toBeDefined();
    expect(invalidCodes!.status).toBe('failed');
  });

  it('detects sitemap index file', async () => {
    const sitemapIndex = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap></sitemapindex>`;
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn(sitemapIndex, 200, 'application/xml');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(result.sitemap?.isSitemapIndex).toBe(true);
    const indexFinding = result.findings.find(f => f.ruleId === 'sitemap-index-found');
    expect(indexFinding).toBeDefined();
    expect(indexFinding!.status).toBe('passed');
  });

  it('detects session IDs in URL', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(
      GOOD_HTML,
      makeResponse({ url: 'https://example.com/?PHPSESSID=abc123' }),
      'https://example.com/?PHPSESSID=abc123',
    );
    const sessionFinding = result.findings.find(f => f.ruleId === 'url-session-id');
    expect(sessionFinding).toBeDefined();
    expect(sessionFinding!.status).toBe('failed');
  });

  it('detects multiple title tags', async () => {
    const html = `<html lang="en"><head><title>First title</title><title>Second title</title></head><body><h1>H</h1></body></html>`;
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(html, makeResponse(), 'https://example.com/');
    const multiFinding = result.findings.find(f => f.ruleId === 'title-multiple');
    expect(multiFinding).toBeDefined();
    expect(multiFinding!.status).toBe('failed');
  });

  it('reports the audit mode as fetch-only', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    expect(result.auditMode).toBe('fetch-only');
  });

  it('all findings have required fields', async () => {
    mockFetchReturn('User-agent: *\nDisallow:');
    mockFetchReturn('<?xml version="1.0"?><urlset></urlset>');

    const result = await checkSEO(GOOD_HTML, makeResponse(), 'https://example.com/');
    for (const f of result.findings) {
      expect(typeof f.id).toBe('string');
      expect(typeof f.ruleId).toBe('string');
      expect(typeof f.title).toBe('string');
      expect(typeof f.status).toBe('string');
      expect(typeof f.severity).toBe('string');
      expect(Array.isArray(f.evidence)).toBe(true);
    }
  });
});
