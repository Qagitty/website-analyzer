'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, Search, Archive, EyeOff, Hash, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorLevelBadge, type ErrorLevel } from './ErrorLevelBadge';
import { ErrorStatusBadge, type ErrorIssueStatus } from './ErrorStatusBadge';
import { ErrorStackTrace } from './ErrorStackTrace';
import { toast } from 'sonner';

interface StackFrame {
  function?: string;
  filename?:  string;
  lineno?:    number;
  colno?:     number;
}

interface ErrorEvent {
  id:                 string;
  message:            string;
  stack_frames:       StackFrame[];
  breadcrumbs:        Array<{ type: string; category: string; data: Record<string, unknown>; timestamp: string }>;
  page_url_sanitized: string | null;
  browser:            string | null;
  device_category:    string | null;
  environment:        string | null;
  received_at:        string;
  is_test_event:      boolean;
}

interface Activity {
  id:             string;
  event_type:     string;
  previous_value: string | null;
  new_value:      string | null;
  created_at:     string;
}

interface Issue {
  id:             string;
  title:          string;
  level:          string;
  status:         string;
  exception_type: string | null;
  fingerprint:    string;
  event_count:    number;
  first_seen_at:  string;
  last_seen_at:   string;
  error_project_id: string;
}

interface Props {
  issue:        Issue;
  recentEvents: ErrorEvent[];
  activities:   Activity[];
}

export function ErrorIssueDetail({ issue, recentEvents, activities }: Props) {
  const router  = useRouter();
  const [status, setStatus] = useState(issue.status);
  const [loading, setLoading] = useState<string | null>(null);

  const latestEvent = recentEvents[0];

  const updateStatus = async (newStatus: string) => {
    setLoading(newStatus);
    try {
      const res = await fetch(
        `/api/error-monitoring/projects/${issue.error_project_id}/issues/${issue.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (!res.ok) throw new Error('Failed');
      setStatus(newStatus);
      toast.success(`Issue marked as ${newStatus}.`);
      router.refresh();
    } catch {
      toast.error('Failed to update issue.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ErrorLevelBadge level={issue.level as ErrorLevel} />
          <ErrorStatusBadge status={status as ErrorIssueStatus} />
          {issue.exception_type && (
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {issue.exception_type}
            </span>
          )}
        </div>
        <h1 className="text-lg font-semibold font-mono">{issue.title}</h1>
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{issue.event_count.toLocaleString()} events</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />First seen {formatDistanceToNow(new Date(issue.first_seen_at), { addSuffix: true })}</span>
          <span>Last seen {formatDistanceToNow(new Date(issue.last_seen_at), { addSuffix: true })}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {status !== 'investigating' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus('investigating')}
            disabled={loading === 'investigating'}
          >
            <Search className="h-4 w-4 mr-1.5" />
            Investigate
          </Button>
        )}
        {status !== 'resolved' && (
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => updateStatus('resolved')}
            disabled={loading === 'resolved'}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Resolve
          </Button>
        )}
        {status !== 'ignored' && (
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-500/30 text-zinc-400 hover:bg-zinc-500/10"
            onClick={() => updateStatus('ignored')}
            disabled={loading === 'ignored'}
          >
            <EyeOff className="h-4 w-4 mr-1.5" />
            Ignore
          </Button>
        )}
        {status !== 'archived' && (
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-500/30 text-zinc-400 hover:bg-zinc-500/10"
            onClick={() => updateStatus('archived')}
            disabled={loading === 'archived'}
          >
            <Archive className="h-4 w-4 mr-1.5" />
            Archive
          </Button>
        )}
      </div>

      {/* Stack trace */}
      {latestEvent && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Stack trace</h2>
          <ErrorStackTrace frames={latestEvent.stack_frames ?? []} />
        </div>
      )}

      {/* Breadcrumbs */}
      {latestEvent && latestEvent.breadcrumbs && latestEvent.breadcrumbs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Breadcrumbs</h2>
          <div className="rounded-md bg-[#0A0A0F] border border-border divide-y divide-border">
            {latestEvent.breadcrumbs.slice(-10).map((b, i) => (
              <div key={i} className="px-3 py-2 flex items-center gap-3 text-xs">
                <span className="text-muted-foreground w-20 shrink-0">{b.type}</span>
                <span className="text-indigo-400 shrink-0">{b.category}</span>
                <span className="text-foreground truncate">
                  {JSON.stringify(b.data).slice(0, 120)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity */}
      {activities.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Activity</h2>
          <div className="space-y-1">
            {activities.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-foreground">{a.event_type.replace(/_/g, ' ')}</span>
                {a.previous_value && <><span>from</span><span className="text-foreground">{a.previous_value}</span></>}
                {a.new_value && <><span>to</span><span className="text-foreground">{a.new_value}</span></>}
                <span>·</span>
                <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
