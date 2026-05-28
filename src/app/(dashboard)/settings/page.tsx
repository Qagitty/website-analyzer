import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { BrandingForm } from '@/components/settings/BrandingForm';
import type { PlanId } from '@/lib/stripe/plans';

export const metadata: Metadata = { title: 'Settings — General' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="bg-card border border-border rounded-xl p-6">{children}</div>
    </section>
  );
}

export default async function SettingsGeneralPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: subscription }, { data: settings }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('user_settings')
      .select('agency_name, brand_color, show_powered_by')
      .eq('user_id', user.id)
      .single() as unknown as Promise<{ data: Record<string, any> | null }>,
  ]);

  const plan = (subscription?.plan ?? 'free') as PlanId;
  const isPro = plan === 'pro' || plan === 'agency';

  return (
    <div className="space-y-8">
      <Section title="Profile">
        <ProfileForm
          email={user.email!}
          initialName={user.user_metadata?.full_name ?? ''}
        />
      </Section>

      <Section title="Branding">
        <BrandingForm
          initialAgencyName={settings?.agency_name ?? ''}
          initialBrandColor={settings?.brand_color ?? '#6366f1'}
          initialShowPoweredBy={settings?.show_powered_by ?? true}
          isPro={isPro}
        />
      </Section>
    </div>
  );
}
