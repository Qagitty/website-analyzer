import { AlertTriangle } from 'lucide-react';
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
  measurementMode?: 'full-fetch' | 'lightweight-fetch' | 'fetch-status-only';
  auditLabel?: string;
  measurementError?: { code: string; message: string; retryable: boolean };
}

interface Props {
  /** Crawled page results. Hidden when undefined, empty, or only 1 page. */
  crawledPages?: CrawledPageData[] | null;
  /** @deprecated use crawledPages */
  pages?: CrawledPageData[] | null;
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

function truncateUrl(url: string, maxLen = 55): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    if (display.length <= maxLen) return display;
    return display.slice(0, maxLen - 1) + '…';
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen - 1) + '…' : url;
  }
}

function getStatusCode(page: CrawledPageData): number | undefined {
  return page.status ?? page.statusCode;
}

export function CrawledPagesSection({ crawledPages, pages }: Props) {
  const data = crawledPages ?? pages;

  // Hide when no data, empty, or only the entry URL (no crawl occurred)
  if (!data || data.length <= 1) return null;

  const totalErrors = data.reduce((acc, p) => acc + (p.errors?.length ?? 0), 0);
  const pagesWithErrors = data.filter((p) => (p.errors?.length ?? 0) > 0).length;

  const perfScores = data.map((p) => p.performance).filter((s): s is number => s != null);
  const avgPerf = perfScores.length > 0
    ? Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length)
    : null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Crawled Pages</h2>
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          {data.length} page{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary card */}
      <div className="bg-secondary rounded-xl p-4 flex flex-wrap gap-6">
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
        <span className="text-sm text-muted-foreground">
          <span className={pagesWithErrors > 0 ? 'text-red-400 font-semibold' : 'text-foreground'}>
            {pagesWithErrors === 1 ? '1 error' : `${pagesWithErrors} errors`}
          </span>
          {' '}found
        </span>
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
                <th scope="col" className="text-left px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider whitespace-nowrap">Audit type</th>
                <th scope="col" className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">Status</th>
                <th scope="col" className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">Perf</th>
                {data.some((p) => p.seo != null) && (
                  <th scope="col" className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">SEO</th>
                )}
                {data.some((p) => p.accessibility != null) && (
                  <th scope="col" className="text-right px-4 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider">A11y</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((page, i) => {
                const statusCode = getStatusCode(page);
                const failed = page.measurementMode === 'fetch-status-only' || !!page.measurementError;
                const auditLabel = page.auditLabel ?? (page.measurementMode === 'full-fetch' ? 'Full fetch audit' : page.measurementMode === 'lightweight-fetch' ? 'Lightweight fetch audit' : null);
                return (
                  <tr key={i} className={`border-b border-border hover:bg-white/[0.02] transition-colors ${failed ? 'opacity-70' : ''}`}>
                    <td className="px-4 py-3 min-w-[260px] max-w-[480px]">
                      <div
                        className="text-sm text-muted-foreground font-mono break-all"
                        title={page.url}
                      >
                        {(() => { try { const u = new URL(page.url); return u.hostname + u.pathname; } catch { return page.url; } })()}
                      </div>
                      {page.title && page.title !== page.url && (
                        <div className="text-sm text-foreground truncate max-w-[440px]">
                          {page.title}
                        </div>
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
                    <td className="px-3 py-3">
                      {auditLabel ? (
                        <Badge className={`text-[9px] border whitespace-nowrap ${
                          page.measurementMode === 'full-fetch'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : page.measurementMode === 'lightweight-fetch'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
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
                    <td className={`text-right px-3 py-3 ${failed ? 'text-muted-foreground/30' : scoreClass(page.performance)}`}
                        title={failed ? page.measurementError?.message : undefined}>
                      {!failed && page.performance != null && page.performance > 0 ? page.performance : '—'}
                    </td>
                    {data.some((p) => p.seo != null) && (
                      <td className={`text-right px-3 py-3 ${failed ? 'text-muted-foreground/30' : scoreClass(page.seo)}`}>
                        {!failed && page.seo != null && page.seo > 0 ? page.seo : '—'}
                      </td>
                    )}
                    {data.some((p) => p.accessibility != null) && (
                      <td className={`text-right px-4 py-3 ${failed ? 'text-muted-foreground/30' : scoreClass(page.accessibility)}`}>
                        {!failed && page.accessibility != null && page.accessibility > 0 ? page.accessibility : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground/50">
        Full fetch audit: root page measured 3× for TTFB stability.
        Lightweight fetch audit: single request per crawled page with independent resource analysis.
        Scores are not copied between pages — each page is measured independently.
      </p>
    </section>
  );
}
