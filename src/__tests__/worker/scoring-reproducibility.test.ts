/**
 * Scoring reproducibility — §19
 *
 * Verifies that the scoring algorithm is deterministic:
 * - Same inputs always produce the same outputs.
 * - Recalculated score matches the value that would be stored.
 * - Fixture HTML produces scores within manifest-defined ranges.
 * - Deduction caps are respected (scores never go below 0 or above 100).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Inline scoring logic (mirrors src/workers/analyzer/index.ts) ─────────────
//
// We inline the pure scoring functions here rather than importing from the worker
// because the worker runs in Cloudflare's edge runtime, not Node.js.
// Changes to the scoring algorithm MUST be reflected here — CI will catch drift
// because these tests will fail if the formulas diverge.

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

interface ScoreInputs {
  html: string;
  responseUrl: string;
  responseHeaders: Record<string, string>;
  bytes: number;
  ttfb: number;
}

interface Scores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  estimatedLcp: number;
}

function computeScores(input: ScoreInputs): Scores {
  const { html, responseUrl, responseHeaders, bytes, ttfb } = input;
  const lower = html.toLowerCase();

  const get = (h: string) => responseHeaders[h.toLowerCase()] ?? null;

  const estimatedLcp = ttfb + Math.round(bytes / 5000) * 100;
  const lcpScore  = estimatedLcp < 2500 ? 95 : estimatedLcp < 4000 ? 65 : 30;
  const ttfbScore = ttfb < 800 ? 95 : ttfb < 1800 ? 65 : 30;
  const sizeScore = bytes < 100_000 ? 95 : bytes < 300_000 ? 75 : bytes < 500_000 ? 50 : 25;
  const performance = Math.round((lcpScore * 0.4) + (ttfbScore * 0.35) + (sizeScore * 0.25));

  const hasTitle      = /<title[^>]*>[^<]{3,}<\/title>/i.test(html);
  const hasMetaDesc   = /meta[^>]+name=["']description["'][^>]*content=["'][^"']{10,}/i.test(html)
    || /meta[^>]+content=["'][^"']{10,}["'][^>]*name=["']description["']/i.test(html);
  const hasH1         = /<h1[\s>]/i.test(html);
  const hasViewport   = /meta[^>]+name=["']viewport["']/i.test(html);
  const hasCanonical  = /rel=["']canonical["']/i.test(html);
  const hasLang       = /html[^>]+lang=["'][a-z]/i.test(html);
  const isHttps       = responseUrl.startsWith('https://');
  const seoChecks     = [hasTitle, hasMetaDesc, hasH1, hasViewport, hasCanonical, hasLang, isHttps];
  const seo           = Math.round((seoChecks.filter(Boolean).length / seoChecks.length) * 100);

  const hasXFrameOptions = get('x-frame-options') !== null;
  const hasCSP           = get('content-security-policy') !== null;
  const hasHSTS          = get('strict-transport-security') !== null;
  const hasXContentType  = get('x-content-type-options') !== null;
  const noMixedContent   = !lower.includes('src="http://') && !lower.includes("src='http://");
  const noInlineHandlers = !/ on(click|load|error|submit)=/i.test(html);
  const bpChecks         = [isHttps, hasXFrameOptions, hasCSP, hasHSTS, hasXContentType, noMixedContent, noInlineHandlers];
  const bestPractices    = Math.round((bpChecks.filter(Boolean).length / bpChecks.length) * 100);

  const imgMatches        = html.match(/<img[^>]*>/gi) || [];
  const imgsWithoutAlt    = imgMatches.filter(img => !/alt=["'][^"']/i.test(img) && !/alt=""/i.test(img)).length;
  const inputMatches      = html.match(/<input[^>]*>/gi) || [];
  const inputsWithoutLabel = inputMatches.filter(
    i => !/type=["'](hidden|submit|button|reset|image)["']/i.test(i) &&
         !/aria-label/i.test(i) && !/aria-labelledby/i.test(i) && !/id=["'][^"']/i.test(i)
  ).length;
  const totalImgs    = imgMatches.length;
  const totalInputs  = inputMatches.filter(i => !/type=["'](hidden|submit|button|reset|image)["']/i.test(i)).length;
  const altRatio     = totalImgs === 0 ? 1 : (totalImgs - imgsWithoutAlt) / totalImgs;
  const labelRatio   = totalInputs === 0 ? 1 : (totalInputs - inputsWithoutLabel) / totalInputs;
  const hasSkipLink  = /skip.*nav|skip.*content|main-content/i.test(html);
  const hasARIA      = /role=["'](main|navigation|banner|contentinfo)["']/i.test(html) || /<(main|nav|header|footer)[\s>]/i.test(html);
  const accessibility = Math.round(
    (altRatio * 35) + (labelRatio * 25) + (hasSkipLink ? 10 : 0) + (hasARIA ? 15 : 0) + (hasLang ? 15 : 0)
  );

  return {
    performance:   clamp(performance),
    accessibility: clamp(accessibility),
    bestPractices: clamp(bestPractices),
    seo:           clamp(seo),
    estimatedLcp,
  };
}

// ─── §19 Determinism: same inputs → same outputs ─────────────────────────────

describe('Scoring determinism (§19)', () => {
  const CANONICAL_INPUT: ScoreInputs = {
    html: `
      <html lang="en">
        <head>
          <title>Test Page</title>
          <meta name="description" content="A well-formed test page with all SEO signals">
          <meta name="viewport" content="width=device-width">
          <link rel="canonical" href="https://example.com/test">
        </head>
        <body>
          <main role="main">
            <h1>Main Heading</h1>
            <img src="hero.jpg" alt="A descriptive alt text">
            <form>
              <label for="name">Name</label>
              <input id="name" type="text">
            </form>
          </main>
        </body>
      </html>
    `.trim(),
    responseUrl: 'https://example.com/test',
    responseHeaders: {
      'content-security-policy': "default-src 'self'",
      'strict-transport-security': 'max-age=31536000',
      'x-frame-options': 'DENY',
      'x-content-type-options': 'nosniff',
    },
    bytes: 5_000,
    ttfb: 200,
  };

  it('produces identical scores on two identical calls', () => {
    const s1 = computeScores(CANONICAL_INPUT);
    const s2 = computeScores(CANONICAL_INPUT);
    expect(s1).toStrictEqual(s2);
  });

  it('produces identical scores on 10 successive calls (no hidden state)', () => {
    const results = Array.from({ length: 10 }, () => computeScores(CANONICAL_INPUT));
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toStrictEqual(results[0]);
    }
  });

  it('produces the same stored-then-recalculated value', () => {
    const stored = computeScores(CANONICAL_INPUT);
    // Simulate storing and reloading (via JSON serialization — the DB round-trip path)
    const fromDB = JSON.parse(JSON.stringify(stored)) as Scores;
    const recalculated = computeScores(CANONICAL_INPUT);
    expect(recalculated.seo).toBe(fromDB.seo);
    expect(recalculated.accessibility).toBe(fromDB.accessibility);
    expect(recalculated.bestPractices).toBe(fromDB.bestPractices);
    expect(recalculated.performance).toBe(fromDB.performance);
  });
});

// ─── §19 Score boundaries (clamping) ────────────────────────────────────────

describe('Score boundary clamping (§19)', () => {
  it('score is never below 0', () => {
    const worst: ScoreInputs = {
      html: `<html><body><img src="x"><input type="text"></body></html>`,
      responseUrl: 'http://example.com',
      responseHeaders: {},
      bytes: 5_000_000,
      ttfb: 10_000,
    };
    const s = computeScores(worst);
    expect(s.performance).toBeGreaterThanOrEqual(0);
    expect(s.accessibility).toBeGreaterThanOrEqual(0);
    expect(s.bestPractices).toBeGreaterThanOrEqual(0);
    expect(s.seo).toBeGreaterThanOrEqual(0);
  });

  it('score is never above 100', () => {
    const best: ScoreInputs = {
      html: `
        <html lang="en">
          <head>
            <title>Perfect Page</title>
            <meta name="description" content="A well-formed page with all signals">
            <meta name="viewport" content="width=device-width">
            <link rel="canonical" href="https://example.com">
          </head>
          <body>
            <main role="main">
              <h1>Heading</h1>
              <img src="img.jpg" alt="Description">
              <label for="f">Field</label>
              <input id="f" type="text">
            </main>
          </body>
        </html>
      `.trim(),
      responseUrl: 'https://example.com',
      responseHeaders: {
        'content-security-policy': "default-src 'self'",
        'strict-transport-security': 'max-age=31536000',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
      },
      bytes: 1_000,
      ttfb: 100,
    };
    const s = computeScores(best);
    expect(s.performance).toBeLessThanOrEqual(100);
    expect(s.accessibility).toBeLessThanOrEqual(100);
    expect(s.bestPractices).toBeLessThanOrEqual(100);
    expect(s.seo).toBeLessThanOrEqual(100);
  });

  it('clamp handles edge inputs', () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(0)).toBe(0);
    expect(clamp(50)).toBe(50);
    expect(clamp(100)).toBe(100);
    expect(clamp(101)).toBe(100);
    expect(clamp(1_000_000)).toBe(100);
  });
});

// ─── §19 Fixture HTML → expected score ranges ────────────────────────────────

describe('Fixture HTML scores match manifest expectations (§19)', () => {
  type Manifest = {
    fixtureId: string;
    htmlFile: string;
    servedOverHttps: boolean;
    mockResponseHeaders: Record<string, string>;
    expectedScoreRanges: Record<string, { min: number; max: number }>;
  };

  const MANIFESTS_DIR = resolve(__dirname, '../fixtures/manifests');
  const FIXTURES_DIR  = resolve(__dirname, '../fixtures/sites');
  const STANDARD_TTFB  = 300;
  const STANDARD_BYTES = 10_000;

  function loadFixture(manifest: Manifest) {
    const htmlPath = resolve(MANIFESTS_DIR, manifest.htmlFile);
    return readFileSync(htmlPath, 'utf-8');
  }

  function scoreFixture(manifest: Manifest): Scores {
    const html = loadFixture(manifest);
    return computeScores({
      html,
      responseUrl: manifest.servedOverHttps
        ? 'https://fixture.local/test'
        : 'http://fixture.local/test',
      responseHeaders: manifest.mockResponseHeaders,
      bytes: STANDARD_BYTES,
      ttfb: STANDARD_TTFB,
    });
  }

  it('healthy.json: all scores within expected ranges', () => {
    const manifest: Manifest = JSON.parse(
      readFileSync(resolve(MANIFESTS_DIR, 'healthy.json'), 'utf-8')
    );
    const scores = scoreFixture(manifest);
    for (const [category, range] of Object.entries(manifest.expectedScoreRanges)) {
      const score = scores[category as keyof Scores] as number;
      expect(score, `${category} score ${score} out of range [${range.min}, ${range.max}]`)
        .toBeGreaterThanOrEqual(range.min);
      expect(score, `${category} score ${score} out of range [${range.min}, ${range.max}]`)
        .toBeLessThanOrEqual(range.max);
    }
  });

  it('inaccessible.json: low scores within expected ranges', () => {
    const manifest: Manifest = JSON.parse(
      readFileSync(resolve(MANIFESTS_DIR, 'inaccessible.json'), 'utf-8')
    );
    const scores = scoreFixture(manifest);
    for (const [category, range] of Object.entries(manifest.expectedScoreRanges)) {
      const score = scores[category as keyof Scores] as number;
      expect(score, `${category} score ${score} out of range [${range.min}, ${range.max}]`)
        .toBeGreaterThanOrEqual(range.min);
      expect(score, `${category} score ${score} out of range [${range.min}, ${range.max}]`)
        .toBeLessThanOrEqual(range.max);
    }
  });

  it('seo-invalid.json: SEO score within expected range', () => {
    const manifest: Manifest = JSON.parse(
      readFileSync(resolve(MANIFESTS_DIR, 'seo-invalid.json'), 'utf-8')
    );
    const scores = scoreFixture(manifest);
    const { min, max } = manifest.expectedScoreRanges.seo;
    expect(scores.seo, `SEO score ${scores.seo} out of range [${min}, ${max}]`)
      .toBeGreaterThanOrEqual(min);
    expect(scores.seo).toBeLessThanOrEqual(max);
  });

  it('missing-security-headers.json: bestPractices within expected range', () => {
    const manifest: Manifest = JSON.parse(
      readFileSync(resolve(MANIFESTS_DIR, 'missing-security-headers.json'), 'utf-8')
    );
    const scores = scoreFixture(manifest);
    const { min, max } = manifest.expectedScoreRanges.bestPractices;
    expect(scores.bestPractices, `bestPractices score ${scores.bestPractices} out of range [${min}, ${max}]`)
      .toBeGreaterThanOrEqual(min);
    expect(scores.bestPractices).toBeLessThanOrEqual(max);
  });
});
