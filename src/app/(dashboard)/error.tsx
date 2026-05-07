'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center p-8">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-xl">
        ⚠️
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          {error.message || 'An unexpected error occurred.'}
        </p>
      </div>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={reset}
          className="border-white/10 text-foreground hover:bg-white/5"
        >
          Try again
        </Button>
        <Button
          asChild
          className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:opacity-90 border-0"
        >
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
