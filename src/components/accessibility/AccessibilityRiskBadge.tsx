'use client';

import { Badge } from '@/components/ui/badge';
import type { AccessibilityRiskLevel } from '@/types/accessibility-profile';

const RISK_CONFIG: Record<
  AccessibilityRiskLevel,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  low:                  { label: 'Low Risk',          variant: 'default',     className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  moderate:             { label: 'Moderate Risk',     variant: 'secondary',   className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  high:                 { label: 'High Risk',         variant: 'destructive', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
  critical:             { label: 'Critical Risk',     variant: 'destructive', className: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300 border-red-300 dark:border-red-700 font-semibold' },
  insufficient_evidence: { label: 'Insufficient Evidence', variant: 'outline', className: 'text-muted-foreground' },
};

interface Props {
  level: AccessibilityRiskLevel | null | undefined;
  size?: 'sm' | 'default';
}

export function AccessibilityRiskBadge({ level, size = 'default' }: Props) {
  if (!level) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not assessed
      </Badge>
    );
  }

  const config = RISK_CONFIG[level] ?? RISK_CONFIG.insufficient_evidence;

  return (
    <Badge
      variant="outline"
      className={config.className + (size === 'sm' ? ' text-xs px-1.5 py-0' : '')}
      aria-label={`Risk level: ${config.label}`}
    >
      {config.label}
    </Badge>
  );
}
