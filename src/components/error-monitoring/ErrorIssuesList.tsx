'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ErrorLevelBadge, type ErrorLevel } from './ErrorLevelBadge';
import { ErrorStatusBadge, type ErrorIssueStatus } from './ErrorStatusBadge';

interface ErrorIssue {
  id:            string;
  title:         string;
  level:         string;
  status:        string;
  event_count:   number;
  first_seen_at: string;
  last_seen_at:  string;
}

interface Props {
  projectId: string;
  issues:    ErrorIssue[];
  total:     number;
}

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '',             label: 'All' },
  { value: 'unresolved',  label: 'Unresolved' },
  { value: 'investigating',label: 'Investigating' },
  { value: 'resolved',    label: 'Resolved' },
  { value: 'ignored',     label: 'Ignored' },
];

export function ErrorIssuesList({ projectId, issues: initialIssues, total: initialTotal }: Props) {
  const router = useRouter();
  const [issues, setIssues]       = useState(initialIssues);
  const [total, setTotal]         = useState(initialTotal);
  const [statusFilter, setStatus] = useState('');
  const [loading, setLoading]     = useState(false);

  const applyFilter = useCallback(async (status: string) => {
    setStatus(status);
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (status) params.set('status', status);
      const res = await fetch(`/api/error-monitoring/projects/${projectId}/issues?${params}`);
      if (!res.ok) return;
      const json = await res.json() as { data: ErrorIssue[]; total: number };
      setIssues(json.data);
      setTotal(json.total);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return (
    <div className="space-y-4">
      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => applyFilter(f.value)}
            className={[
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-indigo-600 text-white'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-indigo-500/40',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">{total} total</span>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-card border border-border rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && issues.length === 0 && (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <p className="text-sm text-muted-foreground">No issues found.</p>
        </div>
      )}

      {!loading && issues.length > 0 && (
        <div className="space-y-2">
          {issues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => router.push(`/errors/${projectId}/issues/${issue.id}`)}
              className="w-full text-left flex items-center gap-3 bg-card border border-border rounded-lg p-3 hover:border-indigo-500/40 hover:bg-card/80 transition-colors"
            >
              <ErrorLevelBadge level={issue.level as ErrorLevel} className="shrink-0 text-[10px] px-1.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{issue.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  First seen{' '}
                  {formatDistanceToNow(new Date(issue.first_seen_at), { addSuffix: true })}
                  {' · '}
                  Last seen{' '}
                  {formatDistanceToNow(new Date(issue.last_seen_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {issue.event_count.toLocaleString()} events
                </span>
                <ErrorStatusBadge status={issue.status as ErrorIssueStatus} className="text-[10px]" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
