'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, RotateCcw, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { ConnectedSiteKey } from '@/types/connected-sites';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  siteId: string;
  keys: ConnectedSiteKey[];
}

export function SiteKeyManagement({ siteId, keys }: Props) {
  const router = useRouter();
  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(true);

  const rotate = async () => {
    setRotating(true);
    try {
      const res = await fetch(`/api/connected-sites/${siteId}/rotate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to rotate key');
      }
      const data = await res.json();
      setNewKey(data.siteKey);
      setShowNewKey(true);
      toast.success('Key rotated — update your site before the grace period ends');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to rotate key');
    } finally {
      setRotating(false);
    }
  };

  const activeKey = keys.find((k) => k.status === 'active');

  return (
    <div className="space-y-4">
      {/* New key reveal */}
      {newKey && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-300">New site key — copy now</CardTitle>
            <CardDescription>
              This key is shown once. Update your script&rsquo;s <code>data-site-key</code> attribute before the grace period expires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-zinc-900 rounded px-3 py-2 text-foreground break-all">
                {showNewKey ? newKey : '•'.repeat(Math.min(newKey.length, 40))}
              </code>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowNewKey((v) => !v)}
                className="shrink-0"
              >
                {showNewKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(newKey);
                  toast.success('Copied');
                }}
              >
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active key */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active key</CardTitle>
          <CardDescription>
            This key is used to authenticate events from your site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeKey ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-foreground">{activeKey.key_prefix}…</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created{' '}
                  {formatDistanceToNow(new Date(activeKey.created_at), { addSuffix: true })}
                  {activeKey.last_used_at &&
                    ` · Last used ${formatDistanceToNow(new Date(activeKey.last_used_at), { addSuffix: true })}`}
                </p>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              >
                active
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active key found.</p>
          )}

          <div className="border-t border-border/30 pt-3">
            <div className="flex items-start gap-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Rotating the key will invalidate the current key after a 24-hour grace period.
                Update the <code>data-site-key</code> attribute on your site immediately after rotating.
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={rotating}>
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                  Rotate key
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rotate site key?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A new key will be generated. The current key will continue to work for 24
                    hours. After that, requests using the old key will be rejected. Make sure to
                    update your site before the grace period ends.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={rotate}
                    disabled={rotating}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {rotating ? 'Rotating…' : 'Rotate key'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Historical keys */}
      {keys.filter((k) => k.status !== 'active').length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-sm">Previous keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {keys
                .filter((k) => k.status !== 'active')
                .map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                  >
                    <div>
                      <p className="font-mono text-sm text-muted-foreground">{key.key_prefix}…</p>
                      <p className="text-xs text-muted-foreground">
                        {key.rotated_at
                          ? `Rotated ${formatDistanceToNow(new Date(key.rotated_at), { addSuffix: true })}`
                          : `Created ${formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}`}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                    >
                      {key.status}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
