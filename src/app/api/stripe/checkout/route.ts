import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { PLANS, type PlanId } from '@/lib/stripe/plans';
import { z } from 'zod';

const schema = z.object({
  plan: z.enum(['pro', 'agency', 'compliance']),
});

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const plan = PLANS[parsed.data.plan as PlanId];
  if (!plan.stripePriceId) {
    return NextResponse.json({ error: 'Plan not configured' }, { status: 500 });
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: subscription?.stripe_customer_id ?? undefined,
    customer_email: !subscription?.stripe_customer_id ? user.email : undefined,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    metadata: { userId: user.id, plan: parsed.data.plan },
    subscription_data: { metadata: { userId: user.id, plan: parsed.data.plan } },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
