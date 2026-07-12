import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { FixRequestStatusBadge } from './FixRequestStatusBadge';
import { FixRequestSeverityBadge } from './FixRequestSeverityBadge';
import { FixRequestTypeBadge } from './FixRequestTypeBadge';
import type { FixRequestStatus, FixRequestSeverity, FixRequestType } from '@/types/fix-request';

interface FixRequestCardProps {
  id: string;
  title: string;
  status: FixRequestStatus;
  severity: FixRequestSeverity;
  request_type: FixRequestType;
  created_at: string;
  summary?: string | null;
}

export function FixRequestCard({
  id,
  title,
  status,
  severity,
  request_type,
  created_at,
  summary,
}: FixRequestCardProps) {
  return (
    <Link
      href={`/fix-requests/${id}`}
      className="block bg-card border border-border rounded-xl p-4 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors group"
      data-testid="fix-request-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-foreground truncate group-hover:text-indigo-300 transition-colors">
            {title}
          </h3>
          {summary && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{summary}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <FixRequestSeverityBadge severity={severity} />
          <FixRequestStatusBadge status={status} />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <FixRequestTypeBadge type={request_type} />
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(created_at), { addSuffix: true })}
        </span>
      </div>
    </Link>
  );
}
