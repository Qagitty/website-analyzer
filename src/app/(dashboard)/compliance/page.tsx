'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, ShieldX, ExternalLink, RefreshCw } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  getComplianceSummary,
  COMPLIANCE_CONFIG,
  type ComplianceLevel,
  type ComplianceSummary,
} from '@/lib/compliance';
import { ClipboardList } from 'lucide-react';
import type { AccessibilityIssue } from '@/types/analysis';
import { formatDistanceToNow } from 'date-fns';
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

// ── Sub-components ────────────────────────────────────────────────────────────

function LevelIcon({ level, className }: { level: ComplianceLevel; className?: string }) {
  if (level === 'compliant')     return <ShieldCheck  className={className} />;
  if (level === 'partial')       return <ShieldAlert  className={className} />;
  return                                <ShieldX      className={className} />;
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
  const level = summary?.level ?? 'compliant';
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
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View latest report →
          </Link>
        </div>
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
  const [sites, setSites]       = useState<SiteCompliance[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else             setLoading(true);
    setError(false);

    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
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

      // 3. Fetch recent history (last 5 per URL) for trend dots
      const urls = [...new Set(monitors.map((m) => m.url))];
      const { data: historyRows } = await supabase
        .from('analyses')
        .select('url, accessibility_issues, completed_at')
        .eq('user_id', user.id)
        .in('url', urls)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(urls.length * 5);

      // Group history by URL
      const historyByUrl = new Map<string, ComplianceLevel[]>();
      for (const row of historyRows ?? []) {
        const existing = historyByUrl.get(row.url) ?? [];
        if (existing.length < 5) {
          const issues = (row.accessibility_issues as AccessibilityIssue[]) ?? [];
          existing.push(getComplianceSummary(issues).level);
          historyByUrl.set(row.url, existing);
        }
      }

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
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageSkeleton />;

  // Summary counts
  const withData   = sites.filter((s) => s.summary !== null);
  const compliant  = withData.filter((s) => s.summary!.level === 'compliant').length;
  const partial    = withData.filter((s) => s.summary!.level === 'partial').length;
  const nonComp    = withData.filter((s) => s.summary!.level === 'non-compliant').length;
  const totalCrit  = withData.reduce((n, s) => n + (s.summary!.criticalCount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Compliance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            EAA / WCAG 2.1 AA status across all monitored sites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/compliance/remediation"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 text-sm text-indigo-400 hover:bg-indigo-500/10 transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Remediation Tracker
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
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
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

          {/* EAA notice */}
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-400/80 leading-relaxed">
            <strong>EU Accessibility Act</strong> — businesses selling to EU customers must meet WCAG 2.1 AA.
            Non-compliance can result in fines up to €100,000 or 4% of annual revenue.
          </div>

          {/* Per-site cards — non-compliant first */}
          <div className="space-y-3">
            {[...sites]
              .sort((a, b) => {
                const order: Record<string, number> = { 'non-compliant': 0, partial: 1, compliant: 2 };
                return (order[a.summary?.level ?? 'compliant'] ?? 2) - (order[b.summary?.level ?? 'compliant'] ?? 2);
              })
              .map((site) => (
                <SiteCard key={site.monitorId} site={site} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
