'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Globe, Clock, Play, Pause, RotateCw, ArrowLeft, CheckCircle2,
  AlertTriangle, XCircle, ExternalLink, ChevronRight, Activity,
} from 'lucide-react';
import type { Monitor } from '@/types/analysis';
import { TrendChart } from './TrendChart';

// ── Types ────────────────────────────────────────────────────────────────────

interface MonitorRun {
  id: string;
  analysis_id: string | null;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  status: string;
  trigger: string;
  attempt: number;
  failure_origin: string | null;
  errors: Array<{ code: string; message: string }> | null;
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  occurrence_count: number;
  last_detected_at: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function healthFromScores(scores: Record<string, number | null> | null | undefined) {
  if (!scores) return null;
  const vals = ['performance', 'accessibility', 'seo']
    .map((k) => (scores as any)[k])
    .filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg >= 80) return { label: 'Healthy', color: 'text-emerald-400', Icon: CheckCircle2 };
  if (avg >= 50) return { label: 'Warning', color: 'text-amber-400', Icon: AlertTriangle };
  return { label: 'Critical', color: 'text-red-400', Icon: XCircle };
}

function runStatusBadge(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    failed:    'bg-red-500/10 text-red-400 border-red-500/20',
    queued:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    running:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
    claimed:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
    cancelled: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  };
  return map[status] ?? 'bg-secondary text-muted-foreground border-border';
}

function incidentSeverityBadge(severity: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    high:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
    medium:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    low:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
    info:     'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  };
  return map[severity] ?? 'bg-secondary text-muted-foreground border-border';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MonitorDetail({ monitor: initialMonitor }: { monitor: Monitor }) {
  const router = useRouter();
  const [monitor, setMonitor] = useState(initialMonitor);
  const [runs, setRuns] = useState<MonitorRun[] | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [tab, setTab] = useState<'runs' | 'incidents' | 'chart'>('runs');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadRuns = useCallback(async () => {
    const res = await fetch(`/api/monitors/${monitor.id}/runs`);
    if (res.ok) setRuns(await res.json());
  }, [monitor.id]);

  const loadIncidents = useCallback(async () => {
    const res = await fetch(`/api/monitors/${monitor.id}/incidents`);
    if (res.ok) setIncidents(await res.json());
  }, [monitor.id]);

  useEffect(() => {
    if (tab === 'runs') loadRuns();
    if (tab === 'incidents') loadIncidents();
  }, [tab, loadRuns, loadIncidents]);

  const toggle = async () => {
    setBusy(true);
    const action = monitor.is_active ? 'pause' : 'resume';
    try {
      const res = await fetch(`/api/monitors/${monitor.id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMonitor(data);
      toast.success(action === 'pause' ? 'Monitor paused' : 'Monitor resumed');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/monitors/${monitor.id}/run-now`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Analysis queued — run history will update when complete.');
      // Reload runs after short delay
      setTimeout(loadRuns, 1500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const health = healthFromScores(monitor.last_scores as any);
  const scores = monitor.last_scores as Record<string, number | null> | null;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
            <h1 className="text-xl font-semibold truncate max-w-lg">{monitor.url}</h1>
            <a href={monitor.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {health && (
              <div className={`flex items-center gap-1.5 text-sm ${health.color}`}>
                <health.Icon className="h-4 w-4" />
                <span>{health.label}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${monitor.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-sm text-muted-foreground">{monitor.is_active ? 'Active' : 'Paused'}</span>
            </div>
            <span className="text-sm text-muted-foreground capitalize bg-secondary border border-border px-2 py-0.5 rounded-full">
              {monitor.frequency}
            </span>
            {mounted && monitor.next_run_at && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Next run {format(new Date(monitor.next_run_at), 'MMM d HH:mm')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={toggle} disabled={busy}>
            {monitor.is_active ? <><Pause className="h-4 w-4 mr-1" /> Pause</> : <><Play className="h-4 w-4 mr-1" /> Resume</>}
          </Button>
          <Button size="sm" onClick={runNow} disabled={busy}
            className="bg-orange-600 hover:bg-orange-700 text-white border-0">
            <RotateCw className="h-4 w-4 mr-1" /> Run now
          </Button>
        </div>
      </div>

      {/* Score summary cards */}
      {scores && (
        <div className="grid grid-cols-3 gap-4">
          {(['performance', 'accessibility', 'seo'] as const).map((k) => {
            const v = (scores as any)[k];
            if (v == null) return null;
            const color = v >= 80 ? 'text-emerald-400' : v >= 50 ? 'text-amber-400' : 'text-red-400';
            return (
              <Card key={k}>
                <CardContent className="pt-6 text-center">
                  <div className={`text-3xl font-bold ${color}`}>{v}</div>
                  <div className="text-sm text-muted-foreground capitalize mt-1">{k}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['runs', 'chart', 'incidents'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-orange-500 text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'runs' ? 'Run History' : t === 'chart' ? 'Score Trend' : 'Incidents'}
          </button>
        ))}
      </div>

      {/* Run history */}
      {tab === 'runs' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Run History
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={loadRuns} disabled={!runs}>
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!runs && <div className="text-sm text-muted-foreground/60">Loading…</div>}
            {runs?.length === 0 && <div className="text-sm text-muted-foreground/60">No runs yet.</div>}
            {runs && runs.length > 0 && (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${runStatusBadge(run.status)}`}>
                        {run.status}
                      </span>
                      <div className="text-sm">
                        <div className="text-muted-foreground/60 text-xs capitalize">{run.trigger} run</div>
                        {mounted && run.scheduled_for && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(run.scheduled_for), 'MMM d, yyyy HH:mm')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {run.completed_at && run.started_at && (
                        <span className="text-xs text-muted-foreground/60">
                          {Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s
                        </span>
                      )}
                      {run.analysis_id && (
                        <a
                          href={`/reports/${run.analysis_id}`}
                          className="text-xs text-orange-500 hover:underline flex items-center gap-0.5"
                        >
                          Report <ChevronRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {run.failure_origin && (
                      <div className="w-full text-xs text-red-400/80 pl-1">
                        Failed: {run.errors?.[0]?.message ?? run.failure_origin}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Score trend chart */}
      {tab === 'chart' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Score Trend</CardTitle></CardHeader>
          <CardContent>
            <TrendChart url={monitor.url} monitorId={monitor.id} />
          </CardContent>
        </Card>
      )}

      {/* Incidents */}
      {tab === 'incidents' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Incidents</CardTitle></CardHeader>
          <CardContent>
            {!incidents && <div className="text-sm text-muted-foreground/60">Loading…</div>}
            {incidents?.length === 0 && (
              <div className="text-sm text-muted-foreground/60">No incidents detected. All looking good.</div>
            )}
            {incidents && incidents.length > 0 && (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {incidents.map((inc) => (
                  <div key={inc.id} className="px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="font-medium text-sm">{inc.title}</span>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${incidentSeverityBadge(inc.severity)}`}>
                          {inc.severity}
                        </span>
                        <Badge variant={inc.status === 'open' ? 'destructive' : 'secondary'} className="text-xs">
                          {inc.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
                      <span>{inc.occurrence_count} occurrence{inc.occurrence_count !== 1 ? 's' : ''}</span>
                      {mounted && (
                        <span>Last: {formatDistanceToNow(new Date(inc.last_detected_at), { addSuffix: true })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
