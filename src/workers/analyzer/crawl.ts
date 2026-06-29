import { analyzeHTML } from './score';
import { checkLLMReadinessLightweight } from './llm-readiness';
import { analyzeSecurityHeaders, analyzeResources } from './resources';
import { checkAccessibility } from './accessibility';
import { checkSEOLightweight } from './seo';
import { checkBestPracticesLightweight } from './best-practices';
import type { CrawledPage, DiscoveredLink } from './types';

// Path segments that indicate auth-gated or user-account pages.
// Matched against each individual path segment (split by '/') so
// '/tickets' passes but '/my-tickets' is blocked.
const SKIP_SEGMENTS = new Set([
  // Auth flows
  'login', 'signin', 'sign-in', 'logout', 'sign-out',
  'signup', 'sign-up', 'register', 'registration',
  'forgot-password', 'reset-password', 'change-password', 'password',
  // User account areas
  'account', 'my-account', 'myaccount',
  'profile', 'my-profile',
  'dashboard', 'my-dashboard',
  'settings', 'preferences',
  // Transactional / gated
  'orders', 'my-orders', 'order-history',
  'cart', 'checkout', 'payment', 'billing',
  'wishlist', 'favourites', 'favorites', 'saved',
  'bookings', 'my-bookings', 'reservations',
  'notifications', 'messages', 'inbox',
  'membership', 'subscription',
  // Tech paths
  'admin', 'api', 'static', 'assets', '_next', '__',
]);

function shouldSkipPath(pathname: string): boolean {
  const segments = pathname.toLowerCase().split('/').filter(Boolean);
  return segments.some(s => SKIP_SEGMENTS.has(s));
}

// Page titles that reliably indicate an auth-gated page.
const PRIVATE_TITLE_KEYWORDS = [
  'my account', 'my dashboard', 'my profile', 'my orders',
  'my bookings', 'my tickets', 'my favorites', 'my favourites',
  'my wishlist', 'my cart', 'my wallet', 'my rewards',
  'sign in', 'sign up', 'log in', 'login', 'register',
  'shopping cart', 'checkout', 'account settings',
];

function isPrivatePage(title: string): boolean {
  const lower = title.toLowerCase();
  return PRIVATE_TITLE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Classifies a URL into a coarse page type based on its path.
 * Used to improve observability when all pages show the same scores.
 */
export function classifyPageType(url: string): string {
  try {
    const { pathname } = new URL(url);
    const p = pathname.toLowerCase();
    if (p === '/' || p === '') return 'homepage';
    if (/\/(blog|article|news|post|story|insight)(s?\/|$)/.test(p)) return 'article';
    if (/\/(product|item)(s?\/|$)/.test(p) || /\/p\/[a-z0-9-]/.test(p)) return 'product';
    if (/\/(categor|catalogue|collection|catalog|department|browse)/.test(p) || /\/c\/[a-z0-9]/.test(p)) return 'category';
    if (/\/(about|contact|team|careers|jobs|pricing|faq|help|support)(\/|$)/.test(p)) return 'landing';
    if (/\/search(\/|\?|$)/.test(p)) return 'search';
    if (/\/(tag|topic|author|archive)(\/|$)/.test(p)) return 'index';
    const segments = p.split('/').filter(Boolean);
    if (segments.some(s => /^\d{4,}$/.test(s))) return 'detail';
    if (segments.length >= 3) return 'detail';
    return 'section';
  } catch {
    return 'unknown';
  }
}

/**
 * Discovers internal links from HTML.
 * Returns up to 20 unique normalized URLs as DiscoveredLink objects.
 * The caller decides how many to actually analyze (typically 4).
 */
export function crawlInternalLinks(html: string, baseUrl: string): DiscoveredLink[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const results: DiscoveredLink[] = [];

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
    if (shouldSkipPath(parsed.pathname)) continue;
    if (parsed.pathname === '/' && parsed.search === '') continue;
    // Deduplicate by origin+pathname (ignore tracking query params)
    const key = parsed.origin + parsed.pathname;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({ url: absolute, depth: 1, discoveredFrom: baseUrl });
    if (results.length >= 20) break;
  }

  return results;
}

function classifyFetchError(err: unknown, elapsed: number): CrawledPage['measurementError'] {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('abort') || lower.includes('timeout') || elapsed >= 9_500) {
    return { code: 'TIMEOUT', message: 'Request timed out after 10 seconds', retryable: true };
  }
  if (lower.includes('dns') || lower.includes('getaddrinfo') || lower.includes('name_not_resolved')) {
    return { code: 'DNS_ERROR', message: 'DNS lookup failed', retryable: false };
  }
  if (lower.includes('tls') || lower.includes('ssl') || lower.includes('certificate')) {
    return { code: 'TLS_ERROR', message: 'TLS/SSL handshake failed', retryable: false };
  }
  return { code: 'UNKNOWN', message: msg.slice(0, 120), retryable: true };
}

/**
 * SE3 — per-hop redirect SSRF guard.
 *
 * `redirect:'follow'` is transparent to intermediate hops: a same-origin page can
 * chain `same-host → 302 → cloud-metadata → 302 → same-host` and the final-URL
 * check only sees the last hop. This helper follows redirects manually, rejecting
 * any hop that leaves the original hostname.
 */
async function fetchSameOriginOnly(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response | null> {
  const originalHostname = new URL(url).hostname;
  let currentUrl = url;

  for (let hop = 0; hop < 5; hop++) {
    const r = await fetch(currentUrl, { headers, redirect: 'manual', signal });

    if (r.status < 300 || r.status >= 400) return r; // final response

    const location = r.headers.get('location');
    if (!location) return null;

    let nextUrl: URL;
    try { nextUrl = new URL(location, currentUrl); } catch { return null; }

    if (nextUrl.hostname !== originalHostname) return null; // cross-origin redirect blocked

    currentUrl = nextUrl.href;
  }

  return null; // exceeded max hops
}

export async function crawlPage(link: DiscoveredLink, fetchHeaders: Record<string, string>): Promise<CrawledPage | null> {
  const { url, depth, discoveredFrom } = link;
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  const pageId = crypto.randomUUID();

  try {
    const r = await fetchSameOriginOnly(url, fetchHeaders, ctrl.signal);
    if (!r) { clearTimeout(timer); return null; }
    clearTimeout(timer);
    const ttfb = Date.now() - t0;

    const html = await r.text();
    const bytes = new TextEncoder().encode(html).length;

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // Skip auth-gated pages detected via title keywords or post-redirect URL
    if (isPrivatePage(title) || shouldSkipPath(new URL(r.url).pathname)) return null;

    // HTTP errors: record provenance but return null scores, not fabricated zeros
    if (!r.ok) {
      return {
        url: r.url, requestedUrl: url, finalUrl: r.url,
        statusCode: r.status, ttfb, bytes, title,
        performance: null, seo: null, accessibility: null, llmReadiness: null,
        pageId, depth, discoveredFrom,
        pageType: classifyPageType(r.url),
        auditLevel: 'status-only',
        measurementMode: 'fetch-status-only',
        auditLabel: 'Measurement failed',
        measurementError: { code: 'HTTP_ERROR', message: `HTTP ${r.status}`, retryable: r.status >= 500 },
      };
    }

    // Independent per-page analysis — each crawled page uses its own fetched HTML
    const resourceAudit = analyzeResources(html, r, url);
    const scores = analyzeHTML(html, r, bytes, ttfb, {
      renderBlockingCount: resourceAudit.renderBlocking.length,
      imageIssueCount:     resourceAudit.imageIssues.length,
      totalImages:         resourceAudit.totalImages,
      thirdPartyCount:     resourceAudit.thirdParty.length,
    });
    const llmReadinessResult = checkLLMReadinessLightweight(html, r, url);
    const securityHeaders = analyzeSecurityHeaders(r);
    const accessibilityAudit = checkAccessibility(html);
    const seoResult = checkSEOLightweight(html, r, url);
    const bestPracticesResult = checkBestPracticesLightweight(html, r, url);

    return {
      url: r.url, requestedUrl: url, finalUrl: r.url,
      statusCode: r.status, ttfb, bytes, title,
      performance: scores.performance,
      seo: seoResult.score ?? scores.seo,
      accessibility: accessibilityAudit.score,
      llmReadiness: llmReadinessResult.score ?? 0,
      securityHeaders,
      pageId, depth, discoveredFrom,
      pageType: classifyPageType(r.url),
      auditLevel: 'fetch-only',
      measurementMode: 'lightweight-fetch',
      auditLabel: 'Lightweight fetch audit',
      accessibilityFindingCount: accessibilityAudit.findings.filter(f => f.status === 'confirmed' || f.status === 'likely').length,
      accessibilityAuditLabel: 'Static accessibility scan',
      seoResult,
      bestPracticesResult,
      llmReadinessResult,
    };
  } catch (err) {
    clearTimeout(timer);
    const elapsed = Date.now() - t0;
    // Network errors: null scores — not measured, not zero
    return {
      url, requestedUrl: url, finalUrl: url,
      statusCode: 0, ttfb: elapsed, bytes: 0, title: url,
      performance: null, seo: null, accessibility: null, llmReadiness: null,
      pageId, depth, discoveredFrom,
      pageType: classifyPageType(url),
      auditLevel: 'not-analyzed',
      measurementMode: 'fetch-status-only',
      auditLabel: 'Measurement failed',
      measurementError: classifyFetchError(err, elapsed),
    };
  }
}
