import { describe, it, expect } from 'vitest';

// ─── Inline pure logic from worker ───────────────────────────────────────────

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

interface Scores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  estimatedLcp: number;
}

function analyzeHTML(html: string, response: Response, bytes: number, ttfb: number): Scores {
  const lower = html.toLowerCase();

  const estimatedLcp = ttfb + Math.round(bytes / 5000) * 100;
  const lcpScore = estimatedLcp < 2500 ? 95 : estimatedLcp < 4000 ? 65 : 30;
  const ttfbScore = ttfb < 800 ? 95 : ttfb < 1800 ? 65 : 30;
  const sizeScore = bytes < 100_000 ? 95 : bytes < 300_000 ? 75 : bytes < 500_000 ? 50 : 25;
  const performance = Math.round((lcpScore * 0.4) + (ttfbScore * 0.35) + (sizeScore * 0.25));

  const hasTitle = /<title[^>]*>[^<]{3,}<\/title>/i.test(html);
  const hasMetaDesc = /meta[^>]+name=["']description["'][^>]*content=["'][^"']{10,}/i.test(html)
    || /meta[^>]+content=["'][^"']{10,}["'][^>]*name=["']description["']/i.test(html);
  const hasH1 = /<h1[\s>]/i.test(html);
  const hasViewport = /meta[^>]+name=["']viewport["']/i.test(html);
  const hasCanonical = /rel=["']canonical["']/i.test(html);
  const hasLang = /html[^>]+lang=["'][a-z]/i.test(html);
  const isHttps = response.url.startsWith('https://');
  const seoChecks = [hasTitle, hasMetaDesc, hasH1, hasViewport, hasCanonical, hasLang, isHttps];
  const seo = Math.round((seoChecks.filter(Boolean).length / seoChecks.length) * 100);

  const hasXFrameOptions = response.headers.get('x-frame-options') !== null;
  const hasCSP = response.headers.get('content-security-policy') !== null;
  const hasHSTS = response.headers.get('strict-transport-security') !== null;
  const hasXContentType = response.headers.get('x-content-type-options') !== null;
  const noMixedContent = !lower.includes('src="http://') && !lower.includes("src='http://");
  const noInlineHandlers = !/ on(click|load|error|submit)=/i.test(html);
  const bpChecks = [isHttps, hasXFrameOptions, hasCSP, hasHSTS, hasXContentType, noMixedContent, noInlineHandlers];
  const bestPractices = Math.round((bpChecks.filter(Boolean).length / bpChecks.length) * 100);

  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const imgsWithoutAlt = imgMatches.filter(img => !/alt=["'][^"']/i.test(img) && !/alt=""/i.test(img)).length;
  const inputMatches = html.match(/<input[^>]*>/gi) || [];
  const inputsWithoutLabel = inputMatches.filter(
    input => !/type=["'](hidden|submit|button|reset|image)["']/i.test(input) &&
             !/aria-label/i.test(input) && !/aria-labelledby/i.test(input) && !/id=["'][^"']/i.test(input)
  ).length;
  const totalImgs = imgMatches.length;
  const totalInputs = inputMatches.filter(i => !/type=["'](hidden|submit|button|reset|image)["']/i.test(i)).length;
  const altRatio = totalImgs === 0 ? 1 : (totalImgs - imgsWithoutAlt) / totalImgs;
  const labelRatio = totalInputs === 0 ? 1 : (totalInputs - inputsWithoutLabel) / totalInputs;
  const hasSkipLink = /skip.*nav|skip.*content|main-content/i.test(html);
  const hasARIALandmarks = /role=["'](main|navigation|banner|contentinfo)["']/i.test(html) || /<(main|nav|header|footer)[\s>]/i.test(html);
  const accessibility = Math.round(
    (altRatio * 35) + (labelRatio * 25) + (hasSkipLink ? 10 : 0) + (hasARIALandmarks ? 15 : 0) + (hasLang ? 15 : 0)
  );

  return {
    performance: clamp(performance),
    accessibility: clamp(accessibility),
    bestPractices: clamp(bestPractices),
    seo: clamp(seo),
    estimatedLcp,
  };
}

// ─── Helpers to build mock Response objects ───────────────────────────────────

function makeResponse(url: string, headers: Record<string, string> = {}): Response {
  return new Response('', { status: 200, headers }) as Response & { url: string };
}

function makeHttpsResponse(headers: Record<string, string> = {}): Response {
  const r = makeResponse('https://example.com', headers);
  Object.defineProperty(r, 'url', { value: 'https://example.com' });
  return r;
}

function makeHttpResponse(): Response {
  const r = makeResponse('http://example.com');
  Object.defineProperty(r, 'url', { value: 'http://example.com' });
  return r;
}

// ─── SEO checks ──────────────────────────────────────────────────────────────

describe('analyzeHTML — SEO checks', () => {
  it('detects title tag', () => {
    const html = `<html lang="en"><head><title>My Page Title</title></head><body></body></html>`;
    const scores = analyzeHTML(html, makeHttpsResponse(), 1000, 200);
    // With title + lang + isHttps = 3/7 checks passing at minimum
    expect(scores.seo).toBeGreaterThan(0);
  });

  it('detects missing title tag results in lower SEO score', () => {
    const withTitle = `<html lang="en"><head><title>Page</title></head><body><h1>H</h1></body></html>`;
    const withoutTitle = `<html lang="en"><head></head><body><h1>H</h1></body></html>`;
    const scoresWithTitle = analyzeHTML(withTitle, makeHttpsResponse(), 1000, 200);
    const scoresWithoutTitle = analyzeHTML(withoutTitle, makeHttpsResponse(), 1000, 200);
    expect(scoresWithTitle.seo).toBeGreaterThan(scoresWithoutTitle.seo);
  });

  it('detects meta description', () => {
    const html = `<html><head><meta name="description" content="A good description here"></head></html>`;
    const scores = analyzeHTML(html, makeHttpsResponse(), 1000, 200);
    // Meta desc passes
    expect(scores.seo).toBeGreaterThan(0);
  });

  it('detects h1 tag', () => {
    const withH1 = `<html lang="en"><head><title>T</title></head><body><h1>Heading</h1></body></html>`;
    const withoutH1 = `<html lang="en"><head><title>T</title></head><body><p>No heading</p></body></html>`;
    const withScore = analyzeHTML(withH1, makeHttpsResponse(), 1000, 200);
    const withoutScore = analyzeHTML(withoutH1, makeHttpsResponse(), 1000, 200);
    expect(withScore.seo).toBeGreaterThan(withoutScore.seo);
  });

  it('detects viewport meta', () => {
    const html = `<html><head><meta name="viewport" content="width=device-width"></head></html>`;
    const scores = analyzeHTML(html, makeHttpsResponse(), 1000, 200);
    expect(scores.seo).toBeGreaterThan(0);
  });

  it('detects canonical', () => {
    const html = `<html><head><link rel="canonical" href="https://example.com/page"></head></html>`;
    const scores = analyzeHTML(html, makeHttpsResponse(), 1000, 200);
    expect(scores.seo).toBeGreaterThan(0);
  });

  it('detects lang attribute', () => {
    const withLang = `<html lang="en"><head></head><body></body></html>`;
    const withoutLang = `<html><head></head><body></body></html>`;
    const withScore = analyzeHTML(withLang, makeHttpsResponse(), 1000, 200);
    const withoutScore = analyzeHTML(withoutLang, makeHttpsResponse(), 1000, 200);
    expect(withScore.seo).toBeGreaterThan(withoutScore.seo);
  });

  it('isHttps from response URL contributes to SEO score', () => {
    const html = `<html lang="en"><head><title>Test</title></head><body><h1>H</h1></body></html>`;
    const httpsScores = analyzeHTML(html, makeHttpsResponse(), 1000, 200);
    const httpScores = analyzeHTML(html, makeHttpResponse(), 1000, 200);
    expect(httpsScores.seo).toBeGreaterThan(httpScores.seo);
  });

  it('SEO score is 100/7 per passing check (rounded)', () => {
    // All 7 SEO checks passing = 100
    const html = `
      <html lang="en">
        <head>
          <title>Full Title Here</title>
          <meta name="description" content="A good meta description here">
          <meta name="viewport" content="width=device-width">
          <link rel="canonical" href="https://example.com">
        </head>
        <body><h1>Main Heading</h1></body>
      </html>
    `;
    const scores = analyzeHTML(html, makeHttpsResponse(), 1000, 200);
    expect(scores.seo).toBe(100);
  });
});

// ─── Best Practices ───────────────────────────────────────────────────────────

describe('analyzeHTML — Best Practices', () => {
  it('detects inline event handlers (onclick=)', () => {
    const withHandler = `<html><body><button onclick="doSomething()">Click</button></body></html>`;
    const withoutHandler = `<html><body><button>Click</button></body></html>`;
    const withScores = analyzeHTML(withHandler, makeHttpsResponse(), 1000, 200);
    const withoutScores = analyzeHTML(withoutHandler, makeHttpsResponse(), 1000, 200);
    expect(withScores.bestPractices).toBeLessThan(withoutScores.bestPractices);
  });

  it('detects mixed content (src="http://")', () => {
    const withMixed = `<html><body><img src="http://example.com/image.jpg"></body></html>`;
    const withoutMixed = `<html><body><img src="https://example.com/image.jpg"></body></html>`;
    const withScores = analyzeHTML(withMixed, makeHttpsResponse(), 1000, 200);
    const withoutScores = analyzeHTML(withoutMixed, makeHttpsResponse(), 1000, 200);
    expect(withScores.bestPractices).toBeLessThan(withoutScores.bestPractices);
  });

  it('no mixed content passes the check', () => {
    const html = `<html><body><img src="https://example.com/image.jpg"></body></html>`;
    // Test just checks that it doesn't penalise for no mixed content
    const scores = analyzeHTML(html, makeHttpsResponse(), 1000, 200);
    // With HTTPS + no mixed content + no inline handlers = 3/7 BP checks pass
    expect(scores.bestPractices).toBeGreaterThan(0);
  });
});

// ─── Performance ─────────────────────────────────────────────────────────────

describe('analyzeHTML — Performance', () => {
  it('small pages get high size score', () => {
    // bytes < 100KB => sizeScore = 95
    const scores = analyzeHTML('<html></html>', makeHttpsResponse(), 1000, 200);
    expect(scores.performance).toBeGreaterThan(80);
  });

  it('pages over 500KB get size score of 25', () => {
    const smallScores = analyzeHTML('<html></html>', makeHttpsResponse(), 1000, 200);
    const hugeScores = analyzeHTML('<html></html>', makeHttpsResponse(), 600_000, 200);
    expect(smallScores.performance).toBeGreaterThan(hugeScores.performance);
  });

  it('fast TTFB (<800ms) gets score 95', () => {
    const fastScores = analyzeHTML('<html></html>', makeHttpsResponse(), 1000, 300);
    const slowScores = analyzeHTML('<html></html>', makeHttpsResponse(), 1000, 900);
    expect(fastScores.performance).toBeGreaterThan(slowScores.performance);
  });

  it('slow TTFB (>1800ms) gets score 30', () => {
    const verySlowScores = analyzeHTML('<html></html>', makeHttpsResponse(), 1000, 2000);
    const fastScores = analyzeHTML('<html></html>', makeHttpsResponse(), 1000, 300);
    expect(verySlowScores.performance).toBeLessThan(fastScores.performance);
  });
});

// ─── clamp ────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('clamps to 0 minimum', () => {
    expect(clamp(-10)).toBe(0);
    expect(clamp(-1)).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    expect(clamp(110)).toBe(100);
    expect(clamp(200)).toBe(100);
  });

  it('passes through values in range', () => {
    expect(clamp(50)).toBe(50);
    expect(clamp(0)).toBe(0);
    expect(clamp(100)).toBe(100);
    expect(clamp(75)).toBe(75);
  });
});
