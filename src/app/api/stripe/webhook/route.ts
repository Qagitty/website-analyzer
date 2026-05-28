import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { PLAN_CREDITS } from '@/lib/stripe/plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const plan = (sub.metadata.plan ?? 'pro') as string;

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (subscription) {
        await supabase
          .from('subscriptions')
          .update({
            plan,
            status: sub.status,
            stripe_subscription_id: sub.id,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          .eq('stripe_customer_id', customerId);

        await supabase
          .from('user_settings')
          .update({ credits: PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] ?? PLAN_CREDITS.pro })
          .eq('user_id', subscription.user_id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const { data: canceled } = await supabase
        .from('subscriptions')
        .update({ plan: 'free', status: 'canceled' })
        .eq('stripe_subscription_id', sub.id)
        .select('user_id')
        .single();

      // Reset credits to free tier — user kept paid credits after cancellation otherwise
      if (canceled?.user_id) {
        await supabase
          .from('user_settings')
          .update({ credits: PLAN_CREDITS.free })
          .eq('user_id', canceled.user_id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
