'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  ClipboardList, ChevronDown, Trash2, ExternalLink,
  BookmarkCheck, Loader2, Calendar, User, CheckCircle2,
  Clock, AlertCircle, CircleDot,
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

type RemediationStatus = 'open' | 'in_progress' | 'resolved' | 'verified';

interface RemediationItem {
  id: string;
  url: string;
  issue_id: string;
  issue_description: string;
  impact: string;
  wcag_criteria: string[];
  status: RemediationStatus;
  notes: string | null;
  assigned_to: string | null;
  due_date: string | null;
  analysis_id: string;
  created_at: string;
  updated_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RemediationStatus, {
  label: string; color: string; bg: string;
  next: RemediationStatus | null; Icon: React.ElementType;
}> = {
  open:        { label: 'Open',        color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/20',    next: 'in_progress', Icon: CircleDot    },
  in_progress: { label: 'In Progress', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',    next: 'resolved',    Icon: Clock        },
  resolved:    { label: 'Resolved',    color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20',  next: 'verified',    Icon: CheckCircle2 },
  verified:    { label: 'Verified ✓',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', next: null,         Icon: CheckCircle2 },
};

const IMPACT_COLOR: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  serious:  'bg-red-500/10 text-red-400 border-red-500/20',
  moderate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  minor:    'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const TABS: { key: RemediationStatus | 'all'; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'open',        label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved',    label: 'Resolved' },
  { key: 'verified',    label: 'Verified' },
];

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ items }: { items: RemediationItem[] }) {
  if (items.length === 0) return null;
  const verified    = items.filter((i) => i.status === 'verified').length;
  const resolved    = items.filter((i) => i.status === 'resolved').length;
  const in_progress = items.filter((i) => i.status === 'in_progress').length;
  const open        = items.filter((i) => i.status === 'open').length;
  const total       = items.length;

  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Remediation Progress</h2>
        <span className="text-xs text-muted-foreground">
          {verified + resolved} of {total} fixed
        </span>
      </div>

      {/* Stacked progress bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-secondary">
        {verified > 0 && (
          <div className="bg-emerald-500 h-full transition-all" style={{ width: pct(verified) }} />
        )}
        {resolved > 0 && (
          <div className="bg-indigo-500 h-full transition-all" style={{ width: pct(resolved) }} />
        )}
        {in_progress > 0 && (
          <div className="bg-amber-500 h-full transition-all" style={{ width: pct(in_progress) }} />
        )}
        {open > 0 && (
          <div className="bg-slate-500/40 h-full transition-all" style={{ width: pct(open) }} />
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open',        count: open,        color: 'bg-slate-500/40' },
          { label: 'In Progress', count: in_progress, color: 'bg-amber-500'  },
          { label: 'Resolved',    count: resolved,    color: 'bg-indigo-500' },
          { label: 'Verified',    count: verified,    color: 'bg-emerald-500' },
        ].map(({ label, count, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs font-semibold text-foreground ml-auto">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onStatusChange,
  onDelete,
  onFieldUpdate,
}: {
  item: RemediationItem;
  onStatusChange: (id: string, status: RemediationStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onFieldUpdate: (id: string, fields: Partial<RemediationItem>) => void;
}) {
  const [showNotes, setShowNotes]   = useState(false);
  const [notes, setNotes]           = useState(item.notes ?? '');
  const [assignee, setAssignee]     = useState(item.assigned_to ?? '');
  const [dueDate, setDueDate]       = useState(item.due_date ?? '');
  const [savingNotes, setSavingNotes]     = useState(false);
  const [advancingStatus, setAdvancingStatus] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const cfg      = STATUS_CONFIG[item.status];
  const next     = cfg.next;
  const hostname = (() => { try { return new URL(item.url).hostname; } catch { return item.url; } })();

  async function advance() {
    if (!next) return;
    setAdvancingStatus(true);
    await onStatusChange(item.id, next);
    setAdvancingStatus(false);
  }

  async function saveFields() {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/remediation/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          assigned_to: assignee || null,
          due_date:    dueDate   || null,
        }),
      });
      if (!res.ok) throw new Error();
      onFieldUpdate(item.id, { notes, assigned_to: assignee || null, due_date: dueDate || null });
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSavingNotes(false);
    }
  }

  const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== 'verified';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left */}
          <div className="min-w-0 space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${IMPACT_COLOR[item.impact] ?? IMPACT_COLOR.minor}`}>
                {item.impact}
              </span>
              <span className="text-xs text-muted-foreground font-mono">{item.issue_id}</span>
              {item.assigned_to && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  {item.assigned_to}
                </span>
              )}
              {item.due_date && (
                <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                  <Calendar className="h-3 w-3" />
                  {isOverdue ? 'Overdue · ' : ''}{new Date(item.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-foreground leading-snug">
              {item.issue_description}
            </p>
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {hostname}
              </span>
              <span>·</span>
              <span>Tracked {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
              {item.wcag_criteria.length > 0 && (
                <>
                  <span>·</span>
                  {item.wcag_criteria.slice(0, 3).map((tag) => (
                    <span key={tag} className="font-mono bg-accent px-1.5 py-0.5 rounded text-muted-foreground/70">{tag}</span>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Right: status + actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
              <cfg.Icon className="h-3 w-3" />
              {cfg.label}
            </span>
            <div className="flex items-center gap-1">
              {next && (
                <button
                  onClick={advance}
                  disabled={advancingStatus}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {advancingStatus
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <BookmarkCheck className="h-3 w-3" />
                  }
                  → {STATUS_CONFIG[next].label}
                </button>
              )}
              <button
                onClick={() => setShowNotes((v) => !v)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
                Details
              </button>
              <button
                onClick={() => { setDeleting(true); onDelete(item.id).finally(() => setDeleting(false)); }}
                disabled={deleting}
                className="p-1 rounded border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded details panel */}
      {showNotes && (
        <div className="border-t border-border px-4 py-4 space-y-3 bg-accent/20">
          {/* Assignee + due date row */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                <User className="h-3 w-3 inline mr-1" />Assigned to
              </label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Developer name or email"
                className="w-full text-xs bg-background border border-border rounded-md px-3 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                <Calendar className="h-3 w-3 inline mr-1" />Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Steps taken, PR links, blockers..."
              rows={3}
              className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <Link href={`/reports/${item.analysis_id}`} className="text-xs text-indigo-400 hover:text-indigo-300">
              View original report →
            </Link>
            <button
              onClick={saveFields}
              disabled={savingNotes}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 transition-colors disabled:opacity-50"
            >
              {savingNotes && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RemediationPage() {
  const [items, setItems]         = useState<RemediationItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<RemediationStatus | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/remediation');
      if (!res.ok) throw new Error();
      setItems(await res.json());
    } catch {
      toast.error('Failed to load remediation items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(id: string, status: RemediationStatus) {
    try {
      const res = await fetch(`/api/remediation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setItems((prev) => prev.map((i) => i.id === id ? updated : i));
      toast.success(`→ ${STATUS_CONFIG[status].label}`);
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/remediation/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success('Issue removed from tracker');
    } catch {
      toast.error('Failed to remove item');
    }
  }

  function handleFieldUpdate(id: string, fields: Partial<RemediationItem>) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...fields } : i));
  }

  const filtered = activeTab === 'all'
    ? items
    : items.filter((i) => i.status === activeTab);

  const counts = {
    all:         items.length,
    open:        items.filter((i) => i.status === 'open').length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    resolved:    items.filter((i) => i.status === 'resolved').length,
    verified:    items.filter((i) => i.status === 'verified').length,
  };

  const overdueCount = items.filter(
    (i) => i.due_date && new Date(i.due_date) < new Date() && i.status !== 'verified',
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/compliance" className="hover:text-foreground">Compliance</Link>
            <span>/</span>
            <span>Remediation</span>
          </div>
          <h1 className="text-3xl font-bold text-gradient">Remediation Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and resolve accessibility issues across your sites
          </p>
        </div>
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 shrink-0">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-sm text-red-400 font-medium">{overdueCount} overdue</span>
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-16 text-center space-y-4">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/20" />
          <p className="text-lg font-medium text-foreground">No issues tracked yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Open any report, go to the Accessibility section, and click <strong>Track</strong> on issues you want to fix.
          </p>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Go to Reports →
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          {/* Progress bar */}
          <ProgressBar items={items} />

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap
                  ${activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'bg-accent text-muted-foreground'
                }`}>
                  {counts[tab.key as keyof typeof counts]}
                </span>
              </button>
            ))}
          </div>

          {/* Items */}
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No {activeTab === 'all' ? '' : activeTab.replace('_', ' ')} issues.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onFieldUpdate={handleFieldUpdate}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
