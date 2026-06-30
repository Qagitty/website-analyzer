'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { CompetitorComparisonSection, type ComparisonAnalysis } from '@/components/reports/CompetitorComparisonSection';

interface ComparisonResponse {
  id:        string;
  createdAt: string;
  analyses:  ComparisonAnalysis[];
  allDone:   boolean;
  anyFailed: boolean;
}

const POLL_INTERVAL_MS = 4_000;

export default function CompareResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [data, setData]       = useState<ComparisonResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [polling, setPolling] = useState(true);

  const fetchComparison = useCallback(async () => {
    try {
      const res = await fetch(`/api/compare/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Comparison not found.');
          setPolling(false);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json: ComparisonResponse = await res.json();
      setData(json);
      if (json.allDone) setPolling(false);
    } catch (err) {
      console.error('[compare page] fetch failed:', err);
    }
  }, [id]);

  // Initial fetch + polling
  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(fetchComparison, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [polling, fetchComparison]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Back + refresh header */}
      <div className="flex items-center justify-between">
        <Link href="/analyze/compare">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            New comparison
          </Button>
        </Link>

        {data && !data.allDone && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Auto-refreshing every {POLL_INTERVAL_MS / 1000}s…
          </span>
        )}

        {data?.allDone && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={fetchComparison}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        )}
      </div>

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gradient">
          {data ? `Comparing ${data.analyses.length} Sites` : 'Loading Comparison…'}
        </h1>
        {data?.createdAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Started {new Date(data.createdAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-medium">{error}</p>
          <Link href="/analyze/compare" className="mt-3 inline-block text-sm text-orange-500 hover:underline">
            Start a new comparison →
          </Link>
        </div>
      )}

      {/* Loading skeleton */}
      {!data && !error && (
        <div className="space-y-4">
          <div className="animate-pulse h-40 bg-card border border-border rounded-xl" />
          <div className="animate-pulse h-64 bg-card border border-border rounded-xl" />
        </div>
      )}

      {/* Main section */}
      {data && (
        <CompetitorComparisonSection
          analyses={data.analyses}
          allDone={data.allDone}
          anyFailed={data.anyFailed}
        />
      )}

      {/* Individual report links (when done) */}
      {data?.allDone && (
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-2">View individual reports:</p>
          <div className="flex flex-wrap gap-2">
            {data.analyses
              .filter((a) => a.status === 'completed')
              .map((a) => (
                <Link
                  key={a.id}
                  href={`/reports/${a.id}`}
                  className="text-xs text-orange-500 hover:underline"
                >
                  {a.label} →
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
