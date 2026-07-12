import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Wrench, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FixRequestCard } from '@/components/fix-requests/FixRequestCard';
import { getFeatures } from '@/lib/billing/limits';
import type { FixRequestStatus, FixRequestSeverity, FixRequestType } from '@/types/fix-request';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Fix Requests' };

interface SearchParams {
  status?: string;
}

export default async function FixRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: subscription }, { data: requestsData }] = await Promise.all([
    supabase.from('subscriptions').select('plan').eq('user_id', user.id).single(),
    supabase
      .from('fix_requests')
      .select('id, request_type, status, severity, title, summary, source_type, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const plan = (subscription?.plan ?? 'free') as 'free' | 'pro' | 'agency' | 'compliance';
  const features = getFeatures(plan);
  const hasAccess = features.fixRequests;

  let requests = requestsData ?? [];

  // Filter by status tab
  const statusFilter = sp.status;
  const activeTab = statusFilter ?? 'all';

  if (statusFilter && statusFilter !== 'all') {
    const tabStatusMap: Record<string, FixRequestStatus[]> = {
      draft:  ['draft', 'ready'],
      active: ['sending', 'sent', 'delivered', 'acknowledged', 'in_review', 'accepted', 'in_progress', 'waiting_for_information', 'fix_submitted', 'verification_required', 'verified'],
      closed: ['closed', 'cancelled', 'declined', 'delivery_failed'],
    };
    const allowed = tabStatusMap[statusFilter] ?? [];
    requests = requests.filter((r) => allowed.includes(r.status as FixRequestStatus));
  }

  const TAB_LINKS = [
    { key: 'all',    label: 'All' },
    { key: 'draft',  label: 'Draft' },
    { key: 'active', label: 'Active' },
    { key: 'closed', label: 'Closed' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Fix Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track and manage developer fix requests
          </p>
        </div>
        {hasAccess && (
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
            <Link href="/fix-requests/new">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Link>
          </Button>
        )}
      </div>

      {!hasAccess ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Pro plan required</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fix Requests require a Pro plan or higher.{' '}
              <Link href="/settings/billing" className="text-indigo-400 hover:underline">
                Upgrade now
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Status tabs */}
          <div className="flex gap-1 border-b border-border pb-0">
            {TAB_LINKS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.key === 'all' ? '/fix-requests' : `/fix-requests?status=${tab.key}`}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {requests.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  No fix requests yet
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Create a fix request to track and communicate developer tasks derived from your
                  analysis findings.
                </p>
                <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                  <Link href="/fix-requests/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first request
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <FixRequestCard
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  status={r.status as FixRequestStatus}
                  severity={r.severity as FixRequestSeverity}
                  request_type={r.request_type as FixRequestType}
                  created_at={r.created_at}
                  summary={r.summary}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
