import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { NotificationPrefs } from '@/components/settings/NotificationPrefs';
import { SubscriptionCard } from '@/components/settings/SubscriptionCard';
import type { PlanId } from '@/lib/stripe/plans';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: subscription }, { data: settings }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', user!.id)
      .single(),
    supabase
      .from('user_settings')
      .select('credits, notifications')
      .eq('user_id', user!.id)
      .single(),
  ]);

  const notifications = (settings?.notifications as any) ?? {
    email_on_complete: true,
    email_on_fail: true,
    weekly_digest: false,
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <ProfileForm
        email={user!.email!}
        initialName={user?.user_metadata?.full_name ?? ''}
      />

      <NotificationPrefs initial={notifications} />

      <SubscriptionCard
        plan={(subscription?.plan ?? 'free') as PlanId}
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
