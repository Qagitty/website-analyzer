'use client';

import { useState } from 'react';
import { BookmarkPlus, BookmarkCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AccessibilityIssue } from '@/types/analysis';

interface Props {
  issue:      AccessibilityIssue;
  analysisId: string;
  url:        string;
  /** Pass the remediation item ID if already tracked; undefined if not. */
  trackedId:  string | undefined;
  /** Called after successful create or delete so parent can update its state. */
  onChange:   (issueId: string, newTrackedId: string | undefined) => void;
}

export function TrackIssueButton({ issue, analysisId, url, trackedId, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const isTracked = !!trackedId;

  async function toggle() {
    setLoading(true);
    try {
      if (isTracked) {
        // Remove tracking
        const res = await fetch(`/api/remediation/${trackedId}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) throw new Error('Failed to remove');
        onChange(issue.id, undefined);
        toast.success('Removed from tracking');
      } else {
        // Add tracking
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
        if (res.status === 409) {
          toast.info('Already tracked');
          return;
        }
        if (res.status === 402 || res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data.code === 'FEATURE_GATE_REMEDIATIONBOARD') {
            toast.error('Remediation tracking requires a Pro plan or higher.', {
              description: 'Upgrade in Settings → Billing to unlock issue tracking.',
              duration: 6000,
            });
            return;
          }
        }
        if (!res.ok) throw new Error('Failed to track');
        const data = await res.json();
        onChange(issue.id, data.id);
        toast.success('Added to remediation tracker');
      }
    } catch {
      toast.error('Could not save. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={isTracked ? 'Remove from tracker' : 'Track this issue'}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors
        ${isTracked
          ? 'border-orange-400 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 text-orange-500 hover:bg-orange-100 dark:bg-orange-950/40'
          : 'border-border text-muted-foreground hover:border-orange-400 dark:border-orange-800 hover:text-orange-500 hover:bg-orange-600/5'
        }
        disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isTracked ? (
        <BookmarkCheck className="h-3 w-3" />
      ) : (
        <BookmarkPlus className="h-3 w-3" />
      )}
      {isTracked ? 'Tracked' : 'Track'}
    </button>
  );
}
