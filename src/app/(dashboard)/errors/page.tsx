import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Bug, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorProjectCard } from '@/components/error-monitoring/ErrorProjectCard';
import { hasFeature, getErrorMonitoringLimits } from '@/lib/billing/limits';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Error Monitoring' };

export default async function ErrorsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: projectsData }, { data: subscription }] = await Promise.all([
    supabase
      .from('error_projects')
      .select(
        'id,name,normalized_origin,environment,status,ingestion_key_prefix,last_event_at,created_at,event_quota_monthly,retention_days',
      )
      .eq('user_id', user.id)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false }),
    supabase.from('subscriptions').select('plan').eq('user_id', user.id).single(),
  ]);

  const plan   = (subscription?.plan ?? 'free') as string;
  const limits = getErrorMonitoringLimits(plan);
  const canUse = hasFeature(plan, 'errorMonitoring');
  const projects = projectsData ?? [];
  const atLimit  = projects.length >= limits.errorMonitoringProjects;

  if (!canUse) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Error Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Capture and triage real browser errors from your websites.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
          <Bug className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <h2 className="text-lg font-semibold">Upgrade to access Error Monitoring</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Runtime Error Monitoring requires a Pro plan or higher. Capture, group, and triage
            unhandled exceptions from your users&apos; browsers.
          </p>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
            <Link href="/settings/billing">Upgrade plan</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Error Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {projects.length} of {limits.errorMonitoringProjects} project
            {limits.errorMonitoringProjects !== 1 ? 's' : ''} used
          </p>
        </div>
        <Button
          asChild
          disabled={atLimit}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          <Link href="/errors/new">
            <Plus className="h-4 w-4 mr-2" />
            New project
          </Link>
        </Button>
      </div>

      {atLimit && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Project limit reached</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your {plan} plan supports up to {limits.errorMonitoringProjects} error monitoring
              project{limits.errorMonitoringProjects !== 1 ? 's' : ''}.{' '}
              <Link href="/settings/billing" className="text-indigo-400 hover:underline">
                Upgrade to add more.
              </Link>
            </p>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bug className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              No error monitoring projects yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Monitor real browser errors from your website. Capture unhandled exceptions,
              group them into issues, and triage with your team.
            </p>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
              <Link href="/errors/new">
                <Plus className="h-4 w-4 mr-2" />
                Create your first project
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <ErrorProjectCard
              key={project.id}
              project={project as Parameters<typeof ErrorProjectCard>[0]['project']}
            />
          ))}
        </div>
      )}
    </div>
  );
}
