'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
            <p className="font-semibold text-lg capitalize">{currentPlan.name}</p>
          </div>
          <Badge variant={status === 'active' ? 'default' : 'destructive'}>
            {status}
          </Badge>
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
          <Button variant="outline" onClick={openPortal} disabled={loadingPortal} className="w-full">
            {loadingPortal ? 'Opening…' : 'Manage Billing & Invoices'}
          </Button>
        )}

        {/* Upgrade options */}
        {(plan === 'free' || plan === 'pro') && (
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-medium">
              {plan === 'free' ? 'Upgrade your plan' : 'Upgrade to Agency'}
            </p>

            {!stripeConfigured && (
              <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                Paid plans coming soon. Stripe is not yet configured.
              </div>
            )}

            {stripeConfigured && (
              <div className={`grid gap-3 ${plan === 'free' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {(plan === 'free' ? (['pro', 'agency'] as PlanId[]) : (['agency'] as PlanId[])).map((p) => (
                  <div key={p} className="rounded-lg border p-3 space-y-2">
                    <p className="font-semibold">{PLANS[p].name} — ${PLANS[p].price}/mo</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {PLANS[p].features.slice(0, 3).map((f) => (
                        <li key={f}>✓ {f}</li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={loadingUpgrade === p}
                      onClick={() => upgrade(p)}
                    >
                      {loadingUpgrade === p ? 'Redirecting…' : `Upgrade to ${PLANS[p].name}`}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
