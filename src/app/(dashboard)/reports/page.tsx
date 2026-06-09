'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import { RetryButton } from '@/components/reports/RetryButton';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

const PAGE_SIZE = 20;

// ── Inline skeleton ───────────────────────────────────────────────────────────
function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400',
    failed:    'bg-red-500/10 text-red-400',
    running:   'bg-indigo-500/10 text-indigo-400',
    queued:    'bg-amber-500/10 text-amber-400',
    pending:   'bg-accent text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${map[status] ?? 'bg-accent text-muted-foreground'}`}>
      {status}
    </span>
  );
}

export default function ReportsPage() {
  const [analyses, setAnalyses]   = useState<any[]>([]);
  const [count, setCount]         = useState<number | null>(null);
  const [page, setPage]           = useState(1);
  const [userId, setUserId]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [dataError, setDataError] = useState(false);

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const load = useCallback(async (currentPage: number) => {
    setLoading(true);
    setDataError(false);

    try {
      const supabase = createBrowserClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      setUserId(user.id);

      const offset = (currentPage - 1) * PAGE_SIZE;

      // Team membership check
      const { data: membership } = await supabase
        .from('team_members')
        .select('owner_id')
        .eq('member_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const userIds = [user.id];
      if (membership?.owner_id) userIds.push(membership.owner_id);

      const { data, count: total, error } = await supabase
        .from('analyses')
        .select('id, url, status, lighthouse_scores, created_at, completed_at, user_id', { count: 'exact' })
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        setDataError(true);
      } else {
        setAnalyses(data ?? []);
        setCount(total ?? null);
      }
    } catch {
      setDataError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  if (loading) return <ReportsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gradient">Reports</h1>
        {(count ?? 0) > 0 && (
          <span className="text-sm text-muted-foreground">{count} total</span>
        )}
      </div>

      {dataError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Could not load your reports — the database may be temporarily unavailable. Try refreshing.
        </div>
      )}

      {!dataError && analyses.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-16 text-center space-y-4">
          <div className="text-4xl opacity-20">📊</div>
          <p className="text-lg font-medium text-foreground">No analyses yet</p>
          <p className="text-sm text-muted-foreground">Run your first analysis to see results here.</p>
          <a
            href="/analyze"
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Analyze a site →
          </a>
        </div>
      )}

      {analyses.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-border text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
            <span>URL</span>
            <span className="text-right">Score</span>
            <span className="text-right">Status</span>
            <span />
            <span className="text-right">Age</span>
          </div>

          <div className="divide-y divide-white/5">
            {analyses.map((analysis) => {
              const perf = analysis.lighthouse_scores?.performance;
              const href = analysis.status === 'completed'
                ? `/reports/${analysis.id}`
                : `/analyze/${analysis.id}`;

              return (
                <Link
                  key={analysis.id}
                  href={href}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3.5 items-center hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{analysis.url}</p>
                    {userId && analysis.user_id !== userId && (
                      <span className="text-xs text-muted-foreground/60">Team</span>
                    )}
                  </div>

                  <div className="text-right">
                    {perf != null ? (
                      <span className={`text-sm font-semibold tabular-nums ${scoreColor(perf)}`}>{perf}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground/60">—</span>
                    )}
                  </div>

                  <div className="text-right">
                    <StatusBadge status={analysis.status} />
                  </div>

                  <div className="flex items-center justify-end">
                    {analysis.status === 'failed' && <RetryButton url={analysis.url} />}
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-muted-foreground/60 whitespace-nowrap">
                      {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <button
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                ← Previous
              </button>
            )}
            {page < totalPages && (
              <button
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
