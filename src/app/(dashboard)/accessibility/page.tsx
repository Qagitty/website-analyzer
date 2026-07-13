export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AccessibilityProfileCard, type AccessibilityProfileSummary } from '@/components/accessibility/AccessibilityProfileCard';
import { ShieldCheck, Plus } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibility profiles — WebScore',
  description: 'Manage your regional accessibility risk assessments and technical conformance evidence.',
};

export default async function AccessibilityPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profiles } = await supabase
    .from('accessibility_profiles')
    .select(`
      id, name, site_url, status,
      latest_risk_level, last_assessed_at,
      assessment_count, coverage_percent
    `)
    .eq('user_id', user.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-500" aria-hidden="true" />
            Accessibility
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Regional accessibility risk assessments and technical conformance evidence for your websites.
          </p>
        </div>
        <Button asChild>
          <Link href="/accessibility/new">
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
            New profile
          </Link>
        </Button>
      </div>

      {!profiles || profiles.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl text-muted-foreground space-y-4">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/50" aria-hidden="true" />
          <div>
            <p className="font-medium">No accessibility profiles yet</p>
            <p className="text-sm mt-1">
              Create a profile to start running accessibility risk assessments on your website.
            </p>
          </div>
          <Button asChild>
            <Link href="/accessibility/new">Create your first profile</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(profiles as AccessibilityProfileSummary[]).map((profile) => (
            <AccessibilityProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </main>
  );
}
