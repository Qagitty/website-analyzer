import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Globe, Clock, CheckCircle2, AlertTriangle, XCircle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

function runStatusClass(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    failed:    'bg-red-500/10 text-red-400 border-red-500/20',
    queued:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    running:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
    claimed:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
    cancelled: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    partial:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return map[status] ?? 'bg-secondary text-muted-foreground border-border';
}

function scoreColor(v: number) {
  if (v >= 80) return 'text-emerald-400';
  if (v >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export default async function MonitorRunDetailPage(
  props: { params: Promise<{ id: string; runId: string }> }
) {
  const { id, runId } = await props.params;
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch monitor (ownership check)
  const { data: monitor } = await supabase
    .from('monitors')
    .select('id, url, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!monitor) redirect('/monitors');

  // Fetch the specific run
  const { data: run } = await supabase
    .from('monitor_runs')
    .select('*')
    .eq('id', runId)
    .eq('monitor_id', id)
    .single();

  if (!run) redirect(`/monitors/${id}`);

  // Fetch pages that were analyzed in this run
  const { data: pages } = await supabase
    .from('monitor_pages')
    .select('id, url, page_type, last_run_id, last_scores, last_checked_at, is_active')
    .eq('monitor_id', id)
    .eq('last_run_id', runId);

  const durationMs = run.completed_at && run.started_at
    ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
    : null;

  const compResult = run.comparison_result as Record<string, unknown> | null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Link
          href={`/monitors/${id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to monitor
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
          <h1 className="text-xl font-semibold text-gradient">{monitor.url}</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${runStatusClass(run.status)}`}>
            {run.status}
          </span>
          <span className="text-sm text-muted-foreground capitalize">{run.trigger} run</span>
          {run.attempt > 1 && (
            <span className="text-xs text-muted-foreground/60">Attempt #{run.attempt}</span>
          )}
        </div>
      </div>

      {/* Timing card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Scheduled',
            value: run.scheduled_for ? format(new Date(run.scheduled_for), 'MMM d, HH:mm') : '—',
          },
          {
            label: 'Started',
            value: run.started_at ? format(new Date(run.started_at), 'MMM d, HH:mm') : '—',
          },
          {
            label: 'Completed',
            value: run.completed_at ? format(new Date(run.completed_at), 'MMM d, HH:mm') : '—',
          },
          {
            label: 'Duration',
            value: durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : '—',
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4 pb-3">
              <div className="text-sm font-semibold">{item.value}</div>
              <div className="text-xs text-muted-foreground/60 mt-0.5">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pages analyzed */}
      {pages && pages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" /> Pages Analyzed ({pages.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {pages.map((page) => (
                <div key={page.id} className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
                  <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs truncate text-foreground">{page.url}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{page.page_type}</Badge>
                      {page.last_checked_at && (
                        <span className="text-[10px] text-muted-foreground/50">
                          {formatDistanceToNow(new Date(page.last_checked_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  {page.last_scores != null && (
                    <div className="flex items-center gap-3">
                      {(['performance', 'accessibility', 'seo'] as const).map((k) => {
                        const v = (page.last_scores as any)[k];
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis report link */}
      {run.analysis_id && (
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Full Analysis Report</p>
              <p className="text-xs text-muted-foreground/60">View the complete analysis results for this run</p>
            </div>
            <Link
              href={`/reports/${run.analysis_id}`}
              className="text-sm text-orange-500 hover:underline"
            >
              View report →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {run.failure_origin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-red-400 flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Run Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs text-muted-foreground/60">
              Origin: <span className="text-muted-foreground">{run.failure_origin}</span>
            </div>
            {Array.isArray(run.errors) && run.errors.length > 0 && (
              <div className="space-y-1">
                {(run.errors as { code: string; message: string }[]).map((e, i) => (
                  <div key={i} className="rounded-md bg-red-500/5 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                    <span className="font-medium">{e.code}:</span> {e.message}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Score comparison result */}
      {compResult && (compResult.scoreChanges as any[])?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {(compResult.scoreChanges as any[]).map((change: any, i: number) => {
                if (!change.comparable) return null;
                const delta = change.delta as number;
                const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-muted-foreground';
                const deltaStr = delta > 0 ? `+${delta}` : String(delta);
                return (
                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-muted-foreground capitalize">{change.category}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground/60">{change.previousScore} → {change.currentScore}</span>
                      <span className={`font-semibold ${deltaColor}`}>{deltaStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
