/**
 * Origin validation for the site-connect ingestion endpoint.
 *
 * Security rules:
 *  - Exact-match origin against the site's normalized_origin stored in DB.
 *  - www <-> non-www variants are allowed if both point to the same host.
 *  - No wildcard matching; no suffix-only matching.
 *  - Suffixes like `example.com.attacker.test` are explicitly rejected.
 *  - localhost / 127.x / private IPs are rejected regardless.
 */

import { validateAnalysisUrl } from '@/lib/security/url-validator';

/**
 * Derive the normalized origin from a raw URL.
 * Returns null if the URL is invalid or private.
 */
export function normalizeOrigin(rawUrl: string): string | null {
  const result = validateAnalysisUrl(rawUrl);
  if (!result.valid) return null;

  try {
    const u = new URL(rawUrl);
    // Remove default ports to get a clean origin
    const port =
      (u.protocol === 'https:' && u.port === '443') ||
      (u.protocol === 'http:'  && u.port === '80')
        ? ''
        : u.port;
    const host = u.hostname.toLowerCase();
    return port ? `${u.protocol}//${host}:${port}` : `${u.protocol}//${host}`;
  } catch {
    return null;
  }
}

/**
 * Extract the canonical host (no protocol, no port, no trailing dot).
 */
export function canonicalHost(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

/**
 * Determine whether an inbound Origin header value matches the site's
 * configured normalized_origin (stored in DB at registration time).
 *
 * Allows www <-> apex normalization when both resolve to the same base domain.
 * Rejects everything else.
 */
export function isOriginAllowed(
  inboundOrigin: string | null | undefined,
  siteNormalizedOrigin: string,
): boolean {
  if (!inboundOrigin) return false;

  // Reject non-http/https origins
  if (!inboundOrigin.startsWith('https://') && !inboundOrigin.startsWith('http://')) {
    return false;
  }

  let inbound: URL;
  let site: URL;
  try {
    inbound = new URL(inboundOrigin);
    site    = new URL(siteNormalizedOrigin);
  } catch {
    return false;
  }

  // Protocol must match
  if (inbound.protocol !== site.protocol) return false;

  // Normalize ports
  const inboundPort = effectivePort(inbound);
  const sitePort    = effectivePort(site);
  if (inboundPort !== sitePort) return false;

  // Exact host match
  const inboundHost = inbound.hostname.toLowerCase();
  const siteHost    = site.hostname.toLowerCase();
  if (inboundHost === siteHost) return true;

  // Allow www <-> apex: both must share the exact same registered domain
  const inboundBase = stripWww(inboundHost);
  const siteBase    = stripWww(siteHost);
  if (inboundBase === siteBase && inboundBase !== '') return true;

  return false;
}

function effectivePort(u: URL): string {
  if (u.port) return u.port;
  return u.protocol === 'https:' ? '443' : '80';
}

function stripWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host;
}

/**
 * Build CORS headers for the ingestion endpoint.
 * Always sets Vary: Origin so CDNs do not cache the wrong origin.
 */
export function buildCorsHeaders(
  inboundOrigin: string | null | undefined,
  siteNormalizedOrigin: string,
): HeadersInit {
  const allowed = inboundOrigin && isOriginAllowed(inboundOrigin, siteNormalizedOrigin);
  return {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    ...(allowed ? { 'Access-Control-Allow-Origin': inboundOrigin! } : {}),
  };
}
