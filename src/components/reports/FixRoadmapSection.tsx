'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { AIInsight } from '@/types/analysis';

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                   */
/* ------------------------------------------------------------------ */

type FilterKey = 'all' | 'critical' | 'quick-wins' | 'performance' | 'accessibility' | 'seo' | 'security' | 'ux';

const FILTER_LABELS: Record<FilterKey, string> = {
  all:           'All fixes',
  critical:      '🔴 Critical & High',
  'quick-wins':  '⚡ Quick wins',
  performance:   '⚡ Performance',
  accessibility: '♿ Accessibility',
  seo:           '🔍 SEO',
  security:      '🔒 Security',
  ux:            '🎨 UX',
};

const EFFORT_LABELS: Record<NonNullable<AIInsight['effortLevel']>, string> = {
  low:    '~15 min',
  medium: '~2 hours',
  high:   '1–2 days',
};

const PRIORITY_LEFT_BORDER: Record<string, string> = {
  critical: 'border-l-red-500',
  high:     'border-l-orange-500',
  medium:   'border-l-amber-500',
  low:      'border-l-slate-500',
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-500',
  low:      'bg-slate-500',
};

const CATEGORY_ICON: Record<AIInsight['category'], string> = {
  performance:   '⚡',
  accessibility: '♿',
  ux:            '🎨',
  seo:           '🔍',
  security:      '🔒',
};

const EFFORT_BADGE: Record<NonNullable<AIInsight['effortLevel']>, string> = {
  low:    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  high:   'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

/* ------------------------------------------------------------------ */
/*  CodeBlock                                                           */
/* ------------------------------------------------------------------ */

function CodeBlock({ code, label, variant = 'after' }: { code: string; label?: string; variant?: 'before' | 'after' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Code copied!');
    } catch {
      toast.error('Copy failed');
    }
  };

  const borderClass = variant === 'before'
    ? 'border-red-500/20 bg-red-500/5'
    : 'border-border bg-background';
  const labelClass  = variant === 'before' ? 'text-red-400' : 'text-muted-foreground/60';
  const dividerClass = variant === 'before' ? 'border-red-500/20' : 'border-border';

  return (
    <div className={`relative rounded-md border ${borderClass}`}>
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${dividerClass}`}>
        <span className={`text-xs font-medium ${labelClass}`}>
          {label ?? (variant === 'before' ? '✗ Current (broken)' : 'Suggested fix')}
        </span>
        {variant !== 'before' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={copy}
            className="h-6 px-2 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-accent"
          >
            {copied ? (
              <><Check className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />Copied</>
            ) : (
              <><Copy className="h-3 w-3 mr-1" />Copy</>
            )}
          </Button>
        )}
      </div>
      <pre className="overflow-x-auto p-3 text-xs text-muted-foreground font-mono leading-relaxed">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RoadmapCard                                                         */
/* ------------------------------------------------------------------ */

function RoadmapCard({ insight, index }: { insight: AIInsight; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [codeView, setCodeView] = useState<'before' | 'after'>('after');

  const hasBefore = !!insight.beforeCode?.trim();
  const hasAfter  = !!(insight.afterCode ?? insight.codeExample)?.trim();
  const hasCode   = hasBefore || hasAfter;

  const afterCode = insight.afterCode ?? insight.codeExample ?? '';

  const borderLeft = PRIORITY_LEFT_BORDER[insight.priority] ?? PRIORITY_LEFT_BORDER.low;
  const dot        = PRIORITY_DOT[insight.priority] ?? PRIORITY_DOT.low;

  return (
    <Card className={`bg-card border border-border border-l-4 ${borderLeft}`}>
      {/* Header row */}
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            {/* Priority dot + index */}
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
              <span className="text-xs text-muted-foreground/50 tabular-nums w-4">{index + 1}</span>
            </div>
            {/* Category icon */}
            <span className="text-base shrink-0">{CATEGORY_ICON[insight.category]}</span>
            {/* Title */}
            <CardTitle className="text-sm font-semibold text-foreground leading-snug">
              {insight.title}
            </CardTitle>
          </div>

          {/* Effort + time badge */}
          {insight.effortLevel && (
            <span
              className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${EFFORT_BADGE[insight.effortLevel]}`}
            >
              {insight.effortLevel} effort · {EFFORT_LABELS[insight.effortLevel]}
            </span>
          )}
        </div>

        {/* Impact bar + WCAG tag */}
        {(insight.impactScore != null || insight.wcagReference) && (
          <div className="flex items-center gap-3 mt-2 ml-9 flex-wrap">
            {insight.impactScore != null && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground/60">Impact</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-3 rounded-sm ${
                        i < insight.impactScore!
                          ? 'bg-orange-600'
                          : 'bg-secondary'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground/60">{insight.impactScore}/10</span>
              </div>
            )}
            {insight.wcagReference && (
              <span className="text-xs text-orange-500 bg-orange-600/5 border border-orange-200 dark:border-orange-900/40 rounded px-2 py-0.5">
                {insight.wcagReference}
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed ml-9">{insight.description}</p>

        {/* Recommendation */}
        <div className="bg-secondary/50 rounded-lg p-3 ml-9 border border-border/50">
          <p className="text-xs font-semibold text-foreground mb-1">Fix</p>
          <p className="text-sm text-muted-foreground">{insight.recommendation}</p>
        </div>

        {/* Estimated impact */}
        <p className="text-xs text-muted-foreground/60 ml-9">
          Expected outcome: {insight.estimatedImpact}
        </p>

        {/* Code toggle */}
        {hasCode && (
          <div className="ml-9">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Hide code example' : 'Show code example'}
            </button>

            {expanded && (
              <div className="mt-2 space-y-2">
                {/* Before / After tabs */}
                {hasBefore && hasAfter && (
                  <div className="flex gap-1 text-xs">
                    <button
                      onClick={() => setCodeView('before')}
                      className={`px-2 py-1 rounded border transition-colors ${
                        codeView === 'before'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'text-muted-foreground border-border hover:bg-accent'
                      }`}
                    >
                      ✗ Before
                    </button>
                    <button
                      onClick={() => setCodeView('after')}
                      className={`px-2 py-1 rounded border transition-colors ${
                        codeView === 'after'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'text-muted-foreground border-border hover:bg-accent'
                      }`}
                    >
                      ✓ After
                    </button>
                  </div>
                )}

                {/* Code block */}
                {codeView === 'before' && hasBefore ? (
                  <CodeBlock code={insight.beforeCode!} variant="before" />
                ) : (
                  afterCode.trim() ? <CodeBlock code={afterCode} variant="after" /> : null
                )}

                {/* Framework notes */}
                {codeView === 'after' && insight.frameworkNotes && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground/60 hover:text-muted-foreground select-none py-1">
                      Framework-specific versions
                    </summary>
                    <div className="mt-2 space-y-2">
                      {insight.frameworkNotes.react && (
                        <CodeBlock code={insight.frameworkNotes.react} label="React" />
                      )}
                      {insight.frameworkNotes.nextjs && (
                        <CodeBlock code={insight.frameworkNotes.nextjs} label="Next.js" />
                      )}
                      {insight.frameworkNotes.vue && (
                        <CodeBlock code={insight.frameworkNotes.vue} label="Vue" />
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

interface Props {
  insights: AIInsight[] | undefined | null;
}

export function FixRoadmapSection({ insights }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  if (!insights?.length) return null;

  /* Sort by impact × priority */
  const priorityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const sorted = [...insights].sort((a, b) => {
    const wa = (priorityWeight[a.priority] ?? 1) * (a.impactScore ?? 5);
    const wb = (priorityWeight[b.priority] ?? 1) * (b.impactScore ?? 5);
    return wb - wa;
  });

  /* Filter */
  const filtered = sorted.filter((ins) => {
    switch (activeFilter) {
      case 'all':           return true;
      case 'critical':      return ins.priority === 'critical' || ins.priority === 'high';
      case 'quick-wins':    return ins.effortLevel === 'low';
      case 'performance':   return ins.category === 'performance';
      case 'accessibility': return ins.category === 'accessibility';
      case 'seo':           return ins.category === 'seo';
      case 'security':      return ins.category === 'security';
      case 'ux':            return ins.category === 'ux';
      default:              return true;
    }
  });

  /* Count badges */
  const counts: Record<FilterKey, number> = {
    all:           sorted.length,
    critical:      sorted.filter((i) => i.priority === 'critical' || i.priority === 'high').length,
    'quick-wins':  sorted.filter((i) => i.effortLevel === 'low').length,
    performance:   sorted.filter((i) => i.category === 'performance').length,
    accessibility: sorted.filter((i) => i.category === 'accessibility').length,
    seo:           sorted.filter((i) => i.category === 'seo').length,
    security:      sorted.filter((i) => i.category === 'security').length,
    ux:            sorted.filter((i) => i.category === 'ux').length,
  };

  /* Active filters to show (hide empties except all/critical/quick-wins) */
  const visibleFilters = (Object.keys(FILTER_LABELS) as FilterKey[]).filter((k) => {
    if (k === 'all' || k === 'critical' || k === 'quick-wins') return true;
    return counts[k] > 0;
  });

  return (
    <section className="space-y-5">
      {/* Section header */}
      <div>
        <h2 className="text-2xl font-bold">Fix Roadmap</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {sorted.length} issues sorted by impact — tackle them top to bottom for fastest improvement
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {visibleFilters.map((key) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeFilter === key
                ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-500 border-orange-300 dark:border-orange-900/50'
                : 'text-muted-foreground border-border hover:bg-accent hover:text-foreground'
            }`}
          >
            {FILTER_LABELS[key]}
            {counts[key] > 0 && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeFilter === key
                    ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-400'
                    : 'bg-secondary text-muted-foreground/70'
                }`}
              >
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((ins, i) => (
            <RoadmapCard key={`${ins.title}-${i}`} insight={ins} index={i} />
          ))}
        </div>
      ) : (
        <Card className="bg-card border border-border">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No issues in this category.
          </CardContent>
        </Card>
      )}
    </section>
  );
}
