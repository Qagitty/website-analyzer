import { describe, it, expect } from 'vitest';
import { checkBestPractices, checkBestPracticesLightweight } from '../../workers/analyzer/best-practices';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResponse(
  url: string,
  headers: Record<string, string> = {},
  status = 200,
  redirected = false,
): Response {
  return new Response('<html><head><title>Test</title></head><body>Hello</body></html>', {
    status,
    headers: { 'content-type': 'text/html', ...headers },
    // @ts-expect-error — JSDOM Response doesn't support url override in constructor
    url,
  });
}

function patchUrl(res: Response, url: string, redirected = false): Response {
  Object.defineProperty(res, 'url', { configurable: true, get: () => url });
  Object.defineProperty(res, 'redirected', { configurable: true, get: () => redirected });
  return res;
}

function httpResponse(
  url: string,
  headers: Record<string, string> = {},
  status = 200,
): Response {
  const res = new Response('', { status, headers: { 'content-type': 'text/html', ...headers } });
  patchUrl(res, url);
  return res;
}

function httpsResponse(
  headers: Record<string, string> = {},
  url = 'https://example.com',
  status = 200,
): Response {
  const res = new Response('', { status, headers: { 'content-type': 'text/html', ...headers } });
  patchUrl(res, url);
  return res;
}

const EMPTY_HTML = '<html><head><title>Test</title></head><body>Hello world</body></html>';

// ── checkBestPractices — structural ──────────────────────────────────────────

describe('checkBestPractices — structure', () => {
  it('returns version bp-v1', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    expect(result.version).toBe('bp-v1');
  });

  it('returns auditMode static', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    expect(result.auditMode).toBe('static');
  });

  it('returns a score between 0 and 100', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('populates testedUrl and finalUrl', () => {
    const res = httpsResponse({}, 'https://example.com/page');
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com/page');
    expect(result.testedUrl).toBe('https://example.com/page');
    expect(result.finalUrl).toBe('https://example.com/page');
  });

  it('populates measuredAt as ISO string', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    expect(() => new Date(result.measuredAt)).not.toThrow();
    expect(new Date(result.measuredAt).getFullYear()).toBeGreaterThanOrEqual(2024);
  });

  it('populates securityHeaders array with known headers', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    expect(result.securityHeaders.length).toBeGreaterThanOrEqual(5);
    const names = result.securityHeaders.map(h => h.header.toLowerCase());
    expect(names).toContain('content-security-policy');
    expect(names).toContain('strict-transport-security');
    expect(names).toContain('x-content-type-options');
  });

  it('populates categoryScores for each weighted category', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const cats = result.categoryScores.map(c => c.category);
    expect(cats).toContain('security-headers');
    expect(cats).toContain('https');
    expect(cats).toContain('mixed-content');
  });

  it('coverage percentage is 0–100', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    expect(result.coverage.percentage).toBeGreaterThanOrEqual(0);
    expect(result.coverage.percentage).toBeLessThanOrEqual(100);
  });

  it('coverage limitations are non-empty', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    expect(result.coverage.limitations.length).toBeGreaterThan(0);
  });

  it('runtime console finding is marked unavailable', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const runtimeFinding = result.findings.find(f => f.ruleId === 'runtime-console-unavailable');
    expect(runtimeFinding).toBeDefined();
    expect(runtimeFinding!.status).toBe('unavailable');
  });

  it('unavailable findings do NOT reduce the score', () => {
    const res = httpsResponse({
      'content-security-policy': "default-src 'self'",
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'SAMEORIGIN',
      'permissions-policy': "camera=()",
      'cross-origin-opener-policy': 'same-origin',
    });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    // Should score well even though browser-console check is unavailable
    expect(result.score).toBeGreaterThanOrEqual(80);
  });
});

// ── HTTPS checks ──────────────────────────────────────────────────────────────

describe('checkBestPractices — HTTPS', () => {
  it('detects HTTPS page as passed', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    expect(result.isHttps).toBe(true);
    const f = result.findings.find(f => f.ruleId === 'https-ok');
    expect(f?.status).toBe('passed');
  });

  it('detects HTTP page as failed with critical severity', () => {
    const res = httpResponse('http://example.com');
    const result = checkBestPractices(EMPTY_HTML, res, 'http://example.com');
    expect(result.isHttps).toBe(false);
    const f = result.findings.find(f => f.ruleId === 'https-not-used');
    expect(f?.status).toBe('failed');
    expect(f?.severity).toBe('critical');
  });

  it('detects HTTP canonical URL as failed', () => {
    const html = '<html><head><link rel="canonical" href="http://example.com/page"></head><body></body></html>';
    const res = httpsResponse({}, 'https://example.com/page');
    const result = checkBestPractices(html, res, 'https://example.com/page');
    const f = result.findings.find(f => f.ruleId === 'https-canonical-http');
    expect(f?.status).toBe('failed');
    expect(f?.severity).toBe('medium');
  });

  it('detects insecure form action', () => {
    const html = '<html><body><form action="http://example.com/submit"><button>Go</button></form></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'https-form-http');
    expect(f?.status).toBe('failed');
    expect(f?.severity).toBe('high');
  });

  it('detects HTTP→HTTPS redirect as passed', () => {
    // Create a fresh response whose url is HTTPS but requestedUrl is HTTP
    const res = new Response('', { status: 200, headers: { 'content-type': 'text/html' } });
    Object.defineProperty(res, 'url', { configurable: true, get: () => 'https://example.com' });
    Object.defineProperty(res, 'redirected', { configurable: true, get: () => true });
    const result = checkBestPractices(EMPTY_HTML, res, 'http://example.com');
    const f = result.findings.find(f => f.ruleId === 'https-redirect-ok');
    expect(f?.status).toBe('passed');
  });
});

// ── Security headers ──────────────────────────────────────────────────────────

describe('checkBestPractices — CSP', () => {
  it('flags missing CSP as failed', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-csp-missing');
    expect(f?.status).toBe('failed');
    expect(f?.severity).toBe('high');
  });

  it('CSP missing — safeToApplyDirectly is false', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-csp-missing');
    expect(f?.safeToApplyDirectly).toBe(false);
  });

  it('CSP missing recommendation does NOT contain a copy-paste policy value', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-csp-missing');
    // Must not recommend a ready-to-enforce CSP value
    expect(f?.recommendation).not.toMatch(/default-src\s+'self'\s*;\s*script-src/);
  });

  it('CSP report-only mode returns warning not failure', () => {
    const res = httpsResponse({ 'content-security-policy-report-only': "default-src 'self'" });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-csp-report-only');
    expect(f?.status).toBe('warning');
  });

  it('CSP with unsafe-inline AND unsafe-eval returns warning', () => {
    const res = httpsResponse({ 'content-security-policy': "default-src 'self'; script-src 'unsafe-inline' 'unsafe-eval'" });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-csp-weak');
    expect(f?.status).toBe('warning');
  });

  it('strong CSP passes', () => {
    const res = httpsResponse({ 'content-security-policy': "default-src 'self'; script-src 'self'" });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-csp-present');
    expect(f?.status).toBe('passed');
  });
});

describe('checkBestPractices — HSTS', () => {
  it('flags missing HSTS as failed on HTTPS page', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-hsts-missing');
    expect(f?.status).toBe('failed');
    expect(f?.severity).toBe('high');
  });

  it('HSTS recommendation does NOT blindly include includeSubDomains; preload', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-hsts-missing');
    // Recommendation must not include copy-paste value with includeSubDomains
    expect(f?.recommendation).not.toMatch(/max-age=31536000;\s*includeSubDomains/);
  });

  it('HSTS is not-applicable on HTTP page', () => {
    const res = httpResponse('http://example.com');
    const result = checkBestPractices(EMPTY_HTML, res, 'http://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-hsts-not-https');
    expect(f?.status).toBe('not-applicable');
  });

  it('short max-age HSTS returns warning', () => {
    const res = httpsResponse({ 'strict-transport-security': 'max-age=60' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-hsts-weak');
    expect(f?.status).toBe('warning');
  });

  it('good HSTS passes', () => {
    const res = httpsResponse({ 'strict-transport-security': 'max-age=31536000' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-hsts-present');
    expect(f?.status).toBe('passed');
  });
});

describe('checkBestPractices — X-Content-Type-Options', () => {
  it('flags missing X-Content-Type-Options', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-xcto-missing');
    expect(f?.status).toBe('failed');
    expect(f?.safeToApplyDirectly).toBe(true);
  });

  it('nosniff passes', () => {
    const res = httpsResponse({ 'x-content-type-options': 'nosniff' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-xcto-present');
    expect(f?.status).toBe('passed');
  });

  it('wrong value returns warning', () => {
    const res = httpsResponse({ 'x-content-type-options': 'nosniffs' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-xcto-wrong');
    expect(f?.status).toBe('warning');
  });
});

describe('checkBestPractices — X-Frame-Options / frame-ancestors', () => {
  it('flags missing framing protection', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-xfo-missing');
    expect(f?.status).toBe('failed');
  });

  it('X-Frame-Options SAMEORIGIN passes', () => {
    const res = httpsResponse({ 'x-frame-options': 'SAMEORIGIN' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-xfo-present');
    expect(f?.status).toBe('passed');
  });

  it('CSP frame-ancestors satisfies framing check even without X-Frame-Options', () => {
    const res = httpsResponse({ 'content-security-policy': "default-src 'self'; frame-ancestors 'none'" });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    // Should NOT have hdr-xfo-missing
    const missing = result.findings.find(f => f.ruleId === 'hdr-xfo-missing');
    expect(missing).toBeUndefined();
  });
});

describe('checkBestPractices — Permissions-Policy', () => {
  it('missing Permissions-Policy returns manual-review not failed', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-pp-missing');
    expect(f?.status).toBe('manual-review');
  });

  it('Permissions-Policy recommendation is NOT copy-paste-safe', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-pp-missing');
    // Must not suggest a ready-made enforcement value
    expect(f?.recommendation).not.toMatch(/camera=\(\)\s*,\s*microphone=\(\)\s*,\s*geolocation=\(\)/);
    expect(f?.safeToApplyDirectly).toBe(false);
  });

  it('Permissions-Policy present passes', () => {
    const res = httpsResponse({ 'permissions-policy': 'camera=(), microphone=()' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'hdr-pp-present');
    expect(f?.status).toBe('passed');
  });
});

// ── Mixed content ─────────────────────────────────────────────────────────────

describe('checkBestPractices — Mixed content', () => {
  it('detects active mixed content (HTTP script on HTTPS page)', () => {
    const html = '<html><head><script src="http://cdn.evil.com/script.js"></script></head><body></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'mixed-content-active');
    expect(f?.status).toBe('failed');
    expect(f?.severity).toBe('critical');
  });

  it('detects passive mixed content (HTTP image on HTTPS page)', () => {
    const html = '<html><body><img src="http://cdn.example.com/photo.jpg"></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'mixed-content-passive');
    expect(f?.status).toBe('warning');
  });

  it('no mixed content passes on HTTPS page', () => {
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'mixed-content-active-none');
    expect(f?.status).toBe('passed');
  });

  it('HTTP page skips mixed content check', () => {
    const res = httpResponse('http://example.com');
    const result = checkBestPractices(EMPTY_HTML, res, 'http://example.com');
    const mixedFindings = result.findings.filter(f => f.category === 'mixed-content');
    expect(mixedFindings.length).toBe(0);
  });
});

// ── External links ────────────────────────────────────────────────────────────

describe('checkBestPractices — External links', () => {
  it('detects external blank-target link without noopener', () => {
    const html = '<html><body><a href="https://other.com" target="_blank">Link</a></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'ext-link-opener');
    expect(f?.status).toBe('warning');
  });

  it('noopener present passes', () => {
    const html = '<html><body><a href="https://other.com" target="_blank" rel="noopener noreferrer">Link</a></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'ext-link-opener-ok');
    expect(f?.status).toBe('passed');
  });

  it('detects javascript: protocol href', () => {
    const html = '<html><body><a href="javascript:void(0)">Click</a></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'ext-link-js-protocol');
    expect(f?.status).toBe('warning');
  });
});

// ── Deprecated APIs ───────────────────────────────────────────────────────────

describe('checkBestPractices — Deprecated APIs', () => {
  it('detects inline onclick handler', () => {
    const html = '<html><body><button onclick="doSomething()">Click</button></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'dep-inline-handlers');
    expect(f?.status).toBe('warning');
    expect(f?.safeToApplyDirectly).toBe(false);
  });

  it('detects document.write', () => {
    const html = '<html><body><script>document.write("<p>Hello</p>")</script></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'dep-document-write');
    expect(f?.status).toBe('warning');
  });

  it('clean page passes inline handlers check', () => {
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'dep-inline-handlers-none');
    expect(f?.status).toBe('passed');
  });
});

// ── Third party ───────────────────────────────────────────────────────────────

describe('checkBestPractices — Third-party scripts', () => {
  it('no external scripts passes', () => {
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'tp-no-scripts');
    expect(f?.status).toBe('passed');
  });

  it('detects third-party scripts with manual-review', () => {
    const html = '<html><head><script src="https://cdn.google.com/analytics.js"></script></head><body></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'tp-scripts-detected');
    expect(f).toBeDefined();
    expect(['manual-review', 'warning']).toContain(f!.status);
  });

  it('same-origin scripts are not flagged as third-party', () => {
    const html = '<html><head><script src="https://example.com/js/app.js"></script></head><body></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'tp-scripts-detected');
    expect(f).toBeUndefined();
  });
});

// ── SRI ───────────────────────────────────────────────────────────────────────

describe('checkBestPractices — Subresource Integrity', () => {
  it('external script without integrity needs review', () => {
    const html = '<html><head><script src="https://cdn.example.net/lib.js"></script></head><body></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'sri-missing');
    expect(f?.status).toBe('manual-review');
  });

  it('external script with integrity attribute passes', () => {
    const html = '<html><head><script src="https://cdn.example.net/lib.js" integrity="sha384-abc123" crossorigin="anonymous"></script></head><body></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'sri-ok');
    expect(f?.status).toBe('passed');
  });

  it('same-origin scripts do not require SRI', () => {
    const html = '<html><head><script src="https://example.com/app.js"></script></head><body></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'sri-ok');
    expect(f?.status).toBe('passed');
  });
});

// ── Cookies ───────────────────────────────────────────────────────────────────

describe('checkBestPractices — Cookies', () => {
  it('no cookies → not-applicable', () => {
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'cookie-none');
    expect(f?.status).toBe('not-applicable');
  });

  it('detects cookie without Secure flag on HTTPS page', () => {
    const res = httpsResponse({ 'set-cookie': 'session=abc; HttpOnly; SameSite=Strict' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'cookie-no-secure');
    expect(f?.status).toBe('failed');
    expect(f?.severity).toBe('high');
  });

  it('detects cookie without SameSite attribute', () => {
    const res = httpsResponse({ 'set-cookie': 'prefs=dark; Secure; HttpOnly' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'cookie-no-samesite');
    expect(f?.status).toBe('warning');
  });

  it('session-named cookie without HttpOnly triggers warning', () => {
    const res = httpsResponse({ 'set-cookie': 'session=xyz; Secure; SameSite=Strict' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'cookie-no-httponly');
    expect(f?.status).toBe('warning');
  });

  it('well-formed session cookie passes', () => {
    const res = httpsResponse({ 'set-cookie': 'session=abc; Secure; HttpOnly; SameSite=Strict' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'cookie-ok');
    expect(f?.status).toBe('passed');
  });
});

// ── iframes ───────────────────────────────────────────────────────────────────

describe('checkBestPractices — iframes', () => {
  it('no iframes → not-applicable', () => {
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'iframe-none');
    expect(f?.status).toBe('not-applicable');
  });

  it('detects iframe without title', () => {
    const html = '<html><body><iframe src="https://example.com/embed"></iframe></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'iframe-no-title');
    expect(f?.status).toBe('failed');
  });

  it('iframe with title is OK', () => {
    const html = '<html><body><iframe title="Video embed" src="https://example.com/embed"></iframe></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const missing = result.findings.find(f => f.ruleId === 'iframe-no-title');
    expect(missing).toBeUndefined();
  });

  it('cross-origin iframe without sandbox triggers manual-review', () => {
    const html = '<html><body><iframe title="Ad" src="https://adprovider.com/ad"></iframe></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPractices(html, res, 'https://example.com');
    const f = result.findings.find(f => f.ruleId === 'iframe-cross-origin-no-sandbox');
    expect(f?.status).toBe('manual-review');
  });
});

// ── Security header details ───────────────────────────────────────────────────

describe('checkBestPractices — SecurityHeaderDetail values', () => {
  it('absent CSP header has strength=absent', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const csp = result.securityHeaders.find(h => h.header.toLowerCase().includes('content-security'));
    expect(csp?.strength).toBe('absent');
    expect(csp?.rolloutRisk).toBe('high');
    expect(csp?.safeToApplyDirectly).toBe(false);
  });

  it('nosniff X-Content-Type-Options has strength=strong', () => {
    const res = httpsResponse({ 'x-content-type-options': 'nosniff' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const xcto = result.securityHeaders.find(h => h.header.toLowerCase().includes('x-content-type'));
    expect(xcto?.strength).toBe('strong');
    expect(xcto?.safeToApplyDirectly).toBe(true);
  });

  it('unsafe-url Referrer-Policy has present-weak status', () => {
    const res = httpsResponse({ 'referrer-policy': 'unsafe-url' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const rp = result.securityHeaders.find(h => h.header.toLowerCase() === 'referrer-policy');
    expect(rp?.status).toBe('present-weak');
  });

  it('HSTS with max-age=0 is weak', () => {
    const res = httpsResponse({ 'strict-transport-security': 'max-age=0' });
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const hsts = result.securityHeaders.find(h => h.header.toLowerCase().includes('strict-transport'));
    expect(hsts?.strength).toBe('weak');
  });
});

// ── Score mechanics ───────────────────────────────────────────────────────────

describe('checkBestPractices — score mechanics', () => {
  it('well-secured HTTPS site scores higher than unsecured HTTP site', () => {
    const securedHtml = EMPTY_HTML;
    const securedRes = httpsResponse({
      'content-security-policy': "default-src 'self'",
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'SAMEORIGIN',
    });
    const securedResult = checkBestPractices(securedHtml, securedRes, 'https://example.com');

    const unsecuredRes = httpResponse('http://insecure.example.com');
    const unsecuredResult = checkBestPractices(EMPTY_HTML, unsecuredRes, 'http://insecure.example.com');

    expect(securedResult.score!).toBeGreaterThan(unsecuredResult.score!);
  });

  it('score is null when no weighted category has applicable checks — not tested', () => {
    // Hard to trigger in practice; at minimum https and security-headers always run
    // Just verify score is always a number for normal pages
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    expect(typeof result.score).toBe('number');
  });

  it('categoryScores weights sum to approximately 1.0 for all scored categories', () => {
    const res = httpsResponse();
    const result = checkBestPractices(EMPTY_HTML, res, 'https://example.com');
    const total = result.categoryScores.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBeCloseTo(1.0, 1);
  });
});

// ── Summary counters ──────────────────────────────────────────────────────────

describe('checkBestPractices — summary counts', () => {
  it('HTTP page has at least one critical finding', () => {
    const res = httpResponse('http://example.com');
    const result = checkBestPractices(EMPTY_HTML, res, 'http://example.com');
    expect(result.summary.critical).toBeGreaterThanOrEqual(1);
  });

  it('passed count increases when all headers are set', () => {
    const noHeaders = httpsResponse();
    const withHeaders = httpsResponse({
      'content-security-policy': "default-src 'self'",
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'SAMEORIGIN',
    });
    const r1 = checkBestPractices(EMPTY_HTML, noHeaders, 'https://example.com');
    const r2 = checkBestPractices(EMPTY_HTML, withHeaders, 'https://example.com');
    expect(r2.summary.passed).toBeGreaterThan(r1.summary.passed);
  });
});

// ── checkBestPracticesLightweight ────────────────────────────────────────────

describe('checkBestPracticesLightweight', () => {
  it('returns auditLabel Lightweight BP scan', () => {
    const res = httpsResponse();
    const result = checkBestPracticesLightweight(EMPTY_HTML, res, 'https://example.com');
    expect(result.auditLabel).toBe('Lightweight BP scan');
  });

  it('score is between 0 and 100', () => {
    const res = httpsResponse();
    const result = checkBestPracticesLightweight(EMPTY_HTML, res, 'https://example.com');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('correctly reports isHttps', () => {
    const httpsRes = httpsResponse();
    const httpRes = httpResponse('http://example.com');
    const r1 = checkBestPracticesLightweight(EMPTY_HTML, httpsRes, 'https://example.com');
    const r2 = checkBestPracticesLightweight(EMPTY_HTML, httpRes, 'http://example.com');
    expect(r1.isHttps).toBe(true);
    expect(r2.isHttps).toBe(false);
  });

  it('scores higher when security headers are present', () => {
    const resGood = httpsResponse({
      'content-security-policy': "default-src 'self'",
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
    const resBad = httpsResponse();
    const good = checkBestPracticesLightweight(EMPTY_HTML, resGood, 'https://example.com');
    const bad = checkBestPracticesLightweight(EMPTY_HTML, resBad, 'https://example.com');
    expect(good.score!).toBeGreaterThan(bad.score!);
  });

  it('HTTP page with active mixed content has criticalFindings >= 1', () => {
    const html = '<html><head><script src="http://cdn.evil.com/x.js"></script></head><body></body></html>';
    const res = httpsResponse({}, 'https://example.com');
    const result = checkBestPracticesLightweight(html, res, 'https://example.com');
    expect(result.criticalFindings).toBeGreaterThanOrEqual(1);
  });

  it('returns correct httpStatus', () => {
    const res = httpsResponse({}, 'https://example.com', 200);
    const result = checkBestPracticesLightweight(EMPTY_HTML, res, 'https://example.com');
    expect(result.httpStatus).toBe(200);
  });

  it('securityHeadersTotal equals number of header specs', () => {
    const res = httpsResponse();
    const result = checkBestPracticesLightweight(EMPTY_HTML, res, 'https://example.com');
    expect(result.securityHeadersTotal).toBeGreaterThanOrEqual(5);
  });

  it('securityHeadersPresent increases when headers are added', () => {
    const resBare = httpsResponse();
    const resWithHeaders = httpsResponse({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'SAMEORIGIN',
    });
    const bare = checkBestPracticesLightweight(EMPTY_HTML, resBare, 'https://example.com');
    const withHeaders = checkBestPracticesLightweight(EMPTY_HTML, resWithHeaders, 'https://example.com');
    expect(withHeaders.securityHeadersPresent).toBeGreaterThan(bare.securityHeadersPresent);
  });
});
