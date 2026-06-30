import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { SubscriptionCard } from '@/components/settings/SubscriptionCard';
import { PLANS, type PlanId } from '@/lib/stripe/plans';
import { Zap, CheckCircle2, ArrowRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Settings — Billing' };

export default async function BillingPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: subscription }, { data: settings }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan, status, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('user_settings')
      .select('credits, credits_used')
      .eq('user_id', user.id)
      .single(),
  ]);

  const plan = (subscription?.plan ?? 'free') as PlanId;
  const stripeConfigured = !!(
    process.env.STRIPE_PRO_PRICE_ID && process.env.STRIPE_AGENCY_PRICE_ID
  );

  const creditsUsed = settings?.credits_used ?? 0;
  const creditsTotal = PLANS[plan].credits >= 99_999 ? null : PLANS[plan].credits;

  return (
    <div className="space-y-8">
      {/* Credits usage */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Credits Usage</h2>
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              <span className="font-medium text-foreground">
                {creditsTotal === null ? 'Unlimited analyses' : `${settings?.credits ?? 0} credits remaining`}
              </span>
            </div>
            {creditsTotal !== null && (
              <span className="text-sm text-muted-foreground">
                {creditsUsed} used of {creditsTotal} this month
              </span>
            )}
          </div>

          {creditsTotal !== null && (
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-600 transition-all"
                  style={{ width: `${Math.min(100, (creditsUsed / creditsTotal) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Credits reset at the start of each billing period.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Subscription card */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Subscription</h2>
        <SubscriptionCard
          plan={plan}
          status={subscription?.status ?? 'active'}
          periodEnd={subscription?.current_period_end ?? null}
          credits={settings?.credits ?? 0}
          stripeConfigured={stripeConfigured}
        />
      </section>

      {/* Plan comparison */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Compare Plans</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {(['free', 'pro', 'agency'] as PlanId[]).map((p) => {
            const planData = PLANS[p];
            const isCurrent = p === plan;
            return (
              <div
                key={p}
                className={`bg-card border rounded-xl p-5 space-y-4 ${
                  isCurrent
                    ? 'border-orange-500/50 ring-1 ring-orange-500/20'
                    : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{planData.name}</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">
                      {planData.price === 0 ? (
                        <span>Free</span>
                      ) : (
                        <span>${planData.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></span>
                      )}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/30 text-orange-500 border border-orange-200 dark:border-orange-900/40">
                      Current
                    </span>
                  )}
                </div>
                <ul className="space-y-2">
                  {planData.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <div className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                    <span>Upgrade</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
