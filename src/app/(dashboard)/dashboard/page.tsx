'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { RecentAnalyses } from '@/components/dashboard/RecentAnalyses';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { OnboardingBanner } from '@/components/dashboard/OnboardingBanner';
import { Skeleton } from '@/components/ui/skeleton';

// ── Inline skeleton — mirrors loading.tsx so the transition is seamless ───────
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export default function DashboardPage() {
  const [analyses, setAnalyses]   = useState<any[]>([]);
  const [settings, setSettings]   = useState<{ credits: number; credits_used: number } | null>(null);
  const [loading, setLoading]     = useState(true);
  const [dataError, setDataError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createBrowserClient();

        // Auth — browser client reads the session cookie automatically
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = '/login'; return; }

        const [analysesRes, settingsRes] = await Promise.all([
          supabase
            .from('analyses')
            .select('id, url, status, lighthouse_scores, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('user_settings')
            .select('credits, credits_used')
            .eq('user_id', user.id)
            .single(),
        ]);

        if (cancelled) return;

        if (analysesRes.error || settingsRes.error) {
          setDataError(true);
        } else {
          setAnalyses(analysesRes.data ?? []);
          setSettings(settingsRes.data ?? null);
        }
      } catch {
        if (!cancelled) setDataError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>

      {dataError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Could not load your data — the database may be temporarily unavailable. Try refreshing.
        </div>
      )}

      <OnboardingBanner analysisCount={analyses.length} />
      <StatsOverview analyses={analyses} settings={settings} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentAnalyses analyses={analyses} />
        </div>
        <QuickActions credits={settings?.credits ?? 0} />
      </div>
    </div>
  );
}
