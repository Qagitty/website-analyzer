import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { MonitorsList } from '@/components/monitors/MonitorsList';
import type { Monitor } from '@/types/analysis';

export const metadata: Metadata = { title: 'Monitors' };

export default async function MonitorsPage() {
  const supabase = createServerClient();

  const { data } = await (supabase as any).from('monitors')
    .select('*')
    .order('created_at', { ascending: false });

  const monitors: Monitor[] = (data ?? []) as Monitor[];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scheduled Monitors</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Automatically re-analyze your sites daily or weekly and get alerted when scores drop.
        </p>
      </div>
      <MonitorsList initialMonitors={monitors} />
    </div>
  );
}
