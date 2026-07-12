import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'expired'
  | 'revoked';

const STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; className: string }
> = {
  verified: {
    label: 'Verified',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  unverified: {
    label: 'Unverified',
    className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  expired: {
    label: 'Expired',
    className: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  revoked: {
    label: 'Revoked',
    className: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
};

interface Props {
  status: VerificationStatus;
  className?: string;
}

export function ConnectedSiteStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.unverified;
  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
