'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Clock, Globe, Trash2, Play, Pause, Plus, Bell, BellOff, ExternalLink, ChevronDown, ChevronRight,
} from 'lucide-react';
import { z } from 'zod';
import type { Monitor } from '@/types/analysis';
import { TrendChart } from './TrendChart';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const urlSchema = z.string().trim().url('Please enter a valid URL including https://');

// ── Create form ──────────────────────────────────────────────────────────────
function CreateMonitorForm({ onCreated }: { onCreated: (m: Monitor) => void }) {
  const [url, setUrl] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [notify, setNotify] = useState(true);
  const [threshold, setThreshold] = useState(10);
  const [loading, setLoading] = useState(false);
  const [urlError, setUrlError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    const parsed = urlSchema.safeParse(trimmed);
    if (!parsed.success) {
      setUrlError(parsed.error.errors[0].message);
      return;
    }
    setUrlError('');
    setLoading(true);
    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmed,
          frequency,
          notify_on_score_drop: notify,
          score_drop_threshold: threshold,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create monitor');
      onCreated(data);
      setUrl('');
      toast.success('Monitor created!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Monitor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(''); }}
              aria-label="URL to monitor"
            />
            {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Frequency */}
            <div className="flex rounded-md border border-border overflow-hidden text-sm">
              {(['daily', 'weekly'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`px-3 py-1.5 capitalize transition-colors ${
                    frequency === f
                      ? 'bg-orange-600 text-white'
                      : 'bg-card hover:bg-accent text-muted-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Notify toggle */}
            <button
              type="button"
              onClick={() => setNotify((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                notify ? 'border-orange-500/50 text-orange-400' : 'border-border text-muted-foreground/60'
              }`}
            >
              {notify ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              {notify ? 'Alerts on' : 'Alerts off'}
            </button>

            {/* Threshold */}
            {notify && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Alert if score drops by</span>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-16 h-8 text-center"
                />
                <span>pts</span>
              </div>
            )}
          </div>

          <Button type="submit" disabled={loading} size="sm" className="bg-orange-600 text-white hover:from-orange-400 hover:to-orange-400 border-0">
            {loading ? 'Creating…' : 'Create monitor'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── History panel ────────────────────────────────────────────────────────────
interface HistoryEntry {
  id: string;
  date: string;
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
}

function HistoryPanel({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (entries !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/history?url=${encodeURIComponent(url)}&limit=20`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (!open) load();
    setOpen((v) => !v);
  };

  return (
    <div className="border-t border-border pt-2">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Report history
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          {loading && (
            <p className="text-xs text-muted-foreground/50 pl-1">Loading…</p>
          )}
          {!loading && entries?.length === 0 && (
            <p className="text-xs text-muted-foreground/50 pl-1">No completed reports yet.</p>
          )}
          {!loading && entries && entries.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              {[...entries].reverse().map((e) => {
                const scores = [e.performance, e.accessibility, e.seo].filter((v) => v != null) as number[];
                const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
                const color = avg == null ? 'text-muted-foreground' : avg >= 80 ? 'text-emerald-400' : avg >= 50 ? 'text-amber-400' : 'text-red-400';
                return (
                  <div key={e.id} className="flex items-center justify-between px-3 py-2 border-b border-border last:border-0 gap-3">
                    <span className="text-xs text-muted-foreground/70">
                      {format(new Date(e.date), 'MMM d, yyyy HH:mm')}
                    </span>
                    <div className="flex items-center gap-3">
                      {avg != null && (
                        <span className={`text-xs font-semibold ${color}`}>{avg} avg</span>
                      )}
                      <a
                        href={`/reports/${e.id}`}
                        className="text-xs text-orange-500 hover:underline whitespace-nowrap"
                      >
                        View →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Monitor card ─────────────────────────────────────────────────────────────
function MonitorCard({
  monitor,
  onUpdate,
  onDelete,
}: {
  monitor: Monitor;
  onUpdate: (updated: Monitor) => void;
  onDelete: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/monitors/${monitor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !monitor.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate(data);
      toast.success(data.is_active ? 'Monitor resumed' : 'Monitor paused');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/monitors/${monitor.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      onDelete(monitor.id);
      toast.success('Monitor deleted');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const scores = monitor.last_scores;

  return (
    <div className="bg-card border border-border rounded-xl hover:border-orange-200 dark:border-orange-900/40 transition-colors p-4 space-y-3">
        {/* URL + status — dimmed when paused, actions row stays at full opacity */}
        <div className={monitor.is_active ? '' : 'opacity-60'}>
        {/* URL + status */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-semibold text-foreground text-sm truncate max-w-xs">{monitor.url}</span>
            <a
              href={monitor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${monitor.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-xs text-muted-foreground">{monitor.is_active ? 'Active' : 'Paused'}</span>
            </div>
            <span className="bg-secondary text-muted-foreground border border-border text-xs px-2 py-0.5 rounded-full capitalize">{monitor.frequency}</span>
          </div>
        </div>

        {/* Last scores */}
        {scores && (
          <div className="bg-background rounded-lg p-3 border border-border flex flex-wrap gap-4">
            {(['performance', 'accessibility', 'seo'] as const).map((k) => {
              const v = (scores as any)[k];
              if (v == null) return null;
              const color = v >= 80 ? 'text-emerald-400' : v >= 50 ? 'text-amber-400' : 'text-red-400';
              return (
                <div key={k} className="text-center">
                  <div className={`text-lg font-bold leading-none ${color}`}>{v}</div>
                  <div className="text-xs text-muted-foreground/60 capitalize mt-0.5">{k}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Score trend chart — only once at least one run has completed */}
        {monitor.last_analysis_id && (
          <TrendChart url={monitor.url} monitorId={monitor.id} />
        )}

        {/* Timing — rendered only on client to avoid SSR/timezone hydration mismatch */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground/60 flex-wrap">
          {mounted && monitor.last_run_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last run {formatDistanceToNow(new Date(monitor.last_run_at), { addSuffix: true })}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Next run {mounted ? format(new Date(monitor.next_run_at), 'MMM d, HH:mm') : '—'}
          </span>
          {monitor.notify_on_score_drop && (
            <span className="flex items-center gap-1">
              <Bell className="h-3 w-3" />
              Alert on {monitor.score_drop_threshold}pt drop
            </span>
          )}
        </div>

        {/* Report history */}
        <HistoryPanel url={monitor.url} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className="text-muted-foreground/60 hover:text-muted-foreground text-xs flex items-center gap-1"
          >
            {monitor.is_active
              ? <><Pause className="h-3 w-3" /> Pause</>
              : <><Play className="h-3 w-3" /> Resume</>}
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={busy}
                className="text-red-400/50 hover:text-red-400 text-xs flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete monitor?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the monitor for{' '}
                  <span className="font-medium text-foreground break-all">{monitor.url}</span>.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={remove}
                  className="bg-red-500 hover:bg-red-600 text-white border-0"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
    </div>
  );
}

// ── Main list ────────────────────────────────────────────────────────────────
export function MonitorsList({ initialMonitors }: { initialMonitors: Monitor[] }) {
  const [monitors, setMonitors] = useState<Monitor[]>(initialMonitors);

  const handleCreated = (m: Monitor) => setMonitors((prev) => [m, ...prev]);
  const handleUpdate = (updated: Monitor) =>
    setMonitors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  const handleDelete = (id: string) =>
    setMonitors((prev) => prev.filter((m) => m.id !== id));

  return (
    <div className="space-y-4">
      <CreateMonitorForm onCreated={handleCreated} />

      {monitors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-muted-foreground/60 text-center text-sm py-12">
          No monitors yet. Create one above to start tracking your sites automatically.
        </div>
      ) : (
        <div className="space-y-3">
          {monitors.map((m) => (
            <MonitorCard
              key={m.id}
              monitor={m}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
