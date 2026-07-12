'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'info';

const LEVEL_CONFIG: Record<ErrorLevel, { label: string; className: string }> = {
  fatal:   { label: 'Fatal',   className: 'bg-red-600 text-white border-red-600' },
  error:   { label: 'Error',   className: 'bg-orange-500 text-white border-orange-500' },
  warning: { label: 'Warning', className: 'bg-amber-500 text-white border-amber-500' },
  info:    { label: 'Info',    className: 'bg-blue-500 text-white border-blue-500' },
};

interface Props {
  level: ErrorLevel;
  className?: string;
}

export function ErrorLevelBadge({ level, className }: Props) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.error;
  return (
    <Badge
      className={cn(cfg.className, className)}
      aria-label={`Error level: ${cfg.label}`}
    >
      {cfg.label}
    </Badge>
  );
}
