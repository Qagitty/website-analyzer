// ─── URL Pre-Validation ──────────────────────────────────────────────────────

type UrlValidationResult = {
  isValid: boolean;
  reason?: string;
  statusCode?: number;
  finalUrl?: string;
  errorType?:
    | 'http_error'
    | 'navigation_error'
    | 'empty_page'
    | 'browser_error_page'
    | 'unknown';
};

/** HTTP status codes that indicate a broken/unavailable page. */
const HTTP_ERROR_STATUSES = new Set([404, 410, 500, 502, 503, 504]);

/**
 * Lowercase text patterns that appear in browser / CDN error pages.
 * We check these against a stripped copy of the HTML body.
 */
const BROWSER_ERROR_PATTERNS: readonly string[] = [
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
];

/**
 * Substrings found in fetch() error messages that indicate a navigation /
 * DNS / TLS failure rather than a normal HTTP error response.
 */
const NAVIGATION_ERROR_FRAGMENTS: readonly string[] = [
  'err_name_not_resolved',
  'err_connection_refused',
  'err_connection_timed_out',
  'err_ssl_protocol_error',
  'err_cert_authority_invalid',
  'net::err_',
  'dns_probe_finished_nxdomain',
  'failed to fetch',
  'networkerror',
  'getaddrinfo',
  'enotfound',
  'etimedout',
  'econnrefused',
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- available for structured logging
function workerLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: Record<string, unknown>,
): void {
  const entry = JSON.stringify({ level, ts: new Date().toISOString(), message, ...data });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
}

function httpStatusText(code: number): string {
  const map: Record<number, string> = {
    404: 'Not Found',
    410: 'Gone',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return map[code] ?? 'HTTP Error';
}

/**
 * Pre-validate a URL before spending analysis credits.
 *
 * Checks (in order):
 *  1. Navigation reachability — fetch must not throw (DNS, TLS, timeout)
 *  2. HTTP status          — blocks 404 / 410 / 500 / 502 / 503 / 504
 *  3. Empty page           — body < 500 bytes or < 50 visible chars
 *  4. Browser error page   — known error-page text in thin content (< 400 chars)
 *
 * NOTE: console errors, CSP warnings, and failed analytics requests do NOT
 * cause a validation failure — many healthy sites have those.
 */
async function validateWebsiteUrl(url: string): Promise<UrlValidationResult> {
  workerLog('info', 'Validating URL before analysis', { url });

  // ── 1. Navigation reachability ──────────────────────────────────────────
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const msg = err instanceof Error ? err.message : String(err);
    const reason = isAbort
      ? 'Connection timed out — the site may be down or very slow.'
      : `Navigation failed: ${msg}`;
    workerLog('warn', 'URL validation failed — navigation error', { url, reason });
    return { isValid: false, reason, errorType: 'navigation_error', finalUrl: url };
  } finally {
    clearTimeout(timer);
  }

  const finalUrl = response.url || url;
  const statusCode = response.status;

  // ── 2. HTTP error status ────────────────────────────────────────────────
  if (HTTP_ERROR_STATUSES.has(statusCode)) {
    const reason = `HTTP ${statusCode} — ${httpStatusText(statusCode)}`;
    workerLog('warn', 'URL validation failed — HTTP error', { url, finalUrl, statusCode });
    return { isValid: false, reason, statusCode, finalUrl, errorType: 'http_error' };
  }

  // Read body once for the remaining checks
  let html: string;
  try {
    html = await response.text();
  } catch {
    workerLog('warn', 'URL validation failed — could not read response body', { url, finalUrl, statusCode });
    return { isValid: false, reason: 'Could not read page content', statusCode, finalUrl, errorType: 'unknown' };
  }

  const visibleText = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  // ── 3. Browser / server error page detection ────────────────────────────
  // Checked BEFORE the empty-page guard so that short-but-identifiable error
  // pages (e.g. "Page Not Found", "This site can't be reached") get the more
  // descriptive error type.
  // We only flag when visible content is thin (< 400 chars) to avoid false
  // positives on legitimate pages that merely mention error strings in prose.
  const bodyLower = html.toLowerCase();
  const matchedPattern = BROWSER_ERROR_PATTERNS.find(p => bodyLower.includes(p));
  if (matchedPattern && visibleText.length < 400) {
    const reason = `Detected error page (matched: "${matchedPattern}")`;
    workerLog('warn', 'URL validation failed — browser error page', { url, finalUrl, statusCode, matchedPattern });
    return { isValid: false, reason, statusCode, finalUrl, errorType: 'browser_error_page' };
  }

  // ── 4. Empty / near-empty page ──────────────────────────────────────────
  if (html.length < 500 || visibleText.length < 50) {
    const reason = `Page appears empty — ${html.length} bytes HTML, ${visibleText.length} visible chars`;
    workerLog('warn', 'URL validation failed — empty page', { url, finalUrl, statusCode, htmlBytes: html.length, visibleChars: visibleText.length });
    return { isValid: false, reason, statusCode, finalUrl, errorType: 'empty_page' };
  }

  workerLog('info', 'URL validation passed', { url, finalUrl, statusCode });
  return { isValid: true, statusCode, finalUrl };
}

// ─────────────────────────────────────────────────────────────────────────────

interface Env {
  WORKER_AUTH_TOKEN: string;
  WORKER_CALLBACK_SECRET: string;
}

interface AnalysisRequest {
  analysisId: string;
  url: string;
  callbackUrl: string;
  authToken: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.headers.get('Authorization') !== `Bearer ${env.WORKER_AUTH_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body: AnalysisRequest;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    ctx.waitUntil(runAnalysis(body));

    return new Response(
      JSON.stringify({ status: 'queued', analysisId: body.analysisId }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  },
};

async function runAnalysis(req: AnalysisRequest): Promise<void> {
  const startTime = Date.now();

  // ── Step 0: Pre-validate the URL ─────────────────────────────────────────
  // Abort early (before spending a credit-worth of work) if the URL is broken,
  // returns an HTTP error, or renders an error page.
  const validation = await validateWebsiteUrl(req.url);
  if (!validation.isValid) {
    await sendCallback(req.callbackUrl, req.authToken, {
      analysisId: req.analysisId,
      error:
        'The provided URL is unavailable, broken, or points to a non-existing page. ' +
        'Please verify the link and try again.',
      validationDebug: {
        statusCode: validation.statusCode,
        finalUrl:   validation.finalUrl,
        errorType:  validation.errorType,
        reason:     validation.reason,
      },
    });
    return;
  }

  try {
    // Run 3 TTFB measurements for stability
    const ttfbSamples: number[] = [];
    let html = '';
    let response!: Response;
    let pageBytes = 0;

    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = Date.now();
      const fetchCtrl = new AbortController();
      setTimeout(() => fetchCtrl.abort(), 15_000);
      const r = await fetch(req.url, { headers: fetchHeaders, redirect: 'follow', signal: fetchCtrl.signal });
      const ttfb = Date.now() - t0;
      ttfbSamples.push(ttfb);
      if (attempt === 0) {
        // Only read body once (expensive)
        html = await r.text();
        pageBytes = new TextEncoder().encode(html).length;
        response = r;
      } else {
        await r.body?.cancel(); // discard body
      }
      if (attempt < 2) await new Promise<void>((res) => setTimeout(res, 200)); // 200ms between
    }

    // Median TTFB (middle value of sorted samples)
    const sorted = [...ttfbSamples].sort((a, b) => a - b);
    const ttfb = sorted[1]; // median of 3
    const ttfbMin = sorted[0];
    const ttfbMax = sorted[2];

    const scores = analyzeHTML(html, response, pageBytes, ttfb);
    const accessibilityIssues = checkAccessibility(html);
    const consoleErrors = checkCommonErrors(html, response);
    const llmReadiness = checkLLMReadiness(html);
    const resourceAudit = analyzeResources(html, response, req.url);
    const securityHeaders = analyzeSecurityHeaders(response);

    // Build homepage crawled page entry
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const homepageTitle = titleMatch ? titleMatch[1].trim() : req.url;

    const crawledPages: CrawledPage[] = [
      {
        url: response.url,
        statusCode: response.status,
        ttfb,
        bytes: pageBytes,
        title: homepageTitle,
        performance: scores.performance,
        seo: scores.seo,
        accessibility: scores.accessibility,
        llmReadiness: llmReadiness.score,
      },
    ];

    // Crawl up to 4 additional internal links
    const internalLinks = crawlInternalLinks(html, req.url);
    for (const link of internalLinks.slice(0, 4)) {
      const page = await crawlPage(link, fetchHeaders);
      crawledPages.push(page);
    }

    await sendCallback(req.callbackUrl, req.authToken, {
      analysisId: req.analysisId,
      screenshotBase64: null,
      lighthouseScores: {
        performance: scores.performance,
        accessibility: scores.accessibility,
        bestPractices: scores.bestPractices,
        seo: scores.seo,
        lcp: scores.estimatedLcp,
        fid: 0,
        cls: 0,
        ttfb,
        ttfbSamples,
        performanceVariance: ttfbMax - ttfbMin,
        llmReadiness: llmReadiness.score,
        llmChecks: llmReadiness.checks,
        llmSignals: llmReadiness.signals,
        securityHeaders,
        scoreBreakdown: scores.scoreBreakdown,
      },
      consoleErrors,
      accessibilityIssues,
      networkSummary: {
        totalRequests: 1,
        totalBytes: pageBytes,
        failedRequests: response.ok ? 0 : 1,
        slowRequests: ttfb > 3000 ? 1 : 0,
        statusCode: response.status,
        finalUrl: response.url,
        redirected: response.redirected,
        analysisTimeMs: Date.now() - startTime,
        resourceAudit,
      },
      crawledPages,
    });
  } catch (err: unknown) {
    await sendCallback(req.callbackUrl, req.authToken, {
      analysisId: req.analysisId,
      error: err instanceof Error ? err.message : 'Failed to fetch URL',
    });
  }
}

interface ScoreCheckItem {
  label: string;
  passed: boolean;
  details?: string;
}
interface ScoreBreakdown {
  performance: ScoreCheckItem[];
  bestPractices: ScoreCheckItem[];
  seo: ScoreCheckItem[];
  accessibility: ScoreCheckItem[];
}
interface Scores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  estimatedLcp: number;
  scoreBreakdown: ScoreBreakdown;
}

interface LLMReadiness {
  score: number;
  checks: {
    hasStructuredData: boolean;
    hasMetaDescription: boolean;
    hasOpenGraph: boolean;
    hasSitemap: boolean;
    allowsAIBots: boolean;
    hasCleanHeadings: boolean;
    hasSufficientContent: boolean;
    hasCanonical: boolean;
  };
  signals: string[];
}

interface CrawledPage {
  url: string;
  statusCode: number;
  ttfb: number;
  bytes: number;
  title: string;
  performance: number;
  seo: number;
  accessibility: number;
  llmReadiness: number;
}

interface ResourceAuditItemW { url: string; type: 'script' | 'stylesheet'; }
interface ImageAuditItemW { src: string; issues: string[]; }
interface ThirdPartyGroupW { domain: string; count: number; types: string[]; }
interface MixedContentItemW { url: string; tag: string; }
interface ResourceAuditW {
  renderBlocking: ResourceAuditItemW[];
  imageIssues: ImageAuditItemW[];
  thirdParty: ThirdPartyGroupW[];
  mixedContent: MixedContentItemW[];
  totalScripts: number; asyncScripts: number; deferScripts: number;
  totalStylesheets: number; totalImages: number; lazyImages: number; inlineScriptCount: number;
}
interface SecurityHeaderResultW {
  header: string; present: boolean; value: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string; recommendation: string;
}

function analyzeHTML(html: string, response: Response, bytes: number, ttfb: number): Scores {
  const lower = html.toLowerCase();

  // --- Performance ---
  // Estimate LCP from TTFB + page size heuristic
  const estimatedLcp = ttfb + Math.round(bytes / 5000) * 100; // rough: 100ms per 5KB
  const lcpScore = estimatedLcp < 2500 ? 95 : estimatedLcp < 4000 ? 65 : 30;
  const ttfbScore = ttfb < 800 ? 95 : ttfb < 1800 ? 65 : 30;
  // Penalise very heavy pages (>500KB HTML is a red flag)
  const sizeScore = bytes < 100_000 ? 95 : bytes < 300_000 ? 75 : bytes < 500_000 ? 50 : 25;
  const performance = Math.round((lcpScore * 0.4) + (ttfbScore * 0.35) + (sizeScore * 0.25));

  // --- SEO ---
  const hasTitle = /<title[^>]*>[^<]{3,}<\/title>/i.test(html);
  const hasMetaDesc = /meta[^>]+name=["']description["'][^>]*content=["'][^"']{10,}/i.test(html)
    || /meta[^>]+content=["'][^"']{10,}["'][^>]*name=["']description["']/i.test(html);
  const hasH1 = /<h1[\s>]/i.test(html);
  const hasViewport = /meta[^>]+name=["']viewport["']/i.test(html);
  const hasCanonical = /rel=["']canonical["']/i.test(html);
  const hasLang = /html[^>]+lang=["'][a-z]/i.test(html);
  const isHttps = response.url.startsWith('https://');
  const seoChecks = [hasTitle, hasMetaDesc, hasH1, hasViewport, hasCanonical, hasLang, isHttps];
  const seo = Math.round((seoChecks.filter(Boolean).length / seoChecks.length) * 100);

  // --- Best Practices ---
  const hasXFrameOptions = response.headers.get('x-frame-options') !== null;
  const hasCSP = response.headers.get('content-security-policy') !== null;
  const hasHSTS = response.headers.get('strict-transport-security') !== null;
  const hasXContentType = response.headers.get('x-content-type-options') !== null;
  const noMixedContent = !lower.includes('src="http://') && !lower.includes("src='http://");
  const noInlineHandlers = !/ on(click|load|error|submit)=/i.test(html);
  const bpChecks = [isHttps, hasXFrameOptions, hasCSP, hasHSTS, hasXContentType, noMixedContent, noInlineHandlers];
  const bestPractices = Math.round((bpChecks.filter(Boolean).length / bpChecks.length) * 100);

  // --- Accessibility (score) ---
  // Computed from the same checks used in checkAccessibility() for consistency
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const imgsWithoutAlt = imgMatches.filter(img => !/alt=/i.test(img)).length;
  const inputMatches = html.match(/<input[^>]*>/gi) || [];
  const inputsWithoutLabel = inputMatches.filter(
    input => !/type=["'](hidden|submit|button|reset|image)["']/i.test(input) &&
             !/aria-label/i.test(input) && !/aria-labelledby/i.test(input) && !/id=["'][^"']/i.test(input)
  ).length;
  const totalImgs = imgMatches.length;
  const totalInputs = inputMatches.filter(i => !/type=["'](hidden|submit|button|reset|image)["']/i.test(i)).length;
  const altRatio = totalImgs === 0 ? 1 : (totalImgs - imgsWithoutAlt) / totalImgs;
  const labelRatio = totalInputs === 0 ? 1 : (totalInputs - inputsWithoutLabel) / totalInputs;
  const hasSkipLink = /skip.*nav|skip.*content|main-content/i.test(html);
  const hasMain = /<main[\s>]/i.test(html) || /role=["']main["']/i.test(html);
  const hasNav = /<nav[\s>]/i.test(html) || /role=["']navigation["']/i.test(html);
  const noOutlineNone = !/outline\s*:\s*(?:none|0)\b/i.test(html);
  const noPositiveTabindex = !/tabindex=["'][1-9]/i.test(html);
  const noViewportBlock = !/user-scalable\s*=\s*no/i.test(html);
  const accessibility = Math.round(
    (altRatio * 25) +
    (labelRatio * 20) +
    (hasSkipLink ? 8 : 0) +
    (hasMain ? 10 : 0) +
    (hasNav ? 5 : 0) +
    (hasLang ? 12 : 0) +
    (noOutlineNone ? 8 : 0) +
    (noPositiveTabindex ? 6 : 0) +
    (noViewportBlock ? 6 : 0)
  );

  const scoreBreakdown: ScoreBreakdown = {
    performance: [
      {
        label: 'Time to First Byte (TTFB)',
        passed: ttfb < 800,
        details: ttfb < 800 ? `${ttfb}ms — good` : `${ttfb}ms — target <800ms. Use a CDN, enable caching headers, or optimize server response time`,
      },
      {
        label: 'Estimated Largest Contentful Paint',
        passed: estimatedLcp < 2500,
        details: estimatedLcp < 2500 ? `~${(estimatedLcp/1000).toFixed(1)}s — good` : `~${(estimatedLcp/1000).toFixed(1)}s — target <2.5s. Reduce server response time and page weight`,
      },
      {
        label: 'Page weight',
        passed: bytes < 300_000,
        details: bytes < 300_000 ? `${Math.round(bytes/1024)}KB — good` : `${Math.round(bytes/1024)}KB HTML — reduce inline scripts/styles and avoid large embedded SVGs`,
      },
    ],
    bestPractices: [
      {
        label: 'HTTPS',
        passed: isHttps,
        details: isHttps ? 'Site served over HTTPS' : "Site is served over HTTP — migrate to HTTPS immediately (free via Let's Encrypt)",
      },
      {
        label: 'X-Frame-Options header',
        passed: hasXFrameOptions,
        details: hasXFrameOptions ? 'Present' : 'Missing — add response header: X-Frame-Options: SAMEORIGIN to prevent clickjacking attacks',
      },
      {
        label: 'Content Security Policy header',
        passed: hasCSP,
        details: hasCSP ? 'Present' : 'Missing — add Content-Security-Policy header to restrict which resources can load on the page',
      },
      {
        label: 'Strict-Transport-Security (HSTS)',
        passed: hasHSTS,
        details: hasHSTS ? 'Present' : 'Missing — add Strict-Transport-Security: max-age=31536000 to enforce HTTPS connections',
      },
      {
        label: 'X-Content-Type-Options header',
        passed: hasXContentType,
        details: hasXContentType ? 'Present' : 'Missing — add X-Content-Type-Options: nosniff to prevent MIME-type sniffing attacks',
      },
      {
        label: 'No mixed content',
        passed: noMixedContent,
        details: noMixedContent ? 'No HTTP resources detected on HTTPS page' : 'HTTP resources found on HTTPS page — update all src/href attributes to use https:// or protocol-relative URLs (//)',
      },
      {
        label: 'No inline event handlers',
        passed: noInlineHandlers,
        details: noInlineHandlers ? 'No inline onclick/onload handlers found' : 'Inline event handlers (onclick=, onload=, onsubmit=, etc.) detected — move to external JS files and use addEventListener()',
      },
    ],
    seo: [
      {
        label: '<title> tag',
        passed: hasTitle,
        details: hasTitle ? 'Present' : 'Missing — add a unique, descriptive <title> tag to every page (50–60 characters recommended)',
      },
      {
        label: 'Meta description',
        passed: hasMetaDesc,
        details: hasMetaDesc ? 'Present' : 'Missing — add <meta name="description" content="..."> with 150–160 characters summarising the page',
      },
      {
        label: '<h1> heading',
        passed: hasH1,
        details: hasH1 ? 'Present' : 'Missing — add exactly one <h1> element as the primary page heading',
      },
      {
        label: 'Viewport meta tag',
        passed: hasViewport,
        details: hasViewport ? 'Present' : 'Missing — add <meta name="viewport" content="width=device-width, initial-scale=1">',
      },
      {
        label: 'Canonical URL',
        passed: hasCanonical,
        details: hasCanonical ? 'Present' : 'Missing — add <link rel="canonical" href="https://yoursite.com/page"> to prevent duplicate content penalties',
      },
      {
        label: 'lang attribute on <html>',
        passed: hasLang,
        details: hasLang ? 'Present' : 'Missing — add lang="en" (or appropriate language code) to the <html> element',
      },
      {
        label: 'HTTPS',
        passed: isHttps,
        details: isHttps ? 'Site served over HTTPS — positive SEO ranking signal' : 'Site served over HTTP — Google penalises non-HTTPS sites in search rankings',
      },
    ],
    accessibility: [
      {
        label: 'Images have alt text',
        passed: altRatio === 1,
        details: altRatio === 1 ? 'All images have alt attributes' : `${Math.round((1 - altRatio) * 100)}% of images missing alt text — screen readers cannot describe these images to blind users. Add descriptive alt attributes to all <img> elements`,
      },
      {
        label: 'Form inputs have labels',
        passed: labelRatio === 1,
        details: labelRatio === 1 ? 'All inputs appear to have label associations' : `${Math.round((1 - labelRatio) * 100)}% of inputs may lack labels — screen reader users cannot identify form fields. Use <label for="id"> or aria-label on every input`,
      },
      {
        label: 'Skip navigation link',
        passed: hasSkipLink,
        details: hasSkipLink ? 'Skip link found' : 'No skip-to-content link — keyboard users must tab through all navigation on every page load. Add <a href="#main">Skip to main content</a> as the first element',
      },
      {
        label: '<main> landmark',
        passed: hasMain,
        details: hasMain ? '<main> landmark present' : 'No <main> element — screen reader users cannot jump directly to main content. Wrap page content in <main> or add role="main"',
      },
      {
        label: '<nav> landmark',
        passed: hasNav,
        details: hasNav ? '<nav> landmark present' : 'No <nav> element — navigation is not identifiable by assistive technologies. Wrap navigation links in <nav>',
      },
      {
        label: 'Language declared',
        passed: hasLang,
        details: hasLang ? 'lang attribute present on <html>' : 'Missing lang attribute on <html> — screen readers cannot select the correct pronunciation rules for the page language',
      },
      {
        label: 'Focus outline not removed',
        passed: noOutlineNone,
        details: noOutlineNone ? 'No outline:none detected' : 'outline:none or outline:0 found in page styles — keyboard users lose the visible focus indicator. Replace with a custom focus style instead of removing it',
      },
      {
        label: 'No positive tabindex values',
        passed: noPositiveTabindex,
        details: noPositiveTabindex ? 'No positive tabindex values found' : 'Positive tabindex values (e.g. tabindex="3") disrupt the natural keyboard navigation order — use tabindex="0" or remove tabindex entirely',
      },
      {
        label: 'Viewport allows user zoom',
        passed: noViewportBlock,
        details: noViewportBlock ? 'Zoom not blocked' : 'user-scalable=no in viewport meta prevents low-vision users from zooming — remove this restriction',
      },
    ],
  };

  return {
    performance: clamp(performance),
    accessibility: clamp(accessibility),
    bestPractices: clamp(bestPractices),
    seo: clamp(seo),
    estimatedLcp,
    scoreBreakdown,
  };
}

function checkAccessibility(html: string): any[] {
  const issues: any[] = [];

  // ── 1. IMAGES ──────────────────────────────────────────────────────────────
  const imgs = html.match(/<img[^>]*>/gi) || [];
  const missingAlt = imgs.filter(img => !/alt=/i.test(img));
  if (missingAlt.length > 0) {
    issues.push({
      id: 'image-alt',
      impact: 'critical',
      description: `${missingAlt.length} image(s) missing alt attribute`,
      nodes: missingAlt.slice(0, 3).map(img => img.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag111'],
    });
  }

  const emptyAlt = imgs.filter(img => /alt=["']\s*["']/i.test(img));
  if (emptyAlt.length > 0) {
    issues.push({
      id: 'image-alt-empty',
      impact: 'minor',
      description: `${emptyAlt.length} image(s) have empty alt text — verify they are purely decorative`,
      nodes: emptyAlt.slice(0, 3).map(img => img.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag111'],
    });
  }

  // ── 2. HTML LANG ───────────────────────────────────────────────────────────
  if (!/html[^>]+lang=["'][a-z]/i.test(html)) {
    issues.push({
      id: 'html-has-lang',
      impact: 'serious',
      description: 'The <html> element must have a lang attribute',
      nodes: ['<html>'],
      wcagCriteria: ['wcag2a', 'wcag311'],
    });
  }

  // ── 3. FORM LABELS & SEMANTICS ─────────────────────────────────────────────
  const inputs = html.match(/<input[^>]*>/gi) || [];

  // Inputs with no label association
  const unlabeled = inputs.filter(input =>
    !/type=["'](hidden|submit|button|reset|image)["']/i.test(input) &&
    !/aria-label/i.test(input) && !/aria-labelledby/i.test(input) && !/id=/i.test(input)
  );
  if (unlabeled.length > 0) {
    issues.push({
      id: 'label',
      impact: 'critical',
      description: `${unlabeled.length} form input(s) may be missing associated <label> elements`,
      nodes: unlabeled.slice(0, 3).map(i => i.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag131', 'wcag332'],
    });
  }

  // Placeholder used as sole label substitute
  const placeholderOnly = inputs.filter(input =>
    /placeholder=/i.test(input) &&
    !/aria-label=/i.test(input) && !/aria-labelledby=/i.test(input) &&
    !/type=["'](hidden|submit|button|reset)["']/i.test(input)
  );
  if (placeholderOnly.length > 0) {
    issues.push({
      id: 'label-placeholder',
      impact: 'moderate',
      description: `${placeholderOnly.length} input(s) use placeholder as a label substitute — placeholder text disappears on typing and has poor contrast`,
      nodes: placeholderOnly.slice(0, 3).map(i => i.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // Select without accessible label
  const selects = html.match(/<select[^>]*>/gi) || [];
  const unlabeledSelects = selects.filter(s =>
    !/aria-label=/i.test(s) && !/aria-labelledby=/i.test(s) && !/id=/i.test(s)
  );
  if (unlabeledSelects.length > 0) {
    issues.push({
      id: 'select-label',
      impact: 'critical',
      description: `${unlabeledSelects.length} <select> element(s) missing accessible labels`,
      nodes: unlabeledSelects.slice(0, 3).map(s => s.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // Textarea without accessible label
  const textareas = html.match(/<textarea[^>]*>/gi) || [];
  const unlabeledTextareas = textareas.filter(t =>
    !/aria-label=/i.test(t) && !/aria-labelledby=/i.test(t) && !/id=/i.test(t)
  );
  if (unlabeledTextareas.length > 0) {
    issues.push({
      id: 'textarea-label',
      impact: 'critical',
      description: `${unlabeledTextareas.length} <textarea> element(s) missing accessible labels`,
      nodes: unlabeledTextareas.slice(0, 3).map(t => t.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // ── 4. BUTTON NAMES ────────────────────────────────────────────────────────
  const buttonTags = html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) || [];
  const emptyButtons = buttonTags.filter(btn => {
    const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(btn);
    const hasAriaLabelledby = /aria-labelledby=/i.test(btn);
    const innerText = btn.replace(/<[^>]+>/g, '').trim();
    return !hasAriaLabel && !hasAriaLabelledby && innerText.length === 0;
  });
  if (emptyButtons.length > 0) {
    issues.push({
      id: 'button-name',
      impact: 'critical',
      description: `${emptyButtons.length} button(s) have no accessible name — no visible text, aria-label, or aria-labelledby`,
      nodes: emptyButtons.slice(0, 3).map(b => b.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag412'],
    });
  }

  // ── 5. LINKS ───────────────────────────────────────────────────────────────
  const anchors = html.match(/<a[^>]*>[\s\S]*?<\/a>/gi) || [];

  // Generic non-descriptive link text
  const genericLinks = anchors.filter(a => {
    const text = a.replace(/<[^>]+>/g, '').trim().toLowerCase();
    return /^(click here|here|read more|more|link|this|learn more|details|info|see more|continue|go|view)$/.test(text);
  });
  if (genericLinks.length > 0) {
    issues.push({
      id: 'link-name-generic',
      impact: 'serious',
      description: `${genericLinks.length} link(s) use generic non-descriptive text ("click here", "read more", etc.) — screen readers list all links out of context`,
      nodes: genericLinks.slice(0, 3).map(a => a.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag244'],
    });
  }

  // Empty links (no text content and no aria-label)
  const emptyLinks = anchors.filter(a => {
    const hasAriaLabel = /aria-label=["'][^"']+["']/i.test(a);
    const innerText = a.replace(/<[^>]+>/g, '').trim();
    return !hasAriaLabel && innerText.length === 0;
  });
  if (emptyLinks.length > 0) {
    issues.push({
      id: 'link-name-empty',
      impact: 'serious',
      description: `${emptyLinks.length} link(s) have no accessible name (no text and no aria-label)`,
      nodes: emptyLinks.slice(0, 3).map(a => a.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag244'],
    });
  }

  // Links opening in new tab without user warning
  const newTabLinks = anchors.filter(a =>
    /target=["']_blank["']/i.test(a) &&
    !/opens.{0,20}new|new.{0,10}(window|tab)/i.test(a) &&
    !/aria-label.*new/i.test(a)
  );
  if (newTabLinks.length > 0) {
    issues.push({
      id: 'link-new-tab-no-warning',
      impact: 'minor',
      description: `${newTabLinks.length} link(s) open in a new tab/window without warning users — add "(opens in new tab)" text or aria-label`,
      nodes: newTabLinks.slice(0, 3).map(a => a.slice(0, 100)),
      wcagCriteria: ['wcag2aaa', 'wcag321'],
    });
  }

  // ── 6. HEADINGS ────────────────────────────────────────────────────────────
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;

  if (h1Count === 0) {
    issues.push({
      id: 'page-has-heading-one',
      impact: 'moderate',
      description: 'Page has no <h1> heading — every page should have exactly one main heading',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  } else if (h1Count > 1) {
    issues.push({
      id: 'heading-multiple-h1',
      impact: 'moderate',
      description: `Page has ${h1Count} <h1> elements — there should be exactly one`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // Skipped heading levels (e.g. h1 → h3 without h2)
  const headingLevels = ([1,2,3,4,5,6] as const)
    .map(n => ((html.match(new RegExp(`<h${n}[\\s>]`, 'gi')) || []).length > 0 ? n : null))
    .filter((n): n is number => n !== null);
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      issues.push({
        id: 'heading-skipped',
        impact: 'moderate',
        description: `Heading level skipped: <h${headingLevels[i - 1]}> jumps to <h${headingLevels[i]}> — assistive technologies rely on sequential heading structure`,
        nodes: [],
        wcagCriteria: ['wcag2a', 'wcag131'],
      });
      break;
    }
  }

  // ── 7. LANDMARK REGIONS ───────────────────────────────────────────────────
  if (!/<main[\s>]/i.test(html) && !/role=["']main["']/i.test(html)) {
    issues.push({
      id: 'landmark-main-missing',
      impact: 'moderate',
      description: 'Page has no <main> landmark — screen reader users cannot jump directly to main content',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  if (!/<nav[\s>]/i.test(html) && !/role=["']navigation["']/i.test(html)) {
    issues.push({
      id: 'landmark-nav-missing',
      impact: 'minor',
      description: 'Page has no <nav> landmark — navigation is not identifiable by assistive technologies',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // ── 8. SKIP LINK ───────────────────────────────────────────────────────────
  if (!/skip.*nav|skip.*content|href=["']#main|href=["']#content/i.test(html)) {
    issues.push({
      id: 'skip-link',
      impact: 'moderate',
      description: 'No "skip to main content" link — keyboard users must tab through all navigation on every page load',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag241'],
    });
  }

  // ── 9. ARIA MISUSE ────────────────────────────────────────────────────────
  // aria-hidden on focusable elements
  const ariaHiddenFocusable = (html.match(/<(?:a|button|input|select|textarea)[^>]*aria-hidden=["']true["'][^>]*>/gi) || []);
  if (ariaHiddenFocusable.length > 0) {
    issues.push({
      id: 'aria-hidden-focus',
      impact: 'serious',
      description: `${ariaHiddenFocusable.length} interactive element(s) marked aria-hidden="true" while still focusable — screen readers will skip them but keyboard focus can still land there`,
      nodes: ariaHiddenFocusable.slice(0, 3).map(e => e.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag412'],
    });
  }

  // Empty aria-label (worse than no label)
  const emptyAriaLabels = (html.match(/aria-label=["']\s*["']/gi) || []).length;
  if (emptyAriaLabels > 0) {
    issues.push({
      id: 'aria-label-empty',
      impact: 'serious',
      description: `${emptyAriaLabels} element(s) have empty aria-label="" — this overrides any other accessible name with nothing`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag412'],
    });
  }

  // Positive tabindex breaks natural focus order
  const positiveTabindex = (html.match(/tabindex=["'][1-9]\d*["']/gi) || []).length;
  if (positiveTabindex > 0) {
    issues.push({
      id: 'tabindex-positive',
      impact: 'serious',
      description: `${positiveTabindex} element(s) use positive tabindex values — this overrides natural tab order and creates unpredictable keyboard navigation`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag243'],
    });
  }

  // ── 10. KEYBOARD / FOCUS ──────────────────────────────────────────────────
  // outline:none / outline:0 removes visible focus indicator
  if (/outline\s*:\s*(?:none|0)\b/i.test(html)) {
    issues.push({
      id: 'focus-outline-removed',
      impact: 'serious',
      description: 'CSS contains `outline: none` or `outline: 0` — this removes the visible keyboard focus indicator for users who navigate without a mouse',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag241', 'wcag2411'],
    });
  }

  // ── 11. CLICKABLE NON-INTERACTIVE ELEMENTS ────────────────────────────────
  const clickableDivs = (html.match(/<div[^>]*onclick[^>]*>/gi) || [])
    .filter(d => !/role=["'](button|link|menuitem|tab|option)["']/i.test(d) && !/tabindex=/i.test(d));
  const clickableSpans = (html.match(/<span[^>]*onclick[^>]*>/gi) || [])
    .filter(s => !/role=["'](button|link|menuitem|tab|option)["']/i.test(s) && !/tabindex=/i.test(s));
  const nonInteractiveClicks = clickableDivs.length + clickableSpans.length;
  if (nonInteractiveClicks > 0) {
    issues.push({
      id: 'click-events-have-key-events',
      impact: 'serious',
      description: `${nonInteractiveClicks} div/span element(s) have onclick handlers but no role or tabindex — they are completely inaccessible to keyboard and screen reader users`,
      nodes: [...clickableDivs, ...clickableSpans].slice(0, 3).map(e => e.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag211'],
    });
  }

  // ── 12. SVG ACCESSIBILITY ─────────────────────────────────────────────────
  const svgs = html.match(/<svg[^>]*>/gi) || [];
  const svgsUnlabeled = svgs.filter(svg =>
    !/aria-label=/i.test(svg) &&
    !/aria-labelledby=/i.test(svg) &&
    !/aria-hidden=["']true["']/i.test(svg) &&
    !/role=["']img["']/i.test(svg)
  );
  if (svgsUnlabeled.length > 0) {
    issues.push({
      id: 'svg-img-alt',
      impact: 'moderate',
      description: `${svgsUnlabeled.length} SVG element(s) have no accessible label and are not hidden from screen readers — add role="img" aria-label="..." or aria-hidden="true" if decorative`,
      nodes: svgsUnlabeled.slice(0, 3).map(s => s.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag111'],
    });
  }

  // ── 13. META VIEWPORT SCALING ─────────────────────────────────────────────
  if (/user-scalable\s*=\s*no/i.test(html) || /maximum-scale\s*=\s*1[^.\d]/i.test(html)) {
    issues.push({
      id: 'meta-viewport-user-scalable',
      impact: 'critical',
      description: 'Viewport is configured to prevent user zooming (user-scalable=no or maximum-scale=1) — this blocks the ability to zoom for low-vision users',
      nodes: [(html.match(/<meta[^>]*viewport[^>]*>/i) || [''])[0].slice(0, 120)],
      wcagCriteria: ['wcag2aa', 'wcag144'],
    });
  }

  // ── 14. COLOR CONTRAST INDICATORS ────────────────────────────────────────
  // Heuristic: flag common low-contrast color values found in inline styles
  const lightColorMatches = (html.match(/color\s*:\s*(#(?:[89a-fA-F][0-9a-fA-F]{5}|[cCdDeEfF][0-9a-fA-F]{2})|lightgray|lightgrey|silver|#ccc|#ddd|#eee|#aaa|#bbb)/gi) || []).length;
  if (lightColorMatches >= 3) {
    issues.push({
      id: 'color-contrast',
      impact: 'serious',
      description: `Potential low color contrast: ${lightColorMatches} instance(s) of light text color values detected in inline styles (e.g. #ccc, silver, lightgray) — verify contrast ratios meet WCAG AA (4.5:1 for normal text, 3:1 for large text)`,
      nodes: [],
      wcagCriteria: ['wcag2aa', 'wcag143'],
    });
  }

  // ── 15. VIDEO CAPTIONS ────────────────────────────────────────────────────
  const videoBlocks = html.match(/<video[\s\S]*?<\/video>/gi) || [];
  const videosWithoutTrack = videoBlocks.filter(v => !/<track/i.test(v));
  if (videosWithoutTrack.length > 0) {
    issues.push({
      id: 'video-caption',
      impact: 'critical',
      description: `${videosWithoutTrack.length} <video> element(s) have no <track kind="captions"> — deaf and hard-of-hearing users cannot access audio content`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag122'],
    });
  }

  // ── 16. TABLE HEADERS ─────────────────────────────────────────────────────
  const tableBlocks = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const tablesNoTh = tableBlocks.filter(t => !/<th[\s>]/i.test(t));
  if (tablesNoTh.length > 0) {
    issues.push({
      id: 'table-duplicate-name',
      impact: 'serious',
      description: `${tablesNoTh.length} data table(s) have no <th> header cells — screen readers cannot convey row/column context to users`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // <th> without scope attribute
  const thTags = html.match(/<th[^>]*>/gi) || [];
  const thNoScope = thTags.filter(th => !/scope=/i.test(th));
  if (thNoScope.length > 0) {
    issues.push({
      id: 'table-th-no-scope',
      impact: 'moderate',
      description: `${thNoScope.length} <th> element(s) missing scope attribute — add scope="col" or scope="row" to clarify header direction`,
      nodes: thNoScope.slice(0, 3).map(t => t.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // ── 17. IFRAMES ───────────────────────────────────────────────────────────
  const iframes = html.match(/<iframe[^>]*>/gi) || [];
  const iframesNoTitle = iframes.filter(f => !/title=["'][^"']+["']/i.test(f) && !/aria-label=/i.test(f));
  if (iframesNoTitle.length > 0) {
    issues.push({
      id: 'frame-title',
      impact: 'serious',
      description: `${iframesNoTitle.length} <iframe> element(s) missing title attribute — screen readers cannot identify the purpose of embedded content`,
      nodes: iframesNoTitle.slice(0, 3).map(f => f.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag241'],
    });
  }

  // ── 18. AUDIO ─────────────────────────────────────────────────────────────
  const audioBlocks = html.match(/<audio[\s\S]*?<\/audio>/gi) || [];
  if (audioBlocks.length > 0) {
    issues.push({
      id: 'audio-caption',
      impact: 'serious',
      description: `${audioBlocks.length} <audio> element(s) detected — ensure a text transcript is provided nearby for deaf and hard-of-hearing users`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag121'],
    });
  }

  // ── 19. AUTOPLAY MEDIA ────────────────────────────────────────────────────
  const autoplayMedia = (html.match(/<(?:video|audio)[^>]*autoplay[^>]*>/gi) || [])
    .filter(m => !/muted/i.test(m));
  if (autoplayMedia.length > 0) {
    issues.push({
      id: 'no-autoplay-audio',
      impact: 'moderate',
      description: `${autoplayMedia.length} media element(s) autoplay with audio — this can disorient screen reader users and violates WCAG 1.4.2`,
      nodes: autoplayMedia.slice(0, 3).map(m => m.slice(0, 100)),
      wcagCriteria: ['wcag2a', 'wcag142'],
    });
  }

  return issues;
}

function checkCommonErrors(html: string, response: Response): any[] {
  const errors: any[] = [];

  if (!response.ok) {
    errors.push({
      message: `Page returned HTTP ${response.status}`,
      type: 'error',
      source: response.url,
      timestamp: Date.now(),
    });
  }

  // Detect common JavaScript error patterns embedded in HTML
  const errorPatterns = [
    { re: /ReferenceError:/g, label: 'ReferenceError in page' },
    { re: /TypeError:/g, label: 'TypeError in page' },
    { re: /SyntaxError:/g, label: 'SyntaxError in page' },
    { re: /Uncaught\s+\w+Error:/g, label: 'Uncaught JS error in page' },
  ];
  for (const { re, label } of errorPatterns) {
    const matches = html.match(re);
    if (matches) {
      errors.push({ message: `${label} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`, type: 'error', source: response.url, timestamp: Date.now() });
    }
  }

  // Detect console.error calls that may be indicative of dev issues
  if ((html.match(/console\.error/g) || []).length > 3) {
    errors.push({ message: 'Multiple console.error() calls found in page source', type: 'warning', source: response.url, timestamp: Date.now() });
  }

  return errors;
}

function checkLLMReadiness(html: string): LLMReadiness {
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

function crawlInternalLinks(html: string, baseUrl: string): string[] {
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
    // Same origin only
    if (parsed.hostname !== base.hostname) continue;
    // Skip common non-content paths
    if (skipPatterns.some(p => parsed.pathname.startsWith(p))) continue;
    // Skip homepage itself
    if (parsed.pathname === '/' && parsed.search === '') continue;
    // Deduplicate
    const key = parsed.origin + parsed.pathname;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push(absolute);
    if (results.length >= 4) break;
  }

  return results;
}

async function crawlPage(url: string, fetchHeaders: object): Promise<CrawledPage> {
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

function analyzeResources(html: string, response: Response, baseUrl: string): ResourceAuditW {
  const base = new URL(baseUrl);
  const isHttps = response.url.startsWith('https://');
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : '';

  // Scripts
  const allScripts = html.match(/<script[^>]*>/gi) ?? [];
  const totalScripts = allScripts.length;
  const asyncScripts = allScripts.filter(s => /\basync\b/i.test(s)).length;
  const deferScripts = allScripts.filter(s => /\bdefer\b/i.test(s)).length;
  const inlineScriptCount = (html.match(/<script(?![^>]*\bsrc\b)[^>]*>[\s\S]{200,}?<\/script>/gi) ?? []).length;

  // Render-blocking scripts (in head, external, no async/defer)
  const headScripts = headHtml.match(/<script[^>]+src=["'][^"']+["'][^>]*>/gi) ?? [];
  const renderBlockingScripts: ResourceAuditItemW[] = headScripts
    .filter(s => !/\basync\b/i.test(s) && !/\bdefer\b/i.test(s))
    .map(s => ({ url: (s.match(/src=["']([^"']+)["']/i)?.[1] ?? '?'), type: 'script' as const }));

  // Stylesheets
  const allLinks = html.match(/<link[^>]+>/gi) ?? [];
  const stylesheets = allLinks.filter(l => /rel=["']stylesheet["']/i.test(l));
  const totalStylesheets = stylesheets.length;
  const headLinks = headHtml.match(/<link[^>]+>/gi) ?? [];
  const renderBlockingCSS: ResourceAuditItemW[] = headLinks
    .filter(l => /rel=["']stylesheet["']/i.test(l) && !/media=["']print["']/i.test(l))
    .map(l => ({ url: (l.match(/href=["']([^"']+)["']/i)?.[1] ?? '?'), type: 'stylesheet' as const }));

  const renderBlocking = [...renderBlockingScripts, ...renderBlockingCSS].slice(0, 10);

  // Images
  const allImgs = html.match(/<img[^>]*>/gi) ?? [];
  const totalImages = allImgs.length;
  const lazyImages = allImgs.filter(img => /loading=["']lazy["']/i.test(img)).length;
  const imageIssues: ImageAuditItemW[] = [];
  for (const img of allImgs.slice(0, 30)) {
    const src = (img.match(/src=["']([^"']+)["']/i)?.[1] ?? '').split('?')[0].slice(-60);
    const issues: string[] = [];
    const hasW = /\bwidth=["']?\d+|width:\s*\d/i.test(img);
    const hasH = /\bheight=["']?\d+|height:\s*\d/i.test(img);
    if (!hasW || !hasH) issues.push('No width/height → causes CLS');
    if (!/loading=["']lazy["']/i.test(img)) issues.push('No lazy loading');
    if (!/srcset=/i.test(img)) issues.push('No srcset → not responsive');
    const low = src.toLowerCase();
    if ((low.endsWith('.jpg') || low.endsWith('.jpeg') || low.endsWith('.png')) && !low.includes('webp')) {
      issues.push('Use WebP/AVIF for 30–50% smaller files');
    }
    if (issues.length > 0) imageIssues.push({ src: src || '(unknown)', issues });
  }

  // Third-party resources
  const thirdPartyMap = new Map<string, { count: number; types: Set<string> }>();
  const resourceRe: [RegExp, string][] = [
    [/<script[^>]+src=["'](https?:\/\/[^"']+)["']/gi, 'script'],
    [/<link[^>]+href=["'](https?:\/\/[^"']+)["']/gi, 'link'],
    [/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi, 'image'],
    [/<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/gi, 'iframe'],
  ];
  for (const [re, type] of resourceRe) {
    const r = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(html)) !== null) {
      try {
        const u = new URL(m[1]);
        if (u.hostname === base.hostname) continue;
        const domain = u.hostname.replace(/^www\./, '');
        if (!thirdPartyMap.has(domain)) thirdPartyMap.set(domain, { count: 0, types: new Set() });
        const e = thirdPartyMap.get(domain)!;
        e.count++;
        e.types.add(type);
      } catch {}
    }
  }
  const thirdParty: ThirdPartyGroupW[] = [...thirdPartyMap.entries()]
    .map(([domain, { count, types }]) => ({ domain, count, types: [...types] }))
    .sort((a, b) => b.count - a.count).slice(0, 10);

  // Mixed content
  const mixedContent: MixedContentItemW[] = [];
  if (isHttps) {
    const mcRe: [RegExp, string][] = [
      [/<script[^>]+src=["'](http:\/\/[^"']+)["']/gi, 'script'],
      [/<link[^>]+href=["'](http:\/\/[^"']+)["']/gi, 'link'],
      [/<img[^>]+src=["'](http:\/\/[^"']+)["']/gi, 'image'],
      [/<iframe[^>]+src=["'](http:\/\/[^"']+)["']/gi, 'iframe'],
    ];
    for (const [re, tag] of mcRe) {
      const r = new RegExp(re.source, re.flags);
      let m: RegExpExecArray | null;
      while ((m = r.exec(html)) !== null) mixedContent.push({ url: m[1].slice(0, 100), tag });
    }
  }

  return {
    renderBlocking, imageIssues: imageIssues.slice(0, 20), thirdParty,
    mixedContent: mixedContent.slice(0, 10), totalScripts, asyncScripts, deferScripts,
    totalStylesheets, totalImages, lazyImages, inlineScriptCount,
  };
}

function analyzeSecurityHeaders(response: Response): SecurityHeaderResultW[] {
  const checks = [
    { header: 'content-security-policy', severity: 'critical' as const,
      description: 'Prevents XSS by whitelisting trusted content sources.',
      recommendation: "Content-Security-Policy: default-src 'self'; script-src 'self'" },
    { header: 'strict-transport-security', severity: 'high' as const,
      description: 'Forces HTTPS and prevents SSL-stripping attacks.',
      recommendation: 'Strict-Transport-Security: max-age=31536000; includeSubDomains' },
    { header: 'x-frame-options', severity: 'high' as const,
      description: 'Prevents clickjacking by blocking iframe embedding.',
      recommendation: 'X-Frame-Options: SAMEORIGIN' },
    { header: 'x-content-type-options', severity: 'medium' as const,
      description: 'Stops MIME-type sniffing that can expose XSS vectors.',
      recommendation: 'X-Content-Type-Options: nosniff' },
    { header: 'referrer-policy', severity: 'medium' as const,
      description: 'Controls how much referrer info is sent with requests.',
      recommendation: 'Referrer-Policy: strict-origin-when-cross-origin' },
    { header: 'permissions-policy', severity: 'low' as const,
      description: 'Restricts browser API access (camera, microphone, geolocation).',
      recommendation: 'Permissions-Policy: camera=(), microphone=(), geolocation=()' },
  ];
  return checks.map(c => ({
    ...c, present: response.headers.get(c.header) !== null,
    value: response.headers.get(c.header),
  }));
}

async function sendCallback(url: string, token: string, data: object): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error('Callback failed:', res.status, await res.text());
  }
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}
