'use client';

import { useState, useEffect } from 'react';
import { FileSearch, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { IndexingPage } from '@/types/connected-sites';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  siteId: string;
  planHasIndexing: boolean;
}

export function IndexingOverview({ siteId, planHasIndexing }: Props) {
  const [pages, setPages] = useState<IndexingPage[]>([]);
  const [totalWarnings, setTotalWarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planHasIndexing) return;
    fetch(`/api/connected-sites/${siteId}/indexing`)
      .then((r) => r.json())
      .then((d) => {
        setPages(d.pages ?? []);
        setTotalWarnings(d.totalWarnings ?? 0);
      })
      .catch(() => {
        setPages([]);
        setTotalWarnings(0);
      })
      .finally(() => setLoading(false));
  }, [siteId, planHasIndexing]);

  if (!planHasIndexing) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <FileSearch className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            Indexing diagnostics are available on Pro and above.
          </p>
          <a
            href="/settings/billing"
            className="text-sm text-indigo-400 hover:underline"
          >
            Upgrade plan
          </a>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <FileSearch className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No indexability observations yet. The script reports these when visitors load your pages.
          </p>
        </CardContent>
      </Card>
    );
  }

  const pagesWithWarnings = pages.filter((p) => p.warnings.length > 0);
  const cleanPages = pages.length - pagesWithWarnings.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{pages.length}</p>
            <p className="text-xs text-muted-foreground">Pages observed</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{cleanPages}</p>
            <p className="text-xs text-muted-foreground">No issues</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{totalWarnings}</p>
            <p className="text-xs text-muted-foreground">Warnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Pages with warnings first */}
      <div className="space-y-2">
        {[...pagesWithWarnings, ...pages.filter((p) => p.warnings.length === 0)].map((page) => (
          <Card key={page.route} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {page.warnings.length > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <p className="font-mono text-sm text-foreground truncate">{page.route}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(page.lastSeen), { addSuffix: true })}
                </p>
              </div>
              {page.warnings.length > 0 && (
                <ul className="mt-2 ml-6 space-y-1">
                  {page.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-300 flex items-center gap-1">
                      <span className="text-amber-500">·</span> {w}
                    </li>
                  ))}
                </ul>
              )}
              {/* Key meta */}
              <div className="mt-2 ml-6 flex flex-wrap gap-2">
                {Boolean(page.observation.hasTitle) && (
                  <Badge variant="outline" className="text-xs bg-zinc-800/50 border-border/30 text-muted-foreground">
                    has title
                  </Badge>
                )}
                {Boolean(page.observation.hasMetaDescription) && (
                  <Badge variant="outline" className="text-xs bg-zinc-800/50 border-border/30 text-muted-foreground">
                    has description
                  </Badge>
                )}
                {Boolean(page.observation.hasCanonical) && (
                  <Badge variant="outline" className="text-xs bg-zinc-800/50 border-border/30 text-muted-foreground">
                    canonical set
                  </Badge>
                )}
                {Boolean(page.observation.hasNoindex) && (
                  <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
                    noindex
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
