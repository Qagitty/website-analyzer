import { workerLog } from './log';
import { HTTP_ERROR_STATUSES, PAGE_ERROR_PATTERNS } from '../../lib/url-validation-patterns';
import type { UrlValidationResult } from './types';

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

/**
 * Pre-validate a URL before spending analysis credits.
 *
 * Checks (in order):
 *  1. Navigation reachability — fetch must not throw (DNS, TLS, timeout)
 *  2. HTTP status          — blocks 404 / 410 / 500 / 502 / 503 / 504
 *  3. Browser error page   — known error-page text in thin content (< 400 chars)
 *  4. Empty page           — body < 500 bytes or < 50 visible chars
 */
export async function validateWebsiteUrl(url: string): Promise<UrlValidationResult> {
  workerLog('info', 'Validating URL before analysis', { url });

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
    workerLog('warn', 'URL validation failed — navigation error', { url, reason });
    return { isValid: false, reason, errorType: 'navigation_error', finalUrl: url };
  } finally {
    clearTimeout(timer);
  }

  const finalUrl = response.url || url;
  const statusCode = response.status;

  if (HTTP_ERROR_STATUSES.has(statusCode)) {
    const reason = `HTTP ${statusCode} — ${httpStatusText(statusCode)}`;
    workerLog('warn', 'URL validation failed — HTTP error', { url, finalUrl, statusCode });
    return { isValid: false, reason, statusCode, finalUrl, errorType: 'http_error' };
  }

  let html: string;
  try {
    html = await response.text();
  } catch {
    workerLog('warn', 'URL validation failed — could not read response body', { url, finalUrl, statusCode });
    return { isValid: false, reason: 'Could not read page content', statusCode, finalUrl, errorType: 'unknown' };
  }

  const visibleText = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  const bodyLower = html.toLowerCase();
  const matchedPattern = PAGE_ERROR_PATTERNS.find(p => bodyLower.includes(p));
  if (matchedPattern && visibleText.length < 400) {
    const reason = `Detected error page (matched: "${matchedPattern}")`;
    workerLog('warn', 'URL validation failed — browser error page', { url, finalUrl, statusCode, matchedPattern });
    return { isValid: false, reason, statusCode, finalUrl, errorType: 'browser_error_page' };
  }

  if (html.length < 500 || visibleText.length < 50) {
    const reason = `Page appears empty — ${html.length} bytes HTML, ${visibleText.length} visible chars`;
    workerLog('warn', 'URL validation failed — empty page', { url, finalUrl, statusCode, htmlBytes: html.length, visibleChars: visibleText.length });
    return { isValid: false, reason, statusCode, finalUrl, errorType: 'empty_page' };
  }

  workerLog('info', 'URL validation passed', { url, finalUrl, statusCode });
  return { isValid: true, statusCode, finalUrl };
}
