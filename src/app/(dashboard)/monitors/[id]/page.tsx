import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MonitorDetail } from '@/components/monitors/MonitorDetail';

export const dynamic = 'force-dynamic';

export default async function MonitorDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: monitorRow } = await supabase
    .from('monitors')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!monitorRow) redirect('/monitors');

  return (
    <div className="space-y-6 p-6">
      <MonitorDetail monitor={monitorRow as any} />
    </div>
  );
}
