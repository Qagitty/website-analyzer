'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BookmarkPlus } from 'lucide-react';
import { TrackIssueButton } from '@/components/reports/TrackIssueButton';
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
  issues:      AccessibilityIssue[];
  aiInsights?: AIAccessibilityInsight[] | null;
  /** When provided, enables the "Track" button for each issue. */
  analysisId?: string;
  url?:        string;
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
  issue:      AccessibilityIssue;
  ai:         AIAccessibilityInsight | undefined;
  analysisId?: string;
  url?:        string;
  trackedId?:  string;
  onTrackChange?: (issueId: string, newTrackedId: string | undefined) => void;
}

function IssueCard({ issue, ai, analysisId, url, trackedId, onTrackChange }: IssueCardProps) {
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
        <div className="flex items-start justify-between gap-2">
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
          <div className="flex items-center gap-2 shrink-0">
            {analysisId && url && onTrackChange && (
              <TrackIssueButton
                issue={issue}
                analysisId={analysisId}
                url={url}
                trackedId={trackedId}
                onChange={onTrackChange}
              />
            )}
            <Badge variant={IMPACT_VARIANT[issue.impact] ?? 'secondary'}>
              {issue.impact}
            </Badge>
          </div>
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
          <div className="bg-background border border-border rounded p-2">
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
              <div className="relative rounded-md bg-background border border-border">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                  <span className="text-xs text-muted-foreground/60">Code fix</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs text-muted-foreground/60 hover:text-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="overflow-x-auto p-3 text-xs text-muted-foreground font-mono">
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

export function AccessibilitySection({ issues, aiInsights, analysisId, url }: Props) {
  const critical = issues.filter((i) => i.impact === 'critical' || i.impact === 'serious');

  // Map of issue_id → remediation item ID (undefined = not tracked)
  const [trackedMap, setTrackedMap] = useState<Map<string, string>>(new Map());

  // Load existing tracked items for this analysis (only when tracking is enabled)
  useEffect(() => {
    if (!analysisId) return;
    fetch(`/api/remediation?url=${encodeURIComponent(url ?? '')}`)
      .then((r) => r.json())
      .then((items: { id: string; issue_id: string; analysis_id: string }[]) => {
        const map = new Map<string, string>();
        items
          .filter((item) => item.analysis_id === analysisId)
          .forEach((item) => map.set(item.issue_id, item.id));
        setTrackedMap(map);
      })
      .catch(() => {}); // fail silently — tracking is non-critical
  }, [analysisId, url]);

  function handleTrackChange(issueId: string, newTrackedId: string | undefined) {
    setTrackedMap((prev) => {
      const next = new Map(prev);
      if (newTrackedId) next.set(issueId, newTrackedId);
      else next.delete(issueId);
      return next;
    });
  }

  const [bulkTracking, setBulkTracking] = useState(false);

  async function trackAllCritical() {
    if (!analysisId || !url) return;
    const untracked = critical.filter((i) => !trackedMap.has(i.id));
    if (untracked.length === 0) {
      toast.info('All critical issues are already tracked');
      return;
    }

    setBulkTracking(true);
    let added = 0;
    for (const issue of untracked) {
      try {
        const res = await fetch('/api/remediation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysis_id:       analysisId,
            url,
            issue_id:          issue.id,
            issue_description: issue.description,
            impact:            issue.impact,
            wcag_criteria:     issue.wcagCriteria ?? [],
          }),
        });
        if (res.status === 201) {
          const data = await res.json();
          handleTrackChange(issue.id, data.id);
          added++;
        }
      } catch {}
    }
    setBulkTracking(false);
    if (added > 0) toast.success(`${added} critical issue${added !== 1 ? 's' : ''} added to tracker`);
    else toast.info('No new issues to add');
  }

  const untrackedCriticalCount = critical.filter((i) => !trackedMap.has(i.id)).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-2xl font-bold">Accessibility</h2>
        <Badge variant={critical.length > 0 ? 'destructive' : 'default'}>
          {issues.length} issue{issues.length !== 1 ? 's' : ''}
        </Badge>
        {analysisId && trackedMap.size > 0 && (
          <span className="text-xs text-indigo-400">
            {trackedMap.size} tracked
          </span>
        )}
        {analysisId && url && untrackedCriticalCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={trackAllCritical}
            disabled={bulkTracking}
            className="ml-auto text-xs h-7 gap-1"
          >
            {bulkTracking
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <BookmarkPlus className="h-3 w-3" />
            }
            Track all critical ({untrackedCriticalCount})
          </Button>
        )}
      </div>

      {issues.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">No accessibility issues found</span>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map((issue, i) => {
            const ai = aiInsights?.find((a) => a.originalId === issue.id);
            return (
              <IssueCard
                key={i}
                issue={issue}
                ai={ai}
                analysisId={analysisId}
                url={url}
                trackedId={trackedMap.get(issue.id)}
                onTrackChange={handleTrackChange}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
