'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Route, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ObservedRoute } from '@/types/connected-sites';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  siteId: string;
  planHasRouteDiscovery: boolean;
}

export function ObservedRoutesTable({ siteId, planHasRouteDiscovery }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [routes, setRoutes] = useState<ObservedRoute[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const limit = 50;

  const load = useCallback(
    async (s: string, p: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ search: s, page: String(p), limit: String(limit) });
        const res = await fetch(`/api/connected-sites/${siteId}/routes?${params}`);
        const data = await res.json();
        setRoutes(data.routes ?? []);
        setTotal(data.total ?? 0);
      } catch {
        setRoutes([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [siteId]
  );

  useEffect(() => {
    load(search, page);
  }, [load, search, page]);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  if (!planHasRouteDiscovery) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <Route className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            Route discovery is available on Pro and above.
          </p>
          <Button size="sm" variant="outline" asChild>
            <a href="/settings/billing">Upgrade plan</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter routes…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => load(search, page)}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <p className="text-xs text-muted-foreground ml-auto">{total} routes discovered</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      ) : routes.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Route className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No routes match your search.' : 'No routes observed yet. Once visitors navigate your site, routes will appear here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-xs text-muted-foreground">Route</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-right">Visits</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Source</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((r) => (
                  <TableRow key={r.route} className="border-border/30">
                    <TableCell className="font-mono text-sm text-foreground py-2">
                      {r.route}
                    </TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground py-2">
                      {r.count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2 capitalize">
                      {r.source}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2">
                      {formatDistanceToNow(new Date(r.lastSeen), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {total > limit && (
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {Math.ceil(total / limit)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page * limit >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
