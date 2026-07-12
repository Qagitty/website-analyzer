import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorIssueDetail } from '@/components/error-monitoring/ErrorIssueDetail';

export const dynamic   = 'force-dynamic';
export const metadata: Metadata = { title: 'Error Issue' };

type Params = { params: Promise<{ id: string; issueId: string }> };

export default async function ErrorIssuePage(props: Params) {
  const { id, issueId } = await props.params;
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Ownership check via project
  const { data: project } = await supabase
    .from('error_projects')
    .select('id,name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!project) notFound();

  const [{ data: issue }, { data: events }, { data: activities }] = await Promise.all([
    supabase
      .from('error_issues')
      .select('*')
      .eq('id', issueId)
      .eq('error_project_id', id)
      .single(),
    supabase
      .from('error_events')
      .select(
        'id,event_type,level,message,stack_frames,breadcrumbs,page_url_sanitized,browser,device_category,environment,received_at,is_test_event',
      )
      .eq('issue_id', issueId)
      .order('received_at', { ascending: false })
      .limit(10),
    supabase
      .from('error_issue_activities')
      .select('*')
      .eq('error_issue_id', issueId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (!issue) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/errors/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <p className="text-xs text-muted-foreground">{(project as { name: string }).name}</p>
        </div>
      </div>

      <ErrorIssueDetail
        issue={issue as Parameters<typeof ErrorIssueDetail>[0]['issue']}
        recentEvents={(events ?? []) as Parameters<typeof ErrorIssueDetail>[0]['recentEvents']}
        activities={(activities ?? []) as Parameters<typeof ErrorIssueDetail>[0]['activities']}
      />
    </div>
  );
}
