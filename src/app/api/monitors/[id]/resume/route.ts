import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature, getLimits } from '@/lib/billing/limits';
import { calculateNextRun, scheduleFromLegacyFrequency } from '@/lib/monitoring/schedule';
import type { MonitorSchedule } from '@/lib/monitoring/types';

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check plan allows monitors
  const { data: sub } = await supabase.from('subscriptions').select('plan').eq('user_id', user.id).single();
  const plan = sub?.plan ?? 'free';
  if (!hasFeature(plan, 'monitoring')) {
    return NextResponse.json({ error: 'Monitoring requires a Pro plan or higher.' }, { status: 403 });
  }

  // Count active monitors to enforce plan limit
  const { count } = await supabase.from('monitors')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .or('is_active.eq.true,status.eq.active');
  if ((count ?? 0) >= getLimits(plan).monitors) {
    return NextResponse.json({ error: `Your plan allows up to ${getLimits(plan).monitors} active monitors.` }, { status: 402 });
  }

  // Fetch current monitor to compute next_run_at
  const { data: monitor } = await supabase.from('monitors')
    .select('schedule, frequency')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  let schedule: MonitorSchedule;
  if (monitor.schedule && typeof monitor.schedule === 'object') {
    schedule = monitor.schedule as MonitorSchedule;
  } else {
    schedule = scheduleFromLegacyFrequency((monitor.frequency as 'daily' | 'weekly') ?? 'weekly', 'UTC');
  }
  const nextRunAt = calculateNextRun(schedule, new Date());

  const { data, error } = await supabase
    .from('monitors')
    .update({ is_active: true, status: 'active', paused_at: null, next_run_at: nextRunAt.toISOString() } as any)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
