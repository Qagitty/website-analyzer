'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  analysisCount: number;
}

export function OnboardingBanner({ analysisCount }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Only show if user has never run an analysis
  if (analysisCount > 0 || dismissed) return null;

  return (
    <div className="relative rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-900 pl-5 pr-10 py-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="text-3xl">🚀</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Welcome to WebAnalyzer!</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Analyze your first website to get a performance, accessibility, and AI insights report — takes about 30 seconds.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <a href="/analyze">Analyze a site →</a>
        </Button>
      </div>
    </div>
  );
}
