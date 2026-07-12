'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2, Copy, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { ConnectedSiteWithDetails } from '@/types/connected-sites';

interface Props {
  site: ConnectedSiteWithDetails;
  onVerified?: () => void;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

function CodeBlock({ code }: { code: string }) {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard');
  };
  return (
    <div className="relative rounded-md bg-zinc-900 border border-border/50">
      <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 h-7 w-7 text-zinc-400 hover:text-zinc-200"
        onClick={copy}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

type VerifyState = 'idle' | 'verifying' | 'success' | 'failed';

export function InstallationPanel({ site, onVerified }: Props) {
  const [method, setMethod] = useState<'script' | 'meta_tag'>('script');
  const [challenge, setChallenge] = useState<{
    token: string;
    snippet: string;
    expiresAt: string;
  } | null>(null);
  const [challenging, setChallenging] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');

  const activeKey = site.connected_site_keys?.find((k) => k.status === 'active');
  const keyPrefix = activeKey?.key_prefix ?? 'ws_site_…';

  const permanentSnippet = `<script
  src="${APP_URL}/site-connect/v1/webscore-connect.min.js"
  data-site-key="${keyPrefix}"
  defer
  crossorigin="anonymous"
></script>`;

  const fetchChallenge = useCallback(async () => {
    setChallenging(true);
    try {
      const res = await fetch(`/api/connected-sites/${site.id}/verification-challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to generate challenge');
      }
      const data = await res.json();
      setChallenge({ token: data.challenge, snippet: data.snippet, expiresAt: data.expiresAt });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate challenge');
    } finally {
      setChallenging(false);
    }
  }, [site.id, method]);

  const verify = useCallback(async () => {
    setVerifyState('verifying');
    try {
      const res = await fetch(`/api/connected-sites/${site.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        setVerifyState('success');
        toast.success('Site verified successfully');
        onVerified?.();
      } else {
        setVerifyState('failed');
        toast.error(data.error ?? 'Verification failed — ensure the snippet is live on your site');
      }
    } catch {
      setVerifyState('failed');
      toast.error('Verification request failed');
    }
  }, [site.id, onVerified]);

  if (site.verification_status === 'verified') {
    return (
      <div className="space-y-6">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-medium text-emerald-300">Site verified</p>
              <p className="text-sm text-muted-foreground">
                Ownership is confirmed. The permanent script below is collecting data.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Permanent script snippet</CardTitle>
            <CardDescription>
              Add this before <code className="text-xs">&lt;/body&gt;</code> on every page you want to track.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock code={permanentSnippet} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1 — choose method */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Step 1 — Choose verification method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['script', 'meta_tag'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  method === m
                    ? 'border-indigo-500/60 bg-indigo-500/10'
                    : 'border-border/50 hover:border-border'
                }`}
              >
                <p className="font-medium text-sm text-foreground">
                  {m === 'script' ? 'Script tag' : 'Meta tag'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {m === 'script'
                    ? 'Add a <script> tag to your page — works for all sites'
                    : 'Add a <meta> tag to your <head> — useful if scripts are restricted'}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2 — generate challenge */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Step 2 — Add the verification snippet</CardTitle>
          <CardDescription>
            Generate a one-time token and add it to your site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={fetchChallenge}
            disabled={challenging}
            variant="outline"
            size="sm"
          >
            {challenging ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              'Generate verification token'
            )}
          </Button>

          {challenge && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Add this snippet to your site, then click Verify below.
              </p>
              <CodeBlock code={challenge.snippet} />
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Token expires {new Date(challenge.expiresAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3 — verify */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Step 3 — Confirm verification</CardTitle>
          <CardDescription>
            Once the snippet is live on your site, click verify.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {verifyState === 'failed' && (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
              Verification failed. Check that the snippet is accessible at your origin URL.
            </div>
          )}
          {verifyState === 'success' && (
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Verified successfully
            </div>
          )}
          <Button
            onClick={verify}
            disabled={!challenge || verifyState === 'verifying' || verifyState === 'success'}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {verifyState === 'verifying' ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                Verifying…
              </>
            ) : (
              'Verify ownership'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Permanent snippet preview */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Permanent script (add after verification)</CardTitle>
          <CardDescription>
            Once verified, replace the verification snippet with this permanent one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={permanentSnippet} />
        </CardContent>
      </Card>
    </div>
  );
}
