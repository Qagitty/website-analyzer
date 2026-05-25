'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Notifications {
  email_on_complete: boolean;
  email_on_fail: boolean;
  weekly_digest: boolean;
}

interface Props {
  initial: Notifications;
}

const PREFS = [
  { key: 'email_on_complete' as const, label: 'Email when analysis completes' },
  { key: 'email_on_fail' as const,     label: 'Email when analysis fails' },
  { key: 'weekly_digest' as const,     label: 'Weekly summary digest' },
];

export function NotificationPrefs({ initial }: Props) {
  const [prefs, setPrefs] = useState<Notifications>(initial);
  const [loading, setLoading] = useState(false);

  const toggle = (key: keyof Notifications) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: prefs }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Notification preferences saved');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {PREFS.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between py-3 border-b border-border cursor-pointer group">
            <span className="text-sm text-foreground">{label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[key]}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
                prefs[key] ? 'bg-indigo-500' : 'bg-secondary'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  prefs[key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        ))}
        <Button
          onClick={save}
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
        >
          {loading ? 'Saving…' : 'Save preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}
