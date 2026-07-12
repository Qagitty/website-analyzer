import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FixRequestType } from '@/types/fix-request';

const TYPE_LABELS: Record<FixRequestType, string> = {
  audit:        'Audit',
  fix:          'Fix',
  estimate:     'Estimate',
  review:       'Review',
  verification: 'Verification',
  consultation: 'Consultation',
};

interface Props {
  type: FixRequestType;
  className?: string;
}

export function FixRequestTypeBadge({ type, className }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn('border text-xs font-medium bg-indigo-500/10 text-indigo-400 border-indigo-500/20', className)}
    >
      {TYPE_LABELS[type] ?? type}
    </Badge>
  );
}
