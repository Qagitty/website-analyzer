import { validateWebsiteUrl } from './validate';
import { analyzeHTML } from './score';
import { buildFetchOnlyAudit } from './perf-score';
import { checkAccessibility } from './accessibility';
import { checkCommonErrors } from './errors';
import { checkLLMReadiness } from './llm-readiness';
import { crawlInternalLinks, crawlPage } from './crawl';
import { analyzeResources, analyzeSecurityHeaders } from './resources';
import { generateOpportunities } from './opportunities';
import { workerLog } from './log';
import type { Env, AnalysisRequest, CrawledPage } from './types';

// Hash analysis URL for logs so the full URL never appears in log output.
// Only last 8 hex chars are kept — sufficient for correlation without disclosing the target.
async function hashUrlForLog(url: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `url:${hex.slice(-8)}`;
  } catch {
    return 'url:unknown';
  }
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
  const urlTag = await hashUrlForLog(req.url);

  workerLog('info', 'analysis.start', { analysisId: req.analysisId, urlHash: urlTag, measurementMode: 'fetch-only' });

  const validationStart = Date.now();
  const validation = await validateWebsiteUrl(req.url);
  const validationDuration = Date.now() - validationStart;

  if (!validation.isValid) {
    workerLog('warn', 'analysis.validation_failed', {
      analysisId: req.analysisId,
      urlHash: urlTag,
      validationDuration,
      errorType: validation.errorType,
      statusCode: validation.statusCode,
    });
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
    const ttfbSamples: number[] = [];
    let html = '';
    let response!: Response;
    let pageBytes = 0;

    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    };

    const fetchStart = Date.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = Date.now();
      const fetchCtrl = new AbortController();
      setTimeout(() => fetchCtrl.abort(), 15_000);
      const r = await fetch(req.url, { headers: fetchHeaders, redirect: 'follow', signal: fetchCtrl.signal });
      const ttfb = Date.now() - t0;
      ttfbSamples.push(ttfb);
      if (attempt === 0) {
        html = await r.text();
        pageBytes = new TextEncoder().encode(html).length;
        response = r;
      } else {
        await r.body?.cancel();
      }
      if (attempt < 2) await new Promise<void>((res) => setTimeout(res, 200));
    }
    const fetchDuration = Date.now() - fetchStart;

    const sorted = [...ttfbSamples].sort((a, b) => a - b);
    const ttfb = sorted[1];
    const ttfbMin = sorted[0];
    const ttfbMax = sorted[2];

    // Resource audit runs first so its counts can improve the performance score
    const resourceStart = Date.now();
    const resourceAudit = analyzeResources(html, response, req.url);
    const resourceAnalysisDuration = Date.now() - resourceStart;
    const scores = analyzeHTML(html, response, pageBytes, ttfb, {
      renderBlockingCount: resourceAudit.renderBlocking.length,
      imageIssueCount:     resourceAudit.imageIssues.length,
      totalImages:         resourceAudit.totalImages,
      thirdPartyCount:     resourceAudit.thirdParty.length,
    });
    const accessibilityIssues = checkAccessibility(html);
    const consoleErrors = checkCommonErrors(html, response);
    const llmReadiness = checkLLMReadiness(html);
    const securityHeaders = analyzeSecurityHeaders(response);

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const homepageTitle = titleMatch ? titleMatch[1].trim() : req.url;

    const opportunities = generateOpportunities({
      html,
      response,
      htmlBytes: pageBytes,
      ttfb,
      ttfbSamples,
      renderBlockingScripts: resourceAudit.renderBlocking.filter(r => r.type === 'script').map(r => r.url),
      renderBlockingStylesheets: resourceAudit.renderBlocking.filter(r => r.type === 'stylesheet').map(r => r.url),
      imageIssues: resourceAudit.imageIssues,
      totalImages: resourceAudit.totalImages,
      lazyImages: resourceAudit.lazyImages,
      inlineScriptCount: resourceAudit.inlineScriptCount,
      thirdPartyDomains: resourceAudit.thirdParty,
      totalScripts: resourceAudit.totalScripts,
      asyncScripts: resourceAudit.asyncScripts,
      deferScripts: resourceAudit.deferScripts,
    });

    const crawledPages: CrawledPage[] = [
      {
        url: response.url,
        requestedUrl: req.url,
        finalUrl: response.url,
        statusCode: response.status,
        ttfb,
        bytes: pageBytes,
        title: homepageTitle,
        performance: scores.performance,
        seo: scores.seo,
        accessibility: scores.accessibility,
        llmReadiness: llmReadiness.score,
        securityHeaders,
        measurementMode: 'full-fetch',
        auditLabel: 'Full fetch audit',
      },
    ];

    const crawlStart = Date.now();
    const internalLinks = crawlInternalLinks(html, req.url);
    for (const link of internalLinks.slice(0, 4)) {
      const page = await crawlPage(link, fetchHeaders);
      if (page) crawledPages.push(page);
    }
    const crawlDuration = Date.now() - crawlStart;

    const totalDuration = Date.now() - startTime;
    workerLog('info', 'analysis.complete', {
      analysisId: req.analysisId,
      urlHash: urlTag,
      measurementMode: 'fetch-only',
      resultStatus: 'completed',
      validationDuration,
      fetchDuration,
      resourceAnalysisDuration,
      crawlDuration,
      totalDuration,
      requestCount: crawledPages.length,
      ttfbMedian: ttfb,
      ttfbVariance: ttfbMax - ttfbMin,
      htmlBytes: pageBytes,
      performanceScore: scores.performance,
    });

    await sendCallback(req.callbackUrl, req.authToken, {
      analysisId: req.analysisId,
      screenshotBase64: null,
      lighthouseScores: {
        performance: scores.performance,
        accessibility: scores.accessibility,
        bestPractices: scores.bestPractices,
        seo: scores.seo,
        // Keep lcp for backward compat with stored reports; estimatedLcp is the canonical name
        lcp: scores.estimatedLcp,
        estimatedLcp: scores.estimatedLcp,
        // fid and cls are NOT sent — they require real browser measurement and would be misleading as 0
        ttfb,
        ttfbSamples,
        performanceVariance: ttfbMax - ttfbMin,
        measurementMode: 'fetch-only',
        scoreVersion: scores.scoreVersion,
        performanceAudit: buildFetchOnlyAudit(
          {
            ttfb,
            ttfbSamples,
            estimatedLcp: scores.estimatedLcp,
            htmlBytes: pageBytes,
            renderBlockingCount: resourceAudit.renderBlocking.length,
            imageIssueCount:     resourceAudit.imageIssues.length,
            totalImages:         resourceAudit.totalImages,
            thirdPartyCount:     resourceAudit.thirdParty.length,
            testedUrl: req.url,
            finalUrl:  response.url,
          },
          scores.performance,
          scores.scoreVersion,
          scores.perfBreakdown,
        ),
        llmReadiness: llmReadiness.score,
        llmChecks: llmReadiness.checks,
        llmSignals: llmReadiness.signals,
        securityHeaders,
        scoreBreakdown: scores.scoreBreakdown,
        opportunities,
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
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch URL';
    workerLog('error', 'analysis.error', {
      analysisId: req.analysisId,
      urlHash: urlTag,
      totalDuration: Date.now() - startTime,
      resultStatus: 'failed',
      errorCode: err instanceof Error ? err.name : 'UNKNOWN',
    });
    await sendCallback(req.callbackUrl, req.authToken, {
      analysisId: req.analysisId,
      error: errorMessage,
    });
  }
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
