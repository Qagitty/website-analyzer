import { validateWebsiteUrl, BROWSER_HEADERS } from './validate';
import { analyzeHTML } from './score';
import { buildFetchOnlyAudit } from './perf-score';
import { checkAccessibility } from './accessibility';
import { checkSEO } from './seo';
import { checkBestPractices } from './best-practices';
import { checkCommonErrors } from './errors';
import { checkLLMReadiness } from './llm-readiness';
import { analyzeSecurityHeadersAsync } from './security-headers';
import { crawlInternalLinks, crawlPage } from './crawl';
import { analyzeResources, analyzeSecurityHeaders } from './resources';
import { generateOpportunities } from './opportunities';
import { workerLog } from './log';
import {
  seoAuditToCategoryScore,
  accessibilityAuditToCategoryScore,
  bestPracticesAuditToCategoryScore,
  llmReadinessAuditToCategoryScore,
  performanceAuditToCategoryScore,
} from './score-adapters';
import type { Env, AnalysisRequest, CrawledPage, CrawlCoverage } from './types';

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

    // §7 — Use the Worker's own env secret, never read it from the request body.
    const callbackSecret = env.WORKER_CALLBACK_SECRET;
    const timeout = new Promise<void>(resolve =>
      setTimeout(async () => {
        await sendCallback(body.callbackUrl, callbackSecret, {
          analysisId: body.analysisId,
          error: 'Analysis timed out — the site may be too slow or blocking automated requests.',
        }).catch(() => {});
        resolve();
      }, 55_000),
    );
    ctx.waitUntil(Promise.race([runAnalysis(body, callbackSecret), timeout]));

    return new Response(
      JSON.stringify({ status: 'queued', analysisId: body.analysisId }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  },
};

async function runAnalysis(req: AnalysisRequest, callbackSecret: string): Promise<void> {
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
    await sendCallback(req.callbackUrl, callbackSecret, {
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
    // Reuse the html and response from validation — no need to fetch the same URL again.
    // A second identical fetch in quick succession is a strong bot signal.
    const html = validation.html;
    const response = validation.response;
    const pageBytes = new TextEncoder().encode(html).length;
    const ttfb = validation.ttfb;
    const ttfbSamples = [ttfb];
    const ttfbMin = ttfb;
    const ttfbMax = ttfb;
    const fetchDuration = ttfb;

    // Headers for subsequent crawl requests — add Referer and same-origin Sec-Fetch-Site
    // so sub-page fetches look like a user clicking an internal link.
    const crawlHeaders: Record<string, string> = {
      ...BROWSER_HEADERS,
      'Referer': req.url,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '',      // not a user-initiated navigation for sub-pages
    };

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
    const accessibilityAudit = checkAccessibility(html);
    const accessibilityIssues = accessibilityAudit.findings;
    workerLog('info', 'accessibility.complete', {
      analysisId: req.analysisId,
      urlHash: urlTag,
      score: accessibilityAudit.score,
      findingsCount: accessibilityAudit.findings.length,
      confirmedCritical: accessibilityAudit.scoreBreakdown.confirmedCritical,
      confirmedSerious: accessibilityAudit.scoreBreakdown.confirmedSerious,
      truncated: !!accessibilityAudit.error,
    });
    const consoleErrors = checkCommonErrors(html, response);
    const securityHeaders = analyzeSecurityHeaders(response);
    const [seoAudit, bestPracticesAudit, llmReadinessAudit, securityHeadersAudit] = await Promise.all([
      checkSEO(html, response, req.url, req.analysisId),
      Promise.resolve(checkBestPractices(html, response, req.url)),
      checkLLMReadiness(html, response, req.url),
      analyzeSecurityHeadersAsync(req.url, response, html),
    ]);

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
        seo: seoAudit.score ?? scores.seo,
        accessibility: accessibilityAudit.score,
        llmReadiness: llmReadinessAudit.score ?? 0,
        securityHeaders,
        pageId: crypto.randomUUID(),
        depth: 0,
        discoveredFrom: null,
        pageType: 'homepage',
        auditLevel: 'fetch-only',
        measurementMode: 'full-fetch',
        auditLabel: 'Full fetch audit',
        accessibilityFindingCount: accessibilityAudit.findings.filter(f => f.status === 'confirmed' || f.status === 'likely').length,
        accessibilityAuditLabel: 'Static accessibility scan',
        seoResult: {
          requestedUrl: req.url,
          finalUrl: response.url,
          httpStatus: response.status,
          title: seoAudit.metadata.title,
          titleLength: seoAudit.metadata.titleLength,
          titleStatus: seoAudit.metadata.titleStatus,
          description: seoAudit.metadata.description,
          descriptionLength: seoAudit.metadata.descriptionLength,
          descriptionStatus: seoAudit.metadata.descriptionStatus,
          h1: seoAudit.metadata.h1,
          h1Count: seoAudit.metadata.h1Count,
          canonical: null,
          canonicalStatus: 'self',
          isIndexable: seoAudit.indexability.isIndexable,
          noindex: seoAudit.indexability.noindex,
          robotsDirectives: seoAudit.indexability.effectiveDirectives,
          structuredDataTypes: seoAudit.structuredData.types,
          score: seoAudit.score,
          auditLabel: 'Full SEO audit',
          coverage: seoAudit.coverage.percentage,
        },
        bestPracticesResult: {
          requestedUrl: req.url,
          finalUrl: response.url,
          httpStatus: response.status,
          isHttps: bestPracticesAudit.isHttps,
          score: bestPracticesAudit.score,
          coverage: bestPracticesAudit.coverage.percentage,
          auditLabel: 'Full BP audit',
          securityHeadersPresent: bestPracticesAudit.securityHeaders.filter(h => h.present).length,
          securityHeadersTotal: bestPracticesAudit.securityHeaders.length,
          criticalFindings: bestPracticesAudit.summary.critical,
          highFindings: bestPracticesAudit.summary.high,
        },
        llmReadinessResult: {
          requestedUrl: req.url,
          finalUrl: response.url,
          httpStatus: response.status,
          auditMode: 'fetch-only',
          title: llmReadinessAudit.detectedSignals.rawTextLength > 0 ? homepageTitle : null,
          h1: llmReadinessAudit.detectedSignals.h1Count > 0 ? null : null,
          canonical: llmReadinessAudit.detectedSignals.canonicalUrl,
          schemaTypes: llmReadinessAudit.detectedSignals.schemaTypes,
          hasAuthorSignal: llmReadinessAudit.detectedSignals.hasAuthorSignal,
          hasDateSignal: llmReadinessAudit.detectedSignals.hasDateSignal,
          isIndexable: !llmReadinessAudit.detectedSignals.robotsMetaDirectives.some(d => d.includes('noindex')),
          score: llmReadinessAudit.score,
          coverage: llmReadinessAudit.coverage.percentage,
          auditLabel: 'Full LLM readiness audit',
          topIssue: llmReadinessAudit.findings.find(f => f.status === 'failed' && f.severity === 'critical')?.title ??
            llmReadinessAudit.findings.find(f => f.status === 'failed' && f.severity === 'high')?.title ?? null,
        },
      },
    ];

    const crawlStart = Date.now();
    const discoveredLinks = crawlInternalLinks(html, req.url);
    const linksToAnalyze = discoveredLinks.slice(0, 4);
    let crawlFailed = 0;
    let crawlSkipped = 0;
    for (const link of linksToAnalyze) {
      // 800–1600 ms random pause between sub-page fetches so burst traffic
      // doesn't look like a rapid-fire bot scan to the target server.
      await new Promise<void>(r => setTimeout(r, 800 + Math.floor(Math.random() * 800)));
      const page = await crawlPage(link, crawlHeaders);
      if (!page) {
        crawlSkipped++;
      } else {
        if (page.measurementError) crawlFailed++;
        crawledPages.push(page);
      }
    }
    const crawlDuration = Date.now() - crawlStart;

    const crawlCoverage: CrawlCoverage = {
      discoveredUrls: discoveredLinks.length,
      queuedUrls: linksToAnalyze.length,
      analyzedPages: crawledPages.length - 1,             // exclude root
      failedPages: crawlFailed,
      skippedPages: crawlSkipped,
      deduplicatedUrls: 0,                                 // dedup is done inside crawlInternalLinks
      auditLevel: 'fetch-only',
      limitations: [
        'Scores reflect static HTML analysis — JavaScript-rendered content is not measured.',
        'Template-heavy sites may show similar scores across pages if HTML structure is shared.',
        linksToAnalyze.length < discoveredLinks.length
          ? `Only ${linksToAnalyze.length} of ${discoveredLinks.length} discovered pages were analyzed (limit: 4).`
          : '',
      ].filter(Boolean),
    };

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

    // §4, §11 — collect unified CategoryScoreResult[] from all category audits
    const categoryScoreResults = [
      seoAuditToCategoryScore(seoAudit),
      accessibilityAuditToCategoryScore(accessibilityAudit),
      bestPracticesAuditToCategoryScore(bestPracticesAudit),
      llmReadinessAuditToCategoryScore(llmReadinessAudit),
      performanceAuditToCategoryScore(
        scores.performance,
        scores.scoreVersion,
        Array.isArray(scores.perfBreakdown) ? scores.perfBreakdown : [],
        [],
      ),
    ];

    await sendCallback(req.callbackUrl, callbackSecret, {
      analysisId: req.analysisId,
      screenshotBase64: null,
      categoryScoreResults,
      // §Gap2 — forward monitor context so callback can trigger monitor post-processing
      ...(req.monitorId && { monitorId: req.monitorId, monitorRunId: req.monitorRunId, monitorUserId: req.monitorUserId }),
      lighthouseScores: {
        performance: scores.performance,
        accessibility: accessibilityAudit.score,
        bestPractices: bestPracticesAudit.score ?? scores.bestPractices,
        seo: seoAudit.score ?? scores.seo,
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
        llmReadiness: llmReadinessAudit.score ?? 0,
        securityHeaders,
        llmReadinessAudit,
        securityHeadersAudit,
        scoreBreakdown: scores.scoreBreakdown,
        opportunities,
        accessibilityAudit,
        seoAudit,
        bestPracticesAudit,
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
      crawlCoverage,
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
    await sendCallback(req.callbackUrl, callbackSecret, {
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
