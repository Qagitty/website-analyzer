/**
 * Shared URL validation patterns used in two places:
 *   1. src/app/api/analyze/route.ts  — pre-credit check (runs on Vercel)
 *   2. src/workers/analyzer/validate.ts — post-dispatch check (runs on Cloudflare)
 *
 * Two independent checks exist intentionally: the Vercel pre-check protects
 * credits before dispatch; the Worker re-checks because Cloudflare's network
 * has a different IP range and some sites block one but not the other.
 */

/** HTTP status codes that indicate a broken or unavailable page. */
export const HTTP_ERROR_STATUSES = new Set([404, 410, 500, 502, 503, 504]);

/**
 * Lowercase text patterns present in browser error pages, CDN error pages
 * (e.g. Cloudflare 1016), and domain parking pages.
 * Only checked against thin content (< 400 visible chars) to avoid false
 * positives on legitimate pages that mention these phrases in prose.
 */
export const PAGE_ERROR_PATTERNS: readonly string[] = [
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
  'error 1016',
  'origin dns error',
  'domain for sale',
  'buy this domain',
  'this domain is parked',
  'domain parking',
  'this domain has expired',
];
