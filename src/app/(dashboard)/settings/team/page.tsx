import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { TeamMembersForm } from '@/components/settings/TeamMembersForm';
import type { PlanId } from '@/lib/stripe/plans';

export const metadata: Metadata = { title: 'Settings — Team' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="bg-card border border-border rounded-xl p-6">{children}</div>
    </section>
  );
}

export default async function TeamPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: subscription }, { data: teamMembers }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('team_members')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const plan = (subscription?.plan ?? 'free') as PlanId;

  return (
    <div className="space-y-8">
      <Section title="Team Members">
        <TeamMembersForm
          isPro={plan === 'agency'}
          initialMembers={(teamMembers as any) ?? []}
          ownerEmail={user.email!}
        />
      </Section>
    </div>
  );
}
