'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { AIInsights, AIInsight } from '@/types/analysis';

const PRIORITY_CLASS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0',
  high: 'bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0',
  low: 'bg-secondary text-muted-foreground border border-border text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0',
};

const CATEGORY_ICONS: Record<AIInsight['category'], string> = {
  performance: '⚡',
  accessibility: '♿',
  ux: '🎨',
  seo: '🔍',
  security: '🔒',
};

const EFFORT_COLORS: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

function CodeBlock({ code }: { code: string }) {
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

  return (
    <div className="relative rounded-md bg-background border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-xs text-muted-foreground/60 font-medium">Suggested fix</span>
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
      </div>
      <pre className="overflow-x-auto p-3 text-xs text-muted-foreground font-mono leading-relaxed">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const [codeView, setCodeView] = useState<'before' | 'after'>('after');
  const hasBefore = !!insight.beforeCode?.trim();
  const hasAfter = !!(insight.afterCode ?? insight.codeExample)?.trim();
  const hasCode = hasBefore || hasAfter;
  const hasFramework = !!(
    insight.frameworkNotes?.react ||
    insight.frameworkNotes?.nextjs ||
    insight.frameworkNotes?.vue
  );
  const [frameworkTab, setFrameworkTab] = useState<'html' | 'react' | 'nextjs' | 'vue'>('html');
  const [codeExpanded, setCodeExpanded] = useState(false);

  const activeCode = (() => {
    if (codeView === 'before') return insight.beforeCode ?? '';
    if (!hasFramework) return insight.afterCode ?? insight.codeExample ?? '';
    if (frameworkTab === 'react') return insight.frameworkNotes?.react ?? insight.afterCode ?? insight.codeExample ?? '';
    if (frameworkTab === 'nextjs') return insight.frameworkNotes?.nextjs ?? insight.afterCode ?? insight.codeExample ?? '';
    if (frameworkTab === 'vue') return insight.frameworkNotes?.vue ?? insight.afterCode ?? insight.codeExample ?? '';
    return insight.afterCode ?? insight.codeExample ?? '';
  })();

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-secondary rounded-lg p-1.5 flex items-center justify-center">
              {CATEGORY_ICONS[insight.category]}
            </span>
            <CardTitle className="text-base text-foreground">{insight.title}</CardTitle>
          </div>
          <span className={PRIORITY_CLASS[insight.priority] ?? PRIORITY_CLASS.low}>
            {insight.priority}
          </span>
        </div>

        {(insight.effortLevel || insight.impactScore != null || insight.wcagReference) && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {insight.effortLevel && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${EFFORT_COLORS[insight.effortLevel]}`}
              >
                Effort: {insight.effortLevel}
              </span>
            )}
            {insight.impactScore != null && (
              <span className="text-xs text-muted-foreground">
                Impact:{' '}
                {'█'.repeat(Math.round(insight.impactScore / 2))}
                {'░'.repeat(5 - Math.round(insight.impactScore / 2))}{' '}
                {insight.impactScore}/10
              </span>
            )}
            {insight.wcagReference && (
              <span className="text-xs text-indigo-400 bg-indigo-500/5 border border-indigo-500/20 rounded px-2 py-0.5">
                {insight.wcagReference}
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{insight.description}</p>

        <div className="bg-background rounded-lg p-3 border border-border">
          <p className="text-xs font-medium mb-1 text-foreground">Recommendation</p>
          <p className="text-sm text-muted-foreground">{insight.recommendation}</p>
        </div>

        {hasCode && (
          <div>
            <button
              onClick={() => setCodeExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground"
            >
              {codeExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {codeExpanded ? 'Hide code' : 'Show code fix'}
            </button>

            {codeExpanded && (
              <div className="mt-2 space-y-2">
                {hasBefore && hasAfter && (
                  <div className="flex gap-1 text-xs">
                    <button
                      onClick={() => setCodeView('before')}
                      className={`px-2 py-1 rounded border ${
                        codeView === 'before'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'text-muted-foreground border-border hover:bg-accent'
                      }`}
                    >
                      ✗ Before
                    </button>
                    <button
                      onClick={() => setCodeView('after')}
                      className={`px-2 py-1 rounded border ${
                        codeView === 'after'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'text-muted-foreground border-border hover:bg-accent'
                      }`}
                    >
                      ✓ After
                    </button>
                  </div>
                )}

                {hasFramework && codeView === 'after' && (
                  <div className="flex gap-1 text-xs flex-wrap">
                    <button
                      onClick={() => setFrameworkTab('html')}
                      className={`px-2 py-0.5 rounded border ${
                        frameworkTab === 'html'
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          : 'text-muted-foreground border-border hover:bg-accent'
                      }`}
                    >
                      HTML
                    </button>
                    {insight.frameworkNotes?.react && (
                      <button
                        onClick={() => setFrameworkTab('react')}
                        className={`px-2 py-0.5 rounded border ${
                          frameworkTab === 'react'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'text-muted-foreground border-border hover:bg-accent'
                        }`}
                      >
                        React
                      </button>
                    )}
                    {insight.frameworkNotes?.nextjs && (
                      <button
                        onClick={() => setFrameworkTab('nextjs')}
                        className={`px-2 py-0.5 rounded border ${
                          frameworkTab === 'nextjs'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'text-muted-foreground border-border hover:bg-accent'
                        }`}
                      >
                        Next.js
                      </button>
                    )}
                    {insight.frameworkNotes?.vue && (
                      <button
                        onClick={() => setFrameworkTab('vue')}
                        className={`px-2 py-0.5 rounded border ${
                          frameworkTab === 'vue'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'text-muted-foreground border-border hover:bg-accent'
                        }`}
                      >
                        Vue
                      </button>
                    )}
                  </div>
                )}

                {codeView === 'before' && hasBefore ? (
                  <div className="relative rounded-md bg-red-500/5 border border-red-500/20">
                    <div className="px-3 py-1.5 border-b border-red-500/20">
                      <span className="text-xs text-red-400 font-medium">✗ Current (broken)</span>
                    </div>
                    <pre className="overflow-x-auto p-3 text-xs text-muted-foreground font-mono leading-relaxed">
                      <code>{insight.beforeCode!.trim()}</code>
                    </pre>
                  </div>
                ) : (
                  activeCode.trim() ? <CodeBlock code={activeCode} /> : null
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground/60">
          Expected impact: {insight.estimatedImpact}
        </p>
      </CardContent>
    </Card>
  );
}

export function AIInsightsSection({ insights }: { insights: AIInsights }) {
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const sortedInsights = [...(insights.insights ?? [])].sort((a, b) => {
    const byImpact = (b.impactScore ?? 5) - (a.impactScore ?? 5);
    if (byImpact !== 0) return byImpact;
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
  });

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">AI Insights</h2>

      {typeof insights.summary === 'string' && insights.summary.trim().length > 5 && (
        <Card className="bg-indigo-500/5 border border-indigo-500/20">
          <CardContent className="pt-6">
            <p className="text-sm leading-relaxed text-muted-foreground">{insights.summary}</p>
          </CardContent>
        </Card>
      )}

      {insights.quickWins?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">⚡ Quick Wins</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.quickWins.map((win, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0">✓</span>
                  <span>{win}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {sortedInsights.map((insight, i) => (
        <InsightCard key={i} insight={insight} />
      ))}
    </section>
  );
}
