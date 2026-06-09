import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { PLAN_CREDITS } from '@/lib/stripe/plans';

/**
 * GET /api/cron/reset-credits
 * Called by Vercel Cron at midnight on the 1st of each month (see vercel.json).
 *
 * Resets credits for all free-tier users back to PLAN_CREDITS.free (3).
 * Paid users are handled by Stripe's customer.subscription.updated webhook,
 * which fires when each billing period renews — this cron only covers the gap
 * for users who have no Stripe subscription at all.
 *
 * Batches resets in pages of 500 to stay within Supabase query limits.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const FREE_CREDITS = PLAN_CREDITS.free;
  const PAGE_SIZE = 500;

  let resetCount = 0;
  let page = 0;

  while (true) {
    // Fetch a page of free-tier user IDs from subscriptions.
    // Using range-based pagination (offset + limit) is safe here because the
    // table is stable for the duration of this cron tick.
    const { data: freeUsers, error: fetchError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('plan', 'free')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (fetchError) {
      console.error('[cron/reset-credits] fetch error:', fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!freeUsers?.length) break;

    const userIds = freeUsers.map((r) => r.user_id);

    const { error: updateError } = await supabase
      .from('user_settings')
      .update({ credits: FREE_CREDITS })
      .in('user_id', userIds);

    if (updateError) {
      console.error('[cron/reset-credits] update error:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    resetCount += userIds.length;

    // Fewer than PAGE_SIZE rows → last page
    if (freeUsers.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`[cron/reset-credits] reset credits to ${FREE_CREDITS} for ${resetCount} free-tier users`);
  return NextResponse.json({ reset: resetCount, creditsPerUser: FREE_CREDITS });
}
