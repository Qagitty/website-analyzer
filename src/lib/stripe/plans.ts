export type PlanId = 'free' | 'pro' | 'agency';

/** Credits granted when a subscription is created/updated or reset on cancellation. */
export const PLAN_CREDITS: Record<PlanId, number> = {
  free:   3,
  pro:    100,
  // Agency is "unlimited" — represented as a large sentinel value.
  // Using 99_999 (not Infinity) because it's stored as a PostgreSQL INTEGER.
  agency: 99_999,
};

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  credits: number;
  stripePriceId: string | null;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    credits: 3,
    stripePriceId: null,
    features: ['3 analyses/month', 'Basic report', 'Performance + Accessibility scores'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 29,
    credits: 100,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    features: [
      '100 analyses/month',
      'Full AI insights',
      'PDF export',
      'History & comparison',
      'Email notifications',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    price: 99,
    credits: 99_999,
    stripePriceId: process.env.STRIPE_AGENCY_PRICE_ID ?? null,
    features: ['Unlimited analyses', 'Everything in Pro', 'API access', 'Priority support'],
  },
};
