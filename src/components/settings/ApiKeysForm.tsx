'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Copy, Check, Trash2, ChevronDown, ChevronRight, KeyRound, ExternalLink, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

interface RevealedKey {
  id: string;
  key: string;
}

export function ApiKeysForm({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [name, setName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<RevealedKey | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);
  // Per-row revealed keys: id → full key string
  const [visibleKeys, setVisibleKeys] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'My API Key' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to generate key');
        return;
      }
      const newRow: ApiKeyRow = {
        id: data.id,
        name: data.name,
        key_prefix: data.key_prefix,
        last_used_at: null,
        created_at: data.created_at,
        revoked_at: null,
      };
      setKeys((prev) => [newRow, ...prev]);
      setRevealedKey({ id: data.id, key: data.key });
      setName('');
      toast.success('API key generated');
    } catch {
      toast.error('Failed to generate key');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setRevoking(keyId);
    try {
      const res = await fetch(`/api/api-keys/${keyId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        toast.error('Failed to revoke key');
        return;
      }
      setKeys((prev) =>
        prev.map((k) =>
          k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k
        )
      );
      if (revealedKey?.id === keyId) setRevealedKey(null);
      toast.success('API key revoked');
    } catch {
      toast.error('Failed to revoke key');
    } finally {
      setRevoking(null);
    }
  }

  async function handleCopy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }

  async function handleToggleReveal(keyId: string) {
    if (visibleKeys[keyId]) {
      setVisibleKeys((prev) => { const n = { ...prev }; delete n[keyId]; return n; });
      return;
    }
    setRevealingId(keyId);
    try {
      const res = await fetch(`/api/api-keys/${keyId}/reveal`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Could not reveal key'); return; }
      setVisibleKeys((prev) => ({ ...prev, [keyId]: data.key }));
    } catch {
      toast.error('Could not reveal key');
    } finally {
      setRevealingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          API Keys
        </CardTitle>
        <CardDescription>
          Use API keys to access the WebAnalyzer REST API from your own applications.{' '}
          <Link
            href="/docs?from=settings"
            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View API Docs <ExternalLink className="h-3 w-3" />
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Generate form */}
        <form onSubmit={handleGenerate} className="flex gap-2">
          <Input
            placeholder="Key name (e.g. Production)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="flex-1 bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500/50 focus:ring-indigo-500/20"
          />
          <Button
            type="submit"
            disabled={generating}
            className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
          >
            {generating ? 'Generating...' : 'Generate API key'}
          </Button>
        </form>

        {/* Post-generation banner */}
        {revealedKey && (
          <div className="bg-background border border-emerald-500/30 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400/70 text-xs font-medium">New key generated</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm text-emerald-300 break-all">
                {revealedKey.key}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(revealedKey.key, revealedKey.id)}
                className="shrink-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                {copiedKeyId === revealedKey.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-emerald-400/50 text-xs">
              You can also reveal this key anytime using the <Eye className="h-3 w-3 inline" /> button in the list below.
            </p>
          </div>
        )}

        {/* Active keys list */}
        {activeKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active API keys. Generate one above.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">
              Active keys ({activeKeys.length}/5)
            </p>
            <div className="h-px bg-accent" />
            <div className="rounded-lg border border-border">
              {activeKeys.map((key) => {
                const fullKey = visibleKeys[key.id];
                const isRevealing = revealingId === key.id;
                return (
                  <div key={key.id} className="border-b border-border last:border-0">
                    <div className="flex items-center justify-between py-3 px-4 gap-4">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm text-foreground truncate">{key.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground font-mono">
                            {fullKey ? fullKey : `${key.key_prefix}...`}
                          </p>
                          {fullKey && (
                            <button
                              type="button"
                              onClick={() => handleCopy(fullKey, key.id)}
                              className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
                              title="Copy key"
                            >
                              {copiedKeyId === key.id
                                ? <Check className="h-3 w-3 text-emerald-400" />
                                : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground/60">
                          Created {format(new Date(key.created_at), 'MMM d, yyyy')}
                          {' · '}
                          Last used:{' '}
                          {key.last_used_at
                            ? format(new Date(key.last_used_at), 'MMM d, yyyy')
                            : 'Never'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleReveal(key.id)}
                          disabled={isRevealing}
                          className="text-muted-foreground/50 hover:text-foreground text-xs transition-colors disabled:opacity-50"
                          title={fullKey ? 'Hide key' : 'Show key'}
                        >
                          {isRevealing
                            ? <span className="text-xs">Loading…</span>
                            : fullKey
                              ? <EyeOff className="h-4 w-4" />
                              : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(key.id)}
                          disabled={revoking === key.id}
                          className="text-red-400/50 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
                        >
                          {revoking === key.id ? (
                            <span>Revoking...</span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Trash2 className="h-4 w-4" />
                              Revoke
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Revoked keys (collapsed) */}
        {revokedKeys.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowRevoked((v) => !v)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showRevoked ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Revoked keys ({revokedKeys.length})
            </button>

            {showRevoked && (
              <div className="rounded-lg border border-border opacity-60">
                <p className="text-xs text-muted-foreground/60 uppercase tracking-wider px-4 pt-3 pb-1">Revoked</p>
                {revokedKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 gap-4">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground truncate">{key.name}</p>
                        <span className="bg-secondary text-muted-foreground/60 border border-border text-xs px-2 py-0.5 rounded-full">Revoked</span>
                      </div>
                      <p className="font-mono text-sm text-muted-foreground">
                        {key.key_prefix}...
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        Revoked {format(new Date(key.revoked_at!), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
