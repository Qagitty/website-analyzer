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
  low: 'bg-[#1C1C27] text-muted-foreground border border-white/10 text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0',
};

const CATEGORY_ICONS: Record<AIInsight['category'], string> = {
  performance: '⚡',
  accessibility: '♿',
  ux: '🎨',
  seo: '🔍',
  security: '🔒',
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
    <div className="relative rounded-md bg-[#0A0A0F] border border-white/10">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
        <span className="text-xs text-[#475569] font-medium">Suggested fix</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          className="h-6 px-2 text-xs text-[#475569] hover:text-foreground hover:bg-white/5"
        >
          {copied ? (
            <><Check className="h-3 w-3 mr-1 text-emerald-400" />Copied</>
          ) : (
            <><Copy className="h-3 w-3 mr-1" />Copy</>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs text-[#94A3B8] font-mono leading-relaxed">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const [expanded, setExpanded] = useState(false);
  const hasCode = insight.codeExample && insight.codeExample.trim();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-[#1C1C27] rounded-lg p-1.5 flex items-center justify-center">{CATEGORY_ICONS[insight.category]}</span>
            <CardTitle className="text-base">{insight.title}</CardTitle>
          </div>
          <span className={PRIORITY_CLASS[insight.priority] ?? PRIORITY_CLASS.low}>{insight.priority}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{insight.description}</p>

        <div className="bg-[#0A0A0F] rounded-lg p-3 border border-white/5">
          <p className="text-xs font-medium mb-1">Recommendation:</p>
          <p className="text-sm">{insight.recommendation}</p>
        </div>

        {hasCode && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[#475569] hover:text-muted-foreground text-xs"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Hide code' : 'Show code fix'}
            </button>
            {expanded && (
              <div className="mt-2">
                <CodeBlock code={insight.codeExample!} />
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-[#475569]">
          Expected impact: {insight.estimatedImpact}
        </p>
      </CardContent>
    </Card>
  );
}

export function AIInsightsSection({ insights }: { insights: AIInsights }) {
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
                  <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                  <span>{win}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {insights.insights?.map((insight, i) => (
        <InsightCard key={i} insight={insight} />
      ))}
    </section>
  );
}
