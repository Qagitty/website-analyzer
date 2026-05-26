/**
 * Tests for validateWebsiteUrl() — the URL pre-validation step that runs
 * inside the Cloudflare Worker before any analysis work begins.
 *
 * The function is inlined here (matching the pattern used by other worker
 * tests) so that tests stay fully isolated from the Cloudflare runtime.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Inline the logic under test (from src/workers/analyzer/index.ts) ────────

type UrlValidationResult = {
  isValid: boolean;
  reason?: string;
  statusCode?: number;
  finalUrl?: string;
  errorType?:
    | 'http_error'
    | 'navigation_error'
    | 'empty_page'
    | 'browser_error_page'
    | 'unknown';
};

const HTTP_ERROR_STATUSES = new Set([404, 410, 500, 502, 503, 504]);

const BROWSER_ERROR_PATTERNS: readonly string[] = [
  '404 not found',
  'page not found',
  "this site can't be reached",
  'server not found',
  'dns_probe_finished_nxdomain',
  'dns probe finished nxdomain',
  'site unavailable',
  'the requested url was not found',
  'service unavailable',
  'bad gateway',
  'gateway timeout',
  'err_name_not_resolved',
];

function httpStatusText(code: number): string {
  const map: Record<number, string> = {
    404: 'Not Found',
    410: 'Gone',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return map[code] ?? 'HTTP Error';
}

async function validateWebsiteUrl(url: string): Promise<UrlValidationResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const msg = err instanceof Error ? err.message : String(err);
    const reason = isAbort
      ? 'Connection timed out — the site may be down or very slow.'
      : `Navigation failed: ${msg}`;
    return { isValid: false, reason, errorType: 'navigation_error', finalUrl: url };
  } finally {
    clearTimeout(timer);
  }

  const finalUrl = response.url || url;
  const statusCode = response.status;

  if (HTTP_ERROR_STATUSES.has(statusCode)) {
    return {
      isValid: false,
      reason: `HTTP ${statusCode} — ${httpStatusText(statusCode)}`,
      statusCode,
      finalUrl,
      errorType: 'http_error',
    };
  }

  let html: string;
  try {
    html = await response.text();
  } catch {
    return { isValid: false, reason: 'Could not read page content', statusCode, finalUrl, errorType: 'unknown' };
  }

  const visibleText = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  // Browser error page check runs BEFORE empty-page check (same order as worker)
  const bodyLower = html.toLowerCase();
  const matchedPattern = BROWSER_ERROR_PATTERNS.find(p => bodyLower.includes(p));
  if (matchedPattern && visibleText.length < 400) {
    return {
      isValid: false,
      reason: `Detected error page (matched: "${matchedPattern}")`,
      statusCode,
      finalUrl,
      errorType: 'browser_error_page',
    };
  }

  if (html.length < 500 || visibleText.length < 50) {
    return {
      isValid: false,
      reason: `Page appears empty — ${html.length} bytes HTML, ${visibleText.length} visible chars`,
      statusCode,
      finalUrl,
      errorType: 'empty_page',
    };
  }

  return { isValid: true, statusCode, finalUrl };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a plain-object Response mock for use in fetch mocks.
 *
 * We deliberately avoid wrapping a real `Response` instance because jsdom's
 * implementation uses private class fields (`#state`) which break when
 * accessed through a Proxy with a different receiver. A plain object mock
 * sidesteps the issue entirely.
 */
function makeResponse(
  body: string,
  status = 200,
  url = 'https://example.com',
): Response {
  let consumed = false;
  return {
    url,
    status,
    ok: status >= 200 && status < 300,
    redirected: false,
    statusText: status === 200 ? 'OK' : String(status),
    type: 'basic' as ResponseType,
    headers: new Headers({ 'Content-Type': 'text/html' }),
    body: null,
    bodyUsed: false,
    async text() {
      if (consumed) throw new Error('body already consumed');
      consumed = true;
      return body;
    },
    async json() { return JSON.parse(body); },
    async blob() { return new Blob([body]); },
    async arrayBuffer() { return new TextEncoder().encode(body).buffer as ArrayBuffer; },
    async formData() { throw new Error('not implemented'); },
    clone() { return makeResponse(body, status, url); },
  } as unknown as Response;
}

/** Minimal valid HTML page with enough content to pass all checks. */
const VALID_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Page</title>
  <meta name="description" content="A real working website with content">
</head>
<body>
  <main>
    <h1>Welcome to our website</h1>
    <p>This is a legitimate page with meaningful content that a real website would have.</p>
    <p>It contains paragraphs of text, navigation, and other elements that make it a valid website.</p>
    <nav><a href="/about">About</a><a href="/contact">Contact</a></nav>
  </main>
</body>
</html>`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validateWebsiteUrl', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Working site ─────────────────────────────────────────────────────

  it('returns isValid:true for a healthy 200 page', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(VALID_HTML, 200, 'https://example.com'));

    const result = await validateWebsiteUrl('https://example.com');

    expect(result.isValid).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.errorType).toBeUndefined();
  });

  // ── 2. 404 page ─────────────────────────────────────────────────────────

  it('blocks a 404 response with errorType http_error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('<h1>Not Found</h1>', 404));

    const result = await validateWebsiteUrl('https://example.com/missing');

    expect(result.isValid).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.errorType).toBe('http_error');
    expect(result.reason).toMatch(/404/);
  });

  it('blocks a 410 (Gone) response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('', 410));
    const result = await validateWebsiteUrl('https://example.com/deleted');
    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('http_error');
    expect(result.statusCode).toBe(410);
  });

  it('blocks a 500 server error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('<h1>Internal Server Error</h1>', 500));
    const result = await validateWebsiteUrl('https://broken.com');
    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('http_error');
    expect(result.statusCode).toBe(500);
  });

  it('blocks a 502 bad gateway', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('Bad Gateway', 502));
    const result = await validateWebsiteUrl('https://broken.com');
    expect(result.isValid).toBe(false);
    expect(result.statusCode).toBe(502);
  });

  it('blocks a 503 service unavailable', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('Service Unavailable', 503));
    const result = await validateWebsiteUrl('https://down.com');
    expect(result.isValid).toBe(false);
    expect(result.statusCode).toBe(503);
  });

  it('blocks a 504 gateway timeout', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('Gateway Timeout', 504));
    const result = await validateWebsiteUrl('https://slow.com');
    expect(result.isValid).toBe(false);
    expect(result.statusCode).toBe(504);
  });

  // ── 3. Non-existent domain ──────────────────────────────────────────────

  it('blocks a non-existent domain (fetch throws TypeError)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new TypeError('Failed to fetch: net::ERR_NAME_NOT_RESOLVED')
    );

    const result = await validateWebsiteUrl('https://testtestov.md');

    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('navigation_error');
    expect(result.reason).toMatch(/navigation failed/i);
  });

  it('blocks ERR_CONNECTION_REFUSED', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new TypeError('net::ERR_CONNECTION_REFUSED')
    );

    const result = await validateWebsiteUrl('https://localhost:9999');

    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('navigation_error');
  });

  it('blocks ERR_SSL_PROTOCOL_ERROR', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new TypeError('net::ERR_SSL_PROTOCOL_ERROR')
    );
    const result = await validateWebsiteUrl('https://bad-ssl.example.com');
    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('navigation_error');
  });

  // ── 4. Timeout ──────────────────────────────────────────────────────────

  it('blocks a connection that times out (AbortError)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    );

    const result = await validateWebsiteUrl('https://very-slow-site.com');

    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('navigation_error');
    expect(result.reason).toMatch(/timed out/i);
  });

  // ── 5. Redirect → valid page ────────────────────────────────────────────

  it('passes when a redirect leads to a valid page', async () => {
    // fetch follows redirect automatically — it just returns the final response
    const finalResponse = makeResponse(VALID_HTML, 200, 'https://www.example.com/');
    vi.mocked(fetch).mockResolvedValueOnce(finalResponse);

    const result = await validateWebsiteUrl('https://example.com');

    expect(result.isValid).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('uses the final URL after a redirect', async () => {
    // makeResponse already wraps in a Proxy that overrides `url`
    vi.mocked(fetch).mockResolvedValueOnce(
      makeResponse(VALID_HTML, 200, 'https://www.example.com/redirected')
    );

    const result = await validateWebsiteUrl('https://example.com');

    expect(result.isValid).toBe(true);
    expect(result.finalUrl).toBe('https://www.example.com/redirected');
  });

  // ── 6. Browser error page ───────────────────────────────────────────────

  it('blocks a thin page containing "page not found" text', async () => {
    const errorPageHtml = `<!DOCTYPE html>
<html><head><title>404</title></head>
<body><h1>Page Not Found</h1><p>The page you requested was not found.</p></body>
</html>`;
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(errorPageHtml, 200));

    const result = await validateWebsiteUrl('https://example.com/missing');

    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('browser_error_page');
    expect(result.reason).toMatch(/page not found/i);
  });

  it('blocks a thin page with "This site can\'t be reached"', async () => {
    const body = `<html><body><h1>This site can't be reached</h1><p>Check your internet.</p></body></html>`;
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(body, 200));

    const result = await validateWebsiteUrl('https://dead.example.com');

    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('browser_error_page');
  });

  it('blocks a thin page with "server not found" text', async () => {
    const body = `<html><body><h1>Server Not Found</h1><p>DNS lookup failed.</p></body></html>`;
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(body, 200));

    const result = await validateWebsiteUrl('https://nxdomain.example.com');

    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('browser_error_page');
  });

  // ── 7. Empty HTML page ──────────────────────────────────────────────────

  it('blocks a completely empty body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('', 200));

    const result = await validateWebsiteUrl('https://empty.example.com');

    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('empty_page');
  });

  it('blocks a body that is only whitespace / tags (no visible text)', async () => {
    const skeletonHtml = `<!DOCTYPE html><html><head></head><body>   </body></html>`;
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(skeletonHtml, 200));

    const result = await validateWebsiteUrl('https://skeleton.example.com');

    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('empty_page');
  });

  it('blocks a very short HTML document (< 500 bytes)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse('<html><body><p>Hi</p></body></html>', 200));

    const result = await validateWebsiteUrl('https://tiny.example.com');

    expect(result.isValid).toBe(false);
    expect(result.errorType).toBe('empty_page');
  });

  // ── 8. Site with console errors but valid content ───────────────────────

  it('passes a page that has console.error calls but real content', async () => {
    const htmlWithErrors = `<!DOCTYPE html>
<html lang="en">
<head><title>My App</title></head>
<body>
  <h1>Welcome to My App</h1>
  <p>This page has substantial content. Lorem ipsum dolor sit amet, consectetur
  adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna
  aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
  <nav><a href="/">Home</a><a href="/about">About</a></nav>
  <script>
    // Some analytics that may emit console warnings
    console.error("Analytics failed to load");
    console.warn("CSP warning: blocked resource");
  </script>
</body>
</html>`;
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(htmlWithErrors, 200));

    const result = await validateWebsiteUrl('https://app.example.com');

    // Console errors in HTML source must NOT cause a validation failure
    expect(result.isValid).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('passes a page with "page not found" mentioned in article content', async () => {
    // A rich help article that happens to mention error pages — should NOT be blocked
    const helpArticle = `<!DOCTYPE html>
<html lang="en">
<head><title>Help Center — Troubleshooting</title></head>
<body>
  <h1>Troubleshooting Guide</h1>
  <p>If you see a "Page Not Found" error, it usually means the link is outdated.</p>
  <p>Here are the most common causes and how to fix them in your application.
  Sometimes 404 Not Found responses occur when a route is misconfigured on the server.
  Check your nginx or Apache configuration for rewrite rules that may be incorrect.</p>
  <p>Other common issues include Server Not Found errors from DNS misconfiguration.
  These typically require updating your DNS records or waiting for propagation.</p>
  <p>For more details, see our full documentation on error handling and best practices
  for production deployments. Consider using structured error pages with appropriate
  HTTP status codes for better SEO and user experience.</p>
  <footer><nav><a href="/">Home</a><a href="/docs">Docs</a></nav></footer>
</body>
</html>`;
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(helpArticle, 200));

    const result = await validateWebsiteUrl('https://help.example.com/troubleshooting');

    // Rich content page with error-page keywords should pass (visibleText > 400 chars)
    expect(result.isValid).toBe(true);
  });

  // ── Additional edge cases ────────────────────────────────────────────────

  it('passes a 403 Forbidden (not in error-status list)', async () => {
    // 403 means the site exists but requires auth — not a broken URL
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(VALID_HTML, 403));
    const result = await validateWebsiteUrl('https://private.example.com');
    expect(result.isValid).toBe(true);
    expect(result.statusCode).toBe(403);
  });

  it('passes a 429 Too Many Requests (site is up, just rate-limiting)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(VALID_HTML, 429));
    const result = await validateWebsiteUrl('https://busy.example.com');
    expect(result.isValid).toBe(true);
    expect(result.statusCode).toBe(429);
  });

  it('includes finalUrl from the response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeResponse(VALID_HTML, 200, 'https://example.com'));
    const result = await validateWebsiteUrl('https://example.com');
    expect(result.finalUrl).toBe('https://example.com');
  });
});
