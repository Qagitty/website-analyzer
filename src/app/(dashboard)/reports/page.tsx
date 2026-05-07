import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RetryButton } from '@/components/reports/RetryButton';
import { formatDistanceToNow } from 'date-fns';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check if this user is a member of another owner's team
  const { data: membership } = await (supabase as any)
    .from('team_members')
    .select('owner_id')
    .eq('member_id', user!.id)
    .eq('status', 'active')
    .single();

  const userIds: string[] = [user!.id];
  if (membership?.owner_id) {
    userIds.push(membership.owner_id);
  }

  const { data: analyses } = await supabase
    .from('analyses')
    .select('id, url, status, lighthouse_scores, created_at, completed_at, user_id')
    .in('user_id', userIds)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reports</h1>

      {!analyses?.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center space-y-3">
          <p className="text-lg font-medium text-muted-foreground">No analyses yet</p>
          <p className="text-sm text-muted-foreground">Run your first analysis to see results here.</p>
          <a href="/analyze" className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Analyze a site →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((analysis) => (
            <Link
              key={analysis.id}
              href={analysis.status === 'completed' ? `/reports/${analysis.id}` : `/analyze/${analysis.id}`}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{analysis.url}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {(analysis as any).user_id !== user!.id && (
                      <Badge variant="outline" className="text-xs">
                        Team
                      </Badge>
                    )}
                    {analysis.lighthouse_scores != null && (
                      <span className="text-sm font-semibold">
                        {(analysis.lighthouse_scores as any).performance}/100
                      </span>
                    )}
                    <Badge
                      variant={
                        analysis.status === 'completed'
                          ? 'default'
                          : analysis.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {analysis.status}
                    </Badge>
                    {analysis.status === 'failed' && (
                      <RetryButton url={analysis.url} />
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
