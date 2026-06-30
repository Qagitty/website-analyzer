'use client';

import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Link2, Link2Off, Check, Activity, Download, Bell, BellOff, Loader2, ChevronDown, FileText, FileSpreadsheet, FileJson, FileDown } from 'lucide-react';
import type { Analysis } from '@/types/analysis';

type ExportFormat = 'pdf' | 'compliance-pdf' | 'docx' | 'markdown' | 'json' | 'xlsx';

const EXPORT_OPTIONS: { format: ExportFormat; label: string; desc: string; Icon: any }[] = [
  { format: 'docx',     label: 'DOCX',     desc: 'Microsoft Word',      Icon: FileText },
  { format: 'xlsx',     label: 'XLSX',     desc: 'Excel spreadsheet',   Icon: FileSpreadsheet },
  { format: 'markdown', label: 'Markdown', desc: 'AI / LLM friendly',   Icon: FileText },
  { format: 'json',     label: 'JSON',     desc: 'Raw structured data', Icon: FileJson },
];

export function ReportHeader({ analysis }: { analysis: Analysis }) {
  const [isPublic, setIsPublic] = useState(analysis.is_public ?? false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Monitor form state
  const [showMonitorForm, setShowMonitorForm] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [notify, setNotify] = useState(true);
  const [threshold, setThreshold] = useState(10);
  const monitorFormRef = useRef<HTMLDivElement>(null);

  // Check on mount whether this URL is already being monitored
  useEffect(() => {
    fetch('/api/monitors')
      .then(r => r.ok ? r.json() : [])
      .then((monitors: { url: string; status?: string }[]) => {
        const exists = monitors.some(
          m => m.url === analysis.url && m.status !== 'paused'
        );
        if (exists) setMonitoringActive(true);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis.url]);

  // Close monitor form on outside click
  useEffect(() => {
    if (!showMonitorForm) return;
    const handler = (e: MouseEvent) => {
      if (monitorFormRef.current && !monitorFormRef.current.contains(e.target as Node)) {
        setShowMonitorForm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMonitorForm]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!showExport) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

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

  const downloadExport = async (format: ExportFormat) => {
    setDownloading(format);
    setShowExport(false);
    try {
      const res = await fetch(`/api/reports/${analysis.id}/${format}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const hostname = (() => { try { return new URL(analysis.url).hostname; } catch { return 'report'; } })();
      const ext: Record<ExportFormat, string> = {
        'pdf': 'pdf', 'compliance-pdf': 'pdf',
        'docx': 'docx', 'xlsx': 'xlsx', 'markdown': 'md', 'json': 'json',
      };
      const prefix = format === 'compliance-pdf' ? 'compliance-report' : 'report';
      a.download = `${prefix}-${hostname}.${ext[format]}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDownloading(null);
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
          frequency,
          notify_on_score_drop: notify,
          score_drop_threshold: threshold,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create monitor');
      setMonitoringActive(true);
      setShowMonitorForm(false);
      toast.success('Monitor created!', {
        description: `${analysis.url} will be checked ${frequency}.`,
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMonitoring(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* URL + date: visible on desktop only (mobile shows them in sticky nav) */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold truncate text-foreground">{analysis.url}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Analyzed {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
          {duration && <> · {duration}s</>}
        </p>
      </div>

      {/* Action buttons: desktop only (mobile shows them in sticky nav) */}
      <div className="hidden lg:block overflow-x-auto -mx-1 px-1">
        <div className="flex items-center gap-2 w-max">
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Completed</Badge>

          {/* Share toggle */}
          <Button
            variant={isPublic ? 'default' : 'outline'}
            size="sm"
            onClick={toggleShare}
            disabled={loading}
            className={isPublic
              ? 'gap-1.5 bg-orange-600 text-white border-0 hover:from-orange-400 hover:to-orange-400'
              : 'gap-1.5 border-orange-400 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:bg-orange-950/30'}
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
              className="gap-1.5 border-orange-400 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:bg-orange-950/30"
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Copied</>
              ) : (
                'Copy link'
              )}
            </Button>
          )}

          {/* PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadExport('pdf')}
            disabled={downloading !== null}
            className="gap-1.5 border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {downloading === 'pdf'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            PDF
          </Button>

          {/* Compliance PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadExport('compliance-pdf')}
            disabled={downloading !== null}
            className="gap-1.5 border-orange-300 dark:border-orange-900/50 text-orange-500 hover:bg-orange-50 dark:bg-orange-950/30 hover:text-orange-500"
          >
            {downloading === 'compliance-pdf'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            Compliance PDF
          </Button>

          {/* Export dropdown (DOCX / XLSX / Markdown / JSON) */}
          <div ref={exportRef} className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExport(v => !v)}
              disabled={downloading !== null}
              className="gap-1.5 border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {downloading !== null && !['pdf','compliance-pdf'].includes(downloading)
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Download className="h-3.5 w-3.5" />}
              Export
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${showExport ? 'rotate-180' : ''}`} />
            </Button>

            {showExport && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-border bg-card shadow-xl py-1.5 overflow-hidden">
                {EXPORT_OPTIONS.map(({ format, label, desc, Icon }) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => downloadExport(format)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary/60 transition-colors"
                  >
                    <Icon className="h-4 w-4 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground leading-none">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Monitor this site */}
          {monitoringActive ? (
            <Badge className="gap-1.5 px-2.5 py-1 text-xs bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-500 border border-orange-200 dark:border-orange-900/40">
              <Activity className="h-3 w-3" />
              Monitoring active
            </Badge>
          ) : (
            <div ref={monitorFormRef} className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMonitorForm((v) => !v)}
                className="gap-1.5 border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Activity className="h-3.5 w-3.5" />
                Monitor this site
              </Button>

              {showMonitorForm && (
                <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-border bg-card shadow-xl p-4 space-y-4">
                  {/* Frequency */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground/70 font-medium">Check frequency</p>
                    <div className="flex rounded-md border border-border overflow-hidden text-sm">
                      {(['daily', 'weekly'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFrequency(f)}
                          className={`flex-1 px-3 py-1.5 capitalize transition-colors ${
                            frequency === f
                              ? 'bg-orange-600 text-white'
                              : 'bg-card hover:bg-accent text-muted-foreground'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notify toggle */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground/70 font-medium">Alerts</p>
                    <button
                      type="button"
                      onClick={() => setNotify((v) => !v)}
                      className={`flex items-center gap-1.5 w-full rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        notify ? 'border-orange-500/50 text-orange-400' : 'border-border text-muted-foreground/60'
                      }`}
                    >
                      {notify ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                      {notify ? 'Alerts on' : 'Alerts off'}
                    </button>

                    {notify && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="text-xs whitespace-nowrap">Alert if score drops by</span>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={threshold}
                          onChange={(e) => setThreshold(Number(e.target.value))}
                          className="w-16 h-8 text-center"
                        />
                        <span className="text-xs">pts</span>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={createMonitor}
                    disabled={monitoring}
                    size="sm"
                    className="w-full bg-orange-600 text-white hover:from-orange-400 hover:to-orange-400 border-0"
                  >
                    {monitoring ? 'Creating…' : 'Create monitor'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Public badge */}
      {isPublic && (
        <div className="flex items-center gap-2 rounded-md border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 text-sm text-orange-700 dark:text-orange-400">
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
