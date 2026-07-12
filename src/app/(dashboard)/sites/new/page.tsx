'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Eye, EyeOff, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

export default function NewConnectedSitePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [rootUrl, setRootUrl] = useState('');
  const [env, setEnv] = useState<'production' | 'staging' | 'development'>('production');
  const [submitting, setSubmitting] = useState(false);

  // Post-create state
  const [createdSiteId, setCreatedSiteId] = useState<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(true);

  const validate = (): string | null => {
    if (!name.trim()) return 'Name is required';
    if (!rootUrl.trim()) return 'Root URL is required';
    try {
      const u = new URL(rootUrl.trim());
      if (!['http:', 'https:'].includes(u.protocol)) return 'URL must start with https://';
    } catch {
      return 'Enter a valid URL including https://';
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/connected-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), root_url: rootUrl.trim(), environment: env }),
      });
      const data = await res.json();
      if (!res.ok) {
        const messages: Record<string, string> = {
          CONNECTED_SITE_INVALID_URL: 'That URL is not valid or is not publicly reachable.',
          CONNECTED_SITE_PRIVATE_URL: 'Private or localhost URLs are not allowed.',
          CONNECTED_SITE_LIMIT_REACHED: 'You have reached your plan limit for connected sites.',
          CONNECTED_SITE_ALREADY_EXISTS: 'This origin is already connected to your account.',
        };
        throw new Error(messages[data.code] ?? data.error ?? 'Failed to create site');
      }
      setCreatedSiteId(data.site.id);
      setSiteKey(data.siteKey);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create site');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdSiteId && siteKey) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sites">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Sites
            </Link>
          </Button>
        </div>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-emerald-300">Site created — save your key now</CardTitle>
            <CardDescription>
              This site key is shown only once. Copy it before leaving this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-zinc-900 rounded px-3 py-2.5 text-foreground break-all border border-border/50">
                {showKey ? siteKey : '•'.repeat(Math.min(siteKey.length, 48))}
              </code>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowKey((v) => !v)}
                className="shrink-0"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(siteKey);
                  toast.success('Key copied');
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
            </div>

            <div className="rounded-md bg-zinc-900 border border-border/50 p-4">
              <p className="text-xs text-muted-foreground mb-2">Add this to every page you want to track:</p>
              <pre className="text-xs font-mono text-zinc-200 whitespace-pre-wrap break-all">{`<script
  src="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/site-connect/v1/webscore-connect.min.js"
  data-site-key="${siteKey}"
  defer
  crossorigin="anonymous"
></script>`}</pre>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                asChild
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Link href={`/sites/${createdSiteId}`}>Go to site dashboard</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/sites">View all sites</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sites">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Sites
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gradient">Connect a site</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Add a website to start collecting real-user data and technical diagnostics.
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-400" />
            Site details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="site-name">Site name</Label>
              <Input
                id="site-name"
                placeholder="My Production Site"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="root-url">Root URL</Label>
              <Input
                id="root-url"
                type="url"
                placeholder="https://example.com"
                value={rootUrl}
                onChange={(e) => setRootUrl(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The origin that will send events. Only this origin will be accepted.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Environment</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['production', 'staging', 'development'] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEnv(e)}
                    className={`rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
                      env === e
                        ? 'border-indigo-500/60 bg-indigo-500/10 text-foreground'
                        : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? 'Creating…' : 'Create connected site'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
