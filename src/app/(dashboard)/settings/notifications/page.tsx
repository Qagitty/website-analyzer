import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { NotificationPrefs } from '@/components/settings/NotificationPrefs';
import { Bell, Mail, AlertTriangle, BarChart2 } from 'lucide-react';

export const metadata: Metadata = { title: 'Settings — Notifications' };

export default async function NotificationsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: settings } = (await supabase
    .from('user_settings')
    .select('notifications')
    .eq('user_id', user.id)
    .single()) as unknown as { data: Record<string, any> | null };

  const notifications = (settings?.notifications as any) ?? {
    email_on_complete: true,
    email_on_fail: true,
    weekly_digest: false,
  };

  return (
    <div className="space-y-8">
      {/* What each notification does */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Email Notifications</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="bg-card border border-border rounded-xl p-4 flex gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Analysis complete</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get notified as soon as your report is ready.
              </p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Analysis failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Know immediately if something goes wrong.
              </p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
              <BarChart2 className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Weekly digest</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A summary of your activity every Monday.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Preferences toggles */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5 text-muted-foreground text-sm">
            <Bell className="h-4 w-4" />
            <span>Notifications are sent to <span className="font-medium text-foreground">{user.email}</span></span>
          </div>
          <NotificationPrefs initial={notifications} />
        </div>
      </section>
    </div>
  );
}
