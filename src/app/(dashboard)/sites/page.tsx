import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Globe, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConnectedSiteCard } from '@/components/connected-sites/ConnectedSiteCard';
import { toConnectedSiteViewModel } from '@/lib/connected-sites/view-models';
import { getLimits } from '@/lib/billing/limits';
import type { ConnectedSiteWithDetails } from '@/types/connected-sites';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connected Sites' };

export default async function ConnectedSitesPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: sitesData }, { data: subscription }] = await Promise.all([
    supabase
      .from('connected_sites')
      .select(
        '*, connected_site_keys(id, key_prefix, status, created_at, rotated_at, last_used_at), site_connection_status(last_seen_at, sdk_version, script_load_status, environment)'
      )
      .eq('user_id', user.id)
      .neq('verification_status', 'revoked')
      .order('created_at', { ascending: false }),
    supabase.from('subscriptions').select('plan').eq('user_id', user.id).single(),
  ]);

  const plan = (subscription?.plan ?? 'free') as 'free' | 'pro' | 'agency' | 'compliance';
  const limits = getLimits(plan);
  const sites = (sitesData ?? []) as unknown as ConnectedSiteWithDetails[];
  const siteCount = sites.length;
  const siteLimit = limits.connectedSites;
  const atLimit = siteCount >= siteLimit;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Connected Sites</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {siteCount} of {siteLimit} site{siteLimit !== 1 ? 's' : ''} used
          </p>
        </div>
        <Button
          asChild
          disabled={atLimit}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          <Link href="/sites/new">
            <Plus className="h-4 w-4 mr-2" />
            Connect site
          </Link>
        </Button>
      </div>

      {atLimit && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Site limit reached</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your {plan} plan supports up to {siteLimit} connected site
              {siteLimit !== 1 ? 's' : ''}.{' '}
              <Link href="/settings/billing" className="text-indigo-400 hover:underline">
                Upgrade to add more.
              </Link>
            </p>
          </div>
        </div>
      )}

      {sites.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              No connected sites yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Connect your website to verify ownership, collect real-user performance data,
              and power technical monitoring.
            </p>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
              <Link href="/sites/new">
                <Plus className="h-4 w-4 mr-2" />
                Connect your first site
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => (
            <ConnectedSiteCard
              key={site.id}
              site={site}
              viewModel={toConnectedSiteViewModel(site)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
