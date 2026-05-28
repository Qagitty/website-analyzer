'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ChevronUp, Settings, Bell, CreditCard, LogOut } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useCredits } from '@/hooks/useCredits';

type Plan = 'free' | 'pro' | 'agency';

const PLAN_BADGE: Record<Plan, string> = {
  free: 'bg-secondary text-muted-foreground border border-border',
  pro: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20',
  agency: 'bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/20',
};

const PLAN_LABEL: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  agency: 'Agency',
};

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [initials, setInitials] = useState('?');
  const [plan, setPlan] = useState<Plan>('free');
  const { credits } = useCredits();
  const supabase = createBrowserClient();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setEmail(user.email);
        setInitials(user.email[0].toUpperCase());
      }
    });

    supabase.from('subscriptions').select('plan').single().then(({ data }) => {
      if (data?.plan) setPlan(data.plan as Plan);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <div ref={containerRef} className="relative px-3 py-3 border-t border-border">
      {/* Dropdown (opens upward) */}
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0 text-sm font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">{email}</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-0.5 ${PLAN_BADGE[plan]}`}>
                {PLAN_LABEL[plan]}
              </span>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Credits */}
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground">
              <span className="text-amber-500">⚡</span>{' '}
              <span className="font-medium text-foreground">{credits}</span> credits remaining
            </p>
          </div>

          <div className="border-t border-border" />

          {/* Menu items */}
          <div className="p-1">
            <button
              onClick={() => navigate('/settings')}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors text-left"
            >
              <Settings className="h-4 w-4 shrink-0" />
              Settings
            </button>
            <button
              onClick={() => navigate('/settings/notifications')}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors text-left"
            >
              <Bell className="h-4 w-4 shrink-0" />
              Notification preferences
            </button>
            <button
              onClick={() => navigate('/settings/billing')}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors text-left"
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              Billing &amp; Subscription
            </button>
          </div>

          <div className="border-t border-border" />

          <div className="p-1">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-left"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-accent transition-colors group',
          open && 'bg-accent'
        )}
      >
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0 text-xs font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">{email || 'Loading…'}</p>
        </div>
        <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}
