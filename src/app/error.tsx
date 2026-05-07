'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in development
    console.error(error);

    // Capture the error with Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center p-8 bg-[#0A0A0F]">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-2xl">
        ⚠️
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
      <Button
        onClick={reset}
        className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:opacity-90 border-0"
      >
        Try again
      </Button>
    </div>
  );
}
