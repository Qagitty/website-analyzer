'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const IMPACT_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400',
  serious:  'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
  moderate: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  minor:    'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
};

// Valid transitions per the state machine in /api/accessibility/findings/[id]
const VALID_TRANSITIONS: Record<string, string[]> = {
  open:                  ['in_progress', 'accepted_risk', 'not_applicable'],
  in_progress:           ['resolved', 'open', 'accepted_risk'],
  resolved:              ['verification_required', 'open'],
  verification_required: ['verified', 'open'],
  verified:              ['open'],
  accepted_risk:         ['open'],
  not_applicable:        ['open'],
};

const STATUS_LABELS: Record<string, string> = {
  open:                  'Open',
  in_progress:           'In Progress',
  resolved:              'Resolved',
  verification_required: 'Needs Verification',
  verified:              'Verified',
  accepted_risk:         'Accepted Risk',
  not_applicable:        'Not Applicable',
};

interface Finding {
  id:                  string;
  title:               string;
  description?:        string;
  impact:              string;
  status:              string;
  page_url:            string;
  selector?:           string;
  html_excerpt?:       string;
  wcag_level?:         string;
  wcag_criteria?:      string[];
  pour_principle?:     string;
  remediation_guidance?: string;
  automated:           boolean;
}

interface Props {
  finding: Finding;
  onStatusChange?: (newStatus: string) => void;
}

export function AccessibilityFindingDetail({ finding, onStatusChange }: Props) {
  const [updating, setUpdating]     = useState(false);
  const [reason, setReason]         = useState('');
  const [pendingStatus, setPending] = useState<string | null>(null);

  const impactLabel = finding.impact ?? 'unknown';
  const transitions = VALID_TRANSITIONS[finding.status] ?? [];
  const needsReason = pendingStatus === 'accepted_risk' || pendingStatus === 'not_applicable';

  const applyTransition = async (targetStatus: string) => {
    if ((targetStatus === 'accepted_risk' || targetStatus === 'not_applicable') && !reason.trim()) {
      toast.error('A reason is required for this status change.');
      return;
    }

    setUpdating(true);
    try {
      const body: Record<string, string> = { status: targetStatus };
      if (targetStatus === 'accepted_risk') body.acceptedRiskReason = reason;
      if (targetStatus === 'not_applicable') body.notApplicableReason = reason;

      const res = await fetch(`/api/accessibility/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Update failed');
      }

      toast.success(`Finding marked as ${STATUS_LABELS[targetStatus]}`);
      setPending(null);
      setReason('');
      onStatusChange?.(targetStatus);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-base leading-snug">{finding.title}</h3>
        <Badge variant="outline" className={IMPACT_COLORS[impactLabel] ?? ''}>
          {impactLabel}
        </Badge>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2 text-xs">
        {finding.wcag_level && (
          <Badge variant="outline">WCAG {finding.wcag_level}</Badge>
        )}
        {finding.pour_principle && (
          <Badge variant="outline" className="capitalize">{finding.pour_principle}</Badge>
        )}
        <Badge variant="outline" className="text-muted-foreground">
          {finding.automated ? 'Automated' : 'Manual'}
        </Badge>
        <Badge variant="outline" className="text-muted-foreground">
          {STATUS_LABELS[finding.status] ?? finding.status}
        </Badge>
      </div>

      {finding.page_url && (
        <p className="text-xs text-muted-foreground break-all">{finding.page_url}</p>
      )}

      {finding.description && (
        <Card className="bg-muted/40">
          <CardContent className="p-3 text-sm">{finding.description}</CardContent>
        </Card>
      )}

      {finding.selector && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Element selector</p>
          <code className="block text-xs bg-muted rounded p-2 break-all">{finding.selector}</code>
        </div>
      )}

      {/* html_excerpt is already sanitized by the API (sanitizeHtmlExcerpt) — render as text only */}
      {finding.html_excerpt && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">HTML excerpt (sanitized)</p>
          <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {finding.html_excerpt}
          </pre>
        </div>
      )}

      {finding.remediation_guidance && (
        <Card className="border-indigo-200 dark:border-indigo-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Remediation guidance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground p-3 pt-0">
            {finding.remediation_guidance}
          </CardContent>
        </Card>
      )}

      {/* Status transitions */}
      {transitions.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground">Change status</p>
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <Button
                key={t}
                variant="outline"
                size="sm"
                onClick={() => {
                  if (t === 'accepted_risk' || t === 'not_applicable') {
                    setPending(t);
                  } else {
                    applyTransition(t);
                  }
                }}
                disabled={updating}
                aria-label={`Mark as ${STATUS_LABELS[t]}`}
              >
                {STATUS_LABELS[t]}
              </Button>
            ))}
          </div>

          {pendingStatus && needsReason && (
            <div className="space-y-2">
              <Label htmlFor={`reason-${finding.id}`} className="text-xs">
                Reason (required for {STATUS_LABELS[pendingStatus]})
              </Label>
              <Textarea
                id={`reason-${finding.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this finding is being accepted or marked not applicable…"
                rows={3}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => applyTransition(pendingStatus)}
                  disabled={updating || !reason.trim()}
                >
                  {updating ? 'Saving…' : 'Confirm'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPending(null); setReason(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
