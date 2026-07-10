'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Globe, Plus, Trash2, RefreshCw, Search, CheckCircle2, AlertTriangle, Loader2, ExternalLink,
} from 'lucide-react';
import { z } from 'zod';

const urlSchema = z.string().trim().url('Please enter a valid URL including https://');

interface MonitorPage {
  id: string;
  monitor_id: string;
  url: string;
  page_type: 'root' | 'pinned' | 'discovered';
  is_active: boolean;
  discovery_source: string | null;
  last_scores: Record<string, number> | null;
  last_checked_at: string | null;
  sort_order: number;
}

interface DiscoveredPage {
  url: string;
  source: string;
  depth: number;
}

function scoreColor(v: number) {
  if (v >= 80) return 'text-emerald-400';
  if (v >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export function MonitorPages({
  monitorId,
  pageMode,
  rootUrl,
}: {
  monitorId: string;
  pageMode: string;
  rootUrl: string;
}) {
  const [pages, setPages] = useState<MonitorPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUrl, setAddUrl] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredPage[] | null>(null);

  const loadPages = useCallback(async () => {
    try {
      const res = await fetch(`/api/monitors/${monitorId}/pages`);
      if (!res.ok) return;
      setPages(await res.json());
    } finally {
      setLoading(false);
    }
  }, [monitorId]);

  useEffect(() => { loadPages(); }, [loadPages]);

  const addPage = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = urlSchema.safeParse(addUrl.trim());
    if (!parsed.success) { setAddError(parsed.error.errors[0].message); return; }
    setAddError('');
    setAdding(true);
    try {
      const res = await fetch(`/api/monitors/${monitorId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parsed.data, page_type: 'pinned' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPages((p) => [...p, data]);
      setAddUrl('');
      toast.success('Page added to monitor');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const removePage = async (page: MonitorPage) => {
    try {
      const res = await fetch(`/api/monitors/${monitorId}/pages/${page.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setPages((p) => p.filter((pg) => pg.id !== page.id));
      toast.success('Page removed');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const runDiscovery = async (save: boolean) => {
    setDiscovering(true);
    setDiscovered(null);
    try {
      const res = await fetch(`/api/monitors/${monitorId}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'both', save }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDiscovered(data.pages);
      if (save) {
        toast.success(`${data.discovered} pages added from discovery`);
        await loadPages();
      } else {
        toast.success(`Found ${data.discovered} pages — review and save below`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDiscovering(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading pages…</div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Monitored Pages</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => runDiscovery(false)}
              disabled={discovering}
            >
              {discovering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              Discover
            </Button>
            {discovered && discovered.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1 border-emerald-500/50 text-emerald-400"
                onClick={() => runDiscovery(true)}
                disabled={discovering}
              >
                <Plus className="h-3 w-3" /> Save {discovered.length} found
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground/60">
          Mode: <span className="font-medium text-muted-foreground">{pageMode}</span>
          {' · '}
          {pages.filter((p) => p.is_active).length} active pages
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Discovery preview */}
        {discovered && discovered.length > 0 && (
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-1">
            <p className="text-xs font-medium text-indigo-400 mb-2">
              {discovered.length} pages found — click "Save" to add them
            </p>
            {discovered.slice(0, 8).map((p) => (
              <div key={p.url} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="h-3 w-3 shrink-0 opacity-50" />
                <span className="truncate">{p.url}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{p.source}</Badge>
              </div>
            ))}
            {discovered.length > 8 && (
              <p className="text-xs text-muted-foreground/50">…and {discovered.length - 8} more</p>
            )}
          </div>
        )}

        {/* Pages list */}
        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 text-center py-4">
            No pages yet. Add one below or run discovery.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {pages.map((page) => (
              <div key={page.id} className="flex items-center gap-3 px-3 py-2.5">
                <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs truncate text-foreground">{page.url}</span>
                    <a href={page.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground shrink-0" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {page.page_type}
                    </Badge>
                    {page.last_checked_at && (
                      <span className="text-[10px] text-muted-foreground/50">
                        Checked {new Date(page.last_checked_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Last scores */}
                {page.last_scores && (
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {(['performance', 'accessibility', 'seo'] as const).map((k) => {
                      const v = page.last_scores![k];
                      if (v == null) return null;
                      return (
                        <div key={k} className="text-center">
                          <div className={`text-xs font-bold ${scoreColor(v)}`}>{v}</div>
                          <div className="text-[9px] text-muted-foreground/40 capitalize">{k.slice(0, 4)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {page.page_type !== 'root' && (
                  <button
                    type="button"
                    onClick={() => removePage(page)}
                    className="text-red-400/40 hover:text-red-400 transition-colors shrink-0"
                    title="Remove page"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add page form (always shown for pinned / custom modes) */}
        {(pageMode === 'pinned' || pageMode === 'custom' || pageMode === 'homepage') && (
          <form onSubmit={addPage} className="flex gap-2">
            <div className="flex-1">
              <Input
                type="url"
                placeholder="https://example.com/page"
                value={addUrl}
                onChange={(e) => { setAddUrl(e.target.value); setAddError(''); }}
                className="h-8 text-sm"
              />
              {addError && <p className="text-xs text-red-500 mt-1">{addError}</p>}
            </div>
            <Button type="submit" size="sm" disabled={adding} variant="outline" className="shrink-0 h-8 gap-1">
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
