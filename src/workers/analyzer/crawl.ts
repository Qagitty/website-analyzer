import { analyzeHTML } from './score';
import { checkLLMReadiness } from './llm-readiness';
import type { CrawledPage } from './types';

export function crawlInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const skipPatterns = ['/login', '/signup', '/admin', '/api', '/static', '/assets'];
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
    if (skipPatterns.some(p => parsed.pathname.startsWith(p))) continue;
    if (parsed.pathname === '/' && parsed.search === '') continue;
    const key = parsed.origin + parsed.pathname;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push(absolute);
    if (results.length >= 4) break;
  }

  return results;
}

export async function crawlPage(url: string, fetchHeaders: object): Promise<CrawledPage> {
  try {
    const t0 = Date.now();
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10_000);
    const r = await fetch(url, { headers: fetchHeaders, redirect: 'follow', signal: ctrl.signal });
    const ttfb = Date.now() - t0;
    const html = await r.text();
    const bytes = new TextEncoder().encode(html).length;

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    const scores = analyzeHTML(html, r, bytes, ttfb);
    const llmReadiness = checkLLMReadiness(html);

    return {
      url: r.url,
      statusCode: r.status,
      ttfb,
      bytes,
      title,
      performance: scores.performance,
      seo: scores.seo,
      accessibility: scores.accessibility,
      llmReadiness: llmReadiness.score,
    };
  } catch {
    return {
      url,
      statusCode: 0,
      ttfb: 0,
      bytes: 0,
      title: url,
      performance: 0,
      seo: 0,
      accessibility: 0,
      llmReadiness: 0,
    };
  }
}
