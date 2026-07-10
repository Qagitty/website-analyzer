import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverPages } from '@/lib/monitoring/discovery';

// Mock validateAnalysisUrl — allow http/https URLs to pass
vi.mock('@/lib/security/url-validator', () => ({
  validateAnalysisUrl: (url: string) => ({
    valid: url.startsWith('https://') || url.startsWith('http://'),
    rejectionReason: url.startsWith('https://') || url.startsWith('http://') ? undefined : 'blocked',
  }),
}));

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/contact</loc></url>
  <url><loc>https://other.com/evil</loc></url>
</urlset>`;

const ROOT_HTML = `<html><body>
  <a href="/products">Products</a>
  <a href="/blog">Blog</a>
  <a href="https://example.com/pricing">Pricing</a>
  <a href="https://evil.com/bad">Evil</a>
  <a href="/contact">Contact</a>
</body></html>`;

const ROBOTS_TXT = `User-agent: *\nDisallow: /admin\nDisallow: /private`;

function mockFetch(responses: Record<string, { ok: boolean; body: string; contentType?: string }>) {
  return vi.fn().mockImplementation((url: string) => {
    const key = Object.keys(responses).find((k) => url.includes(k));
    if (!key) return Promise.resolve({ ok: false, text: async () => '' });
    const r = responses[key];
    return Promise.resolve({
      ok: r.ok,
      text: async () => r.body,
      headers: { get: () => r.contentType ?? 'text/html' },
    });
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('discoverPages — sitemap strategy', () => {
  it('parses sitemap and returns same-origin URLs only', async () => {
    global.fetch = mockFetch({
      'robots.txt': { ok: false, body: '' },
      'sitemap.xml': { ok: true, body: SITEMAP_XML },
    });

    const result = await discoverPages('https://example.com', {
      strategy: 'sitemap',
      maxPages: 10,
    });

    expect(result.sitemapFound).toBe(true);
    // Should include example.com URLs but exclude other.com
    expect(result.pages.every((p) => p.url.startsWith('https://example.com'))).toBe(true);
    expect(result.pages.some((p) => p.url.includes('about'))).toBe(true);
    expect(result.pages.some((p) => p.url.includes('evil.com'))).toBe(false);
    expect(result.pages.every((p) => p.source === 'sitemap')).toBe(true);
  });

  it('respects maxPages limit', async () => {
    const bigSitemap = `<urlset>${Array.from({ length: 20 }, (_, i) => `<url><loc>https://example.com/page-${i}</loc></url>`).join('')}</urlset>`;
    global.fetch = mockFetch({
      'robots.txt': { ok: false, body: '' },
      'sitemap.xml': { ok: true, body: bigSitemap },
    });

    const result = await discoverPages('https://example.com', {
      strategy: 'sitemap',
      maxPages: 5,
    });

    expect(result.pages.length).toBeLessThanOrEqual(5);
  });

  it('respects robots.txt Disallow rules', async () => {
    const sitemap = `<urlset>
      <url><loc>https://example.com/about</loc></url>
      <url><loc>https://example.com/admin/panel</loc></url>
      <url><loc>https://example.com/private/data</loc></url>
    </urlset>`;
    global.fetch = mockFetch({
      'robots.txt': { ok: true, body: ROBOTS_TXT },
      'sitemap.xml': { ok: true, body: sitemap },
    });

    const result = await discoverPages('https://example.com', {
      strategy: 'sitemap',
      maxPages: 10,
    });

    expect(result.robotsFound).toBe(true);
    expect(result.pages.some((p) => p.url.includes('/admin'))).toBe(false);
    expect(result.pages.some((p) => p.url.includes('/private'))).toBe(false);
    expect(result.pages.some((p) => p.url.includes('/about'))).toBe(true);
  });
});

describe('discoverPages — crawl strategy', () => {
  it('extracts internal links from HTML', async () => {
    global.fetch = mockFetch({
      'robots.txt': { ok: false, body: '' },
      'example.com': { ok: true, body: ROOT_HTML },
    });

    const result = await discoverPages('https://example.com', {
      strategy: 'crawl',
      maxPages: 10,
    });

    expect(result.pages.every((p) => p.url.startsWith('https://example.com'))).toBe(true);
    expect(result.pages.some((p) => p.url.includes('/products'))).toBe(true);
    expect(result.pages.some((p) => p.url.includes('evil.com'))).toBe(false);
    expect(result.pages.every((p) => p.source === 'crawl')).toBe(true);
  });
});

describe('discoverPages — SSRF protection', () => {
  it('rejects private/internal URLs even if they appear in sitemap', async () => {
    // Override mock so private URLs fail the validator
    vi.mock('@/lib/security/url-validator', () => ({
      validateAnalysisUrl: (url: string) => ({
        valid: !url.includes('192.168') && !url.includes('localhost') && (url.startsWith('https://') || url.startsWith('http://')),
        rejectionReason: 'blocked',
      }),
    }));

    const sitemap = `<urlset>
      <url><loc>https://example.com/about</loc></url>
      <url><loc>http://192.168.1.1/admin</loc></url>
      <url><loc>http://localhost/secret</loc></url>
    </urlset>`;

    global.fetch = mockFetch({
      'robots.txt': { ok: false, body: '' },
      'sitemap.xml': { ok: true, body: sitemap },
    });

    const result = await discoverPages('https://example.com', {
      strategy: 'sitemap',
      maxPages: 10,
    });

    expect(result.pages.some((p) => p.url.includes('192.168'))).toBe(false);
    expect(result.pages.some((p) => p.url.includes('localhost'))).toBe(false);
  });
});

describe('discoverPages — pattern filters', () => {
  it('applies excludePatterns', async () => {
    global.fetch = mockFetch({
      'robots.txt': { ok: false, body: '' },
      'sitemap.xml': {
        ok: true,
        body: `<urlset>
          <url><loc>https://example.com/blog/post-1</loc></url>
          <url><loc>https://example.com/products/widget</loc></url>
          <url><loc>https://example.com/about</loc></url>
        </urlset>`,
      },
    });

    const result = await discoverPages('https://example.com', {
      strategy: 'sitemap',
      maxPages: 10,
      excludePatterns: ['/blog/'],
    });

    expect(result.pages.some((p) => p.url.includes('/blog/'))).toBe(false);
    expect(result.pages.some((p) => p.url.includes('/products/'))).toBe(true);
  });
});
