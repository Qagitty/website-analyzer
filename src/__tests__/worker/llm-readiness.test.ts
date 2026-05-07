import { describe, it, expect } from 'vitest';

// ─── Inline pure functions from worker (no imports from the worker) ───────────

interface LLMReadiness {
  score: number;
  checks: {
    hasStructuredData: boolean;
    hasMetaDescription: boolean;
    hasOpenGraph: boolean;
    hasSitemap: boolean;
    allowsAIBots: boolean;
    hasCleanHeadings: boolean;
    hasSufficientContent: boolean;
    hasCanonical: boolean;
  };
  signals: string[];
}

function checkLLMReadiness(html: string): LLMReadiness {
  const checks = {
    hasStructuredData: /"@context"\s*:\s*"https?:\/\/schema\.org/i.test(html) || /itemscope/i.test(html),
    hasMetaDescription: (() => {
      const m = html.match(/meta[^>]+name=["']description["'][^>]*content=["']([^"']{50,160})["']/i)
        || html.match(/meta[^>]+content=["']([^"']{50,160})["'][^>]*name=["']description["']/i);
      return m !== null;
    })(),
    hasOpenGraph: /property=["']og:title["']/i.test(html) && /property=["']og:description["']/i.test(html),
    hasSitemap: /sitemap/i.test(html),
    allowsAIBots: !/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*(noindex|nofollow|none)/i.test(html),
    hasCleanHeadings: /<h1[\s>]/i.test(html) && (/<h2[\s>]/i.test(html) || /<h3[\s>]/i.test(html)),
    hasSufficientContent: html.length > 5000,
    hasCanonical: /rel=["']canonical["']/i.test(html),
  };

  const passing = Object.values(checks).filter(Boolean).length;
  const score = Math.round(passing * 12.5);

  const signals: string[] = [];
  if (!checks.hasStructuredData) signals.push('Add JSON-LD structured data (Schema.org) so AI can understand your content type');
  if (!checks.hasMetaDescription) signals.push('Add a meta description (50-160 chars) — AI uses this for content summaries');
  if (!checks.hasOpenGraph) signals.push('Add Open Graph tags so AI bots can preview your content correctly');
  if (!checks.hasSitemap) signals.push('Link to your sitemap.xml in <head> so crawlers discover all pages');
  if (!checks.allowsAIBots) signals.push('Your robots meta tag blocks AI crawlers — remove GPTBot/CCBot restrictions if you want AI indexing');
  if (!checks.hasCleanHeadings) signals.push('Add clear H2/H3 headings to help AI understand your content hierarchy');
  if (!checks.hasSufficientContent) signals.push('Add more substantive content — thin pages are often skipped by AI crawlers');
  if (!checks.hasCanonical) signals.push('Add a canonical URL tag to avoid duplicate content confusion for AI');

  return { score, checks, signals };
}

function crawlInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const skipPatterns = ['/login', '/signup', '/admin', '/api', '/static', '/assets'];
  const seen = new Set<string>();
  const results: string[] = [];

  const hrefRegex = /href=["']([^"'#][^"']*)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) continue;

    let absolute: string;
    try {
      absolute = new URL(raw, base.origin).href;
    } catch {
      continue;
    }

    const parsed = new URL(absolute);
    if (parsed.hostname !== base.hostname) continue;
    if (skipPatterns.some(p => parsed.pathname.startsWith(p))) continue;
    if (parsed.pathname === '/' && parsed.search === '') continue;
    const key = parsed.origin + parsed.pathname;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push(absolute);
    if (results.length >= 4) break;
  }

  return results;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkLLMReadiness', () => {
  it('returns score of 100 for perfectly optimised page', () => {
    const html = `
      <html lang="en">
        <head>
          <title>Test</title>
          <meta name="description" content="A description that is definitely long enough to pass the check here">
          <meta property="og:title" content="Test">
          <meta property="og:description" content="OG description">
          <link rel="canonical" href="https://example.com">
          <link rel="sitemap" href="/sitemap.xml">
          <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>
        </head>
        <body>
          <h1>Title</h1><h2>Section</h2>
          ${'<p>content paragraph</p>'.repeat(300)}
        </body>
      </html>
    `;
    const result = checkLLMReadiness(html);
    expect(result.score).toBe(100);
  });

  it('returns low score for nearly empty page', () => {
    // allowsAIBots defaults true (no noindex), so 1 check passes => score = 13
    const result = checkLLMReadiness('<html><body></body></html>');
    expect(result.score).toBeLessThanOrEqual(13);
    expect(result.checks.hasStructuredData).toBe(false);
    expect(result.checks.hasMetaDescription).toBe(false);
    expect(result.checks.hasOpenGraph).toBe(false);
    expect(result.checks.hasSitemap).toBe(false);
  });

  it('detects JSON-LD structured data', () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org"}</script>`;
    const result = checkLLMReadiness(html);
    expect(result.checks.hasStructuredData).toBe(true);
  });

  it('detects itemscope as structured data', () => {
    const html = `<div itemscope itemtype="https://schema.org/Product">test</div>`;
    const result = checkLLMReadiness(html);
    expect(result.checks.hasStructuredData).toBe(true);
  });

  it('detects missing meta description', () => {
    const html = `<html><head><title>No desc</title></head><body></body></html>`;
    const result = checkLLMReadiness(html);
    expect(result.checks.hasMetaDescription).toBe(false);
  });

  it('detects meta description when present and long enough', () => {
    const html = `<meta name="description" content="This is a good meta description that is long enough to pass">`;
    const result = checkLLMReadiness(html);
    expect(result.checks.hasMetaDescription).toBe(true);
  });

  it('detects Open Graph tags', () => {
    const html = `
      <meta property="og:title" content="My Title">
      <meta property="og:description" content="My description">
    `;
    const result = checkLLMReadiness(html);
    expect(result.checks.hasOpenGraph).toBe(true);
  });

  it('returns false for Open Graph if only og:title present', () => {
    const html = `<meta property="og:title" content="My Title">`;
    const result = checkLLMReadiness(html);
    expect(result.checks.hasOpenGraph).toBe(false);
  });

  it('detects robots meta blocking AI bots (noindex)', () => {
    const html = `<meta name="robots" content="noindex, nofollow">`;
    const result = checkLLMReadiness(html);
    expect(result.checks.allowsAIBots).toBe(false);
  });

  it('allows AI bots when no blocking robots meta', () => {
    const html = `<html><head></head><body>content</body></html>`;
    const result = checkLLMReadiness(html);
    expect(result.checks.allowsAIBots).toBe(true);
  });

  it('generates improvement signals for missing checks', () => {
    const result = checkLLMReadiness('<html><body></body></html>');
    expect(result.signals.length).toBeGreaterThan(0);
    // allowsAIBots defaults true so 7 signals for the 7 failing checks
    expect(result.signals.length).toBe(7);
  });

  it('score is 12.5 per passing check', () => {
    // Page with only sitemap reference — 1 check passes
    const html = `<link rel="sitemap" href="/sitemap.xml">`;
    const result = checkLLMReadiness(html);
    expect(result.checks.hasSitemap).toBe(true);
    // Only sitemap passes (and allowsAIBots which is true by default)
    const passingCount = Object.values(result.checks).filter(Boolean).length;
    expect(result.score).toBe(Math.round(passingCount * 12.5));
  });
});

describe('crawlInternalLinks', () => {
  it('extracts internal links from html', () => {
    const html = `<a href="/about">About</a><a href="/contact">Contact</a>`;
    const links = crawlInternalLinks(html, 'https://example.com');
    expect(links).toContain('https://example.com/about');
    expect(links).toContain('https://example.com/contact');
  });

  it('converts relative links to absolute', () => {
    const html = `<a href="/blog/post-1">Post</a>`;
    const links = crawlInternalLinks(html, 'https://example.com');
    expect(links[0]).toBe('https://example.com/blog/post-1');
  });

  it('filters out anchor-only links (#section)', () => {
    const html = `<a href="#section">Jump</a><a href="/page">Page</a>`;
    const links = crawlInternalLinks(html, 'https://example.com');
    expect(links).not.toContain('https://example.com/#section');
    expect(links).toContain('https://example.com/page');
  });

  it('filters out /login path', () => {
    const html = `<a href="/login">Login</a><a href="/about">About</a>`;
    const links = crawlInternalLinks(html, 'https://example.com');
    expect(links).not.toContain('https://example.com/login');
  });

  it('filters out /signup, /admin, /api paths', () => {
    const html = `
      <a href="/signup">Sign up</a>
      <a href="/admin/settings">Admin</a>
      <a href="/api/data">API</a>
      <a href="/about">About</a>
    `;
    const links = crawlInternalLinks(html, 'https://example.com');
    expect(links).not.toContain('https://example.com/signup');
    expect(links).not.toContain('https://example.com/admin/settings');
    expect(links).not.toContain('https://example.com/api/data');
    expect(links).toContain('https://example.com/about');
  });

  it('deduplicates links', () => {
    const html = `<a href="/about">About 1</a><a href="/about">About 2</a>`;
    const links = crawlInternalLinks(html, 'https://example.com');
    expect(links.filter(l => l === 'https://example.com/about').length).toBe(1);
  });

  it('returns max 4 links', () => {
    const html = [1, 2, 3, 4, 5, 6].map(i => `<a href="/page${i}">Page ${i}</a>`).join('');
    const links = crawlInternalLinks(html, 'https://example.com');
    expect(links.length).toBeLessThanOrEqual(4);
  });

  it('filters out external domain links', () => {
    const html = `<a href="https://otherdomain.com/page">External</a><a href="/about">About</a>`;
    const links = crawlInternalLinks(html, 'https://example.com');
    expect(links).not.toContain('https://otherdomain.com/page');
    expect(links).toContain('https://example.com/about');
  });
});
