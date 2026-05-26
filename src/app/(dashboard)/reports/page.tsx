import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { RetryButton } from '@/components/reports/RetryButton';
import { formatDistanceToNow } from 'date-fns';

export const metadata: Metadata = { title: 'Reports' };

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400',
    failed:    'bg-red-500/10 text-red-400',
    running:   'bg-indigo-500/10 text-indigo-400',
    queued:    'bg-amber-500/10 text-amber-400',
    pending:   'bg-accent text-muted-foreground',
  };
  const cls = styles[status] ?? 'bg-accent text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default async function ReportsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check if this user is a member of another owner's team
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('owner_id')
    .eq('member_id', user!.id)
    .eq('status', 'active')
    .single();

  const userIds: string[] = [user!.id];
  if (membership?.owner_id) {
    userIds.push(membership.owner_id);
  }

  const { data: analyses } = await supabase
    .from('analyses')
    .select('id, url, status, lighthouse_scores, created_at, completed_at, user_id')
    .in('user_id', userIds)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gradient">Reports</h1>

      {!analyses?.length ? (
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
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Table header — 5 columns: URL | Score | Status | (Retry) | Age */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-border text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
            <span>URL</span>
            <span className="text-right">Score</span>
            <span className="text-right">Status</span>
            <span /> {/* Retry column — no header label */}
            <span className="text-right">Age</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {analyses.map((analysis) => {
              const perf = (analysis.lighthouse_scores as any)?.performance;
              const href = analysis.status === 'completed'
                ? `/reports/${analysis.id}`
                : `/analyze/${analysis.id}`;

              return (
                <Link
                  key={analysis.id}
                  href={href}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3.5 items-center hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  {/* URL */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{analysis.url}</p>
                    {(analysis as any).user_id !== user!.id && (
                      <span className="text-xs text-muted-foreground/60">Team</span>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    {perf != null ? (
                      <span className={`text-sm font-semibold tabular-nums ${scoreColor(perf)}`}>
                        {perf}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground/60">—</span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="text-right">
                    <StatusBadge status={analysis.status} />
                  </div>

                  {/* Retry (only for failed — empty cell otherwise keeps columns aligned) */}
                  <div className="flex items-center justify-end">
                    {analysis.status === 'failed' && (
                      <RetryButton url={analysis.url} />
                    )}
                  </div>

                  {/* Age */}
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
    </div>
  );
}
