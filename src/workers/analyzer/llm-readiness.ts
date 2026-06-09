import type { LLMReadiness } from './types';

export function checkLLMReadiness(html: string): LLMReadiness {
  const checks = {
    hasStructuredData: /"@context"\s*:\s*"https?:\/\/schema\.org/i.test(html) || /itemscope/i.test(html),
    hasMetaDescription: (() => {
      const m = html.match(/meta[^>]+name=["']description["'][^>]*content=["']([^"']{50,160})["']/i)
        || html.match(/meta[^>]+content=["']([^"']{50,160})["'][^>]*name=["']description["']/i);
      return m !== null;
    })(),
    hasOpenGraph: /property=["']og:title["']/i.test(html) && /property=["']og:description["']/i.test(html),
    hasSitemap: /sitemap/i.test(html),
    allowsAIBots: !/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*(noindex|nofollow|none)/i.test(html),
    hasCleanHeadings: /<h1[\s>]/i.test(html) && (/<h2[\s>]/i.test(html) || /<h3[\s>]/i.test(html)),
    hasSufficientContent: html.length > 5000,
    hasCanonical: /rel=["']canonical["']/i.test(html),
  };

  const passing = Object.values(checks).filter(Boolean).length;
  const score = Math.round(passing * 12.5);

  const signals: string[] = [];
  if (!checks.hasStructuredData) signals.push('Add JSON-LD structured data (Schema.org) so AI can understand your content type');
  if (!checks.hasMetaDescription) signals.push('Add a meta description (50-160 chars) — AI uses this for content summaries');
  if (!checks.hasOpenGraph) signals.push('Add Open Graph tags so AI bots can preview your content correctly');
  if (!checks.hasSitemap) signals.push('Link to your sitemap.xml in <head> so crawlers discover all pages');
  if (!checks.allowsAIBots) signals.push('Your robots meta tag blocks AI crawlers — remove GPTBot/CCBot restrictions if you want AI indexing');
  if (!checks.hasCleanHeadings) signals.push('Add clear H2/H3 headings to help AI understand your content hierarchy');
  if (!checks.hasSufficientContent) signals.push('Add more substantive content — thin pages are often skipped by AI crawlers');
  if (!checks.hasCanonical) signals.push('Add a canonical URL tag to avoid duplicate content confusion for AI');

  return { score, checks, signals };
}
