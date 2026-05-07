import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CreditsDisplayProps {
  credits: number;
}

export function CreditsDisplay({ credits }: CreditsDisplayProps) {
  const isEmpty = credits === 0;
  const isLow = credits > 0 && credits <= 1;
  const isMid = credits >= 2 && credits <= 5;

  const valueClass = cn(
    'font-bold text-sm',
    isEmpty  ? 'text-red-400'
    : isLow  ? 'text-red-400'
    : isMid  ? 'text-amber-400'
    : 'text-emerald-400'
  );

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-xs font-medium">
        <span className="text-muted-foreground">Credits left</span>
        <span className={valueClass}>{credits}</span>
      </div>
      {isEmpty && (
        <Link
          href="/settings"
          className="mt-1 block text-center text-xs text-indigo-400 hover:text-indigo-300"
        >
          Upgrade to get more
        </Link>
      )}
      {isLow && !isEmpty && (
        <p className="mt-0.5 text-xs text-amber-400">Only {credits} left — consider upgrading</p>
      )}
    </div>
  );
}
