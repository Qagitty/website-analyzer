import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { RecentAnalyses } from '@/components/dashboard/RecentAnalyses';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { OnboardingBanner } from '@/components/dashboard/OnboardingBanner';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: analyses }, { data: settings }] = await Promise.all([
    supabase
      .from('analyses')
      .select('id, url, status, lighthouse_scores, created_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('user_settings')
      .select('credits, credits_used')
      .eq('user_id', user!.id)
      .single(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <OnboardingBanner analysisCount={analyses?.length ?? 0} />
      <StatsOverview analyses={analyses ?? []} settings={settings} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentAnalyses analyses={analyses ?? []} />
        </div>
        <QuickActions credits={settings?.credits ?? 0} />
      </div>
    </div>
  );
}
