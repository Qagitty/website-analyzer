'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { QueuePosition } from '@/components/analyze/QueuePosition';
import { toast } from 'sonner';

type Status = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

interface AnalysisState {
  status: Status;
  queuePosition?: number;
  url: string;
  errorMessage?: string;
}

const STATUS_MESSAGES: Record<Status, string> = {
  pending:   'Initializing...',
  queued:    'Waiting in queue',
  running:   'Analyzing your website',
  completed: 'Analysis complete!',
  failed:    'Analysis failed',
  cancelled: 'Analysis cancelled',
};

const STATUS_PROGRESS: Record<Status, number> = {
  pending:   5,
  queued:    15,
  running:   60,
  completed: 100,
  failed:    0,
  cancelled: 0,
};

const CANCELLABLE: Set<Status> = new Set(['pending', 'queued', 'running']);

interface Props {
  analysisId: string;
  initialData?: AnalysisState;
}

export function AnalysisProgress({ analysisId, initialData }: Props) {
  const [state, setState]       = useState<AnalysisState | null>(initialData ?? null);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const router   = useRouter();
  const guardRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    guardRef.current = setTimeout(() => setTimedOut(true), 2 * 60 * 1000);
    return () => { if (guardRef.current) clearTimeout(guardRef.current); };
  }, []);

  const retry = async () => {
    if (!state?.url) return;
    setRetrying(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: state.url }),
      });
      const data = await res.json();
      if (res.status === 402) { toast.error('No credits remaining. Please upgrade your plan.'); return; }
      if (!res.ok) throw new Error(data.error ?? 'Failed to start analysis');
      router.push(`/analyze/${data.analysisId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRetrying(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/analyze/${analysisId}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not cancel');
      }
      toast.success('Analysis cancelled — your credit has been refunded.');
      router.push('/analyze');
    } catch (err: any) {
      toast.error(err.message);
      setCancelling(false);
    }
  };

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${analysisId}`);
        if (!res.ok) {
          console.error('Polling failed:', res.status, await res.text().catch(() => ''));
          return;
        }

        const data = await res.json();
        setState({
          status:        data.status,
          queuePosition: data.queue_position,
          url:           data.url,
          errorMessage:  data.error_message,
        });

        if (['completed', 'failed', 'cancelled'].includes(data.status)) {
          if (guardRef.current) clearTimeout(guardRef.current);
        }
        if (data.status === 'completed') {
          setTimeout(() => router.push(`/reports/${analysisId}`), 1200);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [analysisId, router]);

  if (!state) {
    return <div className="animate-pulse h-24 bg-card rounded-lg" />;
  }

  if (timedOut && !['completed', 'failed', 'cancelled'].includes(state.status)) {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 text-center space-y-4">
        <div className="space-y-1">
          <p className="text-red-400 font-medium">Analysis Timed Out</p>
          <p className="text-red-400/70 text-sm mt-1">
            The site did not respond within 2 minutes. It may be unreachable or blocking automated requests.
          </p>
        </div>
        {state.url && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground truncate">{state.url}</p>
            <Button onClick={retry} disabled={retrying} variant="destructive" size="sm">
              {retrying ? 'Submitting…' : '↺ Try Again'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (state.status === 'cancelled') {
    return (
      <div className="bg-secondary/50 border border-border rounded-xl p-6 text-center space-y-4">
        <p className="text-muted-foreground font-medium">Analysis cancelled</p>
        <p className="text-sm text-muted-foreground/70">Your credit has been refunded.</p>
        <Button onClick={() => router.push('/analyze')} variant="outline" size="sm">
          ← Analyze another site
        </Button>
      </div>
    );
  }

  if (state.status === 'failed') {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 text-center space-y-4">
        <div className="space-y-1">
          <p className="text-red-400 font-medium">Analysis Failed</p>
          <p className="text-red-400/70 text-sm mt-1">
            {state.errorMessage ?? 'Something went wrong. Please try again.'}
          </p>
        </div>
        {state.url && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground truncate">{state.url}</p>
            <Button onClick={retry} disabled={retrying} variant="destructive" size="sm">
              {retrying ? 'Submitting…' : '↺ Retry Analysis'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const statusBadgeClass = (() => {
    const base = 'text-xs font-medium px-2.5 py-0.5 rounded-full';
    if (state.status === 'completed') return `${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`;
    if (state.status === 'running')   return `${base} bg-indigo-500/10 text-indigo-300 border border-indigo-500/20`;
    return `${base} bg-secondary text-muted-foreground border border-border`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium truncate max-w-xs text-foreground">{state.url}</p>
        <span className={statusBadgeClass}>{state.status}</span>
      </div>

      <Progress value={STATUS_PROGRESS[state.status]} className="h-2" />

      <p className="text-sm text-muted-foreground text-center">
        {STATUS_MESSAGES[state.status]}
      </p>

      {state.status === 'queued' && state.queuePosition && (
        <div className="flex justify-center">
          <QueuePosition position={state.queuePosition} />
        </div>
      )}

      {CANCELLABLE.has(state.status) && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={cancel}
            disabled={cancelling}
            className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/70 hover:text-red-300 transition-colors"
          >
            {cancelling ? 'Cancelling…' : '✕ Cancel analysis'}
          </Button>
        </div>
      )}
    </div>
  );
}
