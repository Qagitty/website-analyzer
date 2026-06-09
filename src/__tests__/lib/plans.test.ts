import { describe, it, expect } from 'vitest';
import { PLANS } from '@/lib/stripe/plans';
import type { PlanId } from '@/lib/stripe/plans';

const ALL_PLANS: PlanId[] = ['free', 'pro', 'agency', 'compliance'];

describe('PLANS data integrity', () => {
  it('defines exactly four plans', () => {
    expect(Object.keys(PLANS)).toHaveLength(4);
    expect(Object.keys(PLANS)).toEqual(expect.arrayContaining(ALL_PLANS));
  });

  it.each(ALL_PLANS)('%s plan has required fields', (planId) => {
    const plan = PLANS[planId];
    expect(plan.id).toBe(planId);
    expect(typeof plan.name).toBe('string');
    expect(plan.name.length).toBeGreaterThan(0);
    expect(typeof plan.price).toBe('number');
    expect(plan.price).toBeGreaterThanOrEqual(0);
    expect(typeof plan.credits).toBe('number');
    expect(plan.credits).toBeGreaterThan(0);
    expect(Array.isArray(plan.features)).toBe(true);
    expect(plan.features.length).toBeGreaterThan(0);
  });

  describe('free plan', () => {
    const plan = PLANS.free;

    it('is free (price = 0)', () => {
      expect(plan.price).toBe(0);
    });

    it('has 3 credits', () => {
      expect(plan.credits).toBe(3);
    });

    it('has no Stripe price ID', () => {
      expect(plan.stripePriceId).toBeNull();
    });
  });

  describe('pro plan', () => {
    const plan = PLANS.pro;

    it('costs $29', () => {
      expect(plan.price).toBe(29);
    });

    it('has 100 credits', () => {
      expect(plan.credits).toBe(100);
    });

    it('has more credits than free', () => {
      expect(plan.credits).toBeGreaterThan(PLANS.free.credits);
    });

    it('includes PDF export in features', () => {
      expect(plan.features.some((f) => f.toLowerCase().includes('pdf'))).toBe(true);
    });
  });

  describe('agency plan', () => {
    const plan = PLANS.agency;

    it('costs $99', () => {
      expect(plan.price).toBe(99);
    });

    it('has more credits than pro', () => {
      expect(plan.credits).toBeGreaterThan(PLANS.pro.credits);
    });

    it('includes API access in features', () => {
      expect(plan.features.some((f) => f.toLowerCase().includes('api'))).toBe(true);
    });

    it('credits represent unlimited (>= 99999)', () => {
      expect(plan.credits).toBeGreaterThanOrEqual(99999);
    });
  });

  describe('compliance plan', () => {
    const plan = PLANS.compliance;

    it('costs $249', () => {
      expect(plan.price).toBe(249);
    });

    it('has unlimited credits (>= 99999)', () => {
      expect(plan.credits).toBeGreaterThanOrEqual(99999);
    });

    it('is more expensive than agency', () => {
      expect(plan.price).toBeGreaterThan(PLANS.agency.price);
    });
  });

  describe('plan ordering', () => {
    it('plans are ordered free < pro < agency < compliance by price', () => {
      expect(PLANS.free.price).toBeLessThan(PLANS.pro.price);
      expect(PLANS.pro.price).toBeLessThan(PLANS.agency.price);
      expect(PLANS.agency.price).toBeLessThan(PLANS.compliance.price);
    });

    it('plans are ordered free < pro < agency by credits', () => {
      expect(PLANS.free.credits).toBeLessThan(PLANS.pro.credits);
      expect(PLANS.pro.credits).toBeLessThan(PLANS.agency.credits);
    });
  });
});
