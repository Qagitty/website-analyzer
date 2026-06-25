import { analyzeHTML } from './score';
import { checkLLMReadiness } from './llm-readiness';
import { analyzeSecurityHeaders, analyzeResources } from './resources';
import { checkAccessibility } from './accessibility';
import { checkSEOLightweight } from './seo';
import type { CrawledPage } from './types';

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

export function crawlInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const results: string[] = [];

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
    const key = parsed.origin + parsed.pathname;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push(absolute);
    if (results.length >= 4) break;
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

export async function crawlPage(url: string, fetchHeaders: object): Promise<CrawledPage | null> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);

  try {
    const r = await fetch(url, { headers: fetchHeaders, redirect: 'follow', signal: ctrl.signal });
    clearTimeout(timer);
    const ttfb = Date.now() - t0;
    const html = await r.text();
    const bytes = new TextEncoder().encode(html).length;

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // Skip auth-gated pages: detected via title keywords or final URL after redirect
    if (isPrivatePage(title) || shouldSkipPath(new URL(r.url).pathname)) return null;

    // HTTP errors — record status but do not fabricate scores
    if (!r.ok) {
      return {
        url: r.url, requestedUrl: url, finalUrl: r.url,
        statusCode: r.status, ttfb, bytes, title,
        performance: 0, seo: 0, accessibility: 0, llmReadiness: 0,
        measurementMode: 'fetch-status-only',
        auditLabel: 'Measurement failed',
        measurementError: { code: 'HTTP_ERROR', message: `HTTP ${r.status}`, retryable: r.status >= 500 },
      };
    }

    // Run resource audit so each crawled page scores on its own resource footprint
    const resourceAudit = analyzeResources(html, r, url);
    const scores = analyzeHTML(html, r, bytes, ttfb, {
      renderBlockingCount: resourceAudit.renderBlocking.length,
      imageIssueCount:     resourceAudit.imageIssues.length,
      totalImages:         resourceAudit.totalImages,
      thirdPartyCount:     resourceAudit.thirdParty.length,
    });
    const llmReadiness = checkLLMReadiness(html);
    const securityHeaders = analyzeSecurityHeaders(r);
    const accessibilityAudit = checkAccessibility(html);
    const seoResult = checkSEOLightweight(html, r, url);

    return {
      url: r.url, requestedUrl: url, finalUrl: r.url,
      statusCode: r.status, ttfb, bytes, title,
      performance: scores.performance,
      seo: seoResult.score ?? scores.seo,
      accessibility: accessibilityAudit.score,
      llmReadiness: llmReadiness.score,
      securityHeaders,
      measurementMode: 'lightweight-fetch',
      auditLabel: 'Lightweight fetch audit',
      accessibilityFindingCount: accessibilityAudit.findings.filter(f => f.status === 'confirmed' || f.status === 'likely').length,
      accessibilityAuditLabel: 'Static accessibility scan',
      seoResult,
    };
  } catch (err) {
    clearTimeout(timer);
    const elapsed = Date.now() - t0;
    return {
      url, requestedUrl: url, finalUrl: url,
      statusCode: 0, ttfb: elapsed, bytes: 0, title: url,
      performance: 0, seo: 0, accessibility: 0, llmReadiness: 0,
      measurementMode: 'fetch-status-only',
      auditLabel: 'Measurement failed',
      measurementError: classifyFetchError(err, elapsed),
    };
  }
}
