'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link2, Link2Off, Check } from 'lucide-react';
import type { Analysis } from '@/types/analysis';

export function ReportHeader({ analysis }: { analysis: Analysis }) {
  const [isPublic, setIsPublic] = useState(analysis.is_public ?? false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const duration = analysis.completed_at && analysis.started_at
    ? Math.round(
        (new Date(analysis.completed_at).getTime() - new Date(analysis.started_at).getTime()) / 1000
      )
    : null;

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${analysis.id}`;

  const toggleShare = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${analysis.id}/share`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update');

      setIsPublic(data.isPublic);

      if (data.isPublic) {
        await navigator.clipboard.writeText(shareUrl).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        toast.success('Link copied to clipboard!', {
          description: 'Anyone with the link can view this report.',
        });
      } else {
        toast.success('Report is now private');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success('Link copied!');
    } catch {
      toast.error('Could not copy — please copy the URL manually');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{analysis.url}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Analyzed {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
            {duration && <> · {duration}s</>}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="default">Completed</Badge>

          {/* Share toggle */}
          <Button
            variant={isPublic ? 'default' : 'outline'}
            size="sm"
            onClick={toggleShare}
            disabled={loading}
            className="gap-1.5"
          >
            {isPublic ? (
              <Link2 className="h-3.5 w-3.5" />
            ) : (
              <Link2Off className="h-3.5 w-3.5" />
            )}
            {loading ? 'Updating…' : isPublic ? 'Shared' : 'Share'}
          </Button>

          {/* Copy link — only visible when already public */}
          {isPublic && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="gap-1.5"
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
              ) : (
                'Copy link'
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Public badge */}
      {isPublic && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span>This report is public. </span>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 truncate max-w-xs hover:no-underline"
          >
            {shareUrl}
          </a>
        </div>
      )}

      {typeof analysis.ai_summary === 'string' && analysis.ai_summary.trim().length > 5 && (
        <p className="text-muted-foreground leading-relaxed">{analysis.ai_summary}</p>
      )}
    </div>
  );
}
