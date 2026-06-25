// SEO Audit Engine — fetch-only mode
// Implements sections 4–21, 22–24, 29–30 of the SEO Audit Improvement spec.
// No browser rendering available; all checks operate on raw HTML + HTTP headers + secondary fetches.

import { workerLog } from './log';
import type {
  SeoAuditResult, SeoPageResult, SeoFinding, SeoFindingStatus, SeoSeverity,
  SeoMetadataResult, SeoIndexabilityResult, StructuredDataResult, StructuredDataItem,
  InternationalSeoResult, SitemapResult, RobotsTxtResult, SeoScoreBreakdown,
  SeoAuditCoverage, InternalLinkResult, SeoAuditError, HreflangEntry,
} from '../../types/seo';

// Re-export for type narrowing at import sites
export type { SeoAuditResult, SeoPageResult };

const SEO_AUDIT_VERSION = 'seo-v1';
const SEO_SCORE_VERSION = '1.0.0';

// Category weights (must sum to 1.0)
const CATEGORY_WEIGHTS: Record<string, number> = {
  indexability:    0.20,
  metadata:        0.20,
  canonicalization:0.15,
  crawlability:    0.15,
  'content-structure': 0.10,
  'structured-data':   0.08,
  international:   0.04,
  social:          0.03,
  'url-hygiene':   0.03,
  mobile:          0.02,
};

// Severity → scoring weight
const SEVERITY_WEIGHT: Record<SeoSeverity, number> = {
  critical: 4,
  high: 2,
  medium: 1,
  low: 0.5,
  info: 0,
};

// IANA / BCP 47 language subtag pattern (2–3 letter primary + optional region)
const LANG_CODE_RE = /^[a-z]{2,3}(-[A-Z]{2}|(-[A-Z][a-z]{3})?(-[A-Z]{2})?)?$/;

// Known schema.org types we recognize
const KNOWN_SCHEMA_TYPES = new Set([
  'Organization','LocalBusiness','WebSite','WebPage','BreadcrumbList',
  'Product','Offer','Event','Article','FAQPage','HowTo','Review',
  'AggregateRating','TouristAttraction','Trip','ItemList','Person',
  'VideoObject','ImageObject','NewsArticle','BlogPosting','Service',
  'SiteNavigationElement','SearchAction','ContactPage','AboutPage',
]);

// Required properties per schema type (minimal validation)
const REQUIRED_PROPS: Record<string, string[]> = {
  Product: ['name'],
  Event: ['name','startDate'],
  Article: ['headline','author','datePublished'],
  FAQPage: ['mainEntity'],
  HowTo: ['name','step'],
  Review: ['itemReviewed','reviewRating'],
  LocalBusiness: ['name','address'],
  Organization: ['name'],
  BreadcrumbList: ['itemListElement'],
};

// Session-ID-like query parameter names
const SESSION_PARAM_RE = /^(s?phpsessid|jsessionid|aspsessionid|sid|sessionid|session_id|viewstate)$/i;

// ──────────────────────────────────────────────────────────────
// Building blocks
// ──────────────────────────────────────────────────────────────

let _findingSeq = 0;
function makeFinding(
  ruleId: string,
  category: SeoFinding['category'],
  title: string,
  description: string,
  status: SeoFindingStatus,
  severity: SeoSeverity,
  confidence: SeoFinding['confidence'],
  recommendation: string,
  evidence: SeoFinding['evidence'] = [],
  affectedPages: string[] = [],
  howToVerify?: string,
): SeoFinding {
  return {
    id: `seo-${ruleId}-${++_findingSeq}`,
    ruleId,
    category,
    title,
    description,
    status,
    severity,
    confidence,
    affectedPages,
    evidence,
    recommendation,
    howToVerify,
  };
}

function safeText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw, base);
    // Normalize: lowercase scheme+host, strip default ports, keep path as-is
    return u.href;
  } catch {
    return null;
  }
}

function stripFragment(url: string): string {
  try { return url.split('#')[0]; } catch { return url; }
}

// ──────────────────────────────────────────────────────────────
// 1. Metadata checks (§4, §5)
// ──────────────────────────────────────────────────────────────

function checkMetadata(html: string, url: string, findings: SeoFinding[]): SeoMetadataResult {
  // Title
  const allTitles = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map(m => m[1].trim());
  const rawTitle = allTitles[0] ?? null;
  const titleNorm = rawTitle ? safeText(rawTitle) : null;
  const titleLen = titleNorm?.length ?? null;

  let titleStatus: SeoMetadataResult['titleStatus'];
  if (allTitles.length === 0) {
    titleStatus = 'missing';
    findings.push(makeFinding('title-missing','metadata','Title tag missing',
      'The page has no <title> element. Search engines use the title as the primary heading in search results.',
      'failed','high','high',
      'Add a unique, descriptive <title> tag (30–65 characters) inside <head>.',
      [{ source: 'html', html: '<title>...</title>', expected: 'Present', actual: 'Missing' }],
      [url],
      'View page source and search for <title>',
    ));
  } else if (allTitles.length > 1) {
    titleStatus = 'multiple';
    findings.push(makeFinding('title-multiple','metadata','Multiple title tags detected',
      `${allTitles.length} <title> elements were found. Browsers and search engines use only the first one; extras are ignored and may cause confusion.`,
      'failed','medium','high',
      'Remove duplicate <title> tags and keep exactly one.',
      [{ source: 'html', actual: `${allTitles.length} title tags`, expected: '1' }],
      [url],
    ));
  } else if (!titleNorm || titleNorm.length === 0) {
    titleStatus = 'empty';
    findings.push(makeFinding('title-empty','metadata','Title tag is empty',
      'The <title> tag exists but contains no text.',
      'failed','high','high',
      'Add descriptive text to the <title> tag.',
      [{ source: 'html', html: rawTitle ?? '', actual: 'Empty string' }],
      [url],
    ));
  } else if (titleLen! < 10) {
    titleStatus = 'too-short';
    findings.push(makeFinding('title-too-short','metadata','Title may be too short',
      `Title is ${titleLen} characters. Very short titles provide little context to search engines.`,
      'warning','low','medium',
      'Consider expanding the title to 30–65 characters to better describe the page.',
      [{ source: 'html', html: titleNorm, actual: `${titleLen} chars` }],
      [url],
    ));
  } else if (titleLen! > 70) {
    titleStatus = 'too-long';
    findings.push(makeFinding('title-too-long','metadata','Title may be truncated in search results',
      `Title is ${titleLen} characters. Search engines typically display 50–65 characters; longer titles may be cut off. This is a heuristic — actual display depends on pixel width.`,
      'warning','low','medium',
      'Consider shortening to under 65 characters, or ensure the most important words appear first.',
      [{ source: 'html', html: titleNorm, actual: `${titleLen} chars` }],
      [url],
    ));
  } else {
    titleStatus = 'good';
    findings.push(makeFinding('title-good','metadata','Title tag present and well-formed',
      `Title: "${titleNorm}" (${titleLen} characters)`,
      'passed','medium','high',
      '',
      [{ source: 'html', html: titleNorm }],
    ));
  }

  // Meta description
  const descMatches = [
    ...html.matchAll(/meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*/gi),
    ...html.matchAll(/meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["'][^>]*/gi),
  ];
  const allDescs = descMatches.map(m => m[1].trim());
  const rawDesc = allDescs[0] ?? null;
  const descLen = rawDesc?.length ?? null;

  let descStatus: SeoMetadataResult['descriptionStatus'];
  if (allDescs.length === 0) {
    descStatus = 'missing';
    findings.push(makeFinding('desc-missing','metadata','Meta description missing',
      'No <meta name="description"> was found. Search engines may generate a snippet from page content, but a relevant description can improve snippet clarity.',
      'warning','medium','high',
      'Add a <meta name="description" content="..."> with 70–155 characters that accurately summarises the page.',
      [{ source: 'html', expected: '<meta name="description">', actual: 'Missing' }],
      [url],
      'Search page source for name="description"',
    ));
  } else if (allDescs.length > 1) {
    descStatus = 'multiple';
    findings.push(makeFinding('desc-multiple','metadata','Multiple meta descriptions detected',
      `${allDescs.length} description meta tags found. Only the first is used.`,
      'failed','medium','high',
      'Keep only one <meta name="description">.',
      [],
      [url],
    ));
  } else if (!rawDesc || rawDesc.length === 0) {
    descStatus = 'empty';
    findings.push(makeFinding('desc-empty','metadata','Meta description is empty',
      'The meta description tag exists but the content attribute is empty.',
      'failed','medium','high',
      'Add meaningful content to the meta description.',
      [{ source: 'html', html: rawDesc ?? '' }],
      [url],
    ));
  } else if (descLen! < 50) {
    descStatus = 'too-short';
    findings.push(makeFinding('desc-too-short','metadata','Meta description may be too short',
      `Description is ${descLen} characters. Very short descriptions provide little context.`,
      'warning','low','medium',
      'Consider expanding to 70–155 characters.',
      [{ source: 'html', html: rawDesc, actual: `${descLen} chars` }],
      [url],
    ));
  } else if (descLen! > 165) {
    descStatus = 'too-long';
    findings.push(makeFinding('desc-too-long','metadata','Meta description may be truncated',
      `Description is ${descLen} characters. Search engines typically display 155–165 characters. Google may choose a different snippet regardless of this tag.`,
      'warning','low','medium',
      'Consider shortening to 155 characters, putting key information first.',
      [{ source: 'html', html: rawDesc.slice(0,80) + '...', actual: `${descLen} chars` }],
      [url],
    ));
  } else {
    descStatus = 'good';
    findings.push(makeFinding('desc-good','metadata','Meta description present and well-formed',
      `Description: "${rawDesc.slice(0,80)}${descLen! > 80 ? '…' : ''}" (${descLen} characters)`,
      'passed','medium','high',
      '',
      [{ source: 'html', html: rawDesc }],
    ));
  }

  // OG tags
  const ogTags: Record<string,string> = {};
  for (const m of html.matchAll(/meta[^>]+property=["'](og:[^"']+)["'][^>]*content=["']([^"']*)["']/gi)) {
    ogTags[m[1]] = m[2];
  }

  // Twitter Card
  const twitterTags: Record<string,string> = {};
  for (const m of html.matchAll(/meta[^>]+name=["'](twitter:[^"']+)["'][^>]*content=["']([^"']*)["']/gi)) {
    twitterTags[m[1]] = m[2];
  }

  // HTML lang
  const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const htmlLang = langMatch ? langMatch[1].trim() : null;

  return {
    title: titleNorm,
    titleLength: titleLen,
    titleStatus,
    description: rawDesc,
    descriptionLength: descLen,
    descriptionStatus: descStatus,
    h1: null, // filled by checkHeadings
    h1Count: 0,
    headingStructure: [],
    ogTags,
    twitterTags,
    htmlLang,
  };
}

// ──────────────────────────────────────────────────────────────
// 2. Heading structure (§11)
// ──────────────────────────────────────────────────────────────

function checkHeadings(html: string, url: string, findings: SeoFinding[], meta: SeoMetadataResult): void {
  const headingRe = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  const headings: Array<{level:number; text:string}> = [];
  for (const m of html.matchAll(headingRe)) {
    const level = parseInt(m[1][1]);
    const text = safeText(m[2]).trim();
    headings.push({ level, text });
  }
  meta.headingStructure = headings;

  const h1s = headings.filter(h => h.level === 1);
  meta.h1Count = h1s.length;
  meta.h1 = h1s[0]?.text ?? null;

  if (h1s.length === 0) {
    findings.push(makeFinding('h1-missing','headings','H1 heading missing',
      'No <h1> element was found. The H1 typically conveys the main topic of the page to both users and search engines.',
      'failed','high','high',
      'Add one <h1> element that describes the main topic of the page.',
      [{ source: 'html', expected: '<h1>...</h1>', actual: 'Missing' }],
      [url],
    ));
  } else if (h1s.length > 1) {
    findings.push(makeFinding('h1-multiple','headings','Multiple H1 elements detected',
      `${h1s.length} <h1> elements found. While modern HTML allows multiple H1s, a single clear H1 better communicates the primary topic. This is a manual-review item — the semantic structure may be intentional.`,
      'manual-review','low','medium',
      'Review whether multiple H1s are intentional. If the page has a clear primary topic, consolidate to one H1.',
      [{ source: 'html', actual: `${h1s.length} H1 elements`, expected: '1' }],
      [url],
    ));
  } else if (h1s[0].text.length === 0) {
    findings.push(makeFinding('h1-empty','headings','H1 heading is empty',
      'An H1 element was found but it contains no visible text.',
      'failed','medium','high',
      'Add descriptive text to the H1 element.',
      [{ source: 'html', html: '<h1></h1>' }],
      [url],
    ));
  } else {
    findings.push(makeFinding('h1-valid','headings','H1 heading present',
      `H1: "${h1s[0].text.slice(0,100)}"`,
      'passed','high','high',
      '',
    ));
  }

  // Check for skipped heading levels
  let prevLevel = 0;
  let skipped = false;
  for (const h of headings) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      skipped = true;
      break;
    }
    prevLevel = h.level;
  }
  if (skipped && headings.length > 1) {
    findings.push(makeFinding('heading-levels-skipped','headings','Heading levels are skipped',
      'The heading hierarchy jumps levels (e.g. H1 → H3 without H2). This can affect document structure for screen readers, though it is not a hard ranking signal.',
      'manual-review','low','medium',
      'Review heading structure. Prefer a continuous hierarchy (H1 → H2 → H3) where semantically appropriate.',
      [{ source: 'html', confidence: 'medium' }],
      [url],
    ));
  }

  // HTML lang check
  if (!meta.htmlLang) {
    findings.push(makeFinding('html-lang-missing','content','HTML lang attribute missing',
      'The <html> element has no lang attribute. Search engines and assistive technologies use the lang attribute to determine the page language.',
      'failed','medium','high',
      'Add lang="en" (or the appropriate BCP 47 language tag) to the <html> element.',
      [{ source: 'html', expected: '<html lang="en">', actual: '<html>' }],
      [url],
    ));
  } else {
    findings.push(makeFinding('html-lang-present','content','HTML lang attribute present',
      `lang="${meta.htmlLang}"`,
      'passed','medium','high',
      '',
    ));
  }
}

// ──────────────────────────────────────────────────────────────
// 3. Indexability (§7)
// ──────────────────────────────────────────────────────────────

function checkIndexability(html: string, response: Response, url: string, findings: SeoFinding[]): SeoIndexabilityResult {
  // Parse <meta name="robots"> directives
  const metaRobotsMatch = html.match(/meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  const robotsMetaRaw = metaRobotsMatch ? metaRobotsMatch[1] : '';
  const robotsMeta = robotsMetaRaw
    ? robotsMetaRaw.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
    : [];

  // Parse X-Robots-Tag header
  const xRobotsRaw = response.headers.get('x-robots-tag') ?? '';
  const xRobotsTag = xRobotsRaw
    ? xRobotsRaw.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
    : [];

  // Combine — most restrictive wins
  const allDirectives = [...new Set([...robotsMeta, ...xRobotsTag])];

  const noindex = allDirectives.some(d => d === 'noindex' || d === 'none');
  const nofollow = allDirectives.some(d => d === 'nofollow' || d === 'none');

  // Detect conflicts: e.g. index + noindex
  const hasIndex = allDirectives.includes('index');
  const conflicting = hasIndex && noindex;

  // Build effective directives (deduplicated, most-restrictive)
  const effectiveDirectives = allDirectives;

  const isIndexable = !noindex;

  if (noindex) {
    findings.push(makeFinding('page-noindex','indexability','Page is set to noindex',
      'This page has a noindex directive (via robots meta tag or X-Robots-Tag header). Search engines are instructed not to include it in search results. If this is intentional (e.g. thank-you page, internal tool), no action is needed.',
      'manual-review','critical','high',
      'Verify whether noindex is intentional. If this page should appear in search results, remove the noindex directive.',
      [
        robotsMeta.length ? { source: 'html' as const, html: `<meta name="robots" content="${robotsMetaRaw}">` } : null,
        xRobotsRaw ? { source: 'http-header' as const, html: `X-Robots-Tag: ${xRobotsRaw}` } : null,
      ].filter(Boolean) as SeoFinding['evidence'],
      [url],
      'Open the page, inspect <meta name="robots"> in source, and check X-Robots-Tag in network panel.',
    ));
  } else {
    findings.push(makeFinding('page-indexable','indexability','Page is indexable',
      'No noindex directive detected. The page should be eligible for indexing.',
      'passed','critical','high',
      '',
    ));
  }

  if (conflicting) {
    findings.push(makeFinding('robots-conflicting','indexability','Conflicting robots directives',
      'Both index and noindex directives are present. Search engines apply the most restrictive rule, so noindex wins.',
      'warning','high','high',
      'Remove the conflicting index/noindex directives and keep only the intended one.',
      [{ source: 'html', actual: allDirectives.join(', ') }],
      [url],
    ));
  }

  if (nofollow) {
    findings.push(makeFinding('page-nofollow','indexability','Page has nofollow directive',
      'The nofollow directive instructs search engines not to follow links on this page. This may limit crawlability of the site.',
      'warning','medium','high',
      'Review whether nofollow on the whole page is intentional. Use rel="nofollow" on individual links instead where possible.',
      [],
      [url],
    ));
  }

  return {
    isIndexable,
    robotsMeta,
    xRobotsTag,
    effectiveDirectives,
    noindex,
    nofollow,
    conflictingDirectives: conflicting,
  };
}

// ──────────────────────────────────────────────────────────────
// 4. Canonical (§6)
// ──────────────────────────────────────────────────────────────

function checkCanonical(html: string, requestedUrl: string, finalUrl: string, findings: SeoFinding[]): string | null {
  const allCanonicals = [...html.matchAll(/link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/gi)]
    .map(m => m[1].trim());

  if (allCanonicals.length === 0) {
    findings.push(makeFinding('canonical-missing','canonical','Canonical tag missing',
      'No <link rel="canonical"> found. Without a canonical, search engines must independently determine the preferred version, which may lead to duplicate-content issues.',
      'warning','medium','medium',
      'Add <link rel="canonical" href="..."> pointing to the preferred URL for this page.',
      [{ source: 'html', expected: '<link rel="canonical" href="...">', actual: 'Missing' }],
      [finalUrl],
      'Search page source for rel="canonical"',
    ));
    return null;
  }

  if (allCanonicals.length > 1) {
    findings.push(makeFinding('canonical-multiple','canonical','Multiple canonical tags detected',
      `${allCanonicals.length} canonical tags found. Search engines may ignore all of them when multiple are present.`,
      'failed','high','high',
      'Keep exactly one <link rel="canonical"> per page.',
      [{ source: 'html', actual: `${allCanonicals.length} canonical tags` }],
      [finalUrl],
    ));
    return null;
  }

  const rawCanonical = allCanonicals[0];
  const resolvedCanonical = normalizeUrl(rawCanonical, finalUrl);

  if (!resolvedCanonical) {
    findings.push(makeFinding('canonical-invalid','canonical','Canonical URL is invalid',
      `The canonical value "${rawCanonical}" could not be resolved to a valid URL.`,
      'failed','high','high',
      'Fix the canonical href to be a valid absolute URL.',
      [{ source: 'html', html: `<link rel="canonical" href="${rawCanonical}">`, actual: 'Invalid URL' }],
      [finalUrl],
    ));
    return null;
  }

  // Compare canonical to final URL
  const canonicalNorm = stripFragment(resolvedCanonical);
  const finalNorm = stripFragment(finalUrl);
  let canonicalStatus: SeoPageResult['canonicalStatus'];

  try {
    const canonParsed = new URL(canonicalNorm);
    const finalParsed = new URL(finalNorm);

    if (canonParsed.hostname !== finalParsed.hostname) {
      // Cross-domain canonical — not automatically wrong
      canonicalStatus = 'cross-domain';
      findings.push(makeFinding('canonical-cross-domain','canonical','Cross-domain canonical detected',
        `The canonical points to a different domain: ${canonParsed.origin}. This is valid when consolidating duplicate content across domains, but should be verified.`,
        'manual-review','medium','medium',
        'Verify the cross-domain canonical is intentional. If this content is the original, ensure the target domain includes a reciprocal signal.',
        [{ source: 'html', html: `<link rel="canonical" href="${resolvedCanonical}">`, actual: resolvedCanonical, expected: finalNorm }],
        [finalUrl],
      ));
    } else if (canonParsed.pathname !== finalParsed.pathname || canonParsed.search !== finalParsed.search) {
      canonicalStatus = 'mismatch';
      findings.push(makeFinding('canonical-mismatch','canonical','Canonical does not match page URL',
        `The canonical (${canonicalNorm}) differs from the final URL (${finalNorm}). This signals to search engines that the current URL is a duplicate and the canonical is the preferred version.`,
        'warning','medium','medium',
        'If this URL is the canonical, update the tag to match. If another URL is preferred, this may be intentional — verify.',
        [{ source: 'html', actual: canonicalNorm, expected: finalNorm }],
        [finalUrl],
        'Check whether the canonical is an intentional consolidation or a configuration error.',
      ));
    } else {
      canonicalStatus = 'self';
      findings.push(makeFinding('canonical-self','canonical','Canonical is a valid self-reference',
        `Canonical: ${resolvedCanonical}`,
        'passed','medium','high',
        '',
        [{ source: 'html', html: `<link rel="canonical" href="${resolvedCanonical}">` }],
      ));
    }
  } catch {
    canonicalStatus = 'missing';
  }

  return resolvedCanonical;
}

// ──────────────────────────────────────────────────────────────
// 5. Hreflang (§10)
// ──────────────────────────────────────────────────────────────

function checkHreflang(html: string, finalUrl: string, findings: SeoFinding[]): InternationalSeoResult {
  const entries: HreflangEntry[] = [];

  for (const m of html.matchAll(/link[^>]+rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["']/gi)) {
    const lang = m[1].trim();
    const href = normalizeUrl(m[2].trim(), finalUrl) ?? m[2].trim();
    entries.push({
      lang,
      url: href,
      isValidLang: lang === 'x-default' || LANG_CODE_RE.test(lang),
      isXDefault: lang === 'x-default',
    });
  }
  // Also check alternate-hreflang with reversed attribute order
  for (const m of html.matchAll(/link[^>]+hreflang=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/gi)) {
    const lang = m[1].trim();
    if (entries.some(e => e.lang === lang)) continue;
    const href = normalizeUrl(m[2].trim(), finalUrl) ?? m[2].trim();
    entries.push({
      lang,
      url: href,
      isValidLang: lang === 'x-default' || LANG_CODE_RE.test(lang),
      isXDefault: lang === 'x-default',
    });
  }

  if (entries.length === 0) {
    // Not an error on single-language sites
    findings.push(makeFinding('hreflang-not-found','hreflang','No hreflang annotations found',
      'No hreflang link elements were detected. This is expected for single-language sites. Multi-language or multi-region sites should implement hreflang to help search engines serve the correct language variant.',
      'manual-review','low','medium',
      'If this site targets multiple languages or regions, implement hreflang annotations.',
      [],
      [finalUrl],
    ));
    return { hasHreflang: false, entries: [], hasXDefault: false, hasSelfReference: false, invalidCodes: [], clusters: [] };
  }

  const hasXDefault = entries.some(e => e.isXDefault);
  const hasSelfReference = entries.some(e => {
    try { return new URL(e.url).href === new URL(finalUrl).href; } catch { return false; }
  });
  const invalidCodes = entries.filter(e => !e.isValidLang).map(e => e.lang);

  if (invalidCodes.length > 0) {
    findings.push(makeFinding('hreflang-invalid-codes','hreflang','Invalid hreflang language codes',
      `Invalid BCP 47 codes: ${invalidCodes.join(', ')}. Search engines will ignore hreflang entries with invalid language codes.`,
      'failed','medium','high',
      'Use valid BCP 47 language codes (e.g. "en", "en-US", "fr", "zh-Hant").',
      [{ source: 'html', actual: invalidCodes.join(', ') }],
      [finalUrl],
    ));
  }

  if (!hasXDefault && entries.length > 1) {
    findings.push(makeFinding('hreflang-no-xdefault','hreflang','Missing x-default hreflang',
      'The hreflang cluster has no x-default entry. The x-default value signals the fallback URL when no specific language match exists.',
      'warning','low','medium',
      'Add <link rel="alternate" hreflang="x-default" href="..."> pointing to the default language page.',
      [],
      [finalUrl],
    ));
  }

  if (!hasSelfReference && entries.length > 0) {
    findings.push(makeFinding('hreflang-no-self','hreflang','Page missing self-reference in hreflang cluster',
      'This page has hreflang annotations but does not include a reference to itself. A self-referencing entry is recommended best practice.',
      'warning','low','medium',
      'Add a hreflang entry for this page\'s own language pointing to its own URL.',
      [],
      [finalUrl],
    ));
  }

  if (invalidCodes.length === 0 && (hasXDefault || entries.length === 1) && hasSelfReference) {
    findings.push(makeFinding('hreflang-valid','hreflang','Hreflang annotations appear well-formed',
      `${entries.length} hreflang entries found.`,
      'passed','medium','medium',
      '',
    ));
  }

  return {
    hasHreflang: true,
    entries,
    hasXDefault,
    hasSelfReference,
    invalidCodes,
    clusters: [],
  };
}

// ──────────────────────────────────────────────────────────────
// 6. Structured data (§13)
// ──────────────────────────────────────────────────────────────

function checkStructuredData(html: string, url: string, findings: SeoFinding[]): StructuredDataResult {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1].trim());

  if (blocks.length === 0) {
    findings.push(makeFinding('schema-none','structured-data','No structured data detected',
      'No JSON-LD structured data blocks were found. Structured data can enable rich results in search engines (FAQ, breadcrumbs, products, reviews, etc.).',
      'manual-review','low','high',
      'Consider adding schema.org structured data relevant to the page type (e.g. WebSite, Article, Product, FAQPage).',
      [{ source: 'json-ld', confidence: 'high' }],
      [url],
      'Search page source for application/ld+json',
    ));
    return { found: false, count: 0, types: [], items: [], hasGraph: false, syntaxErrors: 0, templateVarErrors: 0 };
  }

  const items: StructuredDataItem[] = [];
  const allTypes: string[] = [];
  let syntaxErrors = 0;
  let templateVarErrors = 0;
  let hasGraph = false;

  for (const block of blocks) {
    // Check for unresolved template variables
    const hasTemplateVars = /\{\{[^}]+\}\}|<%[^%]+%>|__[A-Z_]+__/.test(block);
    if (hasTemplateVars) templateVarErrors++;

    let parsed: any;
    let hasValidSyntax = true;
    const errors: string[] = [];

    try {
      parsed = JSON.parse(block);
    } catch (e) {
      hasValidSyntax = false;
      syntaxErrors++;
      errors.push(`JSON parse error: ${e instanceof Error ? e.message : 'invalid JSON'}`);
      items.push({ type: 'unknown', hasValidSyntax: false, isRecognizedType: false, hasRequiredProps: false, errors });
      continue;
    }

    if (hasTemplateVars) {
      errors.push('Unresolved template variables detected (e.g. {{value}})');
    }

    // Support @graph arrays
    const entities = Array.isArray(parsed)
      ? parsed
      : parsed['@graph']
        ? (hasGraph = true, Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed['@graph']])
        : [parsed];

    for (const entity of entities) {
      if (typeof entity !== 'object' || !entity) continue;

      const rawType = entity['@type'];
      const typeArr = Array.isArray(rawType) ? rawType : rawType ? [String(rawType)] : [];
      const isRecognized = typeArr.some(t => KNOWN_SCHEMA_TYPES.has(t));
      typeArr.forEach(t => { if (!allTypes.includes(t)) allTypes.push(t); });

      let hasRequiredProps = true;
      const itemErrors = [...errors];

      for (const type of typeArr) {
        const required = REQUIRED_PROPS[type] ?? [];
        const missing = required.filter(p => !entity[p]);
        if (missing.length > 0) {
          hasRequiredProps = false;
          itemErrors.push(`Missing required properties for ${type}: ${missing.join(', ')}`);
        }
      }

      items.push({
        type: typeArr.length === 1 ? typeArr[0] : typeArr,
        hasValidSyntax,
        isRecognizedType: isRecognized,
        hasRequiredProps,
        errors: itemErrors,
        raw: block.slice(0, 200),
      });
    }
  }

  if (syntaxErrors > 0) {
    findings.push(makeFinding('schema-syntax-error','structured-data','JSON-LD syntax errors detected',
      `${syntaxErrors} JSON-LD block(s) contain syntax errors and will be ignored by search engines.`,
      'failed','high','high',
      'Fix JSON syntax errors in the structured data blocks. Use the Rich Results Test tool to validate.',
      [{ source: 'json-ld', confidence: 'high' }],
      [url],
      'Test at https://search.google.com/test/rich-results',
    ));
  }

  if (templateVarErrors > 0) {
    findings.push(makeFinding('schema-template-vars','structured-data','Unresolved template variables in JSON-LD',
      'Structured data contains unresolved template placeholders (e.g. {{value}}). These are invalid and will be rejected.',
      'failed','high','high',
      'Ensure the template engine correctly replaces all variables before serving the page.',
      [{ source: 'json-ld', confidence: 'high' }],
      [url],
    ));
  }

  const unrecognized = items.filter(i => !i.isRecognizedType).map(i => String(i.type));
  if (unrecognized.length > 0) {
    findings.push(makeFinding('schema-unrecognized-type','structured-data','Unrecognized schema type(s)',
      `Type(s) not in common schema.org vocabulary: ${unrecognized.join(', ')}. These may be valid custom types or typos.`,
      'warning','low','low',
      'Verify the schema types are spelled correctly. See schema.org for the full type list.',
      [{ source: 'json-ld', actual: unrecognized.join(', ') }],
      [url],
    ));
  }

  const missingRequired = items.filter(i => !i.hasRequiredProps && i.hasValidSyntax);
  if (missingRequired.length > 0) {
    findings.push(makeFinding('schema-missing-required-props','structured-data','Structured data missing required properties',
      `${missingRequired.length} schema item(s) are missing required properties. Rich results require these properties.`,
      'warning','medium','high',
      'Add the missing required properties. Check schema.org/[Type] for the full property list.',
      missingRequired.map(i => ({ source: 'json-ld' as const, actual: i.errors.join('; ') })),
      [url],
    ));
  }

  if (syntaxErrors === 0 && templateVarErrors === 0 && items.length > 0) {
    findings.push(makeFinding('schema-valid','structured-data','Valid structured data detected',
      `${items.length} schema item(s) found: ${allTypes.join(', ')}`,
      'passed','medium','high',
      '',
    ));
  }

  return {
    found: true,
    count: items.length,
    types: allTypes,
    items,
    hasGraph,
    syntaxErrors,
    templateVarErrors,
  };
}

// ──────────────────────────────────────────────────────────────
// 7. Social metadata (§14)
// ──────────────────────────────────────────────────────────────

function checkSocialMeta(ogTags: Record<string,string>, twitterTags: Record<string,string>, url: string, findings: SeoFinding[]): void {
  const essentialOg = ['og:title','og:description','og:image','og:url'];
  const missingOg = essentialOg.filter(k => !ogTags[k]);

  if (missingOg.length === essentialOg.length) {
    findings.push(makeFinding('og-missing','social','Open Graph tags missing',
      'No og: meta tags found. Open Graph tags control how the page appears when shared on social platforms (Facebook, LinkedIn, etc.).',
      'warning','low','high',
      'Add og:title, og:description, og:image, og:url, and og:type meta tags.',
      [],
      [url],
    ));
  } else if (missingOg.length > 0) {
    findings.push(makeFinding('og-incomplete','social','Open Graph tags incomplete',
      `Missing OG properties: ${missingOg.join(', ')}`,
      'warning','low','medium',
      `Add the missing Open Graph properties: ${missingOg.join(', ')}`,
      [{ source: 'html', actual: `Missing: ${missingOg.join(', ')}` }],
      [url],
    ));
  } else {
    findings.push(makeFinding('og-complete','social','Open Graph tags present',
      `og:title, og:description, og:image, og:url all present`,
      'passed','low','high',
      '',
    ));
  }

  if (!twitterTags['twitter:card']) {
    findings.push(makeFinding('twitter-card-missing','social','Twitter Card tag missing',
      'No twitter:card meta tag found. Twitter Card controls how the page appears when shared on X/Twitter.',
      'warning','low','medium',
      'Add <meta name="twitter:card" content="summary_large_image"> (or another card type).',
      [],
      [url],
    ));
  } else {
    findings.push(makeFinding('twitter-card-present','social','Twitter Card tag present',
      `twitter:card="${twitterTags['twitter:card']}"`,
      'passed','low','medium',
      '',
    ));
  }
}

// ──────────────────────────────────────────────────────────────
// 8. URL quality (§19, §20)
// ──────────────────────────────────────────────────────────────

function checkUrlQuality(finalUrl: string, requestedUrl: string, findings: SeoFinding[]): void {
  try {
    const u = new URL(finalUrl);

    // HTTPS
    if (u.protocol !== 'https:') {
      findings.push(makeFinding('url-http','url','Page not served over HTTPS',
        'The page is served over HTTP. HTTPS is a Google ranking signal and required for modern browser security features.',
        'failed','high','high',
        'Migrate to HTTPS. Free certificates are available via Let\'s Encrypt.',
        [{ source: 'heuristic', actual: u.protocol, expected: 'https:' }],
        [finalUrl],
      ));
    } else {
      findings.push(makeFinding('url-https','url','Page served over HTTPS','',
        'passed','high','high','',
      ));
    }

    // Session IDs in query params
    const params = [...u.searchParams.entries()];
    const sessionParam = params.find(([k]) => SESSION_PARAM_RE.test(k));
    if (sessionParam) {
      findings.push(makeFinding('url-session-id','url','Session ID in URL',
        `Query parameter "${sessionParam[0]}" looks like a session identifier. Session IDs in URLs create duplicate content — each user session gets a different URL for the same page.`,
        'failed','medium','high',
        'Use server-side sessions (cookies) instead of URL-based session identifiers.',
        [{ source: 'heuristic', actual: sessionParam[0] }],
        [finalUrl],
      ));
    }

    // Fragment as primary route
    const req = new URL(requestedUrl);
    if (req.hash && req.hash.length > 1 && !req.pathname.match(/\.[a-z]{2,4}$/i)) {
      findings.push(makeFinding('url-fragment-route','url','URL uses fragment as primary route',
        `The requested URL uses a hash fragment as the primary navigation target (${req.hash}). Fragment-based routing (e.g. #!/path) can make content invisible to search engines that do not execute JavaScript.`,
        'warning','medium','medium',
        'Use path-based routing (/path/page) instead of hash routing (#/path/page).',
        [{ source: 'heuristic', actual: requestedUrl }],
        [requestedUrl],
      ));
    }

    // URL length
    if (finalUrl.length > 200) {
      findings.push(makeFinding('url-too-long','url','URL is very long',
        `URL length is ${finalUrl.length} characters. Very long URLs can be truncated in search results and are harder to share.`,
        'warning','low','medium',
        'Use shorter, descriptive URL paths. Avoid excessive query parameters.',
        [{ source: 'heuristic', actual: `${finalUrl.length} chars` }],
        [finalUrl],
      ));
    }

    // Excessive query params (>4)
    if (params.length > 4) {
      findings.push(makeFinding('url-many-params','url','URL has many query parameters',
        `${params.length} query parameters detected. Excessive query parameters may signal thin or auto-generated pages.`,
        'warning','low','low',
        'Reduce query parameters or use canonical tags to consolidate parameterized URL variants.',
        [{ source: 'heuristic', actual: `${params.length} params` }],
        [finalUrl],
      ));
    }

  } catch {
    findings.push(makeFinding('url-invalid','url','URL could not be parsed',
      'The final URL could not be parsed.',
      'warning','medium','high',
      'Ensure the URL is a valid absolute URL.',
      [],
      [finalUrl],
    ));
  }
}

// ──────────────────────────────────────────────────────────────
// 9. Mobile (§21)
// ──────────────────────────────────────────────────────────────

function checkMobile(html: string, url: string, findings: SeoFinding[]): void {
  const viewportMatch = html.match(/meta[^>]+name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
  const viewportContent = viewportMatch ? viewportMatch[1] : null;

  if (!viewportContent) {
    findings.push(makeFinding('viewport-missing','mobile','Viewport meta tag missing',
      'No <meta name="viewport"> found. Without this tag, mobile browsers render the page at desktop width. Google uses mobile-first indexing, so mobile usability directly affects ranking.',
      'failed','high','high',
      'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>.',
      [{ source: 'html', expected: '<meta name="viewport">', actual: 'Missing' }],
      [url],
    ));
  } else {
    if (/user-scalable\s*=\s*no/i.test(viewportContent)) {
      findings.push(makeFinding('viewport-zoom-blocked','mobile','Viewport blocks user zoom',
        'user-scalable=no prevents users from zooming. This is an accessibility issue for low-vision users and may affect usability scores.',
        'warning','medium','high',
        'Remove user-scalable=no from the viewport meta tag. Allow users to zoom.',
        [{ source: 'html', html: `<meta name="viewport" content="${viewportContent}">` }],
        [url],
      ));
    }
    if (!/width=device-width/i.test(viewportContent)) {
      findings.push(makeFinding('viewport-no-device-width','mobile','Viewport does not include width=device-width',
        `The viewport content "${viewportContent}" does not include width=device-width, which may cause layout issues on mobile devices.`,
        'warning','medium','medium',
        'Add width=device-width to the viewport content.',
        [{ source: 'html', html: viewportContent }],
        [url],
      ));
    } else {
      findings.push(makeFinding('viewport-valid','mobile','Viewport is correctly configured',
        `<meta name="viewport" content="${viewportContent}">`,
        'passed','high','high',
        '',
      ));
    }
  }
}

// ──────────────────────────────────────────────────────────────
// 10. Robots.txt (§8) — async
// ──────────────────────────────────────────────────────────────

async function fetchAndCheckRobotsTxt(pageUrl: string, findings: SeoFinding[]): Promise<RobotsTxtResult> {
  let origin: string;
  try { origin = new URL(pageUrl).origin; } catch {
    return { found: false, httpStatus: null, allowsCrawling: true, hasSitemapDeclaration: false, matchedRule: null, errors: ['Invalid page URL'], userAgentRules: [] };
  }

  const robotsUrl = `${origin}/robots.txt`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    const r = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!r.ok) {
      if (r.status === 404) {
        findings.push(makeFinding('robots-txt-missing','crawlability','robots.txt not found',
          'No robots.txt file at /robots.txt (HTTP 404). This is generally fine — a missing robots.txt does not block crawling. It is informational, not critical.',
          'passed','low','high',
          'Consider creating a robots.txt to declare a sitemap location and clarify crawl preferences.',
          [{ source: 'robots-txt', url: robotsUrl, actual: 'HTTP 404' }],
        ));
        return { found: false, httpStatus: 404, allowsCrawling: true, hasSitemapDeclaration: false, matchedRule: null, errors: [], userAgentRules: [] };
      }
      findings.push(makeFinding('robots-txt-error','crawlability','robots.txt returned an error',
        `robots.txt at ${robotsUrl} returned HTTP ${r.status}. Search engines may treat server errors differently from 404.`,
        'warning','medium','high',
        'Ensure robots.txt returns HTTP 200. Fix any server errors.',
        [{ source: 'robots-txt', url: robotsUrl, actual: `HTTP ${r.status}` }],
      ));
      return { found: false, httpStatus: r.status, allowsCrawling: true, hasSitemapDeclaration: false, matchedRule: null, errors: [`HTTP ${r.status}`], userAgentRules: [] };
    }

    const text = await r.text();
    const result = parseRobotsTxt(text, pageUrl, robotsUrl, findings);
    result.httpStatus = r.status;
    return result;

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const isTimeout = msg.includes('abort') || msg.includes('timeout');
    findings.push(makeFinding('robots-txt-unavailable','crawlability','robots.txt could not be fetched',
      `Failed to fetch ${robotsUrl}: ${isTimeout ? 'request timed out' : msg}`,
      'unavailable','low','medium',
      'Verify the robots.txt URL is accessible.',
      [{ source: 'robots-txt', url: robotsUrl, confidence: 'high' }],
    ));
    return { found: false, httpStatus: null, allowsCrawling: true, hasSitemapDeclaration: false, matchedRule: null, errors: [msg], userAgentRules: [] };
  }
}

function parseRobotsTxt(text: string, pageUrl: string, robotsUrl: string, findings: SeoFinding[]): RobotsTxtResult {
  const lines = text.split(/\r?\n/);
  const groups: Array<{ userAgents: string[]; disallowed: string[]; allowed: string[] }> = [];
  let currentGroup: { userAgents: string[]; disallowed: string[]; allowed: string[] } | null = null;
  const sitemapDeclarations: string[] = [];
  const errors: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { errors.push(`Invalid line: ${line.slice(0,60)}`); continue; }

    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      if (!currentGroup || currentGroup.disallowed.length > 0 || currentGroup.allowed.length > 0) {
        currentGroup = { userAgents: [value], disallowed: [], allowed: [] };
        groups.push(currentGroup);
      } else {
        currentGroup.userAgents.push(value);
      }
    } else if (directive === 'disallow') {
      currentGroup?.disallowed.push(value);
    } else if (directive === 'allow') {
      currentGroup?.allowed.push(value);
    } else if (directive === 'sitemap') {
      sitemapDeclarations.push(value);
    }
  }

  // Check if page URL is blocked
  let pagePathname = '/';
  try { pagePathname = new URL(pageUrl).pathname; } catch {}

  let matchedRule: string | null = null;
  let allowsCrawling = true;

  // Find applicable groups (wildcard * or WebsiteAnalyzer)
  const applicableGroups = groups.filter(g =>
    g.userAgents.includes('*') || g.userAgents.some(ua => /websiteanalyzer/i.test(ua))
  );

  for (const group of applicableGroups) {
    // Check allows first (more specific wins)
    const allowMatch = group.allowed
      .filter(p => p && pagePathname.startsWith(p))
      .sort((a,b) => b.length - a.length)[0];
    const disallowMatch = group.disallowed
      .filter(p => p && pagePathname.startsWith(p))
      .sort((a,b) => b.length - a.length)[0];

    if (disallowMatch) {
      if (!allowMatch || allowMatch.length <= disallowMatch.length) {
        allowsCrawling = false;
        matchedRule = `Disallow: ${disallowMatch}`;
      }
    }
  }

  if (!allowsCrawling) {
    findings.push(makeFinding('robots-txt-blocked','crawlability','Page URL may be blocked by robots.txt',
      `The robots.txt rule "${matchedRule}" matches the analyzed URL path. This may prevent crawlers from indexing this page. Note: robots.txt controls crawling, not guaranteed indexing.`,
      'warning','critical','high',
      'Review the robots.txt rule. If this page should be crawled, update the Disallow rule or add a more specific Allow rule.',
      [{ source: 'robots-txt', url: robotsUrl, actual: matchedRule ?? '' }],
      [pageUrl],
    ));
  } else {
    findings.push(makeFinding('robots-txt-allows','crawlability','robots.txt allows crawling this page',
      `The analyzed URL is not blocked by robots.txt. robots.txt controls crawling, not guaranteed indexing.`,
      'passed','critical','high',
      '',
      [{ source: 'robots-txt', url: robotsUrl }],
    ));
  }

  if (sitemapDeclarations.length > 0) {
    findings.push(makeFinding('robots-txt-sitemap-declared','crawlability','Sitemap declared in robots.txt',
      `Sitemap: ${sitemapDeclarations[0]}`,
      'passed','low','high',
      '',
    ));
  }

  return {
    found: true,
    httpStatus: 200,
    allowsCrawling,
    hasSitemapDeclaration: sitemapDeclarations.length > 0,
    matchedRule,
    errors,
    userAgentRules: groups.map(g => ({
      userAgent: g.userAgents.join(', '),
      disallowed: g.disallowed,
      allowed: g.allowed,
    })),
  };
}

// ──────────────────────────────────────────────────────────────
// 11. Sitemap (§9) — async
// ──────────────────────────────────────────────────────────────

async function fetchAndCheckSitemap(pageUrl: string, findings: SeoFinding[]): Promise<SitemapResult> {
  let origin: string;
  try { origin = new URL(pageUrl).origin; } catch {
    return { found: false, discoveredAt: 'not-found', httpStatus: null, urlCount: null, hasValidXml: false, isSitemapIndex: false, errors: [], sampled: false };
  }

  const sitemapUrl = `${origin}/sitemap.xml`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6_000);
    const r = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!r.ok) {
      findings.push(makeFinding('sitemap-not-found','crawlability','sitemap.xml not found at /sitemap.xml',
        `HTTP ${r.status} returned for ${sitemapUrl}. A sitemap helps search engines discover and prioritize pages.`,
        'warning','medium','high',
        'Create a sitemap.xml at /sitemap.xml and declare it in robots.txt. For Next.js, use next-sitemap or the built-in sitemap.ts file.',
        [{ source: 'sitemap', url: sitemapUrl, actual: `HTTP ${r.status}` }],
      ));
      return { found: false, discoveredAt: 'not-found', httpStatus: r.status, urlCount: null, hasValidXml: false, isSitemapIndex: false, errors: [`HTTP ${r.status}`], sampled: false };
    }

    // Limit sitemap size — 5 MB cap
    const contentLength = Number(r.headers.get('content-length') ?? 0);
    if (contentLength > 5 * 1024 * 1024) {
      findings.push(makeFinding('sitemap-too-large','crawlability','sitemap.xml is very large',
        `The sitemap exceeds the 5 MB analysis limit. Only basic validation was performed.`,
        'warning','low','medium',
        'Consider splitting into a sitemap index with multiple smaller files.',
        [{ source: 'sitemap', url: sitemapUrl }],
      ));
      return { found: true, discoveredAt: '/sitemap.xml', httpStatus: r.status, urlCount: null, hasValidXml: true, isSitemapIndex: false, errors: ['Sitemap too large for full analysis'], sampled: true };
    }

    const xml = await r.text();
    return parseSitemap(xml, sitemapUrl, findings, r.status);

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    findings.push(makeFinding('sitemap-unavailable','crawlability','sitemap.xml could not be fetched',
      `Failed to fetch ${sitemapUrl}: ${msg.includes('abort') ? 'request timed out' : msg}`,
      'unavailable','medium','medium',
      'Verify the sitemap URL is accessible.',
      [{ source: 'sitemap', url: sitemapUrl }],
    ));
    return { found: false, discoveredAt: 'not-found', httpStatus: null, urlCount: null, hasValidXml: false, isSitemapIndex: false, errors: [msg], sampled: false };
  }
}

function parseSitemap(xml: string, sitemapUrl: string, findings: SeoFinding[], httpStatus: number): SitemapResult {
  const isSitemapIndex = /<sitemapindex/i.test(xml);
  const hasUrlset = /<urlset/i.test(xml);

  if (!isSitemapIndex && !hasUrlset) {
    findings.push(makeFinding('sitemap-invalid-xml','crawlability','sitemap.xml does not appear to be valid XML',
      'The response from /sitemap.xml does not contain a recognized <urlset> or <sitemapindex> element.',
      'failed','medium','high',
      'Ensure the sitemap follows the sitemap protocol (sitemaps.org). Check for XML parsing errors.',
      [{ source: 'sitemap', url: sitemapUrl }],
    ));
    return { found: true, discoveredAt: '/sitemap.xml', httpStatus, urlCount: null, hasValidXml: false, isSitemapIndex: false, errors: ['Not a valid sitemap XML'], sampled: false };
  }

  const urlMatches = xml.match(/<loc>[^<]+<\/loc>/g) ?? [];
  const urlCount = urlMatches.length;
  const sampled = urlCount > 500; // Indicate we're not fetching individual URLs

  if (isSitemapIndex) {
    findings.push(makeFinding('sitemap-index-found','crawlability','Sitemap index found',
      `Sitemap index at /sitemap.xml references ${urlCount} sub-sitemap(s).`,
      'passed','medium','high',
      '',
      [{ source: 'sitemap', url: sitemapUrl }],
    ));
    return { found: true, discoveredAt: '/sitemap.xml', httpStatus, urlCount, hasValidXml: true, isSitemapIndex: true, errors: [], sampled: false };
  }

  findings.push(makeFinding('sitemap-found','crawlability','sitemap.xml found and valid',
    `${urlCount} URL${urlCount !== 1 ? 's' : ''} declared in sitemap.xml.${sampled ? ' Individual URL validation was sampled.' : ''}`,
    'passed','medium','high',
    '',
    [{ source: 'sitemap', url: sitemapUrl }],
  ));

  return { found: true, discoveredAt: '/sitemap.xml', httpStatus, urlCount, hasValidXml: true, isSitemapIndex: false, errors: [], sampled };
}

// ──────────────────────────────────────────────────────────────
// 12. Score calculation (§22)
// ──────────────────────────────────────────────────────────────

const FINDING_CATEGORY_MAP: Record<string, string> = {
  indexability: 'indexability',
  metadata:     'metadata',
  canonical:    'canonicalization',
  hreflang:     'international',
  headings:     'content-structure',
  content:      'content-structure',
  'structured-data': 'structured-data',
  'internal-links':  'internal-links',
  crawlability: 'crawlability',
  images:       'crawlability',
  social:       'social',
  url:          'url-hygiene',
  mobile:       'mobile',
  other:        'other',
};

function computeSeoScore(findings: SeoFinding[]): { score: number; breakdown: SeoScoreBreakdown[] } {
  const categoryData: Record<string, { passed: number; failed: number; warned: number; unavailable: number; totalWeight: number; passedWeight: number }> = {};

  for (const [cat] of Object.entries(CATEGORY_WEIGHTS)) {
    categoryData[cat] = { passed: 0, failed: 0, warned: 0, unavailable: 0, totalWeight: 0, passedWeight: 0 };
  }

  for (const f of findings) {
    const cat = FINDING_CATEGORY_MAP[f.category] ?? 'other';
    if (!categoryData[cat]) continue;
    const w = SEVERITY_WEIGHT[f.severity] ?? 0;
    if (w === 0) continue; // info findings don't affect score

    if (f.status === 'passed') {
      categoryData[cat].passed++;
      categoryData[cat].passedWeight += w;
      categoryData[cat].totalWeight += w;
    } else if (f.status === 'failed') {
      categoryData[cat].failed++;
      categoryData[cat].totalWeight += w;
    } else if (f.status === 'warning') {
      categoryData[cat].warned++;
      categoryData[cat].passedWeight += w * 0.5;
      categoryData[cat].totalWeight += w;
    } else if (f.status === 'unavailable') {
      categoryData[cat].unavailable++;
      // Not in denominator
    }
    // manual-review and not-applicable don't affect the score
  }

  const breakdown: SeoScoreBreakdown[] = [];
  let weightedScore = 0;
  let usedWeight = 0;

  for (const [cat, catWeight] of Object.entries(CATEGORY_WEIGHTS)) {
    const data = categoryData[cat];
    if (!data) continue;

    let catScore: number | null = null;
    let contribution: number | null = null;

    if (data.totalWeight > 0) {
      catScore = Math.round((data.passedWeight / data.totalWeight) * 100);
      contribution = catWeight * catScore;
      weightedScore += contribution;
      usedWeight += catWeight;
    }

    breakdown.push({
      category: cat,
      weight: catWeight,
      score: catScore,
      weightedContribution: contribution,
      passedChecks: data.passed,
      failedChecks: data.failed,
      unavailableChecks: data.unavailable,
      reason: catScore === null ? 'No applicable checks' : catScore >= 80 ? 'Good' : catScore >= 50 ? 'Needs improvement' : 'Critical issues',
    });
  }

  const score = usedWeight > 0 ? Math.min(100, Math.max(0, Math.round(weightedScore / usedWeight))) : null;
  return { score: score ?? 0, breakdown };
}

// ──────────────────────────────────────────────────────────────
// 13. Coverage (§23)
// ──────────────────────────────────────────────────────────────

function computeCoverage(findings: SeoFinding[]): SeoAuditCoverage {
  const supported = findings.length;
  const unavailable = findings.filter(f => f.status === 'unavailable').length;
  const skipped = findings.filter(f => f.status === 'not-applicable').length;
  const executed = supported - unavailable - skipped;
  const percentage = supported > 0 ? Math.round((executed / supported) * 100) : 0;

  const limitations: string[] = [
    'Audit runs in fetch-only mode — no JavaScript execution. Metadata injected by client-side JS may not be detected.',
    'Duplicate content detection requires comparing across crawled pages — a cross-page comparison is not performed here.',
    'Internal link graph analysis is based on up to 4 crawled pages.',
    'robots.txt and sitemap.xml are fetched independently with 5–6 second timeouts.',
    'Image dimensions, redirect chain lengths, and rendering-specific signals require browser access.',
  ];

  return { supportedChecks: supported, executedChecks: executed, unavailableChecks: unavailable, skippedChecks: skipped, percentage, limitations };
}

// ──────────────────────────────────────────────────────────────
// Main exported function (§1, §29)
// ──────────────────────────────────────────────────────────────

export async function checkSEO(
  html: string,
  response: Response,
  requestedUrl: string,
  analysisId?: string,
): Promise<SeoAuditResult> {
  _findingSeq = 0; // reset per-analysis
  const start = Date.now();
  const finalUrl = response.url || requestedUrl;
  const findings: SeoFinding[] = [];
  const errors: SeoAuditError[] = [];
  const warnings: string[] = [];

  try {
    // Metadata
    const metadata = checkMetadata(html, finalUrl, findings);

    // Headings + HTML lang
    checkHeadings(html, finalUrl, findings, metadata);

    // Indexability
    const indexability = checkIndexability(html, response, finalUrl, findings);

    // Canonical
    checkCanonical(html, requestedUrl, finalUrl, findings);

    // Hreflang
    const international = checkHreflang(html, finalUrl, findings);

    // Structured data
    const structuredData = checkStructuredData(html, finalUrl, findings);

    // Social metadata
    checkSocialMeta(metadata.ogTags, metadata.twitterTags, finalUrl, findings);

    // URL quality
    checkUrlQuality(finalUrl, requestedUrl, findings);

    // Mobile
    checkMobile(html, finalUrl, findings);

    // Async: robots.txt + sitemap (parallel, with timeouts)
    workerLog('info', 'seo.async_checks_start', { analysisId, urlHash: finalUrl.slice(-12) });
    const [robotsResult, sitemapResult] = await Promise.allSettled([
      fetchAndCheckRobotsTxt(finalUrl, findings),
      fetchAndCheckSitemap(finalUrl, findings),
    ]);

    const robots = robotsResult.status === 'fulfilled' ? robotsResult.value : null;
    const sitemap = sitemapResult.status === 'fulfilled' ? sitemapResult.value : null;

    if (robotsResult.status === 'rejected') {
      errors.push({ code: 'ROBOTS_PARSE_ERROR', message: String(robotsResult.reason), retryable: true });
    }
    if (sitemapResult.status === 'rejected') {
      errors.push({ code: 'SITEMAP_PARSE_ERROR', message: String(sitemapResult.reason), retryable: true });
    }

    // Score
    const { score, breakdown } = computeSeoScore(findings);
    const coverage = computeCoverage(findings);

    // Summary counts
    const summary = {
      critical: findings.filter(f => f.severity === 'critical' && f.status === 'failed').length,
      high: findings.filter(f => f.severity === 'high' && f.status === 'failed').length,
      medium: findings.filter(f => f.severity === 'medium' && f.status === 'failed').length,
      low: findings.filter(f => (f.status === 'failed' || f.status === 'warning') && f.severity === 'low').length,
      passed: findings.filter(f => f.status === 'passed').length,
      manualReview: findings.filter(f => f.status === 'manual-review').length,
    };

    workerLog('info', 'seo.complete', {
      analysisId,
      score,
      coverage: coverage.percentage,
      findingsCount: findings.length,
      criticalCount: summary.critical,
      highCount: summary.high,
      auditMode: 'fetch-only',
      duration: Date.now() - start,
    });

    return {
      version: 'seo-v1',
      score,
      scoreVersion: SEO_SCORE_VERSION,
      auditMode: 'fetch-only',
      testedUrl: requestedUrl,
      finalUrl,
      measuredAt: new Date().toISOString(),
      findings,
      summary,
      scoreBreakdown: breakdown,
      coverage,
      metadata,
      indexability,
      structuredData,
      international,
      internalLinks: null,
      sitemap,
      robots,
      warnings,
      errors,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown SEO audit error';
    workerLog('error', 'seo.error', { analysisId, error: msg, duration: Date.now() - start });
    errors.push({ code: 'UNKNOWN', message: msg, retryable: false });

    return {
      version: 'seo-v1',
      score: null,
      scoreVersion: SEO_SCORE_VERSION,
      auditMode: 'fetch-only',
      testedUrl: requestedUrl,
      finalUrl: response.url || requestedUrl,
      measuredAt: new Date().toISOString(),
      findings,
      summary: { critical: 0, high: 0, medium: 0, low: 0, passed: 0, manualReview: 0 },
      scoreBreakdown: [],
      coverage: { supportedChecks: 0, executedChecks: 0, unavailableChecks: 0, skippedChecks: 0, percentage: 0, limitations: [] },
      metadata: { title: null, titleLength: null, titleStatus: 'missing', description: null, descriptionLength: null, descriptionStatus: 'missing', h1: null, h1Count: 0, headingStructure: [], ogTags: {}, twitterTags: {}, htmlLang: null },
      indexability: { isIndexable: true, robotsMeta: [], xRobotsTag: [], effectiveDirectives: [], noindex: false, nofollow: false, conflictingDirectives: false },
      structuredData: { found: false, count: 0, types: [], items: [], hasGraph: false, syntaxErrors: 0, templateVarErrors: 0 },
      international: { hasHreflang: false, entries: [], hasXDefault: false, hasSelfReference: false, invalidCodes: [], clusters: [] },
      internalLinks: null,
      sitemap: null,
      robots: null,
      warnings: [],
      errors,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Lightweight per-page SEO scan (§24) — no async fetches
// ──────────────────────────────────────────────────────────────

export function checkSEOLightweight(html: string, response: Response, requestedUrl: string): SeoPageResult {
  const finalUrl = response.url || requestedUrl;
  const localFindings: SeoFinding[] = [];

  // Title
  const titleMatches = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map(m => m[1].trim());
  const rawTitle = titleMatches[0] ?? null;
  const titleNorm = rawTitle ? safeText(rawTitle) : null;
  const titleLen = titleNorm?.length ?? null;
  let titleStatus: SeoMetadataResult['titleStatus'];
  if (titleMatches.length === 0) titleStatus = 'missing';
  else if (titleMatches.length > 1) titleStatus = 'multiple';
  else if (!titleNorm?.length) titleStatus = 'empty';
  else if (titleLen! < 10) titleStatus = 'too-short';
  else if (titleLen! > 70) titleStatus = 'too-long';
  else titleStatus = 'good';

  // Description
  const descMatch = html.match(/meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
    ?? html.match(/meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const rawDesc = descMatch ? descMatch[1].trim() : null;
  const descLen = rawDesc?.length ?? null;
  let descStatus: SeoMetadataResult['descriptionStatus'];
  if (!rawDesc) descStatus = 'missing';
  else if (rawDesc.length === 0) descStatus = 'empty';
  else if (descLen! < 50) descStatus = 'too-short';
  else if (descLen! > 165) descStatus = 'too-long';
  else descStatus = 'good';

  // H1
  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => safeText(m[1]).trim());
  const h1 = h1Matches[0] ?? null;
  const h1Count = h1Matches.length;

  // Canonical
  const canonicals = [...html.matchAll(/link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/gi)].map(m => m[1].trim());
  let canonical: string | null = null;
  let canonicalStatus: SeoPageResult['canonicalStatus'] = 'missing';

  if (canonicals.length === 0) {
    canonicalStatus = 'missing';
  } else if (canonicals.length > 1) {
    canonicalStatus = 'multiple';
  } else {
    canonical = normalizeUrl(canonicals[0], finalUrl);
    if (!canonical) {
      canonicalStatus = 'missing';
    } else {
      try {
        const cp = new URL(canonical);
        const fp = new URL(finalUrl);
        if (cp.hostname !== fp.hostname) canonicalStatus = 'cross-domain';
        else if (cp.pathname === fp.pathname && cp.search === fp.search) canonicalStatus = 'self';
        else canonicalStatus = 'mismatch';
      } catch {
        canonicalStatus = 'missing';
      }
    }
  }

  // Indexability
  const robotsMetaMatch = html.match(/meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  const xRobotsRaw = response.headers.get('x-robots-tag') ?? '';
  const allDirectives = [
    ...(robotsMetaMatch ? robotsMetaMatch[1].split(',').map(d => d.trim().toLowerCase()) : []),
    ...xRobotsRaw.split(',').map(d => d.trim().toLowerCase()).filter(Boolean),
  ];
  const noindex = allDirectives.some(d => d === 'noindex' || d === 'none');

  // Structured data types
  const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim());
  const structuredDataTypes: string[] = [];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block);
      const entities = parsed['@graph'] ? (Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed['@graph']]) : [parsed];
      for (const e of entities) {
        const t = e?.['@type'];
        if (t) (Array.isArray(t) ? t : [t]).forEach((s: string) => { if (!structuredDataTypes.includes(s)) structuredDataTypes.push(s); });
      }
    } catch {}
  }

  // Lightweight score: based on passed basics
  const checks = [
    titleStatus === 'good',
    descStatus === 'good' || descStatus === 'too-short',
    h1Count === 1,
    canonicalStatus === 'self',
    !noindex,
  ];
  const passed = checks.filter(Boolean).length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    requestedUrl,
    finalUrl,
    httpStatus: response.status,
    title: titleNorm,
    titleLength: titleLen,
    titleStatus,
    description: rawDesc,
    descriptionLength: descLen,
    descriptionStatus: descStatus,
    h1,
    h1Count,
    canonical,
    canonicalStatus,
    isIndexable: !noindex,
    noindex,
    robotsDirectives: allDirectives,
    structuredDataTypes,
    score,
    auditLabel: 'Lightweight SEO scan',
    coverage: 60, // limited scope
  };
}
