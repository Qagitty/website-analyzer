export type PlanId = 'free' | 'pro' | 'agency' | 'compliance';

/** Credits granted when a subscription is created/updated or reset on cancellation. */
export const PLAN_CREDITS: Record<PlanId, number> = {
  free:       3,
  pro:        100,
  // Agency / Compliance are "unlimited" — large sentinel value stored as PostgreSQL INTEGER.
  agency:     99_999,
  compliance: 99_999,
};

/** Numeric rank used to check minimum plan requirements (higher = more features). */
export const PLAN_RANK: Record<PlanId | string, number> = {
  free:       0,
  pro:        1,
  agency:     2,
  compliance: 3,
};

/** Returns true when `userPlan` meets or exceeds `requiredPlan`. */
export function planAtLeast(userPlan: string, requiredPlan: PlanId): boolean {
  return (PLAN_RANK[userPlan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0);
}

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  credits: number;
  stripePriceId: string | null;
  description: string;
  features: string[];
  notIncluded?: string[];  // Shown as locked items on pricing cards
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    credits: 3,
    stripePriceId: null,
    description: 'Try the product. No credit card required.',
    features: [
      '3 audits/month',
      'Performance, SEO & accessibility scores',
      'AI-readiness score',
      'Basic AI recommendations',
      'Fix roadmap (top issues)',
    ],
    notIncluded: [
      'PDF export',
      'Website monitoring',
      'Remediation board',
      'API access',
      'Webhooks',
      'Team members',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 29,
    credits: 100,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    description: 'For freelancers and small business owners.',
    features: [
      '100 audits/month',
      'Everything in Free',
      'PDF export',
      'Full fix roadmap',
      'Before/after comparison',
      'Multi-page crawl (up to 10 pages)',
      '1 competitor comparison',
      'Website monitoring (up to 5 sites)',
      'Remediation board',
      'Email alerts',
      'Public report sharing',
    ],
    notIncluded: [
      'API access',
      'Webhooks',
      'Team members',
      'White-label PDF',
      'Compliance PDF',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    price: 99,
    credits: 99_999,
    stripePriceId: process.env.STRIPE_AGENCY_PRICE_ID ?? null,
    description: 'For web studios and small agencies.',
    features: [
      'Unlimited audits (fair use)',
      'Everything in Pro',
      'White-label PDF reports',
      '3 competitor comparisons',
      'Multi-page crawl (up to 50 pages)',
      'Team members (up to 10)',
      'API access (1,000 req/day)',
      'Webhooks',
      'Website monitoring (up to 50 sites)',
      'Client-ready reports',
      'Priority support',
    ],
  },
  compliance: {
    id: 'compliance',
    name: 'Compliance',
    price: 249,
    credits: 99_999,
    stripePriceId: process.env.STRIPE_COMPLIANCE_PRICE_ID ?? null,
    description: 'For businesses that need accessibility compliance tracking.',
    features: [
      'Unlimited audits (fair use)',
      'Everything in Agency',
      'Compliance readiness PDF',
      'Full WCAG 2.1 AA automated checks',
      'Remediation audit trail',
      'Issue lifecycle tracking',
      'Scheduled compliance audits',
      'Historical evidence & reporting',
      'Dedicated compliance support',
    ],
  },
};
