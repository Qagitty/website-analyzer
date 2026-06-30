import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature } from '@/lib/billing/limits';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PlanId } from '@/lib/stripe/plans';

export const metadata: Metadata = { title: 'Widget Leads' };

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  running:   'secondary',
  queued:    'secondary',
  pending:   'outline',
  failed:    'destructive',
};

export default async function LeadsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: subscription } = await supabase
    .from('subscriptions').select('plan').eq('user_id', user.id).single();
  const plan = (subscription?.plan ?? 'free') as PlanId;
  const canUseWidget = hasFeature(plan, 'leadWidget');

  // Fetch widget leads (source = 'widget') for this user
  const { data: leads } = await (supabase
    .from('analyses') as any)
    .select('id, url, status, lead_email, lead_name, completed_at, created_at, error_message')
    .eq('user_id', user.id)
    .eq('source', 'widget')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (leads ?? []) as Array<{
    id: string;
    url: string;
    status: string;
    lead_email: string | null;
    lead_name:  string | null;
    completed_at: string | null;
    created_at:   string;
    error_message: string | null;
  }>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Widget Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Website audit requests submitted through your embedded widget.
          </p>
        </div>
        {canUseWidget && (
          <Link href="/settings">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              ⚙️ Configure Widget
            </Button>
          </Link>
        )}
      </div>

      {/* Gate */}
      {!canUseWidget ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="text-4xl">📡</div>
            <h2 className="text-lg font-semibold">Lead Widget is an Agency Feature</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Upgrade to Agency to embed a lead-capture widget on any website.
              Visitors submit their URL, you get the analysis and the contact.
            </p>
            <Link href="/settings">
              <Button className="mt-1 bg-orange-600 text-white">
                Upgrade to Agency →
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="text-4xl">🎯</div>
            <h2 className="text-lg font-semibold">No leads yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Once visitors submit your embedded widget, their audit requests will appear here.
            </p>
            <Link href="/settings">
              <Button variant="outline" size="sm" className="text-xs">
                Get your embed code →
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total leads',    value: rows.length },
              { label: 'Completed',      value: rows.filter((r) => r.status === 'completed').length },
              { label: 'With email',     value: rows.filter((r) => r.lead_email).length },
              { label: 'In progress',    value: rows.filter((r) => ['queued','running','pending'].includes(r.status)).length },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold text-gradient">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Leads table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background/60">
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">URL</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Lead</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Date</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <span
                            className="text-sm font-medium max-w-[200px] truncate block"
                            title={row.url}
                          >
                            {new URL(row.url).hostname}
                          </span>
                          <span className="text-xs text-muted-foreground/60 max-w-[200px] truncate block">
                            {row.url}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.lead_name && (
                            <p className="text-sm font-medium">{row.lead_name}</p>
                          )}
                          {row.lead_email ? (
                            <a
                              href={`mailto:${row.lead_email}`}
                              className="text-xs text-orange-500 hover:underline"
                            >
                              {row.lead_email}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">No email</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[row.status] ?? 'outline'} className="text-xs">
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {row.status === 'completed' && (
                            <Link
                              href={`/reports/${row.id}`}
                              className="text-xs text-orange-500 hover:underline whitespace-nowrap"
                            >
                              View report →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
