'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ErrorIssueStatus = 'unresolved' | 'investigating' | 'resolved' | 'ignored' | 'archived';

const STATUS_CONFIG: Record<ErrorIssueStatus, { label: string; className: string }> = {
  unresolved:   { label: 'Unresolved',   className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  investigating:{ label: 'Investigating',className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  resolved:     { label: 'Resolved',     className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  ignored:      { label: 'Ignored',      className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
  archived:     { label: 'Archived',     className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
};

interface Props {
  status: ErrorIssueStatus;
  className?: string;
}

export function ErrorStatusBadge({ status, className }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unresolved;
  return (
    <Badge
      variant="outline"
      className={cn(cfg.className, className)}
      aria-label={`Issue status: ${cfg.label}`}
    >
      {cfg.label}
    </Badge>
  );
}
