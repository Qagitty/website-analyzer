import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FixRequestSeverity } from '@/types/fix-request';

const SEVERITY_CONFIG: Record<FixRequestSeverity, { label: string; className: string }> = {
  critical:      { label: 'Critical',      className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high:          { label: 'High',          className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medium:        { label: 'Medium',        className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  low:           { label: 'Low',           className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  informational: { label: 'Info',          className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
};

interface Props {
  severity: FixRequestSeverity;
  className?: string;
}

export function FixRequestSeverityBadge({ severity, className }: Props) {
  const config = SEVERITY_CONFIG[severity] ?? { label: severity, className: 'bg-zinc-500/20 text-zinc-400' };
  return (
    <Badge
      variant="outline"
      className={cn('border text-xs font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
