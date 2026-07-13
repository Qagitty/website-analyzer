'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Link2, Link2Off, Check, Activity, Download,
  Bell, BellOff, Loader2,
  FileText, FileSpreadsheet, FileJson,
} from 'lucide-react';
import type { Analysis } from '@/types/analysis';

type ExportFormat = 'pdf' | 'compliance-pdf' | 'docx' | 'markdown' | 'json' | 'xlsx';

const EXPORT_OPTIONS: { format: ExportFormat; label: string; desc: string; Icon: any }[] = [
  { format: 'docx',     label: 'DOCX',     desc: 'Microsoft Word',      Icon: FileText },
  { format: 'xlsx',     label: 'XLSX',     desc: 'Excel spreadsheet',   Icon: FileSpreadsheet },
  { format: 'markdown', label: 'Markdown', desc: 'AI / LLM friendly',   Icon: FileText },
  { format: 'json',     label: 'JSON',     desc: 'Raw structured data', Icon: FileJson },
];

export function ReportActionBar({ analysis }: { analysis: Analysis }) {
  const [isPublic, setIsPublic] = useState(analysis.is_public ?? false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [showMonitorForm, setShowMonitorForm] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [notify, setNotify] = useState(true);
  const [threshold, setThreshold] = useState(10);
  const monitorFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/monitors')
      .then(r => r.ok ? r.json() : [])
      .then((monitors: { url: string; status?: string }[]) => {
        if (monitors.some(m => m.url === analysis.url && m.status !== 'paused')) {
          setMonitoringActive(true);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis.url]);

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
        toast.success('Link copied to clipboard!', { description: 'Anyone with the link can view this report.' });
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
      toast.success('Monitor created!', { description: `${analysis.url} will be checked ${frequency}.` });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMonitoring(false);
    }
  };

  return (
    <div className="flex items-center gap-2 w-max">
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
        Completed
      </Badge>

      {/* Share */}
      <Button
        variant={isPublic ? 'default' : 'outline'}
        size="sm"
        onClick={toggleShare}
        disabled={loading}
        className={isPublic
          ? 'gap-1.5 bg-orange-600 text-white border-0'
          : 'gap-1.5 border-orange-400 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30'}
      >
        {isPublic ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
        {loading ? 'Updating…' : isPublic ? 'Shared' : 'Share'}
      </Button>

      {isPublic && (
        <Button
          variant="outline"
          size="sm"
          onClick={copyLink}
          className="gap-1.5 border-orange-400 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
        >
          {copied ? <><Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Copied</> : 'Copy link'}
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
        {downloading === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        PDF
      </Button>

      {/* Compliance PDF */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadExport('compliance-pdf')}
        disabled={downloading !== null}
        className="gap-1.5 border-orange-300 dark:border-orange-900/50 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30"
      >
        {downloading === 'compliance-pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Compliance PDF
      </Button>

      {/* Export format buttons (flat — avoids overflow clipping in mobile nav) */}
      {EXPORT_OPTIONS.map(({ format, label, Icon }) => (
        <Button
          key={format}
          variant="outline"
          size="sm"
          onClick={() => downloadExport(format)}
          disabled={downloading !== null}
          className="gap-1.5 border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {downloading === format
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Icon className="h-3.5 w-3.5" />}
          {label}
        </Button>
      ))}

      {/* Monitor */}
      {monitoringActive ? (
        <Badge className="gap-1.5 px-2.5 py-1 text-xs bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-500 border border-orange-200 dark:border-orange-900/40 shrink-0">
          <Activity className="h-3 w-3" />
          Monitoring active
        </Badge>
      ) : (
        <div ref={monitorFormRef} className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMonitorForm(v => !v)}
            className="gap-1.5 border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Activity className="h-3.5 w-3.5" />
            Monitor this site
          </Button>
          {showMonitorForm && (
            <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border border-border bg-card shadow-xl p-4 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground/70 font-medium">Check frequency</p>
                <div className="flex rounded-md border border-border overflow-hidden text-sm">
                  {(['daily', 'weekly'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={`flex-1 px-3 py-1.5 capitalize transition-colors ${frequency === f ? 'bg-orange-600 text-white' : 'bg-card hover:bg-accent text-muted-foreground'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground/70 font-medium">Alerts</p>
                <button
                  type="button"
                  onClick={() => setNotify(v => !v)}
                  className={`flex items-center gap-1.5 w-full rounded-md border px-3 py-1.5 text-sm transition-colors ${notify ? 'border-orange-500/50 text-orange-400' : 'border-border text-muted-foreground/60'}`}
                >
                  {notify ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                  {notify ? 'Alerts on' : 'Alerts off'}
                </button>
                {notify && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-xs whitespace-nowrap">Alert if score drops by</span>
                    <Input
                      type="number" min={1} max={50} value={threshold}
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
                className="w-full bg-orange-600 text-white border-0"
              >
                {monitoring ? 'Creating…' : 'Create monitor'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
