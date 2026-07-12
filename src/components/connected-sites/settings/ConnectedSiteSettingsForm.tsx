'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import type { ConnectedSite } from '@/types/connected-sites';

interface Props {
  site: ConnectedSite;
  planHasIndexing: boolean;
}

export function ConnectedSiteSettingsForm({ site, planHasIndexing }: Props) {
  const router = useRouter();
  const [name, setName] = useState(site.name);
  const [isEnabled, setIsEnabled] = useState(site.is_enabled);
  const [telemetry, setTelemetry] = useState(site.telemetry_enabled);
  const [indexing, setIndexing] = useState(site.indexing_diagnostics_enabled);
  const [crawlerVisibility, setCrawlerVisibility] = useState(site.crawler_visibility_enabled);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/connected-sites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          is_enabled: isEnabled,
          telemetry_enabled: telemetry,
          indexing_diagnostics_enabled: indexing,
          crawler_visibility_enabled: crawlerVisibility,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to save settings');
      }
      toast.success('Settings saved');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteSite = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/connected-sites/${site.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove site');
      toast.success('Site removed');
      router.push('/sites');
      router.refresh();
    } catch {
      toast.error('Failed to remove site');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* General */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="site-name">Site name</Label>
            <Input
              id="site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Site enabled</p>
              <p className="text-xs text-muted-foreground">
                Disable to stop accepting events without removing the site
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* Feature toggles */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Data collection</CardTitle>
          <CardDescription>
            Control which data the script collects from your visitors.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div>
              <p className="text-sm font-medium text-foreground">Telemetry (Web Vitals)</p>
              <p className="text-xs text-muted-foreground">
                Collect Core Web Vitals and performance metrics from real user sessions
              </p>
            </div>
            <Switch checked={telemetry} onCheckedChange={setTelemetry} />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/30">
            <div>
              <p className="text-sm font-medium text-foreground">Indexing diagnostics</p>
              <p className="text-xs text-muted-foreground">
                Report page-level SEO signals (title, description, canonical, noindex)
              </p>
              {!planHasIndexing && (
                <p className="text-xs text-amber-400 mt-0.5">Requires Pro or above</p>
              )}
            </div>
            <Switch
              checked={indexing}
              onCheckedChange={setIndexing}
              disabled={!planHasIndexing}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Crawler visibility</p>
              <p className="text-xs text-muted-foreground">
                Report which search-engine crawlers are detected in traffic logs
              </p>
            </div>
            <Switch checked={crawlerVisibility} onCheckedChange={setCrawlerVisibility} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
        {saving ? 'Saving…' : (
          <>
            <Save className="h-3.5 w-3.5 mr-2" />
            Save settings
          </>
        )}
      </Button>

      {/* Danger zone */}
      <Card className="border-red-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Remove connected site</p>
              <p className="text-xs text-muted-foreground">
                Revokes the site key and stops all data collection. Cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {site.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will revoke the site key and permanently stop data collection from{' '}
                    <strong>{site.normalized_origin}</strong>. Collected data is retained but no
                    new events will be accepted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={deleteSite}
                    disabled={deleting}
                  >
                    {deleting ? 'Removing…' : 'Remove site'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
