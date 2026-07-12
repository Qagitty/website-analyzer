import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getFeatures } from '@/lib/billing/limits';
import { FixRequestDetail } from '@/components/fix-requests/FixRequestDetail';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Fix Request' };

export default async function FixRequestDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: fr }, { data: subscription }] = await Promise.all([
    supabase
      .from('fix_requests')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single(),
    supabase.from('subscriptions').select('plan').eq('user_id', user.id).single(),
  ]);

  if (!fr) redirect('/fix-requests');

  const plan = (subscription?.plan ?? 'free') as 'free' | 'pro' | 'agency' | 'compliance';
  const features = getFeatures(plan);

  return (
    <FixRequestDetail
      fixRequest={fr}
      canWebhook={features.fixRequestWebhookDelivery}
      canTeamAssign={features.fixRequestTeamAssignment}
    />
  );
}
