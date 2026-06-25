'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, ChevronDown } from 'lucide-react';
import type { SecurityHeaderResult, CrawledPage } from '@/types/analysis';

const SEVERITY_COLORS = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  high:     'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  medium:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  low:      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
} as const;

function pagePathLabel(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname === '/' ? u.hostname : u.hostname + u.pathname).replace(/\/$/, '');
  } catch {
    return url;
  }
}

function PageBreakdown({
  headerName,
  crawledPages,
}: {
  headerName: string;
  crawledPages: CrawledPage[];
}) {
  const pagesWithData = crawledPages.filter(p => p.securityHeaders?.length);
  if (!pagesWithData.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Pages scanned</p>
      <div className="space-y-1">
        {pagesWithData.map((page) => {
          const result = page.securityHeaders!.find(h => h.header === headerName);
          const isPresent = result?.present ?? false;
          return (
            <div
              key={page.url}
              className="flex items-start gap-2 text-xs rounded-md bg-secondary/40 px-2.5 py-2"
            >
              {isPresent ? (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-foreground font-medium truncate">{page.title}</p>
                <p className="text-muted-foreground/70 font-mono truncate text-[11px]">
                  {pagePathLabel(page.url)}
                </p>
                {isPresent && result?.value && (
                  <p className="text-emerald-500/80 mt-1 font-mono break-all text-[11px]">
                    {result.value.length > 80 ? result.value.slice(0, 80) + '…' : result.value}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 font-medium text-[11px] mt-0.5 ${
                  isPresent ? 'text-emerald-500' : 'text-red-400'
                }`}
              >
                {isPresent ? 'present' : 'missing'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SecurityHeadersSection({
  securityHeaders,
  crawledPages,
}: {
  securityHeaders?: SecurityHeaderResult[] | null;
  crawledPages?: CrawledPage[] | null;
}) {
  const [openHeaders, setOpenHeaders] = useState<Set<string>>(new Set());

  if (!securityHeaders?.length) return null;

  const presentCount = securityHeaders.filter(h => h.present).length;
  const total        = securityHeaders.length;
  const missingCount = total - presentCount;

  const scoreBadgeClass =
    presentCount >= 5
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
      : presentCount >= 3
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
      : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';

  const toggle = (header: string) => {
    setOpenHeaders(prev => {
      const next = new Set(prev);
      if (next.has(header)) next.delete(header); else next.add(header);
      return next;
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Security Headers</h2>
          {missingCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {missingCount} header{missingCount !== 1 ? 's' : ''} missing — click each row for details and fix instructions
            </p>
          )}
        </div>
        <Badge className={scoreBadgeClass}>
          {presentCount}/{total} headers present
        </Badge>
      </div>

      <Card className="bg-card border border-border">
        <CardContent className="pt-2 pb-2">
          {securityHeaders.map((h, idx) => {
            const isOpen = openHeaders.has(h.header);
            const isLast = idx === securityHeaders.length - 1;

            return (
              <div key={h.header} className={!isLast ? 'border-b border-border' : ''}>
                {/* Header row — always visible, clickable */}
                <button
                  type="button"
                  onClick={() => toggle(h.header)}
                  aria-expanded={isOpen}
                  className="w-full py-3 px-1 flex items-start gap-3 text-left hover:bg-secondary/30 rounded-md transition-colors group"
                >
                  <div className="mt-0.5 shrink-0">
                    {h.present ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono text-foreground">{h.header}</code>
                      {!h.present && (
                        <Badge className={`text-xs border ${SEVERITY_COLORS[h.severity]}`}>
                          {h.severity}
                        </Badge>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${h.present ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      {h.present
                        ? `✓ Present${h.value ? ': ' + (h.value.length > 55 ? h.value.slice(0, 55) + '…' : h.value) : ''}`
                        : h.description}
                    </p>
                  </div>

                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Expanded panel */}
                {isOpen && (
                  <div className="pb-4 px-7 space-y-4">
                    {/* Fix / current value */}
                    {!h.present ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Recommended value</p>
                        <p className="text-xs font-mono text-indigo-400 bg-indigo-500/5 rounded-md px-3 py-2 border border-indigo-500/10 break-all">
                          {h.recommendation}
                        </p>
                      </div>
                    ) : h.value ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Current value</p>
                        <p className="text-xs font-mono text-emerald-400 bg-emerald-500/5 rounded-md px-3 py-2 border border-emerald-500/10 break-all">
                          {h.value}
                        </p>
                      </div>
                    ) : null}

                    {/* Per-page breakdown */}
                    {crawledPages && crawledPages.length > 0 && (
                      <PageBreakdown headerName={h.header} crawledPages={crawledPages} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
