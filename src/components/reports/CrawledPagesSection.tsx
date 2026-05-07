import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CrawledPage } from '@/types/analysis';

interface Props {
  pages: CrawledPage[];
}

function scoreClass(score: number): string {
  if (score >= 80) return 'text-green-600 font-semibold';
  if (score >= 50) return 'text-yellow-600 font-semibold';
  return 'text-red-600 font-semibold';
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
        <Badge variant="secondary">{pages.length} page{pages.length !== 1 ? 's' : ''}</Badge>
      </div>

      {pages.length === 1 ? (
        <p className="text-sm text-muted-foreground">
          Only the homepage was crawled — no internal links found.
        </p>
      ) : (
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>
            Avg Performance:{' '}
            <span className={scoreClass(avgPerf)}>{avgPerf}</span>
          </span>
          <span>
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
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Page</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Perf</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">SEO</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">A11y</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">LLM</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pages.map((page, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium truncate max-w-xs" title={page.url}>
                      {truncateUrl(page.url)}
                    </div>
                    {page.title && page.title !== page.url && (
                      <div className="text-xs text-muted-foreground truncate max-w-xs">
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
