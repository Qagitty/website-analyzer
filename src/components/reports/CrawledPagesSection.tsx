import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CrawledPage } from '@/types/analysis';

interface Props {
  pages: CrawledPage[];
}

function scoreClass(score: number): string {
  if (score >= 80) return 'text-emerald-400 font-semibold tabular-nums';
  if (score >= 50) return 'text-amber-400 font-semibold tabular-nums';
  return 'text-red-400 font-semibold tabular-nums';
}

function avg(pages: CrawledPage[], key: keyof CrawledPage): number {
  if (pages.length === 0) return 0;
  const sum = pages.reduce((acc, p) => acc + (Number(p[key]) || 0), 0);
  return Math.round(sum / pages.length);
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

export function CrawledPagesSection({ pages }: Props) {
  if (!pages || pages.length === 0) return null;

  const avgPerf = avg(pages, 'performance');
  const avgSeo = avg(pages, 'seo');

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Site Crawl</h2>
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          {pages.length} page{pages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {pages.length === 1 ? (
        <p className="text-muted-foreground/60 text-sm text-center py-6 italic">
          Only the homepage was crawled — no internal links found.
        </p>
      ) : (
        <div className="bg-secondary rounded-xl p-4 flex gap-6">
          <span className="text-sm text-muted-foreground">
            Avg Performance:{' '}
            <span className={scoreClass(avgPerf)}>{avgPerf}</span>
          </span>
          <span className="text-sm text-muted-foreground">
            Avg SEO:{' '}
            <span className={scoreClass(avgSeo)}>{avgSeo}</span>
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Crawled Pages</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider pb-2">Page</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider pb-2">Perf</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider pb-2">SEO</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider pb-2">A11y</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground/60 text-xs uppercase tracking-wider pb-2">LLM</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page, i) => (
                <tr key={i} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm text-muted-foreground font-mono truncate max-w-[200px]" title={page.url}>
                      {truncateUrl(page.url)}
                    </div>
                    {page.title && page.title !== page.url && (
                      <div className="text-sm text-foreground truncate max-w-[200px]">
                        {page.title}
                      </div>
                    )}
                  </td>
                  <td className={`text-right px-3 py-3 ${scoreClass(page.performance)}`}>
                    {page.performance > 0 ? page.performance : '—'}
                  </td>
                  <td className={`text-right px-3 py-3 ${scoreClass(page.seo)}`}>
                    {page.seo > 0 ? page.seo : '—'}
                  </td>
                  <td className={`text-right px-3 py-3 ${scoreClass(page.accessibility)}`}>
                    {page.accessibility > 0 ? page.accessibility : '—'}
                  </td>
                  <td className={`text-right px-4 py-3 ${scoreClass(page.llmReadiness)}`}>
                    {page.llmReadiness > 0 ? page.llmReadiness : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
