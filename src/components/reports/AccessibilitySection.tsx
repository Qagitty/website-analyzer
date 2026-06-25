'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BookmarkPlus, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { TrackIssueButton } from '@/components/reports/TrackIssueButton';
import type { AccessibilityIssue } from '@/types/analysis';
import type { AccessibilityAuditResult, AccessibilityFinding, AccessibilityFindingStatus } from '@/types/accessibility';

// ─── AI insight shape (from AI prompt output) ─────────────────────────────────

interface AIAccessibilityInsight {
  originalId: string;
  plainEnglish: string;
  affectedUsers: string;
  fixExample?: string;
  wcagLevel?: string;
  estimatedFixTime?: string;
  beforeCode?: string;
  afterCode?: string;
  codeExample?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** v2 structured audit — preferred when available */
  accessibilityAudit?: AccessibilityAuditResult | null;
  /** Legacy flat list — used when accessibilityAudit is absent (older reports) */
  issues?: AccessibilityIssue[];
  aiInsights?: AIAccessibilityInsight[] | null;
  /** When provided, enables the "Track" button for each issue. */
  analysisId?: string;
  url?: string;
}

// ─── Severity badge helpers ───────────────────────────────────────────────────

const SEV_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  critical:      'destructive',
  serious:       'destructive',
  moderate:      'secondary',
  minor:         'outline',
  'manual-review': 'outline',
};

const SEV_ORDER: Record<string, number> = {
  critical: 0, serious: 1, moderate: 2, minor: 3, 'manual-review': 4,
};

const STATUS_BADGE: Record<AccessibilityFindingStatus, { label: string; cls: string }> = {
  'confirmed':      { label: 'Confirmed',      cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  'likely':         { label: 'Likely',          cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  'manual-review':  { label: 'Manual review',   cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  'passed':         { label: 'Passed',          cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  'not-applicable': { label: 'N/A',             cls: 'bg-secondary text-muted-foreground border border-border' },
};

// ─── Score gauge (0–100 arc arc) ──────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const cls = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-baseline gap-1">
      <span className={`text-4xl font-bold tabular-nums ${cls}`}>{score}</span>
      <span className="text-muted-foreground text-sm">/100</span>
    </div>
  );
}

// ─── Individual finding card (v2) ─────────────────────────────────────────────

function FindingCard({
  finding,
  ai,
  analysisId,
  url,
  trackedId,
  onTrackChange,
}: {
  finding: AccessibilityFinding;
  ai?: AIAccessibilityInsight;
  analysisId?: string;
  url?: string;
  trackedId?: string;
  onTrackChange?: (id: string, newId: string | undefined) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const codeSnippet = ai?.codeExample ?? ai?.fixExample ?? ai?.afterCode;

  const handleCopy = async () => {
    if (!codeSnippet) return;
    try {
      await navigator.clipboard.writeText(codeSnippet.trim());
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const statusInfo = STATUS_BADGE[finding.status] ?? STATUS_BADGE['manual-review'];

  // Use legacy AccessibilityIssue shape for TrackIssueButton
  const legacyIssue: AccessibilityIssue = {
    id:           finding.id,
    impact:       finding.impact,
    description:  finding.what,
    nodes:        finding.nodes,
    wcagCriteria: finding.wcagCriteria,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-snug">
              {ai?.plainEnglish ?? finding.what}
            </CardTitle>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{finding.id}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {analysisId && url && onTrackChange && (
              <TrackIssueButton
                issue={legacyIssue}
                analysisId={analysisId}
                url={url}
                trackedId={trackedId}
                onChange={onTrackChange}
              />
            )}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
            <Badge variant={SEV_VARIANT[finding.severity] ?? 'secondary'}>
              {finding.severity}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Who is affected */}
        {finding.who && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/60">Affects:</span> {ai?.affectedUsers ?? finding.who}
          </p>
        )}

        {/* Why it matters */}
        {finding.why && (
          <p className="text-sm text-muted-foreground">{finding.why}</p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono bg-secondary/60 px-1.5 py-0.5 rounded">{finding.wcag}</span>
          <Badge variant="outline" className="text-xs font-mono">WCAG {finding.wcagLevel}</Badge>
          {finding.count > 1 && (
            <span className="text-muted-foreground/60">{finding.count} occurrences</span>
          )}
          {(ai?.estimatedFixTime) && (
            <Badge variant="outline" className="text-xs">Est. fix: {ai.estimatedFixTime}</Badge>
          )}
        </div>

        {/* Expand for full details */}
        {(finding.where?.length > 0 || finding.howToFix || codeSnippet) && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}

        {expanded && (
          <div className="space-y-3 pt-1">
            {/* How to fix */}
            {finding.howToFix && (
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">How to fix</p>
                <p>{finding.howToFix}</p>
              </div>
            )}

            {/* How to verify */}
            {finding.howToVerify && (
              <div className="rounded-md bg-muted/20 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">How to verify</p>
                <p>{finding.howToVerify}</p>
              </div>
            )}

            {/* Evidence nodes */}
            {finding.where?.length > 0 && (
              <div className="bg-background border border-border rounded p-2">
                <p className="text-xs font-medium mb-1">Affected elements:</p>
                {finding.where.map((node, j) => (
                  <code key={j} className="text-xs block truncate text-muted-foreground">
                    {node.html}
                  </code>
                ))}
              </div>
            )}

            {/* Code fix */}
            {codeSnippet && (
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
                  <code>{codeSnippet.trim()}</code>
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Legacy issue card (for old reports without accessibilityAudit) ───────────

function LegacyIssueCard({
  issue,
  ai,
  analysisId,
  url,
  trackedId,
  onTrackChange,
}: {
  issue: AccessibilityIssue;
  ai?: AIAccessibilityInsight;
  analysisId?: string;
  url?: string;
  trackedId?: string;
  onTrackChange?: (id: string, newId: string | undefined) => void;
}) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeSnippet = ai?.codeExample ?? ai?.fixExample;

  const handleCopy = async () => {
    if (!codeSnippet) return;
    try {
      await navigator.clipboard.writeText(codeSnippet.trim());
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
            <CardTitle className="text-base leading-snug">
              {ai ? ai.plainEnglish : issue.id}
            </CardTitle>
            {ai && <p className="text-xs text-muted-foreground font-mono mt-0.5">{issue.id}</p>}
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
            <Badge variant={SEV_VARIANT[issue.impact] ?? 'secondary'}>{issue.impact}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!ai && <p className="text-sm text-muted-foreground">{issue.description}</p>}
        {ai && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{issue.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Affects: {ai.affectedUsers}</span>
              {ai.estimatedFixTime && (
                <><span aria-hidden="true">·</span><Badge variant="outline" className="text-xs">Est. fix: {ai.estimatedFixTime}</Badge></>
              )}
              {ai.wcagLevel && <Badge variant="outline" className="text-xs font-mono">WCAG {ai.wcagLevel}</Badge>}
            </div>
          </div>
        )}
        {issue.nodes.length > 0 && (
          <div className="bg-background border border-border rounded p-2">
            <p className="text-xs font-medium mb-1">Affected elements:</p>
            {issue.nodes.map((node, j) => (
              <code key={j} className="text-xs block truncate">{node}</code>
            ))}
          </div>
        )}
        {ai && codeSnippet && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              {showCode ? 'Hide code fix ↑' : 'Show code fix ↓'}
            </button>
            {showCode && (
              <div className="relative rounded-md bg-background border border-border">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                  <span className="text-xs text-muted-foreground/60">Code fix</span>
                  <button type="button" onClick={handleCopy} className="text-xs text-muted-foreground/60 hover:text-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors">
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="overflow-x-auto p-3 text-xs text-muted-foreground font-mono">
                  <code>{codeSnippet.trim()}</code>
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

export function AccessibilitySection({
  accessibilityAudit,
  issues: legacyIssues = [],
  aiInsights,
  analysisId,
  url,
}: Props) {
  const [trackedMap, setTrackedMap] = useState<Map<string, string>>(new Map());
  const [bulkTracking, setBulkTracking] = useState(false);
  const [showManualChecklist, setShowManualChecklist] = useState(false);

  useEffect(() => {
    if (!analysisId) return;
    fetch(`/api/remediation?url=${encodeURIComponent(url ?? '')}`)
      .then(r => r.json())
      .then((items: { id: string; issue_id: string; analysis_id: string }[]) => {
        const map = new Map<string, string>();
        items.filter(item => item.analysis_id === analysisId).forEach(item => map.set(item.issue_id, item.id));
        setTrackedMap(map);
      })
      .catch(() => {});
  }, [analysisId, url]);

  function handleTrackChange(issueId: string, newTrackedId: string | undefined) {
    setTrackedMap(prev => {
      const next = new Map(prev);
      if (newTrackedId) next.set(issueId, newTrackedId);
      else next.delete(issueId);
      return next;
    });
  }

  // ── v2 path ──────────────────────────────────────────────────────────────

  if (accessibilityAudit) {
    const { findings, score, scoreBreakdown, manualReviewItems, disclaimer, mode, error } = accessibilityAudit;

    const priorityFindings = findings
      .filter(f => f.status === 'confirmed' || f.status === 'likely')
      .sort((a, b) => (SEV_ORDER[a.severity] ?? 99) - (SEV_ORDER[b.severity] ?? 99));

    const allFindings = [...findings].sort((a, b) => (SEV_ORDER[a.severity] ?? 99) - (SEV_ORDER[b.severity] ?? 99));

    const untrackedCritical = priorityFindings
      .filter(f => (f.severity === 'critical' || f.severity === 'serious') && !trackedMap.has(f.id));

    async function trackAllCritical() {
      if (!analysisId || !url) return;
      if (untrackedCritical.length === 0) { toast.info('All critical issues are already tracked'); return; }
      setBulkTracking(true);
      let added = 0;
      for (const f of untrackedCritical) {
        try {
          const res = await fetch('/api/remediation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              analysis_id: analysisId, url,
              issue_id: f.id, issue_description: f.what,
              impact: f.impact, wcag_criteria: f.wcagCriteria ?? [],
            }),
          });
          if (res.status === 201) { const d = await res.json(); handleTrackChange(f.id, d.id); added++; }
        } catch {}
      }
      setBulkTracking(false);
      if (added > 0) toast.success(`${added} critical issue${added !== 1 ? 's' : ''} added to tracker`);
      else toast.info('No new issues to add');
    }

    return (
      <section className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold">Accessibility</h2>
          <Badge variant={scoreBreakdown.confirmedCritical + scoreBreakdown.confirmedSerious > 0 ? 'destructive' : 'default'}>
            {priorityFindings.length} finding{priorityFindings.length !== 1 ? 's' : ''}
          </Badge>
          {trackedMap.size > 0 && analysisId && (
            <span className="text-xs text-indigo-400">{trackedMap.size} tracked</span>
          )}
          {analysisId && url && untrackedCritical.length > 0 && (
            <Button variant="outline" size="sm" onClick={trackAllCritical} disabled={bulkTracking} className="ml-auto text-xs h-7 gap-1">
              {bulkTracking ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkPlus className="h-3 w-3" />}
              Track all critical ({untrackedCritical.length})
            </Button>
          )}
        </div>

        {/* Overview card */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-none">
                <ScorePill score={score} />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-muted-foreground border border-border">
                    {mode === 'static-html-only' ? 'Static HTML scan' : mode}
                  </span>
                  {error && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {error.partial ? 'Partial analysis' : 'Analysis error'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{disclaimer}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Severity summary grid */}
        {priorityFindings.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              { label: 'Critical', key: 'confirmedCritical', likelyKey: 'likelyCritical', cls: 'text-red-400' },
              { label: 'Serious',  key: 'confirmedSerious',  likelyKey: 'likelySerious',  cls: 'text-orange-400' },
              { label: 'Moderate', key: 'confirmedModerate', likelyKey: 'likelyModerate', cls: 'text-amber-400' },
              { label: 'Minor',    key: 'confirmedMinor',    likelyKey: 'likelyMinor',    cls: 'text-muted-foreground' },
            ] as const).map(({ label, key, likelyKey, cls }) => {
              const confirmed = scoreBreakdown[key];
              const likely = scoreBreakdown[likelyKey];
              const total = confirmed + likely;
              if (total === 0) return null;
              return (
                <Card key={label}>
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className={`text-2xl font-bold ${cls}`}>{total}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    {likely > 0 && <p className="text-xs text-muted-foreground/50 mt-0.5">{confirmed} confirmed · {likely} likely</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Priority findings */}
        {priorityFindings.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <span className="text-emerald-400 font-medium">No confirmed or likely accessibility issues found</span>
              <p className="text-xs text-muted-foreground mt-1">Manual testing is still recommended — see the checklist below.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {priorityFindings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                ai={aiInsights?.find(a => a.originalId === finding.id)}
                analysisId={analysisId}
                url={url}
                trackedId={trackedMap.get(finding.id)}
                onTrackChange={handleTrackChange}
              />
            ))}
          </div>
        )}

        {/* Manual review checklist */}
        {manualReviewItems.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <button
                type="button"
                onClick={() => setShowManualChecklist(v => !v)}
                className="flex items-center justify-between w-full text-left"
              >
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-400" />
                  Manual Testing Checklist
                  <span className="text-xs font-normal text-muted-foreground">({manualReviewItems.length} items)</span>
                </CardTitle>
                {showManualChecklist ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
            </CardHeader>
            {showManualChecklist && (
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  These checks require manual testing with a keyboard, screen reader, or browser tools — they cannot be detected by static HTML analysis.
                </p>
                <ul className="space-y-1.5">
                  {manualReviewItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-blue-400 mt-0.5 shrink-0">□</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        )}

        {/* Manual-review findings (expandable) */}
        {(() => {
          const manualFindings = allFindings.filter(f => f.status === 'manual-review');
          if (manualFindings.length === 0) return null;
          return (
            <details className="group">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1">
                <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
                Show {manualFindings.length} manual-review item{manualFindings.length !== 1 ? 's' : ''} (cannot be confirmed statically)
              </summary>
              <div className="mt-3 space-y-3">
                {manualFindings.map(f => (
                  <FindingCard
                    key={f.id + '-mr'}
                    finding={f}
                    ai={aiInsights?.find(a => a.originalId === f.id)}
                    analysisId={analysisId}
                    url={url}
                    trackedId={trackedMap.get(f.id)}
                    onTrackChange={handleTrackChange}
                  />
                ))}
              </div>
            </details>
          );
        })()}
      </section>
    );
  }

  // ── Legacy path (old reports without accessibilityAudit) ─────────────────

  const issues = legacyIssues;
  const critical = issues.filter(i => i.impact === 'critical' || i.impact === 'serious');

  async function trackAllCriticalLegacy() {
    if (!analysisId || !url) return;
    const untracked = critical.filter(i => !trackedMap.has(i.id));
    if (untracked.length === 0) { toast.info('All critical issues are already tracked'); return; }
    setBulkTracking(true);
    let added = 0;
    for (const issue of untracked) {
      try {
        const res = await fetch('/api/remediation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysis_id: analysisId, url,
            issue_id: issue.id, issue_description: issue.description,
            impact: issue.impact, wcag_criteria: issue.wcagCriteria ?? [],
          }),
        });
        if (res.status === 201) { const d = await res.json(); handleTrackChange(issue.id, d.id); added++; }
      } catch {}
    }
    setBulkTracking(false);
    if (added > 0) toast.success(`${added} critical issue${added !== 1 ? 's' : ''} added to tracker`);
    else toast.info('No new issues to add');
  }

  const untrackedCriticalCount = critical.filter(i => !trackedMap.has(i.id)).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-2xl font-bold">Accessibility</h2>
        <Badge variant={critical.length > 0 ? 'destructive' : 'default'}>
          {issues.length} issue{issues.length !== 1 ? 's' : ''}
        </Badge>
        {trackedMap.size > 0 && analysisId && (
          <span className="text-xs text-indigo-400">{trackedMap.size} tracked</span>
        )}
        {analysisId && url && untrackedCriticalCount > 0 && (
          <Button variant="outline" size="sm" onClick={trackAllCriticalLegacy} disabled={bulkTracking} className="ml-auto text-xs h-7 gap-1">
            {bulkTracking ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkPlus className="h-3 w-3" />}
            Track all critical ({untrackedCriticalCount})
          </Button>
        )}
      </div>

      {issues.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <span className="text-emerald-400 font-medium">No accessibility issues found</span>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues.map((issue, i) => (
            <LegacyIssueCard
              key={i}
              issue={issue}
              ai={aiInsights?.find(a => a.originalId === issue.id)}
              analysisId={analysisId}
              url={url}
              trackedId={trackedMap.get(issue.id)}
              onTrackChange={handleTrackChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}
