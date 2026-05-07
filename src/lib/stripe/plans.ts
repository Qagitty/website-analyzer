export type PlanId = 'free' | 'pro' | 'agency';

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
    credits: 99999,
    stripePriceId: process.env.STRIPE_AGENCY_PRICE_ID ?? null,
    features: ['Unlimited analyses', 'Everything in Pro', 'API access', 'Priority support'],
  },
};
