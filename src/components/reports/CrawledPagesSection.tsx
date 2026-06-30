import { AlertTriangle, Globe, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/** Minimal shape accepted by this component — compatible with both DB type and test mocks */
interface CrawledPageData {
  url: string;
  /** URL before redirects */
  requestedUrl?: string;
  /** HTTP status code (preferred field name) */
  status?: number;
  /** @deprecated use status */
  statusCode?: number;
  performance?: number | null;
  seo?: number | null;
  accessibility?: number | null;
  llmReadiness?: number | null;
  errors?: string[];
  title?: string;
  ttfb?: number;
  bytes?: number;
  pageId?: string;
  depth?: number;
  discoveredFrom?: string | null;
  pageType?: string;
  auditLevel?: string;
  measurementMode?: 'full-fetch' | 'lightweight-fetch' | 'fetch-status-only';
  auditLabel?: string;
  measurementError?: { code: string; message: string; retryable: boolean };
  accessibilityFindingCount?: number;
}

interface CrawlCoverageData {
  discoveredUrls?: number;
  queuedUrls?: number;
  analyzedPages?: number;
  failedPages?: number;
  skippedPages?: number;
  limitations?: string[];
}

interface Props {
  /** Crawled page results. Hidden when undefined, empty, or only 1 page. */
  crawledPages?: CrawledPageData[] | null;
  /** @deprecated use crawledPages */
  pages?: CrawledPageData[] | null;
  /** Coverage summary from the crawl job */
  crawlCoverage?: CrawlCoverageData | null;
}

function scoreClass(score: number | null | undefined): string {
  if (score == null) return 'text-muted-foreground/40';
  if (score >= 80) return 'text-emerald-400 font-semibold tabular-nums';
  if (score >= 50) return 'text-amber-400 font-semibold tabular-nums';
  return 'text-red-400 font-semibold tabular-nums';
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-emerald-400';
  if (code >= 300 && code < 400) return 'text-amber-400';
  return 'text-red-400';
}

function getStatusCode(page: CrawledPageData): number | undefined {
  return page.status ?? page.statusCode;
}

function pageTypeBadge(type: string | undefined): string {
  switch (type) {
    case 'homepage': return 'bg-orange-50 dark:bg-orange-950/30 text-orange-500 border-orange-200 dark:border-orange-900/40';
    case 'article': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'product': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'category': return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
    case 'landing': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
    case 'detail': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    default: return 'bg-secondary text-muted-foreground border-border';
  }
}

export function CrawledPagesSection({ crawledPages, pages, crawlCoverage }: Props) {
  const data = crawledPages ?? pages;

  // Hide when no data, empty, or only the root page (no crawl occurred)
  if (!data || data.length <= 1) return null;

  const failedPages = data.filter((p) => !!p.measurementError || p.measurementMode === 'fetch-status-only');
  const successPages = data.filter((p) => !p.measurementError && p.measurementMode !== 'fetch-status-only');

  const perfScores = data.map((p) => p.performance).filter((s): s is number => s != null);
  const avgPerf = perfScores.length > 0
    ? Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length)
    : null;

  const hasDepth = data.some((p) => p.depth != null);
  const hasPageType = data.some((p) => p.pageType);
  const hasSeo = data.some((p) => p.seo != null);
  const hasA11y = data.some((p) => p.accessibility != null);
  const hasFindings = data.some((p) => p.accessibilityFindingCount != null);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Crawled Pages</h2>
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-50 dark:bg-orange-950/30 text-orange-400 border border-orange-200 dark:border-orange-900/40">
          {data.length} page{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Coverage + summary */}
      <div className="bg-secondary rounded-xl p-4 flex flex-wrap gap-6">
        {crawlCoverage?.discoveredUrls != null && (
          <span className="text-sm text-muted-foreground">
            Discovered:{' '}
            <span className="font-semibold text-foreground">{crawlCoverage.discoveredUrls}</span>
            {crawlCoverage.queuedUrls != null && crawlCoverage.queuedUrls < crawlCoverage.discoveredUrls && (
              <span className="text-muted-foreground/60"> (analyzed {crawlCoverage.queuedUrls})</span>
            )}
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          Total pages:{' '}
          <span className="font-semibold text-foreground">{data.length}</span>
        </span>
        {avgPerf != null && (
          <span className="text-sm text-muted-foreground">
            Avg Performance:{' '}
            <span className={scoreClass(avgPerf)}>{avgPerf}</span>
          </span>
        )}
        {failedPages.length > 0 && (
          <span className="text-sm text-muted-foreground">
            <span className="text-red-400 font-semibold">{failedPages.length} failed</span>
            {' '}to analyze
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Page Results</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="Crawled page results">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="text-left px-4 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">Page</th>
                {hasPageType && (
                  <th scope="col" className="text-left px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">Type</th>
                )}
                {hasDepth && (
                  <th scope="col" className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">Depth</th>
                )}
                <th scope="col" className="text-left px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider whitespace-nowrap">Audit level</th>
                <th scope="col" className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">Status</th>
                <th scope="col" className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">Perf</th>
                {hasSeo && (
                  <th scope="col" className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">SEO</th>
                )}
                {hasA11y && (
                  <th scope="col" className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">A11y</th>
                )}
                {hasFindings && (
                  <th scope="col" className="text-right px-4 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider whitespace-nowrap">Issues</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((page, i) => {
                const statusCode = getStatusCode(page);
                const isFailed = page.measurementMode === 'fetch-status-only' || !!page.measurementError;
                const auditLabel = page.auditLabel ?? (
                  page.measurementMode === 'full-fetch' ? 'Full fetch audit' :
                  page.measurementMode === 'lightweight-fetch' ? 'Lightweight fetch audit' : null
                );
                return (
                  <tr key={page.pageId ?? i} className={`border-b border-border hover:bg-white/[0.02] transition-colors ${isFailed ? 'opacity-70' : ''}`}>
                    <td className="px-4 py-3 min-w-[220px] max-w-[380px]">
                      <div className="text-sm text-muted-foreground font-mono break-all" title={page.url}>
                        {(() => { try { const u = new URL(page.url); return u.hostname + u.pathname; } catch { return page.url; } })()}
                      </div>
                      {page.title && page.title !== page.url && (
                        <div className="text-sm text-foreground truncate max-w-[360px]">{page.title}</div>
                      )}
                      {page.measurementError && (
                        <div className="flex items-center gap-1 text-xs text-red-400 mt-0.5">
                          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                          {page.measurementError.message}
                        </div>
                      )}
                      {!page.measurementError && (page.errors?.length ?? 0) > 0 && (
                        <div className="text-xs text-red-400 mt-0.5">
                          {page.errors!.length} issue{page.errors!.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </td>
                    {hasPageType && (
                      <td className="px-3 py-3">
                        {page.pageType ? (
                          <Badge className={`text-[9px] border whitespace-nowrap ${pageTypeBadge(page.pageType)}`}>
                            {page.pageType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </td>
                    )}
                    {hasDepth && (
                      <td className="text-right px-3 py-3 text-xs text-muted-foreground tabular-nums">
                        {page.depth != null ? page.depth : '—'}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      {auditLabel ? (
                        <Badge className={`text-[9px] border whitespace-nowrap ${
                          page.measurementMode === 'full-fetch'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : page.measurementMode === 'lightweight-fetch'
                            ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-500 border-orange-200 dark:border-orange-900/40'
                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                          {auditLabel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs">—</span>
                      )}
                    </td>
                    <td className={`text-right px-3 py-3 font-mono text-sm ${statusCode ? statusColor(statusCode) : 'text-muted-foreground/40'}`}>
                      {statusCode ? statusCode : '—'}
                    </td>
                    {/* Score cells: null = unavailable (not measured), 0 = measured zero */}
                    <td className={`text-right px-3 py-3 ${scoreClass(page.performance)}`}
                        title={isFailed && page.measurementError ? page.measurementError.message : undefined}>
                      {page.performance != null ? page.performance : '—'}
                    </td>
                    {hasSeo && (
                      <td className={`text-right px-3 py-3 ${scoreClass(page.seo)}`}>
                        {page.seo != null ? page.seo : '—'}
                      </td>
                    )}
                    {hasA11y && (
                      <td className={`text-right px-3 py-3 ${scoreClass(page.accessibility)}`}>
                        {page.accessibility != null ? page.accessibility : '—'}
                      </td>
                    )}
                    {hasFindings && (
                      <td className="text-right px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {page.accessibilityFindingCount != null ? page.accessibilityFindingCount : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Coverage limitations */}
      {crawlCoverage?.limitations && crawlCoverage.limitations.length > 0 && (
        <div className="flex gap-2 text-xs text-muted-foreground/60 bg-secondary/50 rounded-lg px-4 py-3">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-500/60" aria-hidden />
          <div className="space-y-0.5">
            {crawlCoverage.limitations.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground/50">
        Full fetch audit: root page measured 3× for TTFB stability.
        Lightweight fetch audit: single request per crawled page with independent resource analysis.
        Scores are not copied between pages — each page is measured independently.
        Dash (—) means the score is unavailable, not zero.
      </p>
    </section>
  );
}
