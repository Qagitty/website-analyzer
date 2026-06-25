'use client';

import { useState } from 'react';
import { AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, Minus, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PerformanceOpportunity } from '@/types/performance';

// ── Severity config ───────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    icon: XCircle,
    label: 'Critical',
    textClass: 'text-red-500',
    bgClass: 'bg-red-500/5 border-red-500/20',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  high: {
    icon: AlertTriangle,
    label: 'High',
    textClass: 'text-amber-500',
    bgClass: 'bg-amber-500/5 border-amber-500/20',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  medium: {
    icon: Info,
    label: 'Medium',
    textClass: 'text-blue-500',
    bgClass: 'bg-blue-500/5 border-blue-500/20',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  low: {
    icon: Minus,
    label: 'Low',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted/30 border-border',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
} as const;

const CONFIDENCE_CLASS: Record<string, string> = {
  high:   'text-emerald-500/70',
  medium: 'text-amber-500/70',
  low:    'text-orange-500/70',
};

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// ── Single opportunity card ───────────────────────────────────────────────────

function OpportunityCard({ opp }: { opp: PerformanceOpportunity }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[opp.severity];
  const Icon = cfg.icon;

  const hasSavings = opp.estimatedSavingsMs != null || opp.estimatedSavingsBytes != null;

  return (
    <article
      className={`rounded-xl border p-4 space-y-3 ${cfg.bgClass}`}
      aria-label={`${cfg.label} opportunity: ${opp.title}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.textClass}`} aria-hidden />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground leading-snug">{opp.title}</h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge className={`text-[10px] border ${cfg.badgeClass}`}>{cfg.label}</Badge>
              <span className={`text-[10px] font-medium ${CONFIDENCE_CLASS[opp.confidence]}`}>
                {opp.confidence} confidence
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{opp.description}</p>
        </div>
      </div>

      {/* Savings chips */}
      {hasSavings && (
        <div className="flex items-center gap-2 flex-wrap pl-7">
          {opp.estimatedSavingsMs != null && (
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded px-1.5 py-0.5">
              ~{opp.estimatedSavingsMs}ms potential saving
            </span>
          )}
          {opp.estimatedSavingsBytes != null && (
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded px-1.5 py-0.5">
              ~{formatBytes(opp.estimatedSavingsBytes)} potential saving
            </span>
          )}
        </div>
      )}

      {/* Expand/collapse */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pl-7"
        aria-expanded={expanded}
        aria-controls={`opp-${opp.id}-details`}
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Hide details' : 'Show evidence and recommendation'}
      </button>

      {expanded && (
        <div id={`opp-${opp.id}-details`} className="pl-7 space-y-3">
          {/* Evidence */}
          {opp.evidence.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Evidence</p>
              <ul className="space-y-0.5">
                {opp.evidence.map((e, i) => (
                  <li key={i} className="text-xs text-muted-foreground/80 flex gap-2">
                    <span className="text-muted-foreground/40 shrink-0">·</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Affected resources */}
          {opp.affectedResources.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Affected resources</p>
              <ul className="space-y-0.5">
                {opp.affectedResources.slice(0, 5).map((r, i) => (
                  <li key={i} className="text-[10px] font-mono text-muted-foreground/70 truncate">{r}</li>
                ))}
                {opp.affectedResources.length > 5 && (
                  <li className="text-[10px] text-muted-foreground/40">
                    +{opp.affectedResources.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Recommendation */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recommendation</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{opp.recommendation}</p>
          </div>

          {/* Source */}
          <p className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
            <Globe className="h-3 w-3" aria-hidden />
            Source: {opp.source}
          </p>
        </div>
      )}
    </article>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OpportunitiesSection({
  opportunities,
}: {
  opportunities?: PerformanceOpportunity[] | null;
}) {
  if (!opportunities || opportunities.length === 0) return null;

  const criticalCount = opportunities.filter(o => o.severity === 'critical').length;
  const highCount = opportunities.filter(o => o.severity === 'high').length;
  const urgentCount = criticalCount + highCount;

  return (
    <section className="space-y-4" aria-labelledby="opportunities-heading">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 id="opportunities-heading" className="text-2xl font-bold text-foreground">
          Performance Opportunities
        </h2>
        <Badge
          className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs"
          title="Issues detected via static HTML analysis and HTTP header inspection"
        >
          Static analysis
        </Badge>
        {urgentCount > 0 && (
          <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 text-xs">
            {urgentCount} urgent
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {opportunities.length} issue{opportunities.length > 1 ? 's' : ''} detected from HTML analysis
        and HTTP headers. All findings are evidence-based — estimated savings are conservative
        and should be validated in a staging environment.
      </p>

      <div className="space-y-3">
        {opportunities.map(opp => (
          <OpportunityCard key={opp.id} opp={opp} />
        ))}
      </div>
    </section>
  );
}
