'use client';

/**
 * §4 — Executive overview.
 * §5 — Score cards with coverage, confidence, audit-mode, and explicit unavailable states.
 * §6 — "Why this score?" expandable per-category detail.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import type {
  ReportViewModel,
  CategoryViewModel,
  ScoreAvailable,
  ScoreUnavailable,
  ConfidenceViewModel,
} from '@/lib/report/view-model';

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value }: { value: number }) {
  const color =
    value >= 90 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
    </div>
  );
}

// ─── Confidence pip ────────────────────────────────────────────────────────────

function ConfidencePip({ confidence }: { confidence: ConfidenceViewModel }) {
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded bg-secondary ${confidence.colorClass}`}
      title={confidence.description}
    >
      {confidence.label}
    </span>
  );
}

// ─── Category score card (§5) ─────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryViewModel }) {
  const [expanded, setExpanded] = useState(false);
  const score = cat.score;
  const isAvailable = score.available;
  const scoreVal = isAvailable ? (score as ScoreAvailable).value : null;

  return (
    <Card className="bg-card border border-border overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <span className="text-base shrink-0" aria-hidden="true">{cat.icon}</span>
          <span className="text-sm font-medium flex-1 truncate">{cat.label}</span>
          {isAvailable ? (
            <span className={`text-xl font-bold tabular-nums ${(score as ScoreAvailable).colorClass}`}>
              {scoreVal}
            </span>
          ) : (
            <span
              className="text-xs text-muted-foreground/50"
              title={(score as ScoreUnavailable).label}
            >
              {(score as ScoreUnavailable).reason === 'not-applicable' ? 'N/A' : '—'}
            </span>
          )}
        </div>

        {/* Score bar */}
        {isAvailable && scoreVal != null && (
          <div className="flex items-center gap-2">
            <ScoreBar value={scoreVal} />
            <span className={`text-xs font-medium w-16 text-right shrink-0 ${(score as ScoreAvailable).colorClass}`}>
              {(score as ScoreAvailable).label}
            </span>
          </div>
        )}

        {!isAvailable && (
          <p className="text-xs text-muted-foreground/60">{(score as ScoreUnavailable).label}</p>
        )}

        {/* Confidence + audit mode chips */}
        <div className="flex flex-wrap gap-1.5">
          {cat.confidence && <ConfidencePip confidence={cat.confidence} />}
          {cat.auditModeLabel && (
            <span className="text-xs text-muted-foreground/60 bg-secondary px-1.5 py-0.5 rounded">
              {cat.auditModeLabel}
            </span>
          )}
          {cat.coverage != null && (
            <span className="text-xs text-muted-foreground/60 bg-secondary px-1.5 py-0.5 rounded">
              {cat.coverage}% coverage
            </span>
          )}
        </div>

        {/* Finding counts */}
        {(cat.criticalCount > 0 || cat.highCount > 0 || cat.passCount > 0) && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {cat.criticalCount > 0 && (
              <span className="text-red-400 font-medium">{cat.criticalCount} critical</span>
            )}
            {cat.highCount > 0 && (
              <span className="text-amber-400 font-medium">{cat.highCount} high</span>
            )}
            {cat.passCount > 0 && (
              <span className="text-emerald-400/70">{cat.passCount} passed</span>
            )}
          </div>
        )}

        {/* Top limitation */}
        {cat.topLimitation && (
          <div className="flex items-start gap-1.5 text-xs text-amber-400/70 bg-amber-500/5 rounded px-2 py-1.5">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span>{cat.topLimitation}</span>
          </div>
        )}

        {/* §6 — Why this score? */}
        {cat.hasV2Audit && isAvailable && (
          <>
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Why this score?
            </button>
            {expanded && (
              <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/50">
                <p>Score: <span className="font-medium">{scoreVal}/100</span></p>
                {cat.findingCount > 0 && (
                  <p>{cat.findingCount} issue{cat.findingCount !== 1 ? 's' : ''} found</p>
                )}
                {cat.manualReviewCount > 0 && (
                  <p>{cat.manualReviewCount} item{cat.manualReviewCount !== 1 ? 's' : ''} require manual review</p>
                )}
                {cat.coverage != null && (
                  <p>Coverage: {cat.coverage}% of checks evaluated</p>
                )}
                {cat.auditModeLabel && (
                  <p>Audit method: {cat.auditModeLabel}</p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Overall grade ring ────────────────────────────────────────────────────────

function GradeRing({ vm }: { vm: ReportViewModel }) {
  const { overview } = vm;
  if (overview.overallScore == null) {
    return (
      <div className="w-20 h-20 rounded-full border-2 border-muted flex items-center justify-center">
        <span className="text-muted-foreground/50 text-xs text-center px-2">No score</span>
      </div>
    );
  }
  return (
    <div className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center ${overview.gradeRing}`}>
      <span className={`text-4xl font-extrabold leading-none ${overview.gradeColor}`}>
        {overview.grade}
      </span>
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ value, label, colorClass = 'text-foreground' }: {
  value: number | string;
  label: string;
  colorClass?: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold tabular-nums ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  vm: ReportViewModel;
}

export function ExecSummarySection({ vm }: Props) {
  const { overview, categories, domain, analyzedAt } = vm;

  const date = analyzedAt
    ? new Date(analyzedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const coreIds = ['performance', 'accessibility', 'seo', 'best-practices'];
  const coreCategories = categories.filter(c => coreIds.includes(c.id));

  return (
    <section className="space-y-6">
      {/* §4 — Title + metadata */}
      <div>
        <h2 id="overview-heading" className="text-2xl font-bold">Executive Summary</h2>
        <p className="text-sm text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
          <span>{domain}{date ? ` · Analysed ${date}` : ''}</span>
          {overview.auditModeLabel && (
            <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
              {overview.auditModeLabel}
            </span>
          )}
        </p>
      </div>

      {/* §4 — Overall health card */}
      <Card className="bg-card border border-border">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <GradeRing vm={vm} />
              {overview.overallScore != null && (
                <>
                  <p className={`text-sm font-semibold ${overview.gradeColor}`}>{overview.gradeLabel}</p>
                  <p className="text-xs text-muted-foreground">Overall {overview.overallScore}/100</p>
                </>
              )}
            </div>

            {/* §4 — Priority summary chips */}
            <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
              {overview.criticalFindings > 0 && (
                <StatChip value={overview.criticalFindings} label="Critical" colorClass="text-red-400" />
              )}
              {overview.highFindings > 0 && (
                <StatChip value={overview.highFindings} label="High priority" colorClass="text-amber-400" />
              )}
              {overview.manualReviewCount > 0 && (
                <StatChip value={overview.manualReviewCount} label="Need review" colorClass="text-blue-400" />
              )}
              <StatChip
                value={overview.pagesAnalyzed}
                label={overview.pagesAnalyzed === 1 ? 'Page analysed' : 'Pages analysed'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* §4 — AI plain-language summary */}
      {overview.aiSummary && (
        <Card className="bg-orange-600/5 border border-orange-200 dark:border-orange-900/40">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">💬</span>
              <p className="text-sm leading-relaxed text-muted-foreground">{overview.aiSummary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* §4 — Limitations banner */}
      {overview.limitations.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-400">Analysis limitations</p>
            <ul className="text-xs text-amber-400/80 space-y-0.5 list-disc list-inside">
              {overview.limitations.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* §5 — Score cards grid (core four categories) */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {coreCategories.map(cat => (
          <CategoryCard key={cat.id} cat={cat} />
        ))}
      </div>
    </section>
  );
}
