import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FixRequestStatus } from '@/types/fix-request';

const STATUS_CONFIG: Record<FixRequestStatus, { label: string; className: string }> = {
  draft:                   { label: 'Draft',                 className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
  ready:                   { label: 'Ready',                 className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  sending:                 { label: 'Sending',               className: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 animate-pulse' },
  sent:                    { label: 'Sent',                  className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  delivered:               { label: 'Delivered',             className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  delivery_failed:         { label: 'Delivery Failed',       className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  acknowledged:            { label: 'Acknowledged',          className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  in_review:               { label: 'In Review',             className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  accepted:                { label: 'Accepted',              className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  declined:                { label: 'Declined',              className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
  in_progress:             { label: 'In Progress',           className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  waiting_for_information: { label: 'Waiting for Info',      className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  fix_submitted:           { label: 'Fix Submitted',         className: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  verification_required:   { label: 'Verification Required', className: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  verified:                { label: 'Verified',              className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  closed:                  { label: 'Closed',                className: 'bg-emerald-500/20 text-emerald-500/60 border-emerald-500/20' },
  cancelled:               { label: 'Cancelled',             className: 'bg-zinc-500/20 text-zinc-500 border-zinc-500/20' },
};

interface Props {
  status: FixRequestStatus;
  className?: string;
}

export function FixRequestStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-zinc-500/20 text-zinc-400' };
  return (
    <Badge
      variant="outline"
      className={cn('border text-xs font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
