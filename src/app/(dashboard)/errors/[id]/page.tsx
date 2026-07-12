import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorProjectDetail } from '@/components/error-monitoring/ErrorProjectDetail';

export const dynamic   = 'force-dynamic';
export const metadata: Metadata = { title: 'Error Project' };

type Params = { params: Promise<{ id: string }> };

export default async function ErrorProjectPage(props: Params) {
  const { id } = await props.params;
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: project }, { data: issuesData, count }] = await Promise.all([
    supabase
      .from('error_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('error_issues')
      .select('id,title,level,status,event_count,first_seen_at,last_seen_at', { count: 'exact' })
      .eq('error_project_id', id)
      .eq('user_id', user.id)
      .order('last_seen_at', { ascending: false })
      .limit(25),
  ]);

  if (!project) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/errors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gradient">{project.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{project.normalized_origin}</p>
        </div>
      </div>

      <ErrorProjectDetail
        project={project as Parameters<typeof ErrorProjectDetail>[0]['project']}
        issues={(issuesData ?? []) as Parameters<typeof ErrorProjectDetail>[0]['issues']}
        total={count ?? 0}
      />
    </div>
  );
}
