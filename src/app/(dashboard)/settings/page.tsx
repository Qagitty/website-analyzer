import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { NotificationPrefs } from '@/components/settings/NotificationPrefs';
import { SubscriptionCard } from '@/components/settings/SubscriptionCard';
import { BrandingForm } from '@/components/settings/BrandingForm';
import { TeamMembersForm } from '@/components/settings/TeamMembersForm';
import { WebhooksForm } from '@/components/settings/WebhooksForm';
import type { PlanId } from '@/lib/stripe/plans';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: subscription }, { data: settings }, { data: teamMembers }, { data: webhooks }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', user!.id)
      .single(),
    supabase
      .from('user_settings')
      .select('credits, notifications, agency_name, brand_color, show_powered_by')
      .eq('user_id', user!.id)
      .single() as unknown as Promise<{ data: Record<string, any> | null }>,
    (supabase as any)
      .from('team_members')
      .select('*')
      .eq('owner_id', user!.id)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('webhooks')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
  ]);

  const notifications = (settings?.notifications as any) ?? {
    email_on_complete: true,
    email_on_fail: true,
    weekly_digest: false,
  };

  const plan = (subscription?.plan ?? 'free') as PlanId;
  const isPro = plan === 'pro' || plan === 'agency';

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <ProfileForm
        email={user!.email!}
        initialName={user?.user_metadata?.full_name ?? ''}
      />

      <NotificationPrefs initial={notifications} />

      <BrandingForm
        initialAgencyName={(settings as any)?.agency_name ?? ''}
        initialBrandColor={(settings as any)?.brand_color ?? '#6366f1'}
        initialShowPoweredBy={(settings as any)?.show_powered_by ?? true}
        isPro={isPro}
      />

      <TeamMembersForm
        isPro={plan === 'agency'}
        initialMembers={(teamMembers as any) ?? []}
        ownerEmail={user!.email!}
      />

      <WebhooksForm initialWebhooks={(webhooks as any) ?? []} />

      <SubscriptionCard
        plan={plan}
        status={subscription?.status ?? 'active'}
        periodEnd={subscription?.current_period_end ?? null}
        credits={settings?.credits ?? 0}
        stripeConfigured={
          !!(process.env.STRIPE_PRO_PRICE_ID && process.env.STRIPE_AGENCY_PRICE_ID)
        }
      />
    </div>
  );
}
