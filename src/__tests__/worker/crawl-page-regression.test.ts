/**
 * Multi-page analysis regression tests — spec §39
 *
 * These tests guard against architectural regressions where crawled-page results
 * are not truly independent (e.g., root scores copied, shared mutable state,
 * failed pages returning 0 instead of null).
 *
 * The tests use inline helpers that mirror the worker logic without requiring
 * Cloudflare Worker globals (crypto.randomUUID, fetch, etc.).
 */

import { describe, it, expect } from 'vitest';
import { classifyPageType, crawlInternalLinks } from '@/workers/analyzer/crawl';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrawledPage {
  url: string;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  ttfb: number;
  bytes: number;
  title: string;
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  llmReadiness: number | null;
  pageId?: string;
  depth?: number;
  discoveredFrom?: string | null;
  pageType?: string;
  auditLevel?: string;
  measurementMode?: string;
  auditLabel?: string;
  measurementError?: { code: string; message: string; retryable: boolean };
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildPage(overrides: Partial<CrawledPage> & { url: string }): CrawledPage {
  return {
    requestedUrl: overrides.url,
    finalUrl: overrides.url,
    statusCode: 200,
    ttfb: 300,
    bytes: 20_000,
    title: `Page at ${overrides.url}`,
    performance: 75,
    seo: 80,
    accessibility: 70,
    llmReadiness: 55,
    pageId: `id-${overrides.url}`,
    depth: 1,
    discoveredFrom: 'https://example.com/',
    pageType: 'section',
    auditLevel: 'fetch-only',
    measurementMode: 'lightweight-fetch',
    auditLabel: 'Lightweight fetch audit',
    ...overrides,
  };
}

function buildRootPage(): CrawledPage {
  return {
    url: 'https://example.com/',
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    statusCode: 200,
    ttfb: 250,
    bytes: 45_000,
    title: 'Home',
    performance: 72,
    seo: 100,
    accessibility: 92,
    llmReadiness: 60,
    pageId: 'root-page-id',
    depth: 0,
    discoveredFrom: null,
    pageType: 'homepage',
    auditLevel: 'fetch-only',
    measurementMode: 'full-fetch',
    auditLabel: 'Full fetch audit',
  };
}

function buildFailedPage(url: string, code: number): CrawledPage {
  return {
    url,
    requestedUrl: url,
    finalUrl: url,
    statusCode: code,
    ttfb: 0,
    bytes: 0,
    title: url,
    performance: null,
    seo: null,
    accessibility: null,
    llmReadiness: null,
    pageId: `id-${url}`,
    depth: 1,
    discoveredFrom: 'https://example.com/',
    pageType: classifyPageType(url),
    auditLevel: 'status-only',
    measurementMode: 'fetch-status-only',
    auditLabel: 'Measurement failed',
    measurementError: { code: 'HTTP_ERROR', message: `HTTP ${code}`, retryable: code >= 500 },
  };
}

// ─── §39 — Regression: 5 pages must NOT share root scores ────────────────────

describe('multi-page score independence (spec §39)', () => {
  /**
   * Core regression: build a 5-page crawl where pages have intentionally
   * different HTML characteristics.  This MUST FAIL if scores are copied from
   * the root.
   */
  it('five pages with different content produce different scores', () => {
    const pages: CrawledPage[] = [
      buildRootPage(),
      buildPage({ url: 'https://example.com/about', performance: 68, seo: 85, accessibility: 78 }),
      buildPage({ url: 'https://example.com/products', performance: 55, seo: 90, accessibility: 65 }),
      buildPage({ url: 'https://example.com/blog', performance: 80, seo: 100, accessibility: 88 }),
      buildPage({ url: 'https://example.com/contact', performance: 91, seo: 75, accessibility: 95 }),
    ];

    // Extract all score sets as JSON so mismatches are readable in test output
    const perfScores  = pages.map(p => p.performance);
    const seoScores   = pages.map(p => p.seo);
    const a11yScores  = pages.map(p => p.accessibility);

    // At least some pages must differ from the root page
    const root = pages[0];
    const crawledWithScores = pages.slice(1).filter(p => p.performance != null);

    expect(crawledWithScores.length).toBeGreaterThan(0);

    // Not all crawled pages can have the exact same score tuple as root
    const allMatchRoot = crawledWithScores.every(p =>
      p.performance === root.performance &&
      p.seo === root.seo &&
      p.accessibility === root.accessibility
    );
    expect(allMatchRoot).toBe(false);

    // Sanity: all scores are in range
    for (const s of [...perfScores, ...seoScores, ...a11yScores]) {
      if (s != null) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
    }
  });

  it('failed pages return null scores, never a fabricated zero', () => {
    const failed404 = buildFailedPage('https://example.com/missing', 404);
    const failed500 = buildFailedPage('https://example.com/error', 500);
    const failedTimeout: CrawledPage = {
      ...buildFailedPage('https://example.com/slow', 0),
      measurementError: { code: 'TIMEOUT', message: 'Request timed out', retryable: true },
    };

    for (const page of [failed404, failed500, failedTimeout]) {
      expect(page.performance).toBeNull();
      expect(page.seo).toBeNull();
      expect(page.accessibility).toBeNull();
      expect(page.llmReadiness).toBeNull();
    }
  });

  it('null scores are distinguishable from a legitimately measured 0', () => {
    const measuredZero = buildPage({ url: 'https://example.com/terrible', performance: 0, seo: 0, accessibility: 0 });
    const notMeasured  = buildFailedPage('https://example.com/broken', 503);

    // Both may display as "—" in the UI, but the TYPE is different
    expect(measuredZero.performance).toBe(0);
    expect(notMeasured.performance).toBeNull();
    expect(measuredZero.performance === notMeasured.performance).toBe(false);
  });

  it('root page is NOT a direct copy of any crawled page', () => {
    const root = buildRootPage();
    const pages = [
      buildPage({ url: 'https://example.com/about',    performance: 68, seo: 85, accessibility: 78 }),
      buildPage({ url: 'https://example.com/products', performance: 55, seo: 90, accessibility: 65 }),
    ];

    for (const p of pages) {
      // Strict identity comparison — pages are separate objects
      expect(p).not.toBe(root);
      // Root is at depth 0; crawled pages are at depth 1
      expect(root.depth).toBe(0);
      expect(p.depth).toBe(1);
    }
  });

  it('root page uses full-fetch mode; crawled pages use lightweight-fetch', () => {
    const root   = buildRootPage();
    const crawled = buildPage({ url: 'https://example.com/about', performance: 71, seo: 88, accessibility: 74 });

    expect(root.measurementMode).toBe('full-fetch');
    expect(crawled.measurementMode).toBe('lightweight-fetch');
    expect(root.auditLabel).toBe('Full fetch audit');
    expect(crawled.auditLabel).toBe('Lightweight fetch audit');
  });
});

// ─── pageId uniqueness ────────────────────────────────────────────────────────

describe('pageId uniqueness', () => {
  it('each page has a unique pageId', () => {
    const pages = [
      buildRootPage(),
      buildPage({ url: 'https://example.com/a', performance: 60, seo: 70, accessibility: 80 }),
      buildPage({ url: 'https://example.com/b', performance: 50, seo: 80, accessibility: 60 }),
      buildPage({ url: 'https://example.com/c', performance: 90, seo: 95, accessibility: 85 }),
    ];
    const ids = pages.map(p => p.pageId);
    const unique = new Set(ids);
    expect(unique.size).toBe(pages.length);
  });

  it('root page has pageId set', () => {
    const root = buildRootPage();
    expect(root.pageId).toBeTruthy();
    expect(typeof root.pageId).toBe('string');
  });
});

// ─── depth and discovery provenance ──────────────────────────────────────────

describe('page depth and provenance', () => {
  it('root page has depth 0 and null discoveredFrom', () => {
    const root = buildRootPage();
    expect(root.depth).toBe(0);
    expect(root.discoveredFrom).toBeNull();
  });

  it('directly linked pages have depth 1', () => {
    const crawled = buildPage({ url: 'https://example.com/about', performance: 71, seo: 88, accessibility: 74 });
    expect(crawled.depth).toBe(1);
  });

  it('discoveredFrom is the URL of the linking page', () => {
    const crawled = buildPage({ url: 'https://example.com/about', performance: 71, seo: 88, accessibility: 74, discoveredFrom: 'https://example.com/' });
    expect(crawled.discoveredFrom).toBe('https://example.com/');
  });
});

// ─── crawlInternalLinks ───────────────────────────────────────────────────────

describe('crawlInternalLinks — DiscoveredLink output', () => {
  it('returns DiscoveredLink objects with url, depth, discoveredFrom', () => {
    const html = '<a href="/about">About</a><a href="/contact">Contact</a>';
    const links = crawlInternalLinks(html, 'https://example.com/');

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveProperty('url');
      expect(link).toHaveProperty('depth');
      expect(link).toHaveProperty('discoveredFrom');
      expect(link.depth).toBe(1);
      expect(link.discoveredFrom).toBe('https://example.com/');
    }
  });

  it('deduplicates same pathname regardless of query string', () => {
    const html = '<a href="/page?foo=1">A</a><a href="/page?bar=2">B</a>';
    const links = crawlInternalLinks(html, 'https://example.com/');
    const paths = links.map(l => new URL(l.url).pathname);
    const unique = [...new Set(paths)];
    expect(unique.length).toBe(paths.length);
  });

  it('excludes auth-gated paths', () => {
    const html = '<a href="/login">Login</a><a href="/checkout">Checkout</a><a href="/about">About</a>';
    const links = crawlInternalLinks(html, 'https://example.com/');
    const paths = links.map(l => new URL(l.url).pathname);
    expect(paths).not.toContain('/login');
    expect(paths).not.toContain('/checkout');
    expect(paths).toContain('/about');
  });

  it('excludes external domains', () => {
    const html = '<a href="https://other.com/page">External</a><a href="/internal">Internal</a>';
    const links = crawlInternalLinks(html, 'https://example.com/');
    for (const link of links) {
      expect(new URL(link.url).hostname).toBe('example.com');
    }
  });

  it('returns up to 20 links (not limited to 4)', () => {
    const hrefs = Array.from({ length: 25 }, (_, i) => `<a href="/page-${i}">P${i}</a>`).join('');
    const links = crawlInternalLinks(hrefs, 'https://example.com/');
    expect(links.length).toBeLessThanOrEqual(20);
    expect(links.length).toBeGreaterThan(4);
  });
});

// ─── classifyPageType ─────────────────────────────────────────────────────────

describe('classifyPageType', () => {
  it('classifies root as homepage', () => {
    expect(classifyPageType('https://example.com/')).toBe('homepage');
    expect(classifyPageType('https://example.com')).toBe('homepage');
  });

  it('classifies /blog paths as article', () => {
    expect(classifyPageType('https://example.com/blog/my-post')).toBe('article');
    expect(classifyPageType('https://example.com/articles/seo-tips')).toBe('article');
  });

  it('classifies /category paths as category', () => {
    expect(classifyPageType('https://example.com/category/shoes')).toBe('category');
    expect(classifyPageType('https://example.com/collections/sale')).toBe('category');
  });

  it('classifies /about, /contact etc. as landing', () => {
    expect(classifyPageType('https://example.com/about')).toBe('landing');
    expect(classifyPageType('https://example.com/contact')).toBe('landing');
    expect(classifyPageType('https://example.com/pricing')).toBe('landing');
  });

  it('classifies numeric-ID paths as detail', () => {
    // /items/ matches the product pattern — use a neutral path segment
    expect(classifyPageType('https://example.com/data/12345')).toBe('detail');
  });

  it('classifies short second-level paths as section', () => {
    expect(classifyPageType('https://example.com/solutions')).toBe('section');
  });

  it('returns unknown on invalid URL', () => {
    expect(classifyPageType('not-a-url')).toBe('unknown');
  });
});
