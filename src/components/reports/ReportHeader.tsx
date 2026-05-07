'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link2, Link2Off, Check, Activity, Download } from 'lucide-react';
import type { Analysis } from '@/types/analysis';

export function ReportHeader({ analysis }: { analysis: Analysis }) {
  const [isPublic, setIsPublic] = useState(analysis.is_public ?? false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [monitoringActive, setMonitoringActive] = useState(false);

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

  const createMonitor = async () => {
    setMonitoring(true);
    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: analysis.url,
          frequency: 'weekly',
          notify_on_score_drop: true,
          score_drop_threshold: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create monitor');
      setMonitoringActive(true);
      toast.success('Monitor created!', {
        description: `${analysis.url} will be checked weekly.`,
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMonitoring(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate text-white">{analysis.url}</h1>
          <p className="text-[#94A3B8] text-sm mt-1">
            Analyzed {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
            {duration && <> · {duration}s</>}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Completed</Badge>

          {/* Share toggle */}
          <Button
            variant={isPublic ? 'default' : 'outline'}
            size="sm"
            onClick={toggleShare}
            disabled={loading}
            className={isPublic
              ? 'gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-0 hover:from-indigo-400 hover:to-violet-400'
              : 'gap-1.5 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10'}
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
              className="gap-1.5 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10"
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied</>
              ) : (
                'Copy link'
              )}
            </Button>
          )}

          {/* Download PDF */}
          <a href={`/api/reports/${analysis.id}/pdf`} download>
            <Button variant="outline" size="sm" className="gap-1.5 border-white/10 text-[#94A3B8] hover:bg-white/5 hover:text-white">
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          </a>

          {/* Monitor this site */}
          {monitoringActive ? (
            <Badge className="gap-1.5 px-2.5 py-1 text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Activity className="h-3 w-3" />
              Monitoring active
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={createMonitor}
              disabled={monitoring}
              className="gap-1.5 border-white/10 text-[#94A3B8] hover:bg-white/5 hover:text-white"
            >
              <Activity className="h-3.5 w-3.5" />
              {monitoring ? 'Setting up…' : 'Monitor this site'}
            </Button>
          )}
        </div>
      </div>

      {/* Public badge */}
      {isPublic && (
        <div className="flex items-center gap-2 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-300">
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
        <p className="text-[#94A3B8] leading-relaxed">{analysis.ai_summary}</p>
      )}
    </div>
  );
}
