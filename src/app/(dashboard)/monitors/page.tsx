import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { MonitorsList } from '@/components/monitors/MonitorsList';
import type { Monitor } from '@/types/analysis';

export const metadata: Metadata = { title: 'Monitors' };

export default async function MonitorsPage() {
  const supabase = createServerClient();

  const { data } = await supabase.from('monitors')
    .select('*')
    .order('created_at', { ascending: false });

  const monitors: Monitor[] = (data ?? []) as Monitor[];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-gradient">Scheduled Monitors</h1>
        <p className="text-muted-foreground text-sm">
          Automatically re-analyze your sites daily or weekly and get alerted when scores drop.
        </p>
      </div>

      {/* Content */}
      <div className="bg-card border border-border rounded-xl p-6">
        <MonitorsList initialMonitors={monitors} />
      </div>
    </div>
  );
}
