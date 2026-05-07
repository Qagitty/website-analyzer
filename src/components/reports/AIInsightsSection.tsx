'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { AIInsights, AIInsight } from '@/types/analysis';

const PRIORITY_VARIANT: Record<AIInsight['priority'], 'destructive' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
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
    <div className="relative rounded-md bg-zinc-950 dark:bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-medium">Suggested fix</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          className="h-6 px-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          {copied ? (
            <><Check className="h-3 w-3 mr-1 text-green-400" />Copied</>
          ) : (
            <><Copy className="h-3 w-3 mr-1" />Copy</>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs text-zinc-200 leading-relaxed">
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
            <span>{CATEGORY_ICONS[insight.category]}</span>
            <CardTitle className="text-base">{insight.title}</CardTitle>
          </div>
          <Badge variant={PRIORITY_VARIANT[insight.priority]}>{insight.priority}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{insight.description}</p>

        <div className="rounded-md bg-muted p-3">
          <p className="text-xs font-medium mb-1">Recommendation:</p>
          <p className="text-sm">{insight.recommendation}</p>
        </div>

        {hasCode && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
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

        <p className="text-xs text-muted-foreground">
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
        <Card className="border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-900">
          <CardContent className="pt-6">
            <p className="text-sm leading-relaxed">{insights.summary}</p>
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
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
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
