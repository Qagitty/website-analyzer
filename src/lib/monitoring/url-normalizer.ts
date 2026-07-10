/**
 * URL normalization for monitor pages.
 *
 * All monitored URLs must pass through this pipeline before storage.
 * Rules:
 *  - lowercase hostname
 *  - remove default ports (80 for http, 443 for https)
 *  - remove fragments (#...)
 *  - remove known tracking parameters
 *  - normalize trailing slash: root path keeps slash, others drop it
 *  - resolve relative URLs against the monitor root
 *  - same-origin check
 *  - reject non-http/https protocols
 *  - reject excessively long URLs
 *  - preserve meaningful query params (language paths etc. are path-based and unaffected)
 */

const MAX_URL_LENGTH = 2_048;

/** Tracking params that provide no page-identity information. */
const TRACKING_PARAMS = new Set([
  // UTM
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  // Google / Meta / Microsoft
  'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source',
  'msclkid',
  // LinkedIn / Pinterest / Twitter
  'li_fat_id', 'epik', 'ttclid', 'twclid',
  // HubSpot / Marketo
  '_hsenc', '_hsmi', 'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src',
  'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver', 'mkt_tok',
  // Drip / Mailchimp / Klaviyo
  '__s', 'mc_cid', 'mc_eid', 'kme',
  // DoubleClick / Generic
  'ref', '_ga', '_gl', '_ke',
  // Session replay / chat
  'intercom-campaign-id',
]);

export interface NormalizeResult {
  url: string;
  normalizedUrl: string;
  path: string;
  error?: string;
}

/**
 * Normalize a URL for storage and deduplication.
 * Returns the normalized URL string or throws if the URL is invalid/rejected.
 */
export function normalizeMonitorUrl(raw: string, rootUrl?: string): NormalizeResult {
  // Length guard
  if (raw.length > MAX_URL_LENGTH) {
    return { url: raw, normalizedUrl: '', path: '', error: 'URL exceeds maximum length' };
  }

  let parsed: URL;
  try {
    // Resolve relative URLs against the root if provided
    parsed = rootUrl ? new URL(raw, rootUrl) : new URL(raw);
  } catch {
    return { url: raw, normalizedUrl: '', path: '', error: 'Invalid URL' };
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { url: raw, normalizedUrl: '', path: '', error: 'Only http and https URLs are allowed' };
  }

  // Credentials check (embedded username:password)
  if (parsed.username || parsed.password) {
    return { url: raw, normalizedUrl: '', path: '', error: 'URLs with embedded credentials are not allowed' };
  }

  // Lowercase hostname
  parsed.hostname = parsed.hostname.toLowerCase();

  // Remove default ports
  if ((parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')) {
    parsed.port = '';
  }

  // Remove fragment
  parsed.hash = '';

  // Remove tracking parameters
  const params = new URLSearchParams(parsed.search);
  for (const key of [...params.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      params.delete(key);
    }
  }
  // Re-sort remaining params for deterministic ordering
  const sortedParams = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b)));
  parsed.search = sortedParams.toString() ? `?${sortedParams.toString()}` : '';

  // Normalize trailing slash:
  //   root path "/" → keep as "/"
  //   other paths → strip trailing slash
  let { pathname } = parsed;
  if (pathname !== '/' && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  parsed.pathname = pathname;

  const normalizedUrl = parsed.toString();
  return { url: raw, normalizedUrl, path: parsed.pathname };
}

/**
 * Check whether a URL belongs to the same origin as the monitor root.
 */
export function isSameOriginAs(url: string, rootUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const root = new URL(rootUrl);
    return parsed.origin === root.origin;
  } catch {
    return false;
  }
}

/**
 * Get the origin key for Redis throttling (hashed so raw domains never appear in keys).
 * Uses crypto.subtle (available in Node 18+ and Edge Runtime).
 */
export async function getOriginKey(url: string): Promise<string> {
  let origin: string;
  try {
    origin = new URL(url).origin.toLowerCase();
  } catch {
    origin = url.toLowerCase();
  }
  const bytes = new TextEncoder().encode(origin);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16); // 64-bit prefix — unique enough for Redis keys
}
