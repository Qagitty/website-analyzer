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
      const r = await fetch(req.url, { headers: fetchHeaders, redirect: 'follow' });
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
      },
    });
  } catch (err: unknown) {
    await sendCallback(req.callbackUrl, req.authToken, {
      analysisId: req.analysisId,
      error: err instanceof Error ? err.message : 'Failed to fetch URL',
    });
  }
}

interface Scores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  estimatedLcp: number;
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
  // Count missing alt texts, missing labels, low contrast indicators
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const imgsWithoutAlt = imgMatches.filter(img => !/alt=["'][^"']/i.test(img) && !/alt=""/i.test(img)).length;
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
  const hasARIALandmarks = /role=["'](main|navigation|banner|contentinfo)["']/i.test(html) || /<(main|nav|header|footer)[\s>]/i.test(html);
  const accessibility = Math.round(
    (altRatio * 35) + (labelRatio * 25) + (hasSkipLink ? 10 : 0) + (hasARIALandmarks ? 15 : 0) + (hasLang ? 15 : 0)
  );

  return {
    performance: clamp(performance),
    accessibility: clamp(accessibility),
    bestPractices: clamp(bestPractices),
    seo: clamp(seo),
    estimatedLcp,
  };
}

function checkAccessibility(html: string): any[] {
  const issues: any[] = [];

  // Missing alt text on images
  const imgs = html.match(/<img[^>]*>/gi) || [];
  const missingAlt = imgs.filter(img => !/alt=/i.test(img));
  if (missingAlt.length > 0) {
    issues.push({
      id: 'image-alt',
      impact: 'critical',
      description: 'Images must have alternate text',
      nodes: missingAlt.slice(0, 3).map(img => img.slice(0, 80)),
      wcagCriteria: ['wcag2a', 'wcag111'],
    });
  }

  // Empty alt (decorative only acceptable if intentional)
  const emptyAlt = imgs.filter(img => /alt=["']\s*["']/i.test(img));
  if (emptyAlt.length > 0) {
    issues.push({
      id: 'image-alt-empty',
      impact: 'minor',
      description: `${emptyAlt.length} image(s) have empty alt text — ensure they are purely decorative`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag111'],
    });
  }

  // Missing lang on html element
  if (!/html[^>]+lang=["'][a-z]/i.test(html)) {
    issues.push({
      id: 'html-has-lang',
      impact: 'serious',
      description: 'The <html> element must have a lang attribute',
      nodes: ['<html>'],
      wcagCriteria: ['wcag2a', 'wcag311'],
    });
  }

  // Inputs without labels
  const inputs = html.match(/<input[^>]*>/gi) || [];
  const unlabeled = inputs.filter(input =>
    !/type=["'](hidden|submit|button|reset|image)["']/i.test(input) &&
    !/aria-label/i.test(input) && !/aria-labelledby/i.test(input) && !/id=/i.test(input)
  );
  if (unlabeled.length > 0) {
    issues.push({
      id: 'label',
      impact: 'critical',
      description: `${unlabeled.length} form input(s) may be missing associated labels`,
      nodes: unlabeled.slice(0, 3).map(i => i.slice(0, 80)),
      wcagCriteria: ['wcag2a', 'wcag131', 'wcag332'],
    });
  }

  // Missing skip link
  if (!/skip.*nav|skip.*content|href=["']#main|href=["']#content/i.test(html)) {
    issues.push({
      id: 'skip-link',
      impact: 'moderate',
      description: 'Page should have a "skip to main content" link for keyboard users',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag241'],
    });
  }

  // Multiple H1s
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count > 1) {
    issues.push({
      id: 'heading-order',
      impact: 'moderate',
      description: `Page has ${h1Count} <h1> elements — there should be exactly one`,
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
    });
  }

  // No H1 at all
  if (h1Count === 0) {
    issues.push({
      id: 'page-has-heading-one',
      impact: 'moderate',
      description: 'Page does not contain a level-one heading',
      nodes: [],
      wcagCriteria: ['wcag2a', 'wcag131'],
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
