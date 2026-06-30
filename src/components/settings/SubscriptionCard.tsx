'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PLANS, type PlanId } from '@/lib/stripe/plans';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  plan: PlanId;
  status: string;
  periodEnd: string | null;
  credits: number;
  stripeConfigured: boolean;
}

export function SubscriptionCard({ plan, status, periodEnd, credits, stripeConfigured }: Props) {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingUpgrade, setLoadingUpgrade] = useState<PlanId | null>(null);

  const currentPlan = PLANS[plan];

  const openPortal = async () => {
    setLoadingPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message ?? 'Could not open billing portal');
    } finally {
      setLoadingPortal(false);
    }
  };

  const upgrade = async (targetPlan: PlanId) => {
    setLoadingUpgrade(targetPlan);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message ?? 'Could not start checkout');
    } finally {
      setLoadingUpgrade(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Current plan summary */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="font-semibold text-lg capitalize">{currentPlan.name}</p>
              {(() => {
                const base = 'text-xs font-medium px-2.5 py-0.5 rounded-full';
                if (plan === 'compliance') return <span className={`${base} bg-emerald-500/10 text-emerald-300 border border-emerald-500/20`}>{plan}</span>;
                if (plan === 'agency')     return <span className={`${base} bg-orange-50 dark:bg-orange-950/30 text-orange-400 border border-orange-200 dark:border-orange-900/40`}>{plan}</span>;
                if (plan === 'pro')        return <span className={`${base} bg-orange-50 dark:bg-orange-950/30 text-orange-400 border border-orange-200 dark:border-orange-900/40`}>{plan}</span>;
                return <span className={`${base} bg-secondary text-muted-foreground border border-border`}>{plan}</span>;
              })()}
            </div>
          </div>
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
            status === 'active'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Credits remaining</p>
            <p className="font-medium">{credits}</p>
          </div>
          {periodEnd && (
            <div>
              <p className="text-muted-foreground">
                {status === 'canceled' ? 'Access until' : 'Renews on'}
              </p>
              <p className="font-medium">{format(new Date(periodEnd), 'MMM d, yyyy')}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">Analyses per month</p>
            <p className="font-medium">
              {currentPlan.credits >= 99999 ? 'Unlimited' : currentPlan.credits}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Price</p>
            <p className="font-medium">
              {currentPlan.price === 0 ? 'Free' : `$${currentPlan.price}/mo`}
            </p>
          </div>
        </div>

        {/* Billing portal for paid users */}
        {plan !== 'free' && (
          <Button
            variant="outline"
            onClick={openPortal}
            disabled={loadingPortal}
            className="w-full border border-orange-300 dark:border-orange-900/50 text-orange-400 bg-transparent hover:bg-orange-50 dark:bg-orange-950/30"
          >
            {loadingPortal ? 'Opening…' : 'Manage Billing & Invoices'}
          </Button>
        )}

        {/* Upgrade options — show next logical tiers */}
        {plan !== 'compliance' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm font-medium">
              {plan === 'free'   ? 'Upgrade your plan'         :
               plan === 'pro'   ? 'Upgrade to Agency or Compliance' :
                                  'Upgrade to Compliance'}
            </p>

            {!stripeConfigured && (
              <div className="rounded-lg border border-border border-dashed p-3 text-center text-sm text-muted-foreground">
                Paid plans coming soon. Stripe is not yet configured.
              </div>
            )}

            {stripeConfigured && (
              <div className="grid gap-3 grid-cols-1">
                {(
                  plan === 'free'   ? (['pro', 'agency', 'compliance'] as PlanId[]) :
                  plan === 'pro'    ? (['agency', 'compliance']         as PlanId[]) :
                                     (['compliance']                    as PlanId[])
                ).map((p) => {
                  const isCompliance = p === 'compliance';
                  return (
                    <div key={p} className={`rounded-lg border p-3 space-y-2 ${isCompliance ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card'}`}>
                      <p className={`font-semibold ${isCompliance ? 'text-emerald-300' : ''}`}>
                        {PLANS[p].name} — ${PLANS[p].price}/mo
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {PLANS[p].features.slice(0, 3).map((f) => (
                          <li key={f}>✓ {f}</li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        className={`w-full text-white ${
                          isCompliance
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                            : 'bg-orange-600 hover:from-orange-400 hover:to-orange-400'
                        }`}
                        disabled={loadingUpgrade === p}
                        onClick={() => upgrade(p)}
                      >
                        {loadingUpgrade === p ? 'Redirecting…' : `Upgrade to ${PLANS[p].name}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
