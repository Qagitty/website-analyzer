import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { NotificationPrefs } from '@/components/settings/NotificationPrefs';
import { SubscriptionCard } from '@/components/settings/SubscriptionCard';
import { BrandingForm } from '@/components/settings/BrandingForm';
import { TeamMembersForm } from '@/components/settings/TeamMembersForm';
import { WebhooksForm } from '@/components/settings/WebhooksForm';
import { ApiKeysForm } from '@/components/settings/ApiKeysForm';
import type { PlanId } from '@/lib/stripe/plans';

export const metadata: Metadata = { title: 'Settings' };

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="bg-[#13131A] border border-white/5 rounded-xl p-6">
        {children}
      </div>
    </section>
  );
}

export default async function SettingsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: subscription }, { data: settings }, { data: teamMembers }, { data: webhooks }, { data: apiKeys }] = await Promise.all([
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
    (supabase as any)
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, requests_today, created_at, revoked_at')
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
    <div className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold text-gradient">Settings</h1>

      <SettingsSection title="Profile">
        <ProfileForm
          email={user!.email!}
          initialName={user?.user_metadata?.full_name ?? ''}
        />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <NotificationPrefs initial={notifications} />
      </SettingsSection>

      <SettingsSection title="Branding">
        <BrandingForm
          initialAgencyName={(settings as any)?.agency_name ?? ''}
          initialBrandColor={(settings as any)?.brand_color ?? '#6366f1'}
          initialShowPoweredBy={(settings as any)?.show_powered_by ?? true}
          isPro={isPro}
        />
      </SettingsSection>

      <SettingsSection title="Team Members">
        <TeamMembersForm
          isPro={plan === 'agency'}
          initialMembers={(teamMembers as any) ?? []}
          ownerEmail={user!.email!}
        />
      </SettingsSection>

      <SettingsSection title="Webhooks">
        <WebhooksForm initialWebhooks={(webhooks as any) ?? []} />
      </SettingsSection>

      <SettingsSection title="API Keys">
        <ApiKeysForm initialKeys={(apiKeys as any) ?? []} />
      </SettingsSection>

      <SettingsSection title="Subscription">
        <SubscriptionCard
          plan={plan}
          status={subscription?.status ?? 'active'}
          periodEnd={subscription?.current_period_end ?? null}
          credits={settings?.credits ?? 0}
          stripeConfigured={
            !!(process.env.STRIPE_PRO_PRICE_ID && process.env.STRIPE_AGENCY_PRICE_ID)
          }
        />
      </SettingsSection>
    </div>
  );
}
