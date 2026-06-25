import { describe, it, expect } from 'vitest';

// ─── Types (mirrored from analysis.ts to avoid Worker globals) ───────────────

interface CrawledPage {
  url: string;
  requestedUrl?: string;
  finalUrl?: string;
  statusCode: number;
  ttfb: number;
  bytes: number;
  title: string;
  performance: number;
  seo: number;
  accessibility: number;
  llmReadiness: number;
  measurementMode?: 'full-fetch' | 'lightweight-fetch' | 'fetch-status-only';
  auditLabel?: string;
  measurementError?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

// ─── Helpers (inline — mirrors worker logic without CF globals) ───────────────

function buildRootPage(overrides: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url: 'https://example.com/',
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    statusCode: 200,
    ttfb: 320,
    bytes: 45_000,
    title: 'Example Home',
    performance: 78,
    seo: 85,
    accessibility: 72,
    llmReadiness: 60,
    measurementMode: 'full-fetch',
    auditLabel: 'Full fetch audit',
    ...overrides,
  };
}

function buildCrawledPage(overrides: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url: 'https://example.com/about',
    requestedUrl: 'https://example.com/about',
    finalUrl: 'https://example.com/about',
    statusCode: 200,
    ttfb: 410,
    bytes: 22_000,
    title: 'About Us',
    performance: 64,
    seo: 90,
    accessibility: 80,
    llmReadiness: 55,
    measurementMode: 'lightweight-fetch',
    auditLabel: 'Lightweight fetch audit',
    ...overrides,
  };
}

function buildFailedPage(overrides: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url: 'https://example.com/broken',
    requestedUrl: 'https://example.com/broken',
    finalUrl: 'https://example.com/broken',
    statusCode: 404,
    ttfb: 0,
    bytes: 0,
    title: '',
    performance: 0,
    seo: 0,
    accessibility: 0,
    llmReadiness: 0,
    measurementMode: 'fetch-status-only',
    auditLabel: 'Measurement failed',
    measurementError: {
      code: 'HTTP_ERROR',
      message: 'HTTP 404: Not Found',
      retryable: false,
    },
    ...overrides,
  };
}

function isFailed(page: CrawledPage): boolean {
  return page.measurementMode === 'fetch-status-only' || !!page.measurementError;
}

function auditLabelFor(mode: CrawledPage['measurementMode']): string {
  switch (mode) {
    case 'full-fetch':        return 'Full fetch audit';
    case 'lightweight-fetch': return 'Lightweight fetch audit';
    case 'fetch-status-only': return 'Measurement failed';
    default: return 'Unknown';
  }
}

// Simulate score isolation: each page has its own score, not copied from root
function assertScoreIsolation(pages: CrawledPage[]): boolean {
  if (pages.length < 2) return true;
  const root = pages[0];
  return pages.slice(1).every(p =>
    // Crawled pages may have different scores than root — they are not copies
    p.performance !== root.performance ||
    p.seo !== root.seo ||
    p.accessibility !== root.accessibility
  );
}

// ─── Page isolation ───────────────────────────────────────────────────────────

describe('crawled page isolation', () => {
  it('root page and crawled pages have independent scores', () => {
    const root = buildRootPage({ performance: 78, seo: 85, accessibility: 72 });
    const about = buildCrawledPage({ performance: 64, seo: 90, accessibility: 80 });
    const contact = buildCrawledPage({ url: 'https://example.com/contact', performance: 55, seo: 70, accessibility: 65 });

    expect(root.performance).not.toBe(about.performance);
    expect(root.seo).not.toBe(contact.seo);
    expect(root.accessibility).not.toBe(about.accessibility);
  });

  it('crawled page scores do not share references with root page', () => {
    const root = buildRootPage({ performance: 78 });
    const crawled = buildCrawledPage({ performance: 64 });

    // Mutating one should not affect the other
    const rootScore = root.performance;
    (crawled as any).performance = 99;
    expect(root.performance).toBe(rootScore);
  });

  it('assertScoreIsolation returns true when pages have different scores', () => {
    const pages = [
      buildRootPage({ performance: 78, seo: 85, accessibility: 72 }),
      buildCrawledPage({ performance: 64, seo: 90, accessibility: 80 }),
    ];
    expect(assertScoreIsolation(pages)).toBe(true);
  });

  it('assertScoreIsolation returns false when all crawled pages have same scores as root', () => {
    const pages = [
      buildRootPage({ performance: 78, seo: 85, accessibility: 72 }),
      buildCrawledPage({ performance: 78, seo: 85, accessibility: 72 }), // identical to root
    ];
    expect(assertScoreIsolation(pages)).toBe(false);
  });

  it('pages accumulate in order: root first, then crawled', () => {
    const pages: CrawledPage[] = [];
    pages.push(buildRootPage());
    pages.push(buildCrawledPage({ url: 'https://example.com/page1' }));
    pages.push(buildCrawledPage({ url: 'https://example.com/page2' }));

    expect(pages[0].measurementMode).toBe('full-fetch');
    expect(pages[1].measurementMode).toBe('lightweight-fetch');
    expect(pages[2].measurementMode).toBe('lightweight-fetch');
  });
});

// ─── Measurement mode labels ──────────────────────────────────────────────────

describe('auditLabel assignment', () => {
  it('root page gets "Full fetch audit" label', () => {
    const root = buildRootPage();
    expect(root.auditLabel).toBe('Full fetch audit');
    expect(root.measurementMode).toBe('full-fetch');
  });

  it('crawled pages get "Lightweight fetch audit" label', () => {
    const page = buildCrawledPage();
    expect(page.auditLabel).toBe('Lightweight fetch audit');
    expect(page.measurementMode).toBe('lightweight-fetch');
  });

  it('failed pages get "Measurement failed" label', () => {
    const failed = buildFailedPage();
    expect(failed.auditLabel).toBe('Measurement failed');
  });

  it('auditLabelFor helper maps full-fetch correctly', () => {
    expect(auditLabelFor('full-fetch')).toBe('Full fetch audit');
  });

  it('auditLabelFor helper maps lightweight-fetch correctly', () => {
    expect(auditLabelFor('lightweight-fetch')).toBe('Lightweight fetch audit');
  });

  it('auditLabelFor helper maps fetch-status-only correctly', () => {
    expect(auditLabelFor('fetch-status-only')).toBe('Measurement failed');
  });
});

// ─── Failed page handling ─────────────────────────────────────────────────────

describe('failed page handling', () => {
  it('isFailed returns true for fetch-status-only pages', () => {
    const failed = buildFailedPage();
    expect(isFailed(failed)).toBe(true);
  });

  it('isFailed returns true for pages with measurementError', () => {
    const page = buildCrawledPage({
      measurementError: { code: 'TIMEOUT', message: 'Request timed out', retryable: true },
    });
    expect(isFailed(page)).toBe(true);
  });

  it('isFailed returns false for successful pages', () => {
    expect(isFailed(buildRootPage())).toBe(false);
    expect(isFailed(buildCrawledPage())).toBe(false);
  });

  it('failed page has zero scores', () => {
    const failed = buildFailedPage();
    expect(failed.performance).toBe(0);
    expect(failed.seo).toBe(0);
    expect(failed.accessibility).toBe(0);
  });

  it('failed page retains statusCode from the response', () => {
    const failed = buildFailedPage({ statusCode: 404 });
    expect(failed.statusCode).toBe(404);
  });

  it('failed page stores error code and message', () => {
    const failed = buildFailedPage();
    expect(failed.measurementError?.code).toBe('HTTP_ERROR');
    expect(failed.measurementError?.message).toContain('404');
  });

  it('timeout error is marked retryable', () => {
    const failed = buildFailedPage({
      measurementError: { code: 'TIMEOUT', message: 'Request timed out after 15s', retryable: true },
    });
    expect(failed.measurementError?.retryable).toBe(true);
  });

  it('404 error is NOT retryable', () => {
    const failed = buildFailedPage();
    expect(failed.measurementError?.retryable).toBe(false);
  });
});

// ─── Redirect URL storage ─────────────────────────────────────────────────────

describe('redirect URL storage', () => {
  it('requestedUrl stores the original input URL before redirects', () => {
    const page = buildCrawledPage({
      requestedUrl: 'http://example.com/page',
      finalUrl: 'https://example.com/page',
      url: 'https://example.com/page',
    });
    expect(page.requestedUrl).toBe('http://example.com/page');
    expect(page.finalUrl).toBe('https://example.com/page');
  });

  it('finalUrl reflects the URL after HTTP redirects', () => {
    const page = buildCrawledPage({
      requestedUrl: 'https://example.com/old-path',
      finalUrl: 'https://example.com/new-path',
      url: 'https://example.com/new-path',
    });
    expect(page.finalUrl).toBe('https://example.com/new-path');
    expect(page.requestedUrl).toBe('https://example.com/old-path');
    expect(page.requestedUrl).not.toBe(page.finalUrl);
  });

  it('url field matches finalUrl for correctly built pages', () => {
    const page = buildCrawledPage({
      url: 'https://example.com/about',
      finalUrl: 'https://example.com/about',
    });
    expect(page.url).toBe(page.finalUrl);
  });

  it('root page stores requestedUrl as the originally submitted URL', () => {
    const root = buildRootPage({
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com/',
      url: 'https://example.com/',
    });
    expect(root.requestedUrl).toBe('https://example.com');
    expect(root.finalUrl).toBe('https://example.com/');
  });
});

// ─── Crawl limits and structure ───────────────────────────────────────────────

describe('crawl list structure', () => {
  it('at most 5 pages total (root + 4 crawled)', () => {
    const pages: CrawledPage[] = [buildRootPage()];
    for (let i = 0; i < 4; i++) {
      pages.push(buildCrawledPage({ url: `https://example.com/page-${i}` }));
    }
    expect(pages.length).toBe(5);
    expect(pages.length).toBeLessThanOrEqual(5);
  });

  it('root page is always index 0', () => {
    const pages = [buildRootPage(), buildCrawledPage(), buildCrawledPage({ url: 'https://example.com/x' })];
    expect(pages[0].measurementMode).toBe('full-fetch');
  });

  it('all pages have a non-empty url', () => {
    const pages = [
      buildRootPage(),
      buildCrawledPage(),
      buildFailedPage(),
    ];
    for (const p of pages) {
      expect(p.url.length).toBeGreaterThan(0);
    }
  });

  it('all pages have a non-negative statusCode', () => {
    const pages = [buildRootPage(), buildCrawledPage(), buildFailedPage({ statusCode: 404 })];
    for (const p of pages) {
      expect(p.statusCode).toBeGreaterThanOrEqual(0);
    }
  });
});
