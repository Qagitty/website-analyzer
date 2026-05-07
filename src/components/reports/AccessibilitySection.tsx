'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AccessibilityIssue } from '@/types/analysis';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIAccessibilityInsight {
  originalId: string;
  plainEnglish: string;
  affectedUsers: string;
  fixExample: string;
  wcagLevel: string;
  estimatedFixTime: string;
}

interface Props {
  issues: AccessibilityIssue[];
  aiInsights?: AIAccessibilityInsight[] | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const IMPACT_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  serious: 'destructive',
  moderate: 'secondary',
  minor: 'outline',
};

// ─── Sub-component: single issue card ────────────────────────────────────────

interface IssueCardProps {
  issue: AccessibilityIssue;
  ai: AIAccessibilityInsight | undefined;
}

function IssueCard({ issue, ai }: IssueCardProps) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!ai) return;
    try {
      await navigator.clipboard.writeText(ai.fixExample.trim());
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {/* Main title: plain English from AI, or fallback to raw id */}
            <CardTitle className="text-base leading-snug">
              {ai ? ai.plainEnglish : issue.id}
            </CardTitle>
            {/* Always show the axe rule id as a subtitle */}
            {ai && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{issue.id}</p>
            )}
          </div>
          <Badge variant={IMPACT_VARIANT[issue.impact] ?? 'secondary'} className="shrink-0">
            {issue.impact}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Description / AI plain English already shown in title — show raw only without AI */}
        {!ai && (
          <p className="text-sm text-muted-foreground">{issue.description}</p>
        )}

        {/* AI enrichment layer */}
        {ai && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{issue.description}</p>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Affects: {ai.affectedUsers}</span>
              <span aria-hidden="true">·</span>
              <Badge variant="outline" className="text-xs">
                Est. fix: {ai.estimatedFixTime}
              </Badge>
              {ai.wcagLevel && (
                <Badge variant="outline" className="text-xs font-mono">
                  WCAG {ai.wcagLevel}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Affected nodes */}
        {issue.nodes.length > 0 && (
          <div className="bg-muted rounded p-2">
            <p className="text-xs font-medium mb-1">Affected elements:</p>
            {issue.nodes.map((node, j) => (
              <code key={j} className="text-xs block truncate">
                {node}
              </code>
            ))}
          </div>
        )}

        {/* Collapsible code fix — only when AI insight has a fix */}
        {ai && ai.fixExample && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setShowCode((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              {showCode ? 'Hide code fix ↑' : 'Show code fix ↓'}
            </button>

            {showCode && (
              <div className="relative rounded-md bg-zinc-950 border border-zinc-800">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
                  <span className="text-xs text-zinc-500">Code fix</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded hover:bg-zinc-800 transition-colors"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="overflow-x-auto p-3 text-xs text-zinc-200">
                  <code>{ai.fixExample.trim()}</code>
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AccessibilitySection({ issues, aiInsights }: Props) {
  const critical = issues.filter((i) => i.impact === 'critical' || i.impact === 'serious');

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Accessibility</h2>
        <Badge variant={critical.length > 0 ? 'destructive' : 'default'}>
          {issues.length} issue{issues.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {issues.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-green-600 font-medium">
            No accessibility issues found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map((issue, i) => {
            const ai = aiInsights?.find((a) => a.originalId === issue.id);
            return <IssueCard key={i} issue={issue} ai={ai} />;
          })}
        </div>
      )}
    </section>
  );
}
