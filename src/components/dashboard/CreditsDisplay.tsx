import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CreditsDisplayProps {
  credits: number;
}

export function CreditsDisplay({ credits }: CreditsDisplayProps) {
  const isEmpty = credits === 0;
  const isLow = credits > 0 && credits <= 1;

  return (
    <div className="px-3 py-2">
      <div
        className={cn(
          'rounded-md px-3 py-2 text-xs font-medium',
          isEmpty
            ? 'bg-red-100 text-red-700'
            : isLow
            ? 'bg-amber-100 text-amber-700'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span>Credits left</span>
          <span className="font-bold text-sm">{isEmpty ? '0' : credits}</span>
        </div>
        {isEmpty && (
          <Link
            href="/settings"
            className="mt-1 block text-center underline underline-offset-2 hover:no-underline"
          >
            Upgrade to get more
          </Link>
        )}
        {isLow && (
          <p className="mt-0.5">Only {credits} left — consider upgrading</p>
        )}
      </div>
    </div>
  );
}
