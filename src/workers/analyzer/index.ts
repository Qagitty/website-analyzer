import { validateWebsiteUrl } from './validate';
import { analyzeHTML } from './score';
import { checkAccessibility } from './accessibility';
import { checkCommonErrors } from './errors';
import { checkLLMReadiness } from './llm-readiness';
import { crawlInternalLinks, crawlPage } from './crawl';
import { analyzeResources, analyzeSecurityHeaders } from './resources';
import type { Env, AnalysisRequest, CrawledPage } from './types';

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
        html = await r.text();
        pageBytes = new TextEncoder().encode(html).length;
        response = r;
      } else {
        await r.body?.cancel();
      }
      if (attempt < 2) await new Promise<void>((res) => setTimeout(res, 200));
    }

    const sorted = [...ttfbSamples].sort((a, b) => a - b);
    const ttfb = sorted[1];
    const ttfbMin = sorted[0];
    const ttfbMax = sorted[2];

    const scores = analyzeHTML(html, response, pageBytes, ttfb);
    const accessibilityIssues = checkAccessibility(html);
    const consoleErrors = checkCommonErrors(html, response);
    const llmReadiness = checkLLMReadiness(html);
    const resourceAudit = analyzeResources(html, response, req.url);
    const securityHeaders = analyzeSecurityHeaders(response);

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
