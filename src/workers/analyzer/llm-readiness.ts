import type {
  LlmReadinessAuditResult,
  LlmReadinessFinding,
  LlmReadinessCategoryScore,
  LlmReadinessCoverage,
  LlmDetectedSignals,
  LlmReadinessStatus,
  LlmReadinessSeverity,
  LlmReadinessCategory,
  LlmReadinessSource,
  LlmReadinessEvidence,
  AiCrawlerAccess,
  LlmReadinessPageResult,
} from '../../types/llm-readiness';
import {
  AI_CRAWLERS,
  AI_CRAWLER_CONFIG_VERSION,
  parseRobotsTxt,
  checkRobotsAccess,
} from './ai-crawlers';

const SCORE_VERSION = 'llm-readiness-v2';
const AUDIT_MODE = 'fetch-only' as const;
const MAX_ROBOTS_BYTES = 512_000;
const MAX_LLMS_TXT_BYTES = 128_000;
const FETCH_TIMEOUT_MS = 6_000;

// Category weights — sum = 1.0
const CATEGORY_WEIGHTS: Record<LlmReadinessCategory, number> = {
  'crawlability':         0.25,
  'content-accessibility':0.20,
  'semantic-structure':   0.15,
  'entity-clarity':       0.12,
  'structured-data':      0.10,
  'citation-readiness':   0.08,
  'authorship':           0.05,
  'freshness':            0.03,
  'machine-guidance':     0.02,
  'other':                0.00,
};

const CATEGORY_LABELS: Record<LlmReadinessCategory, string> = {
  'crawlability':         'AI Crawlability',
  'content-accessibility':'Content Accessibility',
  'semantic-structure':   'Semantic Structure',
  'entity-clarity':       'Entity Clarity',
  'structured-data':      'Structured Data',
  'citation-readiness':   'Citation Readiness',
  'authorship':           'Authorship & Provenance',
  'freshness':            'Content Freshness',
  'machine-guidance':     'Machine-Readable Guidance',
  'other':                'Other',
};

// Per-signal weights within their category (must sum to 1.0 per category)
const SIGNAL_WEIGHTS: Record<string, number> = {
  // crawlability
  'crl-http-ok':         0.35,
  'crl-robots-meta':     0.25,
  'crl-x-robots':        0.20,
  'crl-robots-txt':      0.20,
  // content-accessibility
  'ca-title':            0.20,
  'ca-meta-desc':        0.20,
  'ca-main-content':     0.30,
  'ca-main-landmark':    0.15,
  'ca-not-js-shell':     0.15,
  // semantic-structure
  'sem-h1':              0.30,
  'sem-heading-order':   0.30,
  'sem-landmarks':       0.25,
  'sem-desc-links':      0.15,
  // entity-clarity
  'ent-org-name':        0.30,
  'ent-about-link':      0.20,
  'ent-contact':         0.20,
  'ent-org-schema':      0.30,
  // structured-data
  'sd-present':          0.30,
  'sd-parseable':        0.30,
  'sd-recognized-types': 0.25,
  'sd-breadcrumb':       0.15,
  // citation-readiness
  'cit-canonical':       0.30,
  'cit-og-tags':         0.25,
  'cit-date-visible':    0.25,
  'cit-stable-url':      0.20,
  // authorship
  'auth-author-visible': 0.40,
  'auth-schema':         0.35,
  'auth-publisher':      0.25,
  // freshness
  'fresh-date-signal':   0.45,
  'fresh-struct-date':   0.35,
  'fresh-last-modified': 0.20,
  // machine-guidance (experimental)
  'mg-llms-txt':         1.00,
};

// ---------- helpers ----------

function makeFinding(
  ruleId: string,
  category: LlmReadinessCategory,
  title: string,
  description: string,
  status: LlmReadinessStatus,
  severity: LlmReadinessSeverity,
  confidence: 'high' | 'medium' | 'low',
  source: LlmReadinessSource,
  recommendation: string,
  evidence: LlmReadinessEvidence[] = [],
  experimental = false,
  affectedPages: string[] = [],
): LlmReadinessFinding {
  return {
    id: ruleId,
    ruleId,
    category,
    title,
    description,
    status,
    severity,
    confidence,
    source,
    affectedPages,
    evidence,
    recommendation,
    experimental,
  };
}

function safeText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseJsonLd(html: string): unknown[] {
  const results: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) results.push(...parsed);
      else results.push(parsed);
    } catch {
      // invalid JSON-LD
    }
  }
  return results;
}

function extractSchemaTypes(items: unknown[]): string[] {
  const types: Set<string> = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const t = (item as Record<string, unknown>)['@type'];
    if (typeof t === 'string') types.add(t);
    else if (Array.isArray(t)) t.forEach(v => typeof v === 'string' && types.add(v));
  }
  return [...types];
}

function hasSchemaType(items: unknown[], ...types: string[]): boolean {
  const found = extractSchemaTypes(items);
  return types.some(t => found.some(f => f.toLowerCase() === t.toLowerCase()));
}

function hasSameAsLink(items: unknown[]): boolean {
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const sa = (item as Record<string, unknown>)['sameAs'];
    if (sa) return true;
  }
  return false;
}

function inferPageType(html: string, schemaTypes: string[]): string {
  const lower = html.toLowerCase();
  if (schemaTypes.some(t => ['article','newsarticle','blogposting','technicalarticle'].includes(t.toLowerCase()))) return 'article';
  if (schemaTypes.some(t => ['product'].includes(t.toLowerCase()))) return 'product';
  if (schemaTypes.some(t => ['event'].includes(t.toLowerCase()))) return 'event';
  if (schemaTypes.some(t => ['faqpage'].includes(t.toLowerCase()))) return 'faq';
  if (schemaTypes.some(t => ['localbusiness','organization'].includes(t.toLowerCase()))) return 'organization';
  if (lower.includes('<main') && (lower.includes('blog') || lower.includes('article') || lower.includes('post'))) return 'article';
  if (lower.includes('contact') && (lower.includes('form') || lower.includes('email') || lower.includes('phone'))) return 'contact';
  if (lower.includes('about') && (lower.includes('team') || lower.includes('company') || lower.includes('mission'))) return 'about';
  return 'unknown';
}

// ---------- check functions ----------

function checkCrawlability(
  html: string,
  response: Response,
  robotsTxtGroups: ReturnType<typeof parseRobotsTxt> | null,
  pageUrl: string,
  findings: LlmReadinessFinding[],
): void {
  const status = response.status;
  const isOk = status >= 200 && status < 300;
  const contentType = response.headers.get('content-type') ?? '';
  const isHtml = contentType.toLowerCase().includes('text/html');

  // HTTP status
  if (isOk) {
    findings.push(makeFinding('crl-http-ok', 'crawlability', 'HTTP Status OK',
      'The page returned a successful HTTP status code, making it accessible to crawlers.',
      'passed', 'info', 'high', 'http-header',
      'No action needed.',
      [{ source: 'http-header', actual: String(status), confidence: 'high' }]));
  } else if (status >= 400 && status < 500) {
    findings.push(makeFinding('crl-http-ok', 'crawlability', 'Page Not Accessible',
      `The server returned HTTP ${status}. The page cannot be crawled or indexed.`,
      'failed', 'critical', 'high', 'http-header',
      'Ensure the URL returns a 200 status code. Check redirects, authentication, and access controls.',
      [{ source: 'http-header', actual: String(status), expected: '2xx', confidence: 'high' }]));
  } else if (status >= 500) {
    findings.push(makeFinding('crl-http-ok', 'crawlability', 'Server Error Response',
      `The server returned HTTP ${status}. Crawlers may retry, but repeated failures prevent indexing.`,
      'failed', 'critical', 'high', 'http-header',
      'Investigate server errors. Ensure the page returns 200 for public content.',
      [{ source: 'http-header', actual: String(status), expected: '2xx', confidence: 'high' }]));
  }

  // Robots meta noindex
  const metaRobotsMatch = html.match(/meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  const robotsMeta = metaRobotsMatch ? metaRobotsMatch[1].toLowerCase() : '';
  const metaNoindex = robotsMeta.includes('noindex');
  const metaNofollow = robotsMeta.includes('nofollow');

  if (!metaNoindex) {
    findings.push(makeFinding('crl-robots-meta', 'crawlability', 'Robots Meta Allows Indexing',
      'No noindex directive found in the robots meta tag.',
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      robotsMeta ? [{ source: 'raw-html', html: `<meta name="robots" content="${robotsMeta}">`, confidence: 'high' }] : []));
  } else {
    findings.push(makeFinding('crl-robots-meta', 'crawlability', 'Page Blocked via Robots Meta',
      `The page contains a robots meta tag with "noindex"${metaNofollow ? ' and "nofollow"' : ''}, instructing crawlers not to index it.`,
      'failed', 'high', 'high', 'raw-html',
      'If this page should be discoverable by AI and search crawlers, remove the noindex directive. If intentional, keep it.',
      [{ source: 'raw-html', html: `<meta name="robots" content="${robotsMeta}">`, confidence: 'high' }]));
  }

  // X-Robots-Tag header
  const xRobotsRaw = response.headers.get('x-robots-tag') ?? '';
  const xRobotsLower = xRobotsRaw.toLowerCase();
  const xNoindex = xRobotsLower.includes('noindex');

  if (!xNoindex) {
    const status2: LlmReadinessStatus = xRobotsRaw ? 'passed' : 'passed';
    findings.push(makeFinding('crl-x-robots', 'crawlability', 'X-Robots-Tag Allows Indexing',
      xRobotsRaw
        ? `X-Robots-Tag header is present but does not contain noindex: "${xRobotsRaw}".`
        : 'No X-Robots-Tag header detected.',
      status2, 'info', 'high', 'http-header',
      'No action needed.',
      xRobotsRaw ? [{ source: 'http-header', html: `X-Robots-Tag: ${xRobotsRaw}`, confidence: 'high' }] : []));
  } else {
    findings.push(makeFinding('crl-x-robots', 'crawlability', 'Page Blocked via X-Robots-Tag Header',
      `The X-Robots-Tag response header contains "noindex": "${xRobotsRaw}".`,
      'failed', 'high', 'high', 'http-header',
      'If this page should be crawlable, remove the noindex directive from the X-Robots-Tag header (set in web server or CDN configuration).',
      [{ source: 'http-header', html: `X-Robots-Tag: ${xRobotsRaw}`, expected: 'no noindex', confidence: 'high' }]));
  }

  // robots.txt
  if (robotsTxtGroups === null) {
    findings.push(makeFinding('crl-robots-txt', 'crawlability', 'robots.txt Not Checked',
      'The robots.txt file could not be fetched during this audit.',
      'unavailable', 'info', 'low', 'robots-txt',
      'Ensure /robots.txt exists and does not disallow the primary content pages.'));
  } else {
    let pagePath: string;
    try { pagePath = new URL(pageUrl).pathname || '/'; }
    catch { pagePath = '/'; }

    const result = checkRobotsAccess(robotsTxtGroups, '*', pagePath);
    if (result.allowed) {
      findings.push(makeFinding('crl-robots-txt', 'crawlability', 'robots.txt Allows General Crawlers',
        'The robots.txt wildcard rules allow general crawlers to access this page.',
        'passed', 'info', 'high', 'robots-txt',
        'No action needed.',
        [{ source: 'robots-txt', actual: result.matchedRule ?? '(no matching Disallow)', confidence: 'high' }]));
    } else {
      findings.push(makeFinding('crl-robots-txt', 'crawlability', 'robots.txt Blocks General Crawlers',
        `The robots.txt wildcard rule disallows this page path: "${result.matchedRule ?? 'unknown rule'}".`,
        'failed', 'high', 'high', 'robots-txt',
        'If this page should be discoverable, ensure the robots.txt wildcard rules do not block its path.',
        [{ source: 'robots-txt', actual: result.matchedRule ?? '', expected: 'Allow', confidence: 'high' }]));
    }
  }
}

function checkContentAccessibility(
  html: string,
  textContent: string,
  findings: LlmReadinessFinding[],
): void {
  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  if (title) {
    findings.push(makeFinding('ca-title', 'content-accessibility', 'Page Title Present',
      `The page has a descriptive title: "${title.slice(0, 80)}${title.length > 80 ? '…' : ''}"`,
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', html: `<title>${title}</title>`, confidence: 'high' }]));
  } else {
    findings.push(makeFinding('ca-title', 'content-accessibility', 'Missing Page Title',
      'No <title> element was found in the raw HTML.',
      'failed', 'high', 'high', 'raw-html',
      'Add a descriptive <title> element. It is used as the primary identifier by search and AI systems.',
      []));
  }

  // Meta description
  const metaDescMatch =
    html.match(/meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : null;
  const descLen = metaDesc ? metaDesc.length : 0;

  if (metaDesc && descLen >= 50 && descLen <= 300) {
    findings.push(makeFinding('ca-meta-desc', 'content-accessibility', 'Meta Description Present',
      `Meta description is ${descLen} characters long.`,
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', html: `<meta name="description" content="${metaDesc.slice(0, 100)}…">`, confidence: 'high' }]));
  } else if (metaDesc && descLen < 50) {
    findings.push(makeFinding('ca-meta-desc', 'content-accessibility', 'Meta Description Too Short',
      `The meta description is only ${descLen} characters, which may not provide enough context for AI systems.`,
      'warning', 'low', 'high', 'raw-html',
      'Expand the meta description to 50–160 characters with a clear, accurate summary of the page content.',
      [{ source: 'raw-html', html: `<meta name="description" content="${metaDesc}">`, confidence: 'high' }]));
  } else {
    findings.push(makeFinding('ca-meta-desc', 'content-accessibility', 'Meta Description Missing or Too Long',
      metaDesc ? `Meta description is ${descLen} characters (over 300). Excessively long descriptions may be truncated.` : 'No meta description was found.',
      metaDesc ? 'warning' : 'failed', 'medium', 'high', 'raw-html',
      'Add a concise, accurate meta description of 50–160 characters summarizing the page content.',
      metaDesc ? [{ source: 'raw-html', html: `<meta name="description" content="${metaDesc.slice(0, 100)}…">`, confidence: 'high' }] : []));
  }

  // Sufficient content in raw HTML
  const textLen = textContent.length;
  if (textLen >= 300) {
    findings.push(makeFinding('ca-main-content', 'content-accessibility', 'Sufficient Content in Raw HTML',
      `${textLen.toLocaleString()} characters of text content detected in raw HTML.`,
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', actual: `${textLen} chars`, confidence: 'high' }]));
  } else if (textLen >= 100) {
    findings.push(makeFinding('ca-main-content', 'content-accessibility', 'Limited Content in Raw HTML',
      `Only ${textLen} characters of text content detected in the raw HTML. Some content may be loaded via JavaScript.`,
      'warning', 'medium', 'medium', 'raw-html',
      'Consider server-rendering key content so it is accessible to crawlers that do not execute JavaScript.',
      [{ source: 'raw-html', actual: `${textLen} chars`, expected: '≥300 chars', confidence: 'medium' }]));
  } else {
    findings.push(makeFinding('ca-main-content', 'content-accessibility', 'Very Little Content in Raw HTML',
      `Only ${textLen} characters of text content detected. The page may be a JavaScript-only application shell.`,
      'failed', 'high', 'medium', 'raw-html',
      'Most primary content appears only after JavaScript rendering. Some crawlers and retrieval systems may process it less reliably than server-rendered HTML. Consider server-side rendering or static generation of key content.',
      [{ source: 'raw-html', actual: `${textLen} chars`, expected: '≥300 chars', confidence: 'medium' }]));
  }

  // Main landmark
  const hasMain = /<main[\s>]/i.test(html) || /role=["']main["']/i.test(html);
  if (hasMain) {
    findings.push(makeFinding('ca-main-landmark', 'content-accessibility', 'Main Content Landmark Present',
      'A <main> element or role="main" was found, helping automated systems identify primary content.',
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', html: '<main>', confidence: 'high' }]));
  } else {
    findings.push(makeFinding('ca-main-landmark', 'content-accessibility', 'No Main Content Landmark',
      'No <main> element or role="main" attribute was detected. Automated systems have less guidance on where primary content begins.',
      'warning', 'low', 'high', 'raw-html',
      'Wrap the primary content in a <main> element to help crawlers and parsing tools identify it.',
      []));
  }

  // JS-only shell detection
  const isJsShell = textLen < 200 &&
    /<div[^>]+id=["'](app|root|__next|__nuxt)["']/i.test(html) &&
    !/<h[1-6][\s>]/i.test(html);

  if (!isJsShell) {
    findings.push(makeFinding('ca-not-js-shell', 'content-accessibility', 'Server-Rendered Content Detected',
      'The page contains meaningful server-rendered HTML content.',
      'passed', 'info', 'medium', 'raw-html',
      'No action needed.',
      []));
  } else {
    findings.push(makeFinding('ca-not-js-shell', 'content-accessibility', 'Possible JavaScript-Only Application Shell',
      'The raw HTML appears to be a minimal app shell with no server-rendered content. This may limit accessibility to crawlers that do not execute JavaScript.',
      'warning', 'medium', 'medium', 'heuristic',
      'Consider server-side rendering or static site generation for primary content, especially titles, descriptions, and key body text.',
      [{ source: 'heuristic', actual: 'No headings or text in raw HTML', confidence: 'medium' }]));
  }
}

function checkSemanticStructure(
  html: string,
  findings: LlmReadinessFinding[],
): void {
  // H1
  const h1Matches = html.match(/<h1[\s>][^]*?<\/h1>/gi) ?? [];
  const h1Count = h1Matches.length;
  const h1Text = h1Matches[0]
    ? h1Matches[0].replace(/<[^>]+>/g, '').trim().slice(0, 80)
    : null;

  if (h1Count === 1) {
    findings.push(makeFinding('sem-h1', 'semantic-structure', 'Single H1 Heading Present',
      `The page has exactly one H1 heading: "${h1Text ?? ''}"`,
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', html: `<h1>${h1Text}</h1>`, confidence: 'high' }]));
  } else if (h1Count > 1) {
    findings.push(makeFinding('sem-h1', 'semantic-structure', 'Multiple H1 Headings',
      `${h1Count} H1 headings were found. While not always a problem, a single descriptive H1 can help automated systems identify the primary topic.`,
      'warning', 'low', 'high', 'raw-html',
      'Consider using a single H1 that clearly describes the primary topic of the page. Use H2–H6 for subsections.',
      [{ source: 'raw-html', actual: `${h1Count} H1 elements`, expected: '1', confidence: 'high' }]));
  } else {
    findings.push(makeFinding('sem-h1', 'semantic-structure', 'No H1 Heading',
      'No H1 heading was found in the raw HTML. H1 is the primary semantic identifier of page content.',
      'failed', 'medium', 'high', 'raw-html',
      'Add a clear, descriptive H1 heading that identifies the primary topic of the page.',
      []));
  }

  // Heading hierarchy
  const hasH2 = /<h2[\s>]/i.test(html);
  const hasH3 = /<h3[\s>]/i.test(html);
  const hasAnySubheadings = hasH2 || hasH3;

  if (hasAnySubheadings) {
    findings.push(makeFinding('sem-heading-order', 'semantic-structure', 'Subheadings Present',
      'The page uses subheadings (H2 or H3) to structure content.',
      'passed', 'info', 'medium', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', actual: `H2: ${hasH2 ? 'yes' : 'no'}, H3: ${hasH3 ? 'yes' : 'no'}`, confidence: 'medium' }]));
  } else {
    findings.push(makeFinding('sem-heading-order', 'semantic-structure', 'No Subheadings Found',
      'No H2 or H3 headings were detected. Long content without section headings is harder for automated systems to parse and segment.',
      'warning', 'low', 'medium', 'raw-html',
      'Use H2 and H3 headings to break content into clear sections. Each section heading should describe the content that follows.',
      []));
  }

  // Semantic landmarks
  const hasArticle = /<article[\s>]/i.test(html);
  const hasNav = /<nav[\s>]/i.test(html);
  const hasAside = /<aside[\s>]/i.test(html);
  const landmarkCount = [/<main[\s>]/i.test(html), hasArticle, hasNav, hasAside].filter(Boolean).length;

  if (landmarkCount >= 2) {
    findings.push(makeFinding('sem-landmarks', 'semantic-structure', 'Semantic Landmarks Present',
      `${landmarkCount} semantic landmark elements found (main, article, nav, aside).`,
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', actual: `${landmarkCount} landmarks`, confidence: 'high' }]));
  } else {
    findings.push(makeFinding('sem-landmarks', 'semantic-structure', 'Limited Semantic Landmarks',
      'Few semantic HTML landmark elements were detected. Landmarks (main, article, nav) help parsing tools identify different regions of the page.',
      'warning', 'low', 'medium', 'raw-html',
      'Use semantic HTML elements such as <main>, <article>, <nav>, and <aside> to identify page regions.',
      [{ source: 'raw-html', actual: `${landmarkCount} landmarks`, expected: '≥2', confidence: 'medium' }]));
  }

  // Descriptive link text (check for generic anchors)
  const allLinks = [...html.matchAll(/<a[^>]*>([^<]{0,80})<\/a>/gi)];
  const genericTexts = new Set(['click here', 'here', 'read more', 'learn more', 'more', 'link', 'this', 'details']);
  const genericCount = allLinks.filter(m => genericTexts.has(m[1].trim().toLowerCase())).length;
  const genericRatio = allLinks.length > 0 ? genericCount / allLinks.length : 0;

  if (genericRatio < 0.3) {
    findings.push(makeFinding('sem-desc-links', 'semantic-structure', 'Links Use Descriptive Text',
      `${genericCount} of ${allLinks.length} links use generic anchor text.`,
      'passed', 'info', 'medium', 'raw-html',
      'No action needed.',
      []));
  } else {
    findings.push(makeFinding('sem-desc-links', 'semantic-structure', 'Many Links Use Generic Anchor Text',
      `${genericCount} of ${allLinks.length} links use generic text such as "click here" or "read more". This reduces the semantic value of link relationships.`,
      'warning', 'low', 'medium', 'raw-html',
      'Replace generic link text with descriptive text that explains the destination. For example, use "Read our privacy policy" instead of "Click here".',
      [{ source: 'raw-html', actual: `${genericCount} generic links`, expected: '<30% generic', confidence: 'medium' }]));
  }
}

function checkEntityClarity(
  html: string,
  schemaItems: unknown[],
  findings: LlmReadinessFinding[],
): void {
  const orgSchema = schemaItems.find((item): item is Record<string, unknown> => {
    if (!item || typeof item !== 'object') return false;
    const t = (item as Record<string, unknown>)['@type'];
    const types = Array.isArray(t) ? t : [t];
    return types.some(v => typeof v === 'string' && ['organization', 'localbusiness', 'corporation', 'ngo', 'website'].includes(v.toLowerCase()));
  });

  if (orgSchema) {
    findings.push(makeFinding('ent-org-name', 'entity-clarity', 'Organization Identity in Structured Data',
      'An Organization, LocalBusiness, Corporation, or WebSite schema was found with entity information.',
      'passed', 'info', 'high', 'structured-data',
      'No action needed.',
      [{ source: 'structured-data', html: `@type: ${(orgSchema['@type'] as string)}`, confidence: 'high' }]));
  } else {
    // Fall back to looking for visible brand/org name heuristics
    const hasBrandSignal =
      /copyright[^<]{1,60}(llc|ltd|inc|corp|gmbh|co\.|company)/i.test(html) ||
      /<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i.test(html);

    if (hasBrandSignal) {
      findings.push(makeFinding('ent-org-name', 'entity-clarity', 'Organization Name Partially Identifiable',
        'The organization or brand name can be inferred from page metadata or footer content, but no Organization schema was found.',
        'warning', 'low', 'medium', 'heuristic',
        'Add an Organization or WebSite schema with name, url, and logo to make entity identification reliable for automated systems.',
        [{ source: 'heuristic', actual: 'Brand detected via heuristics', confidence: 'medium' }]));
    } else {
      findings.push(makeFinding('ent-org-name', 'entity-clarity', 'Organization Identity Not Clearly Detectable',
        'No Organization schema or reliable brand identifier was found. Automated systems may have difficulty attributing this content to a specific entity.',
        'warning', 'medium', 'low', 'heuristic',
        'Add an Organization or WebSite JSON-LD schema with name, url, logo, and optionally sameAs references to established profiles.',
        []));
    }
  }

  // About page link
  const hasAboutLink = /href=["'][^"']*about[^"']*["']/i.test(html) || /href=["'][^"']*\/about\/?["']/i.test(html);
  if (hasAboutLink) {
    findings.push(makeFinding('ent-about-link', 'entity-clarity', 'Link to About Page Found',
      'The page contains a link to an About page, helping automated systems find entity context.',
      'passed', 'info', 'medium', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', actual: 'Link to /about found', confidence: 'medium' }]));
  } else {
    findings.push(makeFinding('ent-about-link', 'entity-clarity', 'No About Page Link Detected',
      'No link to an About page was found. This is not a critical issue but an About page provides useful entity context for AI systems.',
      'warning', 'low', 'low', 'heuristic',
      'If the site has an About page, ensure it is linked from navigation or the footer.',
      []));
  }

  // Contact info
  const hasContactLink = /href=["'][^"']*contact[^"']*["']/i.test(html) ||
    /mailto:/i.test(html) ||
    /\+?[\d][\d\s\-().]{7,}/i.test(html);
  if (hasContactLink) {
    findings.push(makeFinding('ent-contact', 'entity-clarity', 'Contact Information Detected',
      'Contact information or a link to a contact page was found.',
      'passed', 'info', 'medium', 'raw-html',
      'No action needed.',
      []));
  } else {
    findings.push(makeFinding('ent-contact', 'entity-clarity', 'No Contact Information Detected',
      'No contact information (email, phone, or contact page link) was found. Contact information is a light trust signal for entity clarity.',
      'warning', 'low', 'low', 'heuristic',
      'Add a link to a contact page or include a contact email address if appropriate for the site type.',
      []));
  }

  // Organization schema specifically
  if (orgSchema) {
    findings.push(makeFinding('ent-org-schema', 'entity-clarity', 'Organization Schema Present',
      'An Organization or LocalBusiness structured data block was found, providing machine-readable entity signals.',
      'passed', 'info', 'high', 'structured-data',
      'No action needed.',
      [{ source: 'structured-data', confidence: 'high' }]));
  } else if (hasSchemaType(schemaItems, 'WebSite', 'WebPage')) {
    findings.push(makeFinding('ent-org-schema', 'entity-clarity', 'WebSite Schema Present (No Organization)',
      'A WebSite schema was found, but no Organization or LocalBusiness schema was detected.',
      'warning', 'low', 'high', 'structured-data',
      'Add an Organization schema to explicitly identify the entity responsible for this content.',
      []));
  } else {
    findings.push(makeFinding('ent-org-schema', 'entity-clarity', 'No Organization Schema',
      'No Organization, LocalBusiness, or WebSite schema was found. These schema types help automated systems identify the entity that owns or published this content.',
      'failed', 'medium', 'high', 'structured-data',
      'Add an Organization or WebSite JSON-LD schema with at minimum name, url, and logo.',
      []));
  }
}

function checkStructuredData(
  html: string,
  schemaItems: unknown[],
  schemaTypes: string[],
  findings: LlmReadinessFinding[],
): { hasInvalidJsonLd: boolean } {
  const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const hasJsonLd = jsonLdBlocks.length > 0;
  let hasInvalidJsonLd = false;

  if (hasJsonLd) {
    findings.push(makeFinding('sd-present', 'structured-data', 'JSON-LD Structured Data Present',
      `${jsonLdBlocks.length} JSON-LD block${jsonLdBlocks.length > 1 ? 's' : ''} found.`,
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', actual: `${jsonLdBlocks.length} block(s)`, confidence: 'high' }]));

    // Validate JSON syntax
    let parseErrors = 0;
    for (const block of jsonLdBlocks) {
      try { JSON.parse(block[1].trim()); }
      catch { parseErrors++; }
    }
    if (parseErrors === 0) {
      findings.push(makeFinding('sd-parseable', 'structured-data', 'JSON-LD Syntax Valid',
        'All JSON-LD blocks parse without errors.',
        'passed', 'info', 'high', 'raw-html',
        'No action needed.',
        []));
    } else {
      hasInvalidJsonLd = true;
      findings.push(makeFinding('sd-parseable', 'structured-data', 'JSON-LD Parse Errors',
        `${parseErrors} JSON-LD block${parseErrors > 1 ? 's' : ''} contain${parseErrors === 1 ? 's' : ''} invalid JSON and will be ignored by parsers.`,
        'failed', 'high', 'high', 'raw-html',
        'Validate all JSON-LD blocks using the Schema.org validator or Google Rich Results Test. Fix any JSON syntax errors.',
        [{ source: 'raw-html', actual: `${parseErrors} parse error(s)`, confidence: 'high' }]));
    }
  } else {
    findings.push(makeFinding('sd-present', 'structured-data', 'No JSON-LD Structured Data',
      'No JSON-LD structured data blocks were found. Structured data helps automated systems understand entity types and relationships.',
      'failed', 'medium', 'high', 'raw-html',
      'Add JSON-LD structured data appropriate to the page type. Start with WebPage or Article and add Organization or Product as applicable.',
      []));
    findings.push(makeFinding('sd-parseable', 'structured-data', 'No JSON-LD to Validate',
      'No JSON-LD blocks were present, so syntax validation was not applicable.',
      'not-applicable', 'info', 'high', 'raw-html',
      'Add valid JSON-LD structured data.',
      []));
  }

  // Recognized schema types
  const RECOGNIZED_TYPES = new Set([
    'WebPage', 'WebSite', 'Organization', 'LocalBusiness', 'Corporation',
    'Article', 'NewsArticle', 'BlogPosting', 'TechArticle',
    'Product', 'Offer', 'AggregateOffer',
    'Event', 'Place', 'Person', 'HowTo', 'FAQPage',
    'BreadcrumbList', 'ListItem', 'ItemList',
    'Review', 'AggregateRating', 'CreativeWork',
  ]);
  const recognized = schemaTypes.filter(t => RECOGNIZED_TYPES.has(t));

  if (recognized.length > 0) {
    findings.push(makeFinding('sd-recognized-types', 'structured-data', 'Recognized Schema.org Types',
      `Recognized types: ${recognized.join(', ')}.`,
      'passed', 'info', 'high', 'structured-data',
      'No action needed.',
      [{ source: 'structured-data', actual: recognized.join(', '), confidence: 'high' }]));
  } else if (schemaTypes.length > 0) {
    findings.push(makeFinding('sd-recognized-types', 'structured-data', 'Unrecognized Schema Types Only',
      `Schema types found (${schemaTypes.join(', ')}) were not recognized as commonly supported schema.org types.`,
      'warning', 'medium', 'medium', 'structured-data',
      'Use standard schema.org types. Check the schema.org type catalog for the type most appropriate to your content.',
      [{ source: 'structured-data', actual: schemaTypes.join(', '), confidence: 'medium' }]));
  } else if (hasJsonLd) {
    findings.push(makeFinding('sd-recognized-types', 'structured-data', 'No @type in JSON-LD',
      'JSON-LD was found but no @type declarations were detected.',
      'warning', 'medium', 'high', 'structured-data',
      'Ensure every JSON-LD block includes a valid @type declaration.',
      []));
  } else {
    findings.push(makeFinding('sd-recognized-types', 'structured-data', 'No Structured Data Types',
      'No structured data was present to assess.',
      'not-applicable', 'info', 'high', 'structured-data',
      'Add structured data with recognized schema.org @type values.',
      []));
  }

  // BreadcrumbList
  const hasBreadcrumb = hasSchemaType(schemaItems, 'BreadcrumbList');
  if (hasBreadcrumb) {
    findings.push(makeFinding('sd-breadcrumb', 'structured-data', 'Breadcrumb Schema Present',
      'BreadcrumbList schema was found, providing navigation context for automated systems.',
      'passed', 'info', 'high', 'structured-data',
      'No action needed.',
      []));
  } else {
    findings.push(makeFinding('sd-breadcrumb', 'structured-data', 'No Breadcrumb Schema',
      'No BreadcrumbList schema was detected. Breadcrumbs help automated systems understand the page hierarchy.',
      'warning', 'low', 'medium', 'structured-data',
      'Add a BreadcrumbList schema if the page exists within a logical hierarchy.',
      []));
  }

  return { hasInvalidJsonLd };
}

function checkCitationReadiness(
  html: string,
  response: Response,
  pageUrl: string,
  findings: LlmReadinessFinding[],
): void {
  // Canonical URL
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonicalMatch) {
    findings.push(makeFinding('cit-canonical', 'citation-readiness', 'Canonical URL Present',
      `Canonical URL: ${canonicalMatch[1].slice(0, 100)}`,
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', html: `<link rel="canonical" href="${canonicalMatch[1].slice(0, 80)}">`, confidence: 'high' }]));
  } else {
    findings.push(makeFinding('cit-canonical', 'citation-readiness', 'No Canonical URL',
      'No rel="canonical" link was found. Without a canonical URL, duplicate or syndicated copies of this content may lead to attribution confusion.',
      'failed', 'medium', 'high', 'raw-html',
      `Add <link rel="canonical" href="${pageUrl}"> (or the preferred permanent URL) to the <head>.`,
      []));
  }

  // Open Graph
  const hasOgTitle = /property=["']og:title["']/i.test(html);
  const hasOgDesc = /property=["']og:description["']/i.test(html);
  if (hasOgTitle && hasOgDesc) {
    findings.push(makeFinding('cit-og-tags', 'citation-readiness', 'Open Graph Tags Present',
      'og:title and og:description are present.',
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', actual: 'og:title, og:description', confidence: 'high' }]));
  } else if (hasOgTitle) {
    findings.push(makeFinding('cit-og-tags', 'citation-readiness', 'Open Graph Tags Incomplete',
      'og:title is present but og:description is missing.',
      'warning', 'low', 'high', 'raw-html',
      'Add og:description to complete the Open Graph metadata.',
      [{ source: 'raw-html', actual: 'og:title only', expected: 'og:title + og:description', confidence: 'high' }]));
  } else {
    findings.push(makeFinding('cit-og-tags', 'citation-readiness', 'No Open Graph Tags',
      'Neither og:title nor og:description was found.',
      'failed', 'low', 'high', 'raw-html',
      'Add Open Graph meta tags (og:title, og:description, og:url, og:type) to the <head>.',
      []));
  }

  // Visible date
  const hasVisibleDate =
    /\b(20[0-9]{2})\s*[-\/]\s*(0?[1-9]|1[0-2])\s*[-\/]\s*(0?[1-9]|[12][0-9]|3[01])\b/.test(html) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+[0-9]{1,2}[,\s]+20[0-9]{2}\b/i.test(html) ||
    /itemprop=["'](datePublished|dateModified|uploadDate)["']/i.test(html);

  if (hasVisibleDate) {
    findings.push(makeFinding('cit-date-visible', 'citation-readiness', 'Publication or Update Date Detectable',
      'A date was detected in the page content or schema attributes.',
      'passed', 'info', 'medium', 'raw-html',
      'No action needed.',
      []));
  } else {
    findings.push(makeFinding('cit-date-visible', 'citation-readiness', 'No Publication Date Detected',
      'No visible publication or modification date was found. For time-sensitive content, dates help automated systems assess relevance and freshness.',
      'warning', 'low', 'medium', 'raw-html',
      'Add a visible publication date. Use datePublished and dateModified in structured data for reliable machine-readable dates.',
      []));
  }

  // Stable URL check (no session IDs or tracking parameters)
  let hasUnstableUrl = false;
  try {
    const u = new URL(pageUrl);
    const sessionParams = ['sessionid', 'session_id', 'phpsessid', 'jsessionid', 'sid', 'token', 'hash'];
    hasUnstableUrl = sessionParams.some(p => u.searchParams.has(p));
  } catch { /* ignore */ }

  if (!hasUnstableUrl) {
    findings.push(makeFinding('cit-stable-url', 'citation-readiness', 'URL Appears Stable',
      'No session identifiers or ephemeral parameters were detected in the URL.',
      'passed', 'info', 'high', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', url: pageUrl, confidence: 'high' }]));
  } else {
    findings.push(makeFinding('cit-stable-url', 'citation-readiness', 'URL Contains Session or Ephemeral Parameters',
      'The URL contains parameters that may make it unstable across visits, reducing citability.',
      'failed', 'medium', 'high', 'raw-html',
      'Ensure permanent content pages use stable, parameter-free canonical URLs.',
      [{ source: 'raw-html', url: pageUrl, confidence: 'high' }]));
  }
}

function checkAuthorship(
  html: string,
  schemaItems: unknown[],
  pageType: string,
  findings: LlmReadinessFinding[],
): void {
  const isEditorialPage = ['article', 'guide', 'faq'].includes(pageType);
  const isUtilityPage = ['checkout', 'search', 'category', 'unknown'].includes(pageType);

  if (isUtilityPage && !isEditorialPage) {
    // Authorship not applicable for utility pages
    findings.push(makeFinding('auth-author-visible', 'authorship', 'Authorship Not Applicable for This Page Type',
      'Authorship signals are not expected for this page type.',
      'not-applicable', 'info', 'medium', 'heuristic',
      'No action needed for this page type.',
      []));
    findings.push(makeFinding('auth-schema', 'authorship', 'Author Schema Not Applicable',
      'Author schema is not expected for this page type.',
      'not-applicable', 'info', 'medium', 'heuristic',
      'No action needed.',
      []));
    findings.push(makeFinding('auth-publisher', 'authorship', 'Publisher Signal Not Applicable',
      'Publisher signals are not expected for this page type.',
      'not-applicable', 'info', 'medium', 'heuristic',
      'No action needed.',
      []));
    return;
  }

  // Visible author byline
  const hasAuthorMeta = /name=["']author["']/i.test(html);
  const hasAuthorByline = /class=["'][^"']*(author|byline)[^"']*["']/i.test(html) ||
    /rel=["']author["']/i.test(html) ||
    /itemprop=["']author["']/i.test(html);

  if (hasAuthorMeta || hasAuthorByline) {
    findings.push(makeFinding('auth-author-visible', 'authorship', 'Author Signal Detected',
      'An author meta tag, byline class, or itemprop=author was found.',
      'passed', 'info', 'medium', 'raw-html',
      'No action needed.',
      [{ source: 'raw-html', actual: 'Author signal present', confidence: 'medium' }]));
  } else {
    findings.push(makeFinding('auth-author-visible', 'authorship', 'No Visible Author Signal',
      isEditorialPage
        ? 'No author byline or author meta tag was found on this editorial page. Author attribution may help automated systems assess content credibility.'
        : 'No author signal was detected. Consider adding author attribution for content where it adds context.',
      isEditorialPage ? 'warning' : 'warning', 'low', 'medium', 'raw-html',
      'Add a visible author byline and/or a <meta name="author"> tag. For editorial content, consider adding Person schema.',
      []));
  }

  // Author in schema
  const hasPersonSchema = hasSchemaType(schemaItems, 'Person');
  const hasAuthorInSchema = schemaItems.some((item): boolean => {
    if (!item || typeof item !== 'object') return false;
    const author = (item as Record<string, unknown>)['author'];
    return !!author;
  });

  if (hasPersonSchema || hasAuthorInSchema) {
    findings.push(makeFinding('auth-schema', 'authorship', 'Author Schema Present',
      'A Person schema or author property in structured data was found.',
      'passed', 'info', 'high', 'structured-data',
      'No action needed.',
      []));
  } else {
    findings.push(makeFinding('auth-schema', 'authorship', 'No Author in Structured Data',
      isEditorialPage
        ? 'No author property or Person schema was found in structured data. For articles and editorial content, this reduces attribution signals.'
        : 'No author in structured data detected.',
      isEditorialPage ? 'warning' : 'warning', 'low', 'medium', 'structured-data',
      'Add an author property to Article or BlogPosting schema with a nested Person schema.',
      []));
  }

  // Publisher
  const hasPublisher = schemaItems.some((item): boolean => {
    if (!item || typeof item !== 'object') return false;
    return !!(item as Record<string, unknown>)['publisher'];
  });

  if (hasPublisher) {
    findings.push(makeFinding('auth-publisher', 'authorship', 'Publisher Identity in Schema',
      'A publisher property was found in structured data.',
      'passed', 'info', 'high', 'structured-data',
      'No action needed.',
      []));
  } else {
    findings.push(makeFinding('auth-publisher', 'authorship', 'No Publisher in Structured Data',
      isEditorialPage
        ? 'No publisher property was found in structured data. Publisher identity helps automated systems understand content ownership.'
        : 'No publisher in structured data.',
      isEditorialPage ? 'warning' : 'warning', 'low', 'medium', 'structured-data',
      'Add a publisher property to Article schema with a nested Organization schema.',
      []));
  }
}

function checkFreshness(
  html: string,
  response: Response,
  schemaItems: unknown[],
  findings: LlmReadinessFinding[],
): void {
  // Any date signal
  const hasVisibleDate =
    /\b20[0-9]{2}\b/.test(html) ||
    /itemprop=["'](datePublished|dateModified)["']/i.test(html);

  if (hasVisibleDate) {
    findings.push(makeFinding('fresh-date-signal', 'freshness', 'Date Signal Present',
      'At least one date reference was detected in the page content.',
      'passed', 'info', 'medium', 'raw-html',
      'No action needed.',
      []));
  } else {
    findings.push(makeFinding('fresh-date-signal', 'freshness', 'No Date Signal Detected',
      'No date references were found. For time-sensitive content, visible dates help automated systems assess freshness.',
      'warning', 'low', 'low', 'raw-html',
      'Add a visible publication date where relevant. Use structured-data dates for reliable machine-readable values.',
      []));
  }

  // Structured dates (datePublished, dateModified)
  const hasStructuredDate = schemaItems.some((item): boolean => {
    if (!item || typeof item !== 'object') return false;
    const r = item as Record<string, unknown>;
    return !!(r['datePublished'] || r['dateModified'] || r['uploadDate']);
  });

  if (hasStructuredDate) {
    findings.push(makeFinding('fresh-struct-date', 'freshness', 'Structured Data Dates Present',
      'datePublished or dateModified was found in structured data.',
      'passed', 'info', 'high', 'structured-data',
      'No action needed.',
      []));
  } else {
    findings.push(makeFinding('fresh-struct-date', 'freshness', 'No Structured Dates',
      'No datePublished or dateModified in structured data. Machine-readable dates are more reliable than visible text dates.',
      'warning', 'low', 'medium', 'structured-data',
      'Add datePublished and dateModified to Article or WebPage schema using ISO 8601 format.',
      []));
  }

  // Last-Modified header
  const lastMod = response.headers.get('last-modified');
  if (lastMod) {
    findings.push(makeFinding('fresh-last-modified', 'freshness', 'Last-Modified Header Present',
      `Server provides Last-Modified: ${lastMod}. Note: this may reflect server reconfigurations, not editorial updates.`,
      'passed', 'info', 'medium', 'http-header',
      'No action needed.',
      [{ source: 'http-header', html: `Last-Modified: ${lastMod}`, confidence: 'medium' }]));
  } else {
    findings.push(makeFinding('fresh-last-modified', 'freshness', 'No Last-Modified Header',
      'The server does not return a Last-Modified header.',
      'warning', 'low', 'low', 'http-header',
      'Configure the server to return a Last-Modified header for HTML pages.',
      []));
  }
}

function checkMachineGuidance(
  llmsTxtStatus: 'found' | 'not-found' | 'error' | 'unchecked',
  llmsTxtSize: number | null,
  findings: LlmReadinessFinding[],
): void {
  if (llmsTxtStatus === 'found') {
    findings.push(makeFinding('mg-llms-txt', 'machine-guidance', 'llms.txt File Found',
      `An /llms.txt file was found (${llmsTxtSize != null ? `${llmsTxtSize} bytes` : 'size unknown'}). This is an emerging, non-standard convention and its support varies by provider.`,
      'passed', 'info', 'medium', 'llms-txt',
      'Review the file to ensure it accurately describes public content and does not expose sensitive information.',
      [{ source: 'llms-txt', actual: 'found', confidence: 'medium' }],
      true));
  } else if (llmsTxtStatus === 'not-found') {
    findings.push(makeFinding('mg-llms-txt', 'machine-guidance', 'No llms.txt File',
      'No /llms.txt file was found. This file is an emerging, non-standard convention and is not required for search indexing or AI visibility.',
      'warning', 'info', 'high', 'llms-txt',
      'llms.txt is optional and experimental. If you add one, include only public content summaries and ensure it does not expose private information. Not all AI providers use it.',
      [],
      true));
  } else if (llmsTxtStatus === 'error') {
    findings.push(makeFinding('mg-llms-txt', 'machine-guidance', 'llms.txt Fetch Error',
      'An error occurred while trying to fetch /llms.txt.',
      'unavailable', 'info', 'low', 'llms-txt',
      'Verify the URL /llms.txt is accessible if you intend to use this experimental file.',
      [],
      true));
  } else {
    findings.push(makeFinding('mg-llms-txt', 'machine-guidance', 'llms.txt Not Checked',
      'The llms.txt file was not checked in this audit.',
      'unavailable', 'info', 'low', 'llms-txt',
      'llms.txt is an optional, experimental convention.',
      [],
      true));
  }
}

// ---------- score computation ----------

function statusScore(status: LlmReadinessStatus): number | null {
  if (status === 'passed') return 1.0;
  if (status === 'warning') return 0.5;
  if (status === 'failed') return 0.0;
  return null; // unavailable / manual-review / not-applicable — don't count
}

function computeScore(findings: LlmReadinessFinding[]): {
  score: number | null;
  categoryScores: LlmReadinessCategoryScore[];
} {
  const categories = Object.keys(CATEGORY_WEIGHTS) as LlmReadinessCategory[];
  const categoryScores: LlmReadinessCategoryScore[] = [];

  for (const cat of categories) {
    if (cat === 'other') continue;
    const catFindings = findings.filter(f => f.category === cat);
    const active = catFindings.filter(f => statusScore(f.status) !== null);

    const passedSignals = catFindings.filter(f => f.status === 'passed').length;
    const failedSignals = catFindings.filter(f => f.status === 'failed').length;
    const warningSignals = catFindings.filter(f => f.status === 'warning').length;
    const unavailableSignals = catFindings.filter(f =>
      f.status === 'unavailable' || f.status === 'not-applicable' || f.status === 'manual-review'
    ).length;

    if (active.length === 0) {
      categoryScores.push({
        category: cat,
        label: CATEGORY_LABELS[cat],
        weight: CATEGORY_WEIGHTS[cat],
        score: null,
        weightedContribution: null,
        passedSignals, failedSignals, warningSignals, unavailableSignals,
        reason: 'No executable signals in this category.',
      });
      continue;
    }

    let totalWeight = 0;
    let earned = 0;
    for (const f of active) {
      const sw = SIGNAL_WEIGHTS[f.ruleId] ?? (1 / active.length);
      const sc = statusScore(f.status)!;
      earned += sw * sc;
      totalWeight += sw;
    }
    const catScore = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : null;

    categoryScores.push({
      category: cat,
      label: CATEGORY_LABELS[cat],
      weight: CATEGORY_WEIGHTS[cat],
      score: catScore,
      weightedContribution: catScore !== null ? CATEGORY_WEIGHTS[cat] * catScore : null,
      passedSignals, failedSignals, warningSignals, unavailableSignals,
      reason: catScore !== null
        ? `${passedSignals} passed, ${failedSignals} failed, ${warningSignals} warning`
        : 'Signals unavailable.',
    });
  }

  const evaluated = categoryScores.filter(c => c.score !== null && CATEGORY_WEIGHTS[c.category] > 0);
  if (evaluated.length === 0) return { score: null, categoryScores };

  let totalCatWeight = 0;
  let totalContrib = 0;
  for (const c of evaluated) {
    totalCatWeight += CATEGORY_WEIGHTS[c.category];
    totalContrib += CATEGORY_WEIGHTS[c.category] * c.score!;
  }
  const score = totalCatWeight > 0 ? Math.round(totalContrib / totalCatWeight) : null;

  return { score, categoryScores };
}

function computeCoverage(findings: LlmReadinessFinding[]): LlmReadinessCoverage {
  const scored = findings.filter(f => f.category !== 'other');
  const supportedSignals = scored.length;
  const unavailableSignals = scored.filter(f => f.status === 'unavailable').length;
  const notApplicable = scored.filter(f => f.status === 'not-applicable').length;
  const manualReviewSignals = scored.filter(f => f.status === 'manual-review').length;
  const executedSignals = supportedSignals - unavailableSignals - notApplicable;
  const passedSignals = scored.filter(f => f.status === 'passed').length;
  const failedSignals = scored.filter(f => f.status === 'failed').length;
  const warningSignals = scored.filter(f => f.status === 'warning').length;

  const percentage = supportedSignals > 0
    ? Math.round((executedSignals / supportedSignals) * 100)
    : 0;

  const limitations: string[] = [
    'Rendered-DOM comparison is unavailable in fetch-only mode. JavaScript-dependent content checks are not performed.',
    'robots.txt analysis reflects the configured user-agent list at the time of the audit. Provider behaviors change over time.',
    'Authorship and entity signals are detected via heuristics and structured data only; editorial quality is not assessed.',
  ];

  return {
    supportedSignals,
    executedSignals,
    passedSignals,
    failedSignals,
    warningSignals,
    unavailableSignals: unavailableSignals + notApplicable,
    manualReviewSignals,
    percentage,
    limitations,
  };
}

// ---------- async fetchers ----------

async function fetchRobotsTxt(baseUrl: string): Promise<ReturnType<typeof parseRobotsTxt> | null> {
  let origin: string;
  try { origin = new URL(baseUrl).origin; }
  catch { return null; }
  const robotsUrl = `${origin}/robots.txt`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const r = await fetch(robotsUrl, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)' } });
    clearTimeout(timer);
    if (!r.ok) return null;
    const text = (await r.text()).slice(0, MAX_ROBOTS_BYTES);
    return parseRobotsTxt(text);
  } catch {
    return null;
  }
}

async function fetchLlmsTxt(baseUrl: string): Promise<{ status: 'found' | 'not-found' | 'error'; size: number | null }> {
  let origin: string;
  try { origin = new URL(baseUrl).origin; }
  catch { return { status: 'error', size: null }; }
  const url = `${origin}/llms.txt`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)' } });
    clearTimeout(timer);
    if (r.status === 404 || r.status === 410) return { status: 'not-found', size: null };
    if (!r.ok) return { status: 'error', size: null };
    const text = (await r.text()).slice(0, MAX_LLMS_TXT_BYTES);
    return { status: 'found', size: text.length };
  } catch {
    return { status: 'not-found', size: null };
  }
}

function buildAiCrawlerAccess(
  robotsTxtGroups: ReturnType<typeof parseRobotsTxt> | null,
  pageUrl: string,
): AiCrawlerAccess[] {
  let pagePath: string;
  try { pagePath = new URL(pageUrl).pathname || '/'; }
  catch { pagePath = '/'; }

  if (!robotsTxtGroups) {
    return AI_CRAWLERS.map(c => ({
      crawlerName: c.name,
      userAgent: c.userAgent,
      category: c.category,
      provider: c.provider,
      allowed: null,
      matchedGroup: null,
      matchedRule: null,
      confidence: 'low' as const,
      configVersion: AI_CRAWLER_CONFIG_VERSION,
    }));
  }

  return AI_CRAWLERS.map(c => {
    const result = checkRobotsAccess(robotsTxtGroups, c.userAgent, pagePath);
    return {
      crawlerName: c.name,
      userAgent: c.userAgent,
      category: c.category,
      provider: c.provider,
      allowed: result.allowed,
      matchedGroup: result.matchedGroup,
      matchedRule: result.matchedRule,
      confidence: result.matchedGroup?.includes(c.userAgent.toLowerCase()) ? 'high' : 'medium',
      configVersion: AI_CRAWLER_CONFIG_VERSION,
    };
  });
}

// ---------- public exports ----------

export async function checkLLMReadiness(
  html: string,
  response: Response,
  requestedUrl: string,
): Promise<import('../../types/llm-readiness').LlmReadinessAuditResult> {
  const measuredAt = new Date().toISOString();
  const finalUrl = response.url || requestedUrl;

  const textContent = safeText(html.slice(0, 600_000));
  const schemaItems = parseJsonLd(html);
  const schemaTypes = extractSchemaTypes(schemaItems);
  const pageType = inferPageType(html, schemaTypes);

  // Async fetches (robots.txt + llms.txt) in parallel
  const [robotsTxtGroups, llmsTxtResult] = await Promise.all([
    fetchRobotsTxt(requestedUrl),
    fetchLlmsTxt(requestedUrl),
  ]);

  const aiCrawlerAccess = buildAiCrawlerAccess(robotsTxtGroups, requestedUrl);

  const findings: LlmReadinessFinding[] = [];

  checkCrawlability(html, response, robotsTxtGroups, requestedUrl, findings);
  checkContentAccessibility(html, textContent, findings);
  checkSemanticStructure(html, findings);
  checkEntityClarity(html, schemaItems, findings);
  checkStructuredData(html, schemaItems, schemaTypes, findings);
  checkCitationReadiness(html, response, requestedUrl, findings);
  checkAuthorship(html, schemaItems, pageType, findings);
  checkFreshness(html, response, schemaItems, findings);
  checkMachineGuidance(
    llmsTxtResult.status === 'not-found' ? 'not-found' : llmsTxtResult.status === 'found' ? 'found' : 'error',
    llmsTxtResult.size,
    findings,
  );

  const { score, categoryScores } = computeScore(findings);
  const coverage = computeCoverage(findings);

  const metaDescMatch =
    html.match(/meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : null;
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const robotsMetaMatch = html.match(/meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  const xRobotsRaw = response.headers.get('x-robots-tag') ?? '';

  const detectedSignals: LlmDetectedSignals = {
    hasJsonLd: schemaItems.length > 0,
    schemaTypes,
    hasOrganizationSchema: hasSchemaType(schemaItems, 'Organization', 'LocalBusiness', 'Corporation', 'WebSite'),
    hasArticleSchema: hasSchemaType(schemaItems, 'Article', 'NewsArticle', 'BlogPosting'),
    hasBreadcrumbSchema: hasSchemaType(schemaItems, 'BreadcrumbList'),
    hasAuthorSignal: /name=["']author["']/i.test(html) || /itemprop=["']author["']/i.test(html),
    hasDateSignal: /itemprop=["'](datePublished|dateModified)["']/i.test(html) || schemaItems.some(item => !!(item as any)?.datePublished),
    hasSameAsLinks: hasSameAsLink(schemaItems),
    rawTextLength: textContent.length,
    headingCount: (html.match(/<h[1-6][\s>]/gi) ?? []).length,
    h1Count: (html.match(/<h1[\s>]/gi) ?? []).length,
    internalLinkCount: 0,
    hasMetaDescription: !!metaDesc,
    metaDescriptionLength: metaDesc?.length ?? 0,
    hasOpenGraph: /property=["']og:title["']/i.test(html),
    hasCanonical: !!canonicalMatch,
    canonicalUrl: canonicalMatch ? canonicalMatch[1] : null,
    isHttps: requestedUrl.startsWith('https://'),
    robotsMetaDirectives: robotsMetaMatch ? robotsMetaMatch[1].split(',').map(s => s.trim()) : [],
    xRobotsDirectives: xRobotsRaw ? xRobotsRaw.split(',').map(s => s.trim()) : [],
    contentType: response.headers.get('content-type'),
    lastModifiedHeader: response.headers.get('last-modified'),
    hasMainLandmark: /<main[\s>]/i.test(html),
    hasArticleLandmark: /<article[\s>]/i.test(html),
    hasNavLandmark: /<nav[\s>]/i.test(html),
    llmsTxtStatus: llmsTxtResult.status,
    llmsTxtSize: llmsTxtResult.size,
    aiCrawlerAccess,
    robotsTxtFetched: robotsTxtGroups !== null,
    pageType,
  };

  const warnings: string[] = [];
  if (!detectedSignals.robotsTxtFetched) {
    warnings.push('robots.txt could not be fetched. Crawler access rules are not included in this audit.');
  }
  if (coverage.percentage < 50) {
    warnings.push('Audit coverage is below 50%. Score conclusions should be interpreted conservatively.');
  }

  return {
    score,
    scoreVersion: SCORE_VERSION,
    auditMode: AUDIT_MODE,
    testedUrl: requestedUrl,
    finalUrl,
    measuredAt,
    findings,
    categoryScores,
    coverage,
    detectedSignals,
    warnings,
    errors: [],
  };
}

export function checkLLMReadinessLightweight(
  html: string,
  response: Response,
  requestedUrl: string,
): LlmReadinessPageResult {
  const finalUrl = response.url || requestedUrl;
  const schemaItems = parseJsonLd(html);
  const schemaTypes = extractSchemaTypes(schemaItems);
  const textContent = safeText(html.slice(0, 200_000));

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);

  const robotsMeta = html.match(/meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? '';
  const xRobots = (response.headers.get('x-robots-tag') ?? '').toLowerCase();
  const isIndexable = !robotsMeta.includes('noindex') && !xRobots.includes('noindex');

  const hasAuthorSignal = /name=["']author["']/i.test(html) || /itemprop=["']author["']/i.test(html);
  const hasDateSignal = /itemprop=["'](datePublished|dateModified)["']/i.test(html) ||
    schemaItems.some(item => !!(item as any)?.datePublished || !!(item as any)?.dateModified);

  // Quick lightweight score (subset of checks)
  let points = 0;
  let total = 6;
  if (titleMatch) points++;
  if (textContent.length >= 300) points++;
  if (/<h1[\s>]/i.test(html)) points++;
  if (canonicalMatch) points++;
  if (schemaItems.length > 0) points++;
  if (hasDateSignal) points++;

  const score = Math.round((points / total) * 100);

  // Top issue
  let topIssue: string | null = null;
  if (!titleMatch) topIssue = 'Missing page title';
  else if (textContent.length < 300) topIssue = 'Very little content in raw HTML';
  else if (!/<h1[\s>]/i.test(html)) topIssue = 'No H1 heading';
  else if (!canonicalMatch) topIssue = 'No canonical URL';
  else if (!schemaItems.length) topIssue = 'No structured data';

  return {
    requestedUrl,
    finalUrl,
    httpStatus: response.status,
    auditMode: 'fetch-only',
    title: titleMatch ? titleMatch[1].trim().slice(0, 120) : null,
    h1: h1Match ? h1Match[1].trim().slice(0, 120) : null,
    canonical: canonicalMatch ? canonicalMatch[1].slice(0, 200) : null,
    schemaTypes,
    hasAuthorSignal,
    hasDateSignal,
    isIndexable,
    score,
    coverage: 100,
    auditLabel: 'Lightweight LLM readiness scan',
    topIssue,
  };
}
