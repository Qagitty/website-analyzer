import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseRobotsTxt, checkRobotsAccess, AI_CRAWLERS, AI_CRAWLER_CONFIG_VERSION } from '../../workers/analyzer/ai-crawlers';

// ─── mock fetch for async helpers ─────────────────────────────────────────────
let mockFetch = vi.fn();
vi.stubGlobal('fetch', (...args: Parameters<typeof fetch>) => mockFetch(...args));

// ─── helpers ──────────────────────────────────────────────────────────────────
function makeResponse(
  opts: { status?: number; headers?: Record<string, string>; url?: string } = {},
): Response {
  const r = new Response('', { status: opts.status ?? 200, headers: opts.headers ?? {} });
  Object.defineProperty(r, 'url', { value: opts.url ?? 'https://example.com/', configurable: true });
  return r;
}

function stubFetch(robots: string | null, llmsTxt: string | null = null) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('/robots.txt')) {
      if (robots === null) throw new Error('fetch error');
      return new Response(robots, { status: 200 });
    }
    if (url.includes('/llms.txt')) {
      if (llmsTxt === null) return new Response('', { status: 404 });
      return new Response(llmsTxt, { status: 200 });
    }
    return new Response('', { status: 404 });
  });
}

// Import after mock setup
const { checkLLMReadiness, checkLLMReadinessLightweight } = await import('../../workers/analyzer/llm-readiness');

const FULL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Example Site</title>
  <meta name="description" content="A comprehensive guide to building better websites with accessibility and performance in mind.">
  <meta property="og:title" content="Example Site">
  <meta property="og:description" content="A comprehensive guide to web development.">
  <link rel="canonical" href="https://example.com/">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Example","url":"https://example.com"}</script>
</head>
<body>
  <nav><a href="/about">About</a><a href="/contact">Contact</a></nav>
  <main>
    <h1>Welcome to Example</h1>
    <h2>Getting Started</h2>
    <p>${'Content paragraph. '.repeat(30)}</p>
    <h2>Advanced Topics</h2>
    <p>${'More content. '.repeat(20)}</p>
    <p>Contact us at <a href="mailto:hello@example.com">hello@example.com</a></p>
  </main>
  <footer><p>© 2024 Example Corp</p></footer>
</body>
</html>`;

const EMPTY_SHELL_HTML = `<!DOCTYPE html><html><head><title></title></head><body><div id="root"></div></body></html>`;

// ─── parseRobotsTxt ───────────────────────────────────────────────────────────

describe('parseRobotsTxt', () => {
  it('parses a simple wildcard group', () => {
    const groups = parseRobotsTxt('User-agent: *\nDisallow: /private/\nAllow: /');
    expect(groups).toHaveLength(1);
    expect(groups[0]!.userAgents).toContain('*');
    expect(groups[0]!.rules).toHaveLength(2);
  });

  it('parses multiple user-agent groups', () => {
    const txt = `User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /`;
    const groups = parseRobotsTxt(txt);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.userAgents).toContain('*');
    expect(groups[1]!.userAgents).toContain('gptbot');
  });

  it('groups consecutive user-agent lines into one group', () => {
    const txt = `User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /`;
    const groups = parseRobotsTxt(txt);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.userAgents).toContain('gptbot');
    expect(groups[0]!.userAgents).toContain('claudebot');
  });

  it('strips comments', () => {
    const txt = `# main\nUser-agent: * # all bots\nDisallow: /secret/ # keep out`;
    const groups = parseRobotsTxt(txt);
    expect(groups[0]!.rules[0]!.path).toBe('/secret/');
  });

  it('handles empty Disallow (meaning allow all)', () => {
    const txt = `User-agent: *\nDisallow: `;
    const groups = parseRobotsTxt(txt);
    // empty Disallow is parsed with empty path
    expect(groups[0]!.rules[0]!.type).toBe('disallow');
    expect(groups[0]!.rules[0]!.path).toBe('');
  });
});

// ─── checkRobotsAccess ────────────────────────────────────────────────────────

describe('checkRobotsAccess', () => {
  it('allows when no groups present', () => {
    const r = checkRobotsAccess([], '*', '/');
    expect(r.allowed).toBe(true);
  });

  it('blocks path matching Disallow rule', () => {
    const groups = parseRobotsTxt('User-agent: *\nDisallow: /private/');
    const r = checkRobotsAccess(groups, '*', '/private/page');
    expect(r.allowed).toBe(false);
  });

  it('allows path not matching any Disallow', () => {
    const groups = parseRobotsTxt('User-agent: *\nDisallow: /private/');
    const r = checkRobotsAccess(groups, '*', '/public/page');
    expect(r.allowed).toBe(true);
  });

  it('exact user-agent group beats wildcard', () => {
    const txt = `User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /public/`;
    const groups = parseRobotsTxt(txt);
    // GPTBot should match its own group
    const r = checkRobotsAccess(groups, 'GPTBot', '/public/page');
    expect(r.allowed).toBe(true);
  });

  it('wildcard group used when no exact match', () => {
    const txt = `User-agent: *\nDisallow: /secret/`;
    const groups = parseRobotsTxt(txt);
    const r = checkRobotsAccess(groups, 'NewBot', '/secret/page');
    expect(r.allowed).toBe(false);
  });

  it('longer path rule wins (Allow /public/ beats Disallow /)', () => {
    const txt = `User-agent: *\nDisallow: /\nAllow: /public/`;
    const groups = parseRobotsTxt(txt);
    const r = checkRobotsAccess(groups, '*', '/public/page');
    expect(r.allowed).toBe(true);
  });

  it('blocked training crawlers do not make path unavailable to all crawlers', () => {
    const txt = `User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /`;
    const groups = parseRobotsTxt(txt);
    // Wildcard (general) allows
    const generalAccess = checkRobotsAccess(groups, '*', '/page');
    expect(generalAccess.allowed).toBe(true);
    // GPTBot blocked
    const gptAccess = checkRobotsAccess(groups, 'GPTBot', '/page');
    expect(gptAccess.allowed).toBe(false);
  });
});

// ─── AI_CRAWLERS registry ─────────────────────────────────────────────────────

describe('AI_CRAWLERS registry', () => {
  it('has at least 10 entries', () => {
    expect(AI_CRAWLERS.length).toBeGreaterThanOrEqual(10);
  });

  it('each entry has name, userAgent, category, provider', () => {
    for (const c of AI_CRAWLERS) {
      expect(c.name).toBeTruthy();
      expect(c.userAgent).toBeTruthy();
      expect(c.category).toBeTruthy();
      expect(c.provider).toBeTruthy();
    }
  });

  it('includes GPTBot, ClaudeBot, PerplexityBot', () => {
    const names = AI_CRAWLERS.map(c => c.name);
    expect(names).toContain('GPTBot');
    expect(names).toContain('ClaudeBot');
    expect(names).toContain('PerplexityBot');
  });

  it('distinguishes training vs search-retrieval categories', () => {
    const trainingCrawlers = AI_CRAWLERS.filter(c => c.category === 'model-training');
    const searchCrawlers   = AI_CRAWLERS.filter(c => c.category === 'search-retrieval');
    expect(trainingCrawlers.length).toBeGreaterThan(0);
    expect(searchCrawlers.length).toBeGreaterThan(0);
  });

  it('has a config version string', () => {
    expect(AI_CRAWLER_CONFIG_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── checkLLMReadiness (async, full audit) ────────────────────────────────────

describe('checkLLMReadiness', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    stubFetch('User-agent: *\nAllow: /');
  });

  it('returns a result with required fields', async () => {
    const result = await checkLLMReadiness(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(result.score).not.toBeNull();
    expect(result.scoreVersion).toBe('llm-readiness-v2');
    expect(result.auditMode).toBe('fetch-only');
    expect(result.findings).toBeInstanceOf(Array);
    expect(result.categoryScores).toBeInstanceOf(Array);
    expect(result.coverage).toBeDefined();
    expect(result.detectedSignals).toBeDefined();
  });

  it('score is null only if no categories could be evaluated', async () => {
    const result = await checkLLMReadiness(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(typeof result.score).toBe('number');
  });

  it('score is between 0 and 100', async () => {
    const result = await checkLLMReadiness(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('detects HTTPS from requestedUrl', async () => {
    const result = await checkLLMReadiness('<html></html>', makeResponse({ url: 'https://example.com/' }), 'https://example.com/');
    expect(result.detectedSignals.isHttps).toBe(true);
  });

  it('detects non-HTTPS', async () => {
    const result = await checkLLMReadiness('<html></html>', makeResponse({ url: 'http://example.com/' }), 'http://example.com/');
    expect(result.detectedSignals.isHttps).toBe(false);
  });

  it('detects JSON-LD structured data', async () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script></head><body><h1>T</h1></body></html>`;
    const result = await checkLLMReadiness(html, makeResponse(), 'https://example.com/');
    expect(result.detectedSignals.hasJsonLd).toBe(true);
    expect(result.detectedSignals.schemaTypes).toContain('Article');
  });

  it('marks structured data finding as passed when JSON-LD present', async () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script></head><body><h1>T</h1></body></html>`;
    const result = await checkLLMReadiness(html, makeResponse(), 'https://example.com/');
    const finding = result.findings.find(f => f.ruleId === 'sd-present');
    expect(finding?.status).toBe('passed');
  });

  it('marks structured data finding as failed when no JSON-LD', async () => {
    const result = await checkLLMReadiness('<html><body><h1>Test</h1></body></html>', makeResponse(), 'https://example.com/');
    const finding = result.findings.find(f => f.ruleId === 'sd-present');
    expect(finding?.status).toBe('failed');
  });

  it('detects invalid JSON-LD and marks it failed', async () => {
    const html = `<html><head><script type="application/ld+json">{ invalid json }</script></head><body></body></html>`;
    const result = await checkLLMReadiness(html, makeResponse(), 'https://example.com/');
    const finding = result.findings.find(f => f.ruleId === 'sd-parseable');
    expect(finding?.status).toBe('failed');
  });

  it('marks robots-meta as failed when noindex present', async () => {
    const html = `<html><head><meta name="robots" content="noindex, nofollow"></head><body><h1>T</h1></body></html>`;
    const result = await checkLLMReadiness(html, makeResponse(), 'https://example.com/');
    const finding = result.findings.find(f => f.ruleId === 'crl-robots-meta');
    expect(finding?.status).toBe('failed');
  });

  it('marks robots-meta as passed when noindex absent', async () => {
    const html = `<html><head><meta name="robots" content="index, follow"></head><body><h1>T</h1></body></html>`;
    const result = await checkLLMReadiness(html, makeResponse(), 'https://example.com/');
    const finding = result.findings.find(f => f.ruleId === 'crl-robots-meta');
    expect(finding?.status).toBe('passed');
  });

  it('marks X-Robots noindex as failed', async () => {
    const result = await checkLLMReadiness(
      '<html><body><h1>T</h1></body></html>',
      makeResponse({ headers: { 'x-robots-tag': 'noindex' } }),
      'https://example.com/',
    );
    const finding = result.findings.find(f => f.ruleId === 'crl-x-robots');
    expect(finding?.status).toBe('failed');
  });

  it('crl-http-ok passes on 200', async () => {
    const result = await checkLLMReadiness(FULL_HTML, makeResponse({ status: 200 }), 'https://example.com/');
    const finding = result.findings.find(f => f.ruleId === 'crl-http-ok');
    expect(finding?.status).toBe('passed');
  });

  it('crl-http-ok fails on 404', async () => {
    const result = await checkLLMReadiness(FULL_HTML, makeResponse({ status: 404 }), 'https://example.com/');
    const finding = result.findings.find(f => f.ruleId === 'crl-http-ok');
    expect(finding?.status).toBe('failed');
    expect(finding?.severity).toBe('critical');
  });

  it('marks canonical as passed when present', async () => {
    const html = `<html><head><link rel="canonical" href="https://example.com/"><title>T</title></head><body></body></html>`;
    const result = await checkLLMReadiness(html, makeResponse(), 'https://example.com/');
    const finding = result.findings.find(f => f.ruleId === 'cit-canonical');
    expect(finding?.status).toBe('passed');
  });

  it('marks canonical as failed when absent', async () => {
    const result = await checkLLMReadiness('<html><body><h1>T</h1></body></html>', makeResponse(), 'https://example.com/');
    const finding = result.findings.find(f => f.ruleId === 'cit-canonical');
    expect(finding?.status).toBe('failed');
  });

  it('detects H1 correctly', async () => {
    const withH1 = `<html><body><h1>My Title</h1></body></html>`;
    const r1 = await checkLLMReadiness(withH1, makeResponse(), 'https://example.com/');
    expect(r1.detectedSignals.h1Count).toBe(1);
    const finding = r1.findings.find(f => f.ruleId === 'sem-h1');
    expect(finding?.status).toBe('passed');
  });

  it('flags missing H1 as failed', async () => {
    const r = await checkLLMReadiness('<html><body><p>No heading</p></body></html>', makeResponse(), 'https://example.com/');
    const finding = r.findings.find(f => f.ruleId === 'sem-h1');
    expect(finding?.status).toBe('failed');
  });

  it('marks llms.txt as passed when found', async () => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/robots.txt')) return new Response('User-agent: *\nAllow: /', { status: 200 });
      if (url.includes('/llms.txt')) return new Response('# LLMs guide\n/index.md', { status: 200 });
      return new Response('', { status: 404 });
    });
    const r = await checkLLMReadiness('<html><body><h1>T</h1></body></html>', makeResponse(), 'https://example.com/');
    const finding = r.findings.find(f => f.ruleId === 'mg-llms-txt');
    expect(finding?.status).toBe('passed');
    expect(finding?.experimental).toBe(true);
  });

  it('marks llms.txt as warning (not failed) when not found', async () => {
    const r = await checkLLMReadiness('<html><body><h1>T</h1></body></html>', makeResponse(), 'https://example.com/');
    const finding = r.findings.find(f => f.ruleId === 'mg-llms-txt');
    // missing llms.txt must NOT be critical or high severity
    expect(finding?.status).toBe('warning');
    expect(finding?.severity).toBe('info');
    expect(finding?.experimental).toBe(true);
  });

  it('missing llms.txt is NOT high or critical severity', async () => {
    const r = await checkLLMReadiness('<html><body><h1>T</h1></body></html>', makeResponse(), 'https://example.com/');
    const finding = r.findings.find(f => f.ruleId === 'mg-llms-txt');
    expect(['critical', 'high']).not.toContain(finding?.severity);
  });

  it('includes AI crawler access in detectedSignals', async () => {
    const r = await checkLLMReadiness('<html><body></body></html>', makeResponse(), 'https://example.com/');
    expect(r.detectedSignals.aiCrawlerAccess).toBeInstanceOf(Array);
    expect(r.detectedSignals.aiCrawlerAccess.length).toBeGreaterThan(0);
  });

  it('robots.txt blocking GPTBot does not make crl-robots-txt fail for general crawlers', async () => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/robots.txt')) {
        return new Response('User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /', { status: 200 });
      }
      return new Response('', { status: 404 });
    });
    const r = await checkLLMReadiness('<html><body><h1>T</h1></body></html>', makeResponse(), 'https://example.com/');
    const robotsTxtFinding = r.findings.find(f => f.ruleId === 'crl-robots-txt');
    // wildcard allows, so general crawlability should pass
    expect(robotsTxtFinding?.status).toBe('passed');
    // GPTBot is blocked but shown in aiCrawlerAccess, not as a score failure
    const gptEntry = r.detectedSignals.aiCrawlerAccess.find(c => c.crawlerName === 'GPTBot');
    expect(gptEntry?.allowed).toBe(false);
  });

  it('coverage is < 100 only when unavailable signals exist', async () => {
    const r = await checkLLMReadiness(FULL_HTML, makeResponse(), 'https://example.com/');
    // fetch-only mode = no rendered-DOM signals
    expect(r.coverage.percentage).toBeLessThanOrEqual(100);
    expect(r.coverage.supportedSignals).toBeGreaterThan(0);
  });

  it('coverage percentage is between 0 and 100', async () => {
    const r = await checkLLMReadiness(EMPTY_SHELL_HTML, makeResponse(), 'https://example.com/');
    expect(r.coverage.percentage).toBeGreaterThanOrEqual(0);
    expect(r.coverage.percentage).toBeLessThanOrEqual(100);
  });

  it('unavailable signals do not reduce score', async () => {
    // Result with robots.txt fetch failure
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/robots.txt')) throw new Error('network error');
      return new Response('', { status: 404 });
    });
    const r = await checkLLMReadiness(FULL_HTML, makeResponse(), 'https://example.com/');
    const robotsFinding = r.findings.find(f => f.ruleId === 'crl-robots-txt');
    expect(robotsFinding?.status).toBe('unavailable');
    // Score should still be computed from available signals
    expect(r.score).not.toBeNull();
  });

  it('categoryScores has weight > 0 categories', async () => {
    const r = await checkLLMReadiness(FULL_HTML, makeResponse(), 'https://example.com/');
    const weighted = r.categoryScores.filter(c => c.weight > 0);
    expect(weighted.length).toBeGreaterThan(0);
  });

  it('experimental signals have experimental=true', async () => {
    const r = await checkLLMReadiness('<html><body></body></html>', makeResponse(), 'https://example.com/');
    const experimentalFindings = r.findings.filter(f => f.experimental);
    expect(experimentalFindings.length).toBeGreaterThan(0);
    // llms.txt is always experimental
    const llmsTxt = r.findings.find(f => f.ruleId === 'mg-llms-txt');
    expect(llmsTxt?.experimental).toBe(true);
  });

  it('page with good signals gets higher score than empty page', async () => {
    const emptyResult = await checkLLMReadiness(EMPTY_SHELL_HTML, makeResponse(), 'https://example.com/');
    const goodResult  = await checkLLMReadiness(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(goodResult.score!).toBeGreaterThan(emptyResult.score!);
  });

  it('detects meta description and marks ca-meta-desc as passed for good length', async () => {
    const html = `<html><head><meta name="description" content="A detailed description of the page content that is long enough"></head><body><h1>T</h1></body></html>`;
    const r = await checkLLMReadiness(html, makeResponse(), 'https://example.com/');
    const finding = r.findings.find(f => f.ruleId === 'ca-meta-desc');
    expect(finding?.status).toBe('passed');
  });

  it('short meta description (< 50 chars) gets warning not passed', async () => {
    const html = `<html><head><meta name="description" content="Short"></head><body><h1>T</h1></body></html>`;
    const r = await checkLLMReadiness(html, makeResponse(), 'https://example.com/');
    const finding = r.findings.find(f => f.ruleId === 'ca-meta-desc');
    expect(finding?.status).toBe('warning');
  });

  it('session ID in URL marks cit-stable-url as failed', async () => {
    const r = await checkLLMReadiness('<html><body><h1>T</h1></body></html>', makeResponse(), 'https://example.com/?sessionid=abc123');
    const finding = r.findings.find(f => f.ruleId === 'cit-stable-url');
    expect(finding?.status).toBe('failed');
  });

  it('clean URL marks cit-stable-url as passed', async () => {
    const r = await checkLLMReadiness('<html><body><h1>T</h1></body></html>', makeResponse(), 'https://example.com/about');
    const finding = r.findings.find(f => f.ruleId === 'cit-stable-url');
    expect(finding?.status).toBe('passed');
  });

  it('Last-Modified header marks fresh-last-modified as passed', async () => {
    const r = await checkLLMReadiness(
      '<html><body><h1>T</h1></body></html>',
      makeResponse({ headers: { 'last-modified': 'Mon, 01 Jan 2024 00:00:00 GMT' } }),
      'https://example.com/',
    );
    const finding = r.findings.find(f => f.ruleId === 'fresh-last-modified');
    expect(finding?.status).toBe('passed');
  });

  it('includes scoreVersion in result', async () => {
    const r = await checkLLMReadiness('<html><body></body></html>', makeResponse(), 'https://example.com/');
    expect(r.scoreVersion).toBe('llm-readiness-v2');
  });

  it('includes measuredAt timestamp', async () => {
    const r = await checkLLMReadiness('<html><body></body></html>', makeResponse(), 'https://example.com/');
    expect(r.measuredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('coverage.limitations is a non-empty array', async () => {
    const r = await checkLLMReadiness('<html><body></body></html>', makeResponse(), 'https://example.com/');
    expect(r.coverage.limitations).toBeInstanceOf(Array);
    expect(r.coverage.limitations.length).toBeGreaterThan(0);
  });
});

// ─── checkLLMReadinessLightweight ─────────────────────────────────────────────

describe('checkLLMReadinessLightweight', () => {
  it('returns required fields', () => {
    const r = checkLLMReadinessLightweight(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(r.requestedUrl).toBe('https://example.com/');
    expect(r.httpStatus).toBe(200);
    expect(r.auditMode).toBe('fetch-only');
    expect(typeof r.score).toBe('number');
    expect(r.coverage).toBeLessThanOrEqual(100);
  });

  it('extracts title', () => {
    const r = checkLLMReadinessLightweight(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(r.title).toBe('Example Site');
  });

  it('extracts H1', () => {
    const r = checkLLMReadinessLightweight(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(r.h1).toBe('Welcome to Example');
  });

  it('extracts canonical URL', () => {
    const r = checkLLMReadinessLightweight(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(r.canonical).toBe('https://example.com/');
  });

  it('extracts schema types', () => {
    const r = checkLLMReadinessLightweight(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(r.schemaTypes).toContain('WebPage');
  });

  it('detects noindex correctly', () => {
    const html = `<html><head><meta name="robots" content="noindex"></head><body></body></html>`;
    const r = checkLLMReadinessLightweight(html, makeResponse(), 'https://example.com/');
    expect(r.isIndexable).toBe(false);
  });

  it('page without noindex is indexable', () => {
    const r = checkLLMReadinessLightweight(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(r.isIndexable).toBe(true);
  });

  it('good page scores higher than empty page', () => {
    const good  = checkLLMReadinessLightweight(FULL_HTML, makeResponse(), 'https://example.com/');
    const empty = checkLLMReadinessLightweight(EMPTY_SHELL_HTML, makeResponse(), 'https://example.com/');
    expect(good.score!).toBeGreaterThan(empty.score!);
  });

  it('provides a topIssue for pages with problems', () => {
    const r = checkLLMReadinessLightweight(EMPTY_SHELL_HTML, makeResponse(), 'https://example.com/');
    expect(r.topIssue).not.toBeNull();
  });

  it('topIssue is null for well-formed pages', () => {
    const r = checkLLMReadinessLightweight(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(r.topIssue).toBeNull();
  });

  it('is synchronous (does not return a Promise)', () => {
    const result = checkLLMReadinessLightweight(FULL_HTML, makeResponse(), 'https://example.com/');
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('page results are independent — not shared with root', () => {
    const r1 = checkLLMReadinessLightweight(FULL_HTML, makeResponse(), 'https://example.com/about');
    const r2 = checkLLMReadinessLightweight(EMPTY_SHELL_HTML, makeResponse(), 'https://example.com/contact');
    // Scores must differ — they are NOT copies of the root
    expect(r1.requestedUrl).not.toBe(r2.requestedUrl);
    expect(r1.score).not.toBe(r2.score);
  });
});
