import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SiteOverview } from '@/components/connected-sites/SiteOverview';
import { InstallationPanel } from '@/components/connected-sites/installation/InstallationPanel';
import { WebVitalsSummary } from '@/components/connected-sites/telemetry/WebVitalsSummary';
import { ObservedRoutesTable } from '@/components/connected-sites/routes/ObservedRoutesTable';
import { IndexingOverview } from '@/components/connected-sites/indexing/IndexingOverview';
import { ConnectedSiteSettingsForm } from '@/components/connected-sites/settings/ConnectedSiteSettingsForm';
import { SiteKeyManagement } from '@/components/connected-sites/settings/SiteKeyManagement';
import { ConnectedSiteStatusBadge } from '@/components/connected-sites/ConnectedSiteStatusBadge';
import { getLimits, getFeatures } from '@/lib/billing/limits';
import type { ConnectedSiteWithDetails } from '@/types/connected-sites';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('connected_sites')
    .select('name')
    .eq('id', params.id)
    .single();
  return { title: data?.name ? `${data.name} — Connected Sites` : 'Connected Site' };
}

export default async function ConnectedSiteDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: siteData }, { data: subscription }] = await Promise.all([
    supabase
      .from('connected_sites')
      .select(
        '*, connected_site_keys(id, key_prefix, status, created_at, rotated_at, last_used_at), site_connection_status(last_seen_at, sdk_version, script_load_status, environment)'
      )
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single(),
    supabase.from('subscriptions').select('plan').eq('user_id', user.id).single(),
  ]);

  if (!siteData) notFound();

  const site = siteData as unknown as ConnectedSiteWithDetails;
  const plan = (subscription?.plan ?? 'free') as 'free' | 'pro' | 'agency' | 'compliance';
  const features = getFeatures(plan);
  const limits = getLimits(plan);

  const planHasRouteDiscovery = features.siteRouteDiscovery;
  const planHasIndexing = features.siteIndexingDiagnostics;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sites">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Sites
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">{site.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{site.normalized_origin}</p>
        </div>
        <ConnectedSiteStatusBadge status={site.verification_status} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="installation">Installation</TabsTrigger>
          <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="indexing">Indexing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <SiteOverview site={site} />
        </TabsContent>

        <TabsContent value="installation" className="mt-4">
          <InstallationPanel site={site} />
        </TabsContent>

        <TabsContent value="telemetry" className="mt-4">
          <WebVitalsSummary siteId={site.id} />
        </TabsContent>

        <TabsContent value="routes" className="mt-4">
          <ObservedRoutesTable
            siteId={site.id}
            planHasRouteDiscovery={planHasRouteDiscovery}
          />
        </TabsContent>

        <TabsContent value="indexing" className="mt-4">
          <IndexingOverview siteId={site.id} planHasIndexing={planHasIndexing} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="space-y-6">
            <ConnectedSiteSettingsForm site={site} planHasIndexing={planHasIndexing} />
            <div className="border-t border-border/50 pt-6">
              <h3 className="text-base font-semibold mb-4">Key management</h3>
              <SiteKeyManagement
                siteId={site.id}
                keys={site.connected_site_keys ?? []}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
