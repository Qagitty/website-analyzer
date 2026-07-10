/**
 * Page discovery for multi-page monitors.
 *
 * Two strategies:
 *  1. sitemap — fetch /sitemap.xml (and /sitemap_index.xml), extract <loc> entries
 *  2. crawl   — fetch the root page, extract internal <a href> links
 *
 * Both strategies respect:
 *  - robots.txt Disallow rules (User-agent: *)
 *  - includePatterns / excludePatterns from MonitorScope
 *  - maxPages limit
 *  - Same-origin constraint (never leave the root domain)
 */

import { validateAnalysisUrl } from '@/lib/security/url-validator';

export interface DiscoveredPage {
  url: string;
  source: 'sitemap' | 'crawl' | 'manual';
  depth: number;
}

export interface DiscoveryResult {
  pages: DiscoveredPage[];
  sitemapFound: boolean;
  robotsFound: boolean;
  errors: string[];
}

const FETCH_TIMEOUT_MS = 8_000;
const MAX_SITEMAP_URLS = 500;

function safeFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': 'WebScore-Monitor/1.0 (+https://webscore.app)' },
  }).finally(() => clearTimeout(timer));
}

/** Parse robots.txt and return set of disallowed path prefixes for * agent */
function parseRobotsDisallowed(text: string): Set<string> {
  const disallowed = new Set<string>();
  let capturing = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (/^user-agent\s*:\s*\*/i.test(line)) { capturing = true; continue; }
    if (/^user-agent\s*:/i.test(line)) { capturing = false; continue; }
    if (capturing && /^disallow\s*:/i.test(line)) {
      const path = line.replace(/^disallow\s*:\s*/i, '').trim();
      if (path) disallowed.add(path);
    }
  }
  return disallowed;
}

function isDisallowed(path: string, disallowed: Set<string>): boolean {
  for (const prefix of disallowed) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

/** Extract <loc> values from a sitemap XML string */
function extractSitemapLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

/** Extract href values from anchor tags in HTML */
function extractLinks(html: string, base: URL): string[] {
  const hrefs: string[] = [];
  const re = /href=["']([^"'#?][^"']*?)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1], base).href;
      hrefs.push(resolved);
    } catch { /* ignore invalid hrefs */ }
  }
  return hrefs;
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // Remove fragment, normalize trailing slash on root
    u.hash = '';
    return u.href;
  } catch {
    return raw;
  }
}

function isSameOrigin(url: string, rootOrigin: string): boolean {
  try {
    return new URL(url).origin === rootOrigin;
  } catch {
    return false;
  }
}

function matchesPatterns(url: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  return patterns.some((p) => {
    try { return new RegExp(p).test(url); } catch { return url.includes(p); }
  });
}

export async function discoverPages(
  rootUrl: string,
  options: {
    strategy: 'sitemap' | 'crawl' | 'both';
    maxPages: number;
    includePatterns?: string[];
    excludePatterns?: string[];
  },
): Promise<DiscoveryResult> {
  const { strategy, maxPages, includePatterns = [], excludePatterns = [] } = options;
  const errors: string[] = [];
  const pages: DiscoveredPage[] = [];
  const seen = new Set<string>();

  let rootOrigin: string;
  let rootBase: URL;
  try {
    rootBase = new URL(rootUrl);
    rootOrigin = rootBase.origin;
  } catch {
    return { pages: [], sitemapFound: false, robotsFound: false, errors: ['Invalid root URL'] };
  }

  // Always include the root URL itself
  const normRoot = normalizeUrl(rootUrl);
  seen.add(normRoot);

  function addPage(url: string, source: 'sitemap' | 'crawl', depth = 0): boolean {
    if (pages.length >= maxPages) return false;
    const norm = normalizeUrl(url);
    if (seen.has(norm)) return false;

    // Safety: SSRF check on every discovered URL
    const v = validateAnalysisUrl(norm);
    if (!v.valid) return false;

    // Same-origin only
    if (!isSameOrigin(norm, rootOrigin)) return false;

    // Pattern filters
    if (includePatterns.length > 0 && !matchesPatterns(norm, includePatterns)) return false;
    if (excludePatterns.length > 0 && matchesPatterns(norm, excludePatterns)) return false;

    seen.add(norm);
    pages.push({ url: norm, source, depth });
    return true;
  }

  // ── Robots.txt ──────────────────────────────────────────────────────────────
  let robotsFound = false;
  let disallowed = new Set<string>();
  try {
    const robotsRes = await safeFetch(`${rootOrigin}/robots.txt`);
    if (robotsRes.ok) {
      robotsFound = true;
      disallowed = parseRobotsDisallowed(await robotsRes.text());
    }
  } catch { /* robots.txt is optional */ }

  // ── Sitemap strategy ────────────────────────────────────────────────────────
  let sitemapFound = false;

  if (strategy === 'sitemap' || strategy === 'both') {
    const sitemapUrls = [`${rootOrigin}/sitemap.xml`, `${rootOrigin}/sitemap_index.xml`];

    for (const sitemapUrl of sitemapUrls) {
      if (sitemapFound) break;
      try {
        const res = await safeFetch(sitemapUrl);
        if (!res.ok) continue;
        const xml = await res.text();
        if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) continue;

        sitemapFound = true;

        // Handle sitemap index — fetch child sitemaps
        const childSitemaps = xml.includes('<sitemapindex')
          ? extractSitemapLocs(xml).slice(0, 5) // max 5 child sitemaps
          : [];

        const allLocs: string[] = xml.includes('<sitemapindex') ? [] : extractSitemapLocs(xml);

        for (const childUrl of childSitemaps) {
          if (allLocs.length >= MAX_SITEMAP_URLS) break;
          try {
            const childRes = await safeFetch(childUrl);
            if (childRes.ok) {
              allLocs.push(...extractSitemapLocs(await childRes.text()));
            }
          } catch { /* skip failed child sitemaps */ }
        }

        for (const loc of allLocs.slice(0, MAX_SITEMAP_URLS)) {
          if (pages.length >= maxPages) break;
          const path = (() => { try { return new URL(loc).pathname; } catch { return '/'; } })();
          if (isDisallowed(path, disallowed)) continue;
          addPage(loc, 'sitemap', 0);
        }
      } catch (err) {
        errors.push(`Sitemap fetch failed: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }
  }

  // ── Crawl strategy ──────────────────────────────────────────────────────────
  if ((strategy === 'crawl' || strategy === 'both') && pages.length < maxPages) {
    try {
      const res = await safeFetch(rootUrl);
      if (res.ok) {
        const html = await res.text();
        const links = extractLinks(html, rootBase);

        for (const link of links) {
          if (pages.length >= maxPages) break;
          const path = (() => { try { return new URL(link).pathname; } catch { return '/'; } })();
          if (isDisallowed(path, disallowed)) continue;
          addPage(link, 'crawl', 1);
        }
      }
    } catch (err) {
      errors.push(`Crawl failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return { pages, sitemapFound, robotsFound, errors };
}
