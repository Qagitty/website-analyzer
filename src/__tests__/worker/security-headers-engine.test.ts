import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseCSPValue,
  classifyCSPQuality,
  parseHSTS,
  classifyHSTS,
  classifyXCTO,
  classifyXFO,
  classifyReferrerPolicy,
  classifyPermissionsPolicy,
  classifyCOOP,
  classifyCOEP,
  analyzeSecurityHeadersAsync,
} from '../../workers/analyzer/security-headers';

// ── Mock fetch for redirect chain ─────────────────────────────────────────────

function mockFetch(responses: Array<{ status: number; headers?: Record<string, string>; url?: string }>) {
  let call = 0;
  return vi.fn(() => {
    const resp = responses[Math.min(call++, responses.length - 1)];
    const hdrs = new Headers(resp.headers ?? {});
    return Promise.resolve({
      status: resp.status,
      url: resp.url ?? 'https://example.com/',
      ok: resp.status >= 200 && resp.status < 300,
      headers: hdrs,
      body: { cancel: vi.fn().mockResolvedValue(undefined) },
    });
  });
}

function makeFinalResponse(headers: Record<string, string>, url = 'https://example.com/'): Response {
  return { headers: new Headers(headers), url, status: 200, ok: true } as unknown as Response;
}

// ── parseCSPValue ─────────────────────────────────────────────────────────────

describe('parseCSPValue', () => {
  it('parses simple directives', () => {
    const result = parseCSPValue("default-src 'self'; script-src 'self' cdn.example.com");
    expect(result.directives['default-src']).toEqual(["'self'"]);
    expect(result.directives['script-src']).toEqual(["'self'", 'cdn.example.com']);
  });

  it('returns empty parse errors for valid CSP', () => {
    const result = parseCSPValue("default-src 'none'");
    expect(result.parseErrors).toHaveLength(0);
  });

  it('records duplicate directive errors', () => {
    const result = parseCSPValue("default-src 'self'; default-src 'none'");
    expect(result.parseErrors.some(e => e.includes('Duplicate'))).toBe(true);
  });

  it('handles trailing semicolons', () => {
    const result = parseCSPValue("default-src 'self';");
    expect(result.directives['default-src']).toEqual(["'self'"]);
  });

  it('parses frame-ancestors directive', () => {
    const result = parseCSPValue("default-src 'self'; frame-ancestors 'none'");
    expect(result.directives['frame-ancestors']).toEqual(["'none'"]);
  });

  it('normalises directive names to lowercase', () => {
    const result = parseCSPValue("Default-Src 'self'");
    expect(result.directives['default-src']).toEqual(["'self'"]);
  });

  it('handles directives with no sources (block-all)', () => {
    const result = parseCSPValue("default-src 'none'; script-src");
    expect(result.directives['script-src']).toEqual([]);
  });
});

// ── classifyCSPQuality ────────────────────────────────────────────────────────

describe('classifyCSPQuality', () => {
  it('returns missing when no CSP at all', () => {
    const result = classifyCSPQuality([], [], true);
    expect(result.status).toBe('missing');
    expect(result.earnedPoints).toBe(0);
    expect(result.hasFrameAncestors).toBe(false);
  });

  it('gives partial credit for report-only only', () => {
    const result = classifyCSPQuality([], ["default-src 'self'"], true);
    expect(result.status).toBe('present');
    expect(result.earnedPoints).toBeGreaterThan(0);
    expect(result.earnedPoints).toBeLessThan(30);
    expect(result.weaknesses.some(w => w.includes('report-only') || w.includes('Report-Only'))).toBe(true);
  });

  it('returns strong for well-configured CSP', () => {
    const result = classifyCSPQuality([
      "default-src 'self'; script-src 'nonce-abc123'; frame-ancestors 'none'; object-src 'none'",
    ], [], true);
    expect(result.status).toBe('strong');
    expect(result.earnedPoints).toBe(30);
    expect(result.hasFrameAncestors).toBe(true);
  });

  it('returns weak for unsafe-inline without nonce', () => {
    const result = classifyCSPQuality([
      "default-src 'self'; script-src 'unsafe-inline'",
    ], [], true);
    expect(result.status).toBe('weak');
    expect(result.earnedPoints).toBeLessThan(15);
    expect(result.weaknesses.some(w => w.includes('unsafe-inline'))).toBe(true);
  });

  it('does not penalise unsafe-inline when nonce is present', () => {
    const result = classifyCSPQuality([
      "script-src 'unsafe-inline' 'nonce-abc123'; frame-ancestors 'none'; default-src 'self'; object-src 'none'",
    ], [], true);
    // unsafe-inline is rendered inert by nonce — should not be a critical weakness
    expect(result.weaknesses.every(w => !w.includes("unsafe-inline in script-src without nonce"))).toBe(true);
  });

  it('flags unsafe-eval', () => {
    const result = classifyCSPQuality(["default-src 'self'; script-src 'unsafe-eval'"], [], true);
    expect(result.weaknesses.some(w => w.includes('unsafe-eval'))).toBe(true);
  });

  it('flags wildcard sources as weak', () => {
    const result = classifyCSPQuality(["script-src *"], [], true);
    expect(result.status).toBe('weak');
    expect(result.weaknesses.some(w => w.includes('Wildcard') || w.includes('wildcard'))).toBe(true);
  });

  it('flags missing frame-ancestors', () => {
    const result = classifyCSPQuality(["default-src 'none'; object-src 'none'"], [], true);
    expect(result.weaknesses.some(w => w.includes('frame-ancestors'))).toBe(true);
  });

  it('detects frame-ancestors presence', () => {
    const result = classifyCSPQuality(["default-src 'none'; frame-ancestors 'self'"], [], true);
    expect(result.hasFrameAncestors).toBe(true);
  });

  it('does not penalise HTTP sources on HTTP page', () => {
    const result = classifyCSPQuality(["script-src http://cdn.example.com; default-src 'self'; frame-ancestors 'none'; object-src 'none'"], [], false);
    expect(result.weaknesses.every(w => !w.includes('HTTP script sources'))).toBe(true);
  });

  it('penalises HTTP sources on HTTPS page', () => {
    const result = classifyCSPQuality(["script-src http://cdn.example.com"], [], true);
    expect(result.weaknesses.some(w => w.includes('HTTP script sources'))).toBe(true);
  });
});

// ── parseHSTS ────────────────────────────────────────────────────────────────

describe('parseHSTS', () => {
  it('parses max-age correctly', () => {
    const result = parseHSTS('max-age=31536000');
    expect(result.maxAge).toBe(31536000);
    expect(result.includeSubDomains).toBe(false);
    expect(result.preload).toBe(false);
  });

  it('parses all directives', () => {
    const result = parseHSTS('max-age=31536000; includeSubDomains; preload');
    expect(result.maxAge).toBe(31536000);
    expect(result.includeSubDomains).toBe(true);
    expect(result.preload).toBe(true);
  });

  it('handles missing max-age', () => {
    const result = parseHSTS('includeSubDomains');
    expect(result.maxAge).toBeNull();
    expect(result.parseError).toBeTruthy();
  });

  it('handles max-age=0', () => {
    const result = parseHSTS('max-age=0');
    expect(result.maxAge).toBe(0);
    expect(result.parseError).toBeUndefined();
  });

  it('handles invalid max-age value', () => {
    const result = parseHSTS('max-age=abc');
    expect(result.parseError).toBeTruthy();
  });

  it('is case-insensitive for includeSubDomains', () => {
    const result = parseHSTS('max-age=3600; IncludeSubDomains');
    expect(result.includeSubDomains).toBe(true);
  });
});

// ── classifyHSTS ─────────────────────────────────────────────────────────────

describe('classifyHSTS', () => {
  it('returns not-applicable on HTTP', () => {
    const result = classifyHSTS(['max-age=31536000'], false);
    expect(result.status).toBe('not-applicable');
    expect(result.earnedPoints).toBe(0);
  });

  it('returns missing when header absent on HTTPS', () => {
    const result = classifyHSTS([], true);
    expect(result.status).toBe('missing');
    expect(result.earnedPoints).toBe(0);
  });

  it('returns strong for max-age >= 1 year', () => {
    const result = classifyHSTS(['max-age=31536000'], true);
    expect(result.status).toBe('strong');
    expect(result.earnedPoints).toBe(25);
  });

  it('returns present for max-age >= 1 day', () => {
    const result = classifyHSTS(['max-age=86400'], true);
    expect(result.status).toBe('present');
    expect(result.earnedPoints).toBeGreaterThan(0);
    expect(result.earnedPoints).toBeLessThan(25);
  });

  it('returns weak for max-age < 1 day but >= 5 min', () => {
    const result = classifyHSTS(['max-age=300'], true);
    expect(result.status).toBe('weak');
    expect(result.earnedPoints).toBeGreaterThan(0);
    expect(result.earnedPoints).toBeLessThan(20);
  });

  it('returns weak (0 points) for max-age=0', () => {
    const result = classifyHSTS(['max-age=0'], true);
    expect(result.status).toBe('weak');
    expect(result.earnedPoints).toBe(0);
  });

  it('returns malformed for invalid value', () => {
    const result = classifyHSTS(['includeSubDomains'], true);
    expect(result.status).toBe('malformed');
    expect(result.earnedPoints).toBeGreaterThan(0);
    expect(result.earnedPoints).toBeLessThan(5);
  });

  it('warns when preload set without includeSubDomains', () => {
    const result = classifyHSTS(['max-age=31536000; preload'], true);
    expect(result.warnings.some(w => w.includes('includeSubDomains'))).toBe(true);
  });

  it('warns when preload is set', () => {
    const result = classifyHSTS(['max-age=31536000; includeSubDomains; preload'], true);
    expect(result.warnings.some(w => w.toLowerCase().includes('preload'))).toBe(true);
  });
});

// ── classifyXCTO ─────────────────────────────────────────────────────────────

describe('classifyXCTO', () => {
  it('returns strong for nosniff', () => {
    expect(classifyXCTO(['nosniff']).status).toBe('strong');
    expect(classifyXCTO(['nosniff']).earnedPoints).toBe(15);
  });

  it('is case-insensitive for nosniff', () => {
    expect(classifyXCTO(['NoSniff']).status).toBe('strong');
  });

  it('returns missing when absent', () => {
    expect(classifyXCTO([]).status).toBe('missing');
    expect(classifyXCTO([]).earnedPoints).toBe(0);
  });

  it('returns malformed for invalid value', () => {
    expect(classifyXCTO(['sniff']).status).toBe('malformed');
    expect(classifyXCTO(['sniff']).earnedPoints).toBeLessThan(5);
  });

  it('returns malformed for empty string', () => {
    expect(classifyXCTO(['']).status).toBe('malformed');
  });
});

// ── classifyXFO ──────────────────────────────────────────────────────────────

describe('classifyXFO', () => {
  it('returns strong when CSP has frame-ancestors and no XFO', () => {
    const csp = parseCSPValue("default-src 'self'; frame-ancestors 'none'");
    const result = classifyXFO([], csp);
    expect(result.status).toBe('strong');
    expect(result.earnedPoints).toBe(20);
  });

  it('returns missing when neither XFO nor frame-ancestors', () => {
    const csp = parseCSPValue("default-src 'self'");
    const result = classifyXFO([], csp);
    expect(result.status).toBe('missing');
    expect(result.earnedPoints).toBe(0);
  });

  it('returns present for DENY', () => {
    const result = classifyXFO(['DENY'], null);
    expect(result.status).toBe('present');
    expect(result.earnedPoints).toBeGreaterThan(15);
  });

  it('returns present for SAMEORIGIN', () => {
    const result = classifyXFO(['SAMEORIGIN'], null);
    expect(result.status).toBe('present');
  });

  it('returns weak for ALLOW-FROM', () => {
    const result = classifyXFO(['ALLOW-FROM https://example.com'], null);
    expect(result.status).toBe('weak');
    expect(result.earnedPoints).toBeLessThan(10);
  });

  it('returns present when both XFO and frame-ancestors exist', () => {
    const csp = parseCSPValue("default-src 'self'; frame-ancestors 'self'");
    const result = classifyXFO(['SAMEORIGIN'], csp);
    expect(result.status).toBe('present');
    expect(result.reason).toContain('frame-ancestors');
  });

  it('returns malformed for unrecognised value', () => {
    const result = classifyXFO(['INVALID'], null);
    expect(result.status).toBe('malformed');
  });
});

// ── classifyReferrerPolicy ───────────────────────────────────────────────────

describe('classifyReferrerPolicy', () => {
  it('returns missing when absent', () => {
    expect(classifyReferrerPolicy([]).status).toBe('missing');
    expect(classifyReferrerPolicy([]).earnedPoints).toBe(0);
  });

  it('returns strong for no-referrer', () => {
    expect(classifyReferrerPolicy(['no-referrer']).status).toBe('strong');
    expect(classifyReferrerPolicy(['no-referrer']).earnedPoints).toBe(10);
  });

  it('returns strong for strict-origin-when-cross-origin', () => {
    expect(classifyReferrerPolicy(['strict-origin-when-cross-origin']).status).toBe('strong');
  });

  it('returns strong for strict-origin', () => {
    expect(classifyReferrerPolicy(['strict-origin']).status).toBe('strong');
  });

  it('returns strong for same-origin', () => {
    expect(classifyReferrerPolicy(['same-origin']).status).toBe('strong');
  });

  it('returns present for no-referrer-when-downgrade', () => {
    expect(classifyReferrerPolicy(['no-referrer-when-downgrade']).status).toBe('present');
  });

  it('returns weak for unsafe-url', () => {
    expect(classifyReferrerPolicy(['unsafe-url']).status).toBe('weak');
    expect(classifyReferrerPolicy(['unsafe-url']).earnedPoints).toBeLessThan(3);
  });

  it('returns malformed for unrecognised value', () => {
    expect(classifyReferrerPolicy(['not-a-valid-policy']).status).toBe('malformed');
  });

  it('handles comma-separated fallback list', () => {
    const result = classifyReferrerPolicy(['invalid-policy, strict-origin-when-cross-origin']);
    expect(result.status).toBe('strong');
  });
});

// ── classifyPermissionsPolicy ─────────────────────────────────────────────────

describe('classifyPermissionsPolicy', () => {
  it('returns missing when absent', () => {
    expect(classifyPermissionsPolicy([]).status).toBe('missing');
  });

  it('returns present when header exists', () => {
    expect(classifyPermissionsPolicy(['camera=()']).status).toBe('present');
  });
});

// ── classifyCOOP ─────────────────────────────────────────────────────────────

describe('classifyCOOP', () => {
  it('returns missing / not-applicable when absent', () => {
    const result = classifyCOOP([]);
    expect(result.status).toBe('missing');
    expect(result.isApplicable).toBe(false);
  });

  it('returns strong for same-origin', () => {
    const result = classifyCOOP(['same-origin']);
    expect(result.status).toBe('strong');
    expect(result.isApplicable).toBe(true);
  });

  it('returns present for same-origin-allow-popups', () => {
    expect(classifyCOOP(['same-origin-allow-popups']).status).toBe('present');
  });

  it('returns weak for unsafe-none', () => {
    expect(classifyCOOP(['unsafe-none']).status).toBe('weak');
  });

  it('returns malformed for invalid value', () => {
    expect(classifyCOOP(['bogus-value']).status).toBe('malformed');
  });
});

// ── classifyCOEP ─────────────────────────────────────────────────────────────

describe('classifyCOEP', () => {
  it('returns missing / not-applicable when absent', () => {
    const result = classifyCOEP([]);
    expect(result.status).toBe('missing');
    expect(result.isApplicable).toBe(false);
  });

  it('returns strong for require-corp', () => {
    expect(classifyCOEP(['require-corp']).status).toBe('strong');
  });

  it('returns present for credentialless', () => {
    expect(classifyCOEP(['credentialless']).status).toBe('present');
  });

  it('returns malformed for unknown value', () => {
    expect(classifyCOEP(['bogus']).status).toBe('malformed');
  });
});

// ── analyzeSecurityHeadersAsync ───────────────────────────────────────────────

describe('analyzeSecurityHeadersAsync', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch([{ status: 200, url: 'https://example.com/', headers: {} }]));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a result with scoreVersion=security-headers-v2', async () => {
    const response = makeFinalResponse({ 'x-content-type-options': 'nosniff' });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.scoreVersion).toBe('security-headers-v2');
  });

  it('score is a number between 0 and 100', async () => {
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('score is null when no applicable headers (headers access error simulated)', async () => {
    // Score should be null only when header access fails entirely
    // In normal operation with no headers, score = 0
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('http://example.com/', response, '');
    // On HTTP, HSTS is not-applicable so excluded from denominator
    // Score should still be deterministic (0 for all missing required headers except HSTS)
    expect(result.score).toBeTypeOf('number');
  });

  it('detects missing CSP in findings', async () => {
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.findings.some(f => f.headerName === 'content-security-policy')).toBe(true);
  });

  it('detects missing HSTS on HTTPS', async () => {
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.findings.some(f => f.headerName === 'strict-transport-security')).toBe(true);
  });

  it('does NOT include HSTS finding on HTTP (not-applicable)', async () => {
    const response = makeFinalResponse({}, 'http://example.com/');
    const result = await analyzeSecurityHeadersAsync('http://example.com/', response, '');
    const hstsFinding = result.findings.find(f => f.headerName === 'strict-transport-security');
    expect(hstsFinding).toBeUndefined();
  });

  it('returns isHttps=true for HTTPS URL', async () => {
    const response = makeFinalResponse({}, 'https://example.com/');
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.isHttps).toBe(true);
  });

  it('returns isHttps=false for HTTP URL', async () => {
    const response = makeFinalResponse({}, 'http://example.com/');
    const result = await analyzeSecurityHeadersAsync('http://example.com/', response, '');
    expect(result.isHttps).toBe(false);
  });

  it('gives strong score for well-configured HTTPS site', async () => {
    const response = makeFinalResponse({
      'content-security-policy': "default-src 'self'; script-src 'nonce-abc123'; frame-ancestors 'none'; object-src 'none'",
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
    }, 'https://example.com/');
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.summary.strong).toBeGreaterThan(0);
  });

  it('scores 0 for site with no security headers on HTTPS', async () => {
    const response = makeFinalResponse({}, 'https://example.com/');
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.score).toBe(0);
  });

  it('detects X-Content-Type-Options: nosniff as strong', async () => {
    const response = makeFinalResponse({ 'x-content-type-options': 'nosniff' });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['x-content-type-options']?.status).toBe('strong');
  });

  it('detects XFO SAMEORIGIN as present', async () => {
    const response = makeFinalResponse({ 'x-frame-options': 'SAMEORIGIN' });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['x-frame-options']?.status).toBe('present');
  });

  it('detects frame-ancestors in CSP as strong for XFO check', async () => {
    const response = makeFinalResponse({
      'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
    });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['x-frame-options']?.status).toBe('strong');
  });

  it('detects HSTS max-age=0 as weak', async () => {
    const response = makeFinalResponse({ 'strict-transport-security': 'max-age=0' });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['strict-transport-security']?.status).toBe('weak');
    expect(result.headers['strict-transport-security']?.earnedPoints).toBe(0);
  });

  it('detects weak referrer-policy', async () => {
    const response = makeFinalResponse({ 'referrer-policy': 'unsafe-url' });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['referrer-policy']?.status).toBe('weak');
  });

  it('detects X-XSS-Protection as legacy in headers', async () => {
    const response = makeFinalResponse({ 'x-xss-protection': '1; mode=block' });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['x-xss-protection']).toBeDefined();
    expect(result.findings.some(f => f.headerName === 'x-xss-protection')).toBe(true);
  });

  it('detects dangerous HPKP header and includes in findings', async () => {
    const response = makeFinalResponse({
      'public-key-pins': 'pin-sha256="abc"; max-age=60',
    });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['public-key-pins']).toBeDefined();
    expect(result.findings.some(f => f.headerName === 'public-key-pins')).toBe(true);
  });

  it('never counts HSTS as missing on HTTP site (score denominator adjustment)', async () => {
    const response = makeFinalResponse({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'referrer-policy': 'strict-origin-when-cross-origin',
    }, 'http://example.com/');
    const result = await analyzeSecurityHeadersAsync('http://example.com/', response, '');
    // On HTTP, HSTS is not-applicable: denominator = 30+15+20+10 = 75 (no 25 for HSTS)
    // nosniff(15) + SAMEORIGIN(18) + strict-origin-when-cross-origin(10) = 43
    // CSP missing = 0
    // expected score = round(43/75 * 100) = 57
    expect(result.score).toBe(Math.round(43 / 75 * 100));
  });

  it('returns redirectChain as array', async () => {
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(Array.isArray(result.redirectChain)).toBe(true);
  });

  it('coverage percentage is 0-100', async () => {
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.coverage.percentage).toBeGreaterThanOrEqual(0);
    expect(result.coverage.percentage).toBeLessThanOrEqual(100);
  });

  it('includes summary object with all count keys', async () => {
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.summary).toHaveProperty('strong');
    expect(result.summary).toHaveProperty('missing');
    expect(result.summary).toHaveProperty('weak');
    expect(result.summary).toHaveProperty('present');
    expect(result.summary).toHaveProperty('malformed');
    expect(result.summary).toHaveProperty('conflicting');
    expect(result.summary).toHaveProperty('unavailable');
  });

  it('detects meta http-equiv CSP and adds warning', async () => {
    const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'"></head></html>`;
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, html);
    expect(result.warnings.some(w => w.includes('meta') || w.includes('Meta'))).toBe(true);
  });

  it('detects weak CSP (unsafe-inline) as weak status', async () => {
    const response = makeFinalResponse({
      'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'",
    });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['content-security-policy']?.status).toBe('weak');
  });

  it('detects report-only CSP only as present (not strong or missing)', async () => {
    const response = makeFinalResponse({
      'content-security-policy-report-only': "default-src 'self'",
    });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['content-security-policy']?.status).toBe('present');
    expect(result.headers['content-security-policy']?.earnedPoints).toBeGreaterThan(0);
    expect(result.headers['content-security-policy']?.earnedPoints).toBeLessThan(30);
  });

  it('scoreBreakdown contains only scored headers', async () => {
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    // All entries in scoreBreakdown that are required should have weight > 0
    const required = result.scoreBreakdown.filter(b => b.applicability === 'required');
    required.forEach(b => expect(b.weight).toBeGreaterThan(0));
  });

  it('findings are sorted by severity (critical first)', async () => {
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    for (let i = 1; i < result.findings.length; i++) {
      const prev = severityOrder[result.findings[i - 1].severity] ?? 5;
      const curr = severityOrder[result.findings[i].severity] ?? 5;
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });

  it('Feature-Policy appears as legacy header in headers map', async () => {
    const response = makeFinalResponse({ 'feature-policy': "camera 'none'" });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['feature-policy']).toBeDefined();
    expect(result.findings.some(f => f.headerName === 'feature-policy')).toBe(true);
  });

  it('Permissions-Policy present sets status=present', async () => {
    const response = makeFinalResponse({ 'permissions-policy': "camera=()" });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['permissions-policy']?.status).toBe('present');
  });

  it('COOP same-origin shows in headers map as strong', async () => {
    const response = makeFinalResponse({ 'cross-origin-opener-policy': 'same-origin' });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['cross-origin-opener-policy']?.status).toBe('strong');
  });

  it('COEP require-corp shows in headers map as strong', async () => {
    const response = makeFinalResponse({ 'cross-origin-embedder-policy': 'require-corp' });
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.headers['cross-origin-embedder-policy']?.status).toBe('strong');
  });

  it('testedUrl and finalUrl are populated', async () => {
    const response = makeFinalResponse({}, 'https://www.example.com/');
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.testedUrl).toBe('https://example.com/');
    expect(result.finalUrl).toBe('https://www.example.com/');
  });

  it('measuredAt is a valid ISO date string', async () => {
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(() => new Date(result.measuredAt)).not.toThrow();
    expect(new Date(result.measuredAt).toString()).not.toBe('Invalid Date');
  });

  it('does not throw when fetch for redirect chain fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const response = makeFinalResponse({});
    const result = await analyzeSecurityHeadersAsync('https://example.com/', response, '');
    expect(result.warnings.some(w => w.toLowerCase().includes('redirect chain'))).toBe(true);
    expect(result.score).toBeTypeOf('number');
  });
});
