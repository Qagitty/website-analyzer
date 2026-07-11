'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, ShieldX, ExternalLink, RefreshCw, History, ChevronDown, ChevronUp } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  getComplianceSummary,
  COMPLIANCE_CONFIG,
  type ComplianceLevel,
  type ComplianceSummary,
} from '@/lib/compliance';
import { ClipboardList } from 'lucide-react';
import type { AccessibilityIssue } from '@/types/analysis';
import { formatDistanceToNow, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SiteCompliance {
  monitorId: string;
  url: string;
  analysisId: string | null;
  lastChecked: string | null;
  summary: ComplianceSummary | null;
  /** Last 5 compliance snapshots, newest first */
  history: ComplianceLevel[];
}

interface HistoryRow {
  analysisId: string;
  url: string;
  completedAt: string;
  level: ComplianceLevel;
  criticalCount: number;
  moderateCount: number;
  totalIssues: number;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LevelIcon({ level, className }: { level: ComplianceLevel; className?: string }) {
  if (level === 'no_blockers') return <ShieldCheck className={className} />;
  if (level === 'gaps')        return <ShieldAlert  className={className} />;
  return                              <ShieldX      className={className} />;
}

function ComplianceBadge({ level }: { level: ComplianceLevel }) {
  const cfg = COMPLIANCE_CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.badgeClass}`}>
      <LevelIcon level={level} className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

/** Five coloured dots showing the last 5 audit results (newest = rightmost). */
function HistoryDots({ history }: { history: ComplianceLevel[] }) {
  const slots = Array.from({ length: 5 }, (_, i) => history[history.length - 1 - i] ?? null);
  return (
    <div className="flex items-center gap-1" title="Last 5 audits (newest → oldest)">
      {slots.reverse().map((level, i) =>
        level ? (
          <span key={i} className={`h-2 w-2 rounded-full ${COMPLIANCE_CONFIG[level].dot}`} />
        ) : (
          <span key={i} className="h-2 w-2 rounded-full bg-border" />
        ),
      )}
    </div>
  );
}

function SiteCard({ site }: { site: SiteCompliance }) {
  const { summary, history } = site;
  const level = summary?.level ?? 'no_blockers';
  const cfg   = COMPLIANCE_CONFIG[level];

  const hostname = (() => {
    try { return new URL(site.url).hostname; } catch { return site.url; }
  })();

  return (
    <div className={`border-l-4 ${cfg.borderClass} bg-card border border-border rounded-xl p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left: URL + badge */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <LevelIcon level={level} className={`h-4 w-4 shrink-0 ${cfg.textClass}`} />
            <p className="text-sm font-semibold text-foreground truncate">{hostname}</p>
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <ComplianceBadge level={level} />
            {site.lastChecked && (
              <span className="text-xs text-muted-foreground">
                Last checked {formatDistanceToNow(new Date(site.lastChecked), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        {/* Right: stats + history */}
        <div className="flex items-center gap-5 shrink-0">
          {summary && (
            <>
              <div className="text-center">
                <p className={`text-xl font-bold ${summary.criticalCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {summary.criticalCount}
                </p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-bold ${summary.moderateCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {summary.moderateCount}
                </p>
                <p className="text-xs text-muted-foreground">Moderate</p>
              </div>
            </>
          )}
          <div className="text-center space-y-1">
            <HistoryDots history={history} />
            <p className="text-xs text-muted-foreground">History</p>
          </div>
        </div>
      </div>

      {/* Footer: view report link */}
      {site.analysisId && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <Link
            href={`/reports/${site.analysisId}`}
            className="text-xs text-orange-500 hover:text-orange-500 transition-colors"
          >
            View latest report →
          </Link>
        </div>
      )}
    </div>
  );
}

/** Full history table — filterable by URL, sortable by date */
function ComplianceHistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [filterUrl, setFilterUrl]   = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [expanded, setExpanded]     = useState(true);

  const urls = ['all', ...Array.from(new Set(rows.map(r => {
    try { return new URL(r.url).hostname; } catch { return r.url; }
  })))];

  const filtered = rows.filter(r => {
    const hostname = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();
    if (filterUrl   !== 'all' && hostname    !== filterUrl)    return false;
    if (filterLevel !== 'all' && r.level     !== filterLevel)  return false;
    return true;
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Compliance History</span>
          <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
            {rows.length} audits
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 px-5 pb-4 border-t border-border/50 pt-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Site</label>
              <select
                value={filterUrl}
                onChange={e => setFilterUrl(e.target.value)}
                className="text-xs bg-secondary border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {urls.map(u => <option key={u} value={u}>{u === 'all' ? 'All sites' : u}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Status</label>
              <select
                value={filterLevel}
                onChange={e => setFilterLevel(e.target.value)}
                className="text-xs bg-secondary border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="all">All statuses</option>
                <option value="no_blockers">No Blockers</option>
                <option value="gaps">Gaps Detected</option>
                <option value="blockers">Blockers Found</option>
              </select>
            </div>
            {(filterUrl !== 'all' || filterLevel !== 'all') && (
              <button
                onClick={() => { setFilterUrl('all'); setFilterLevel('all'); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="px-5 pb-8 text-center text-sm text-muted-foreground">
              No audits match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-border/50 bg-secondary/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2.5">Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Site</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Status</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Critical</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Moderate</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2.5">Total</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map(row => {
                    const cfg      = COMPLIANCE_CONFIG[row.level];
                    const hostname = (() => { try { return new URL(row.url).hostname; } catch { return row.url; } })();
                    return (
                      <tr key={row.analysisId} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <div>{format(new Date(row.completedAt), 'MMM d, yyyy')}</div>
                          <div className="text-muted-foreground/50">{format(new Date(row.completedAt), 'HH:mm')}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-foreground">{hostname}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badgeClass}`}>
                            {row.level === 'no_blockers' && <ShieldCheck className="h-3 w-3" />}
                            {row.level === 'gaps'        && <ShieldAlert  className="h-3 w-3" />}
                            {row.level === 'blockers'    && <ShieldX      className="h-3 w-3" />}
                            {cfg.short}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-semibold tabular-nums ${row.criticalCount > 0 ? 'text-red-400' : 'text-muted-foreground/50'}`}>
                            {row.criticalCount > 0 ? row.criticalCount : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-semibold tabular-nums ${row.moderateCount > 0 ? 'text-amber-400' : 'text-muted-foreground/50'}`}>
                            {row.moderateCount > 0 ? row.moderateCount : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs tabular-nums text-muted-foreground">{row.totalIssues}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/reports/${row.analysisId}`}
                            className="text-xs text-orange-500 hover:text-orange-400 transition-colors whitespace-nowrap"
                          >
                            View report →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label, value, sub, colorClass,
}: { label: string; value: number; sub?: string; colorClass: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center space-y-1">
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [sites, setSites]           = useState<SiteCompliance[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else             setLoading(true);
    setError(false);

    const timer = setTimeout(() => {
      setError(true);
      setLoading(false);
      setRefreshing(false);
    }, 12000);

    try {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { window.location.href = '/login'; return; }

      // 1. Fetch all monitors
      const { data: monitors, error: mErr } = await supabase
        .from('monitors')
        .select('id, url, last_analysis_id, last_run_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (mErr) throw mErr;
      if (!monitors?.length) { setSites([]); return; }

      // 2. Batch-fetch the latest analysis for each monitor
      const analysisIds = monitors
        .map((m) => m.last_analysis_id)
        .filter((id): id is string => !!id);

      const { data: latestAnalyses } = analysisIds.length
        ? await supabase
            .from('analyses')
            .select('id, accessibility_issues, completed_at')
            .in('id', analysisIds)
        : { data: [] };

      const analysisMap = new Map(
        (latestAnalyses ?? []).map((a) => [a.id, a]),
      );

      // 3. Fetch full history for monitored URLs (up to 200 rows for the table)
      const urls = [...new Set(monitors.map((m) => m.url))];
      const { data: allHistory } = await supabase
        .from('analyses')
        .select('id, url, accessibility_issues, completed_at')
        .eq('user_id', user.id)
        .in('url', urls)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(200);

      // Group history by URL (first 5 per URL for trend dots)
      const historyByUrl = new Map<string, ComplianceLevel[]>();
      const tableRows: HistoryRow[] = [];

      for (const row of allHistory ?? []) {
        const issues  = (row.accessibility_issues as AccessibilityIssue[]) ?? [];
        const summary = getComplianceSummary(issues);

        // trend dots
        const existing = historyByUrl.get(row.url) ?? [];
        if (existing.length < 5) {
          existing.push(summary.level);
          historyByUrl.set(row.url, existing);
        }

        // full history table
        tableRows.push({
          analysisId:    row.id,
          url:           row.url,
          completedAt:   row.completed_at ?? '',
          level:         summary.level,
          criticalCount: summary.criticalCount,
          moderateCount: summary.moderateCount,
          totalIssues:   summary.totalIssues,
        });
      }

      setHistoryRows(tableRows);

      // 4. Build site compliance objects
      const result: SiteCompliance[] = monitors.map((monitor) => {
        const analysis = monitor.last_analysis_id
          ? analysisMap.get(monitor.last_analysis_id)
          : null;

        const issues = analysis
          ? ((analysis.accessibility_issues as AccessibilityIssue[]) ?? [])
          : null;

        return {
          monitorId:   monitor.id,
          url:         monitor.url,
          analysisId:  analysis?.id ?? null,
          lastChecked: analysis?.completed_at ?? monitor.last_run_at ?? null,
          summary:     issues ? getComplianceSummary(issues) : null,
          history:     historyByUrl.get(monitor.url) ?? [],
        };
      });

      setSites(result);
    } catch {
      setError(true);
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageSkeleton />;

  // Summary counts
  const withData   = sites.filter((s) => s.summary !== null);
  const compliant  = withData.filter((s) => s.summary!.level === 'no_blockers').length;
  const partial    = withData.filter((s) => s.summary!.level === 'gaps').length;
  const nonComp    = withData.filter((s) => s.summary!.level === 'blockers').length;
  const totalCrit  = withData.reduce((n, s) => n + (s.summary!.criticalCount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gradient">Compliance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            EAA / WCAG 2.1 AA status across all monitored sites
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/compliance/remediation"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-300 dark:border-orange-900/50 text-sm text-orange-500 hover:bg-orange-50 dark:bg-orange-950/30 transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Remediation Tracker</span>
            <span className="sm:hidden">Remediation</span>
          </Link>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Could not load compliance data. Please refresh.
        </div>
      )}

      {/* No monitors yet */}
      {!error && sites.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-16 text-center space-y-4">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/20" />
          <p className="text-lg font-medium text-foreground">No monitored sites yet</p>
          <p className="text-sm text-muted-foreground">
            Set up a monitor for your sites and compliance data will appear here after the first analysis.
          </p>
          <Link
            href="/monitors"
            className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Set up a monitor →
          </Link>
        </div>
      )}

      {sites.length > 0 && (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Monitored Sites"
              value={sites.length}
              colorClass="text-foreground"
            />
            <StatCard
              label="Compliant"
              value={compliant}
              sub="WCAG 2.1 AA"
              colorClass="text-emerald-400"
            />
            <StatCard
              label="Partial"
              value={partial}
              sub="minor issues only"
              colorClass="text-amber-400"
            />
            <StatCard
              label="Non-Compliant"
              value={nonComp}
              sub={totalCrit > 0 ? `${totalCrit} critical issues total` : undefined}
              colorClass="text-red-400"
            />
          </div>

          {/* EAA context note */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400/80 leading-relaxed">
            <strong>EU Accessibility Act</strong> — may apply to certain digital products and services sold to EU customers.
            Whether it applies to your organization depends on your specific business circumstances.
            Consult a qualified legal professional to determine your obligations.
          </div>

          {/* Per-site cards — non-compliant first */}
          <div className="space-y-3">
            {[...sites]
              .sort((a, b) => {
                const order: Record<string, number> = { blockers: 0, gaps: 1, no_blockers: 2 };
                return (order[a.summary?.level ?? 'no_blockers'] ?? 2) - (order[b.summary?.level ?? 'no_blockers'] ?? 2);
              })
              .map((site) => (
                <SiteCard key={site.monitorId} site={site} />
              ))}
          </div>

          {/* Full compliance history table */}
          {historyRows.length > 0 && (
            <ComplianceHistoryTable rows={historyRows} />
          )}
        </>
      )}
    </div>
  );
}
