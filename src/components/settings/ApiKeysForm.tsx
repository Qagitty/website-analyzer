'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Copy, Check, Trash2, ChevronDown, ChevronRight, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          API Keys
        </CardTitle>
        <CardDescription>
          Use API keys to access the WebAnalyzer REST API from your own applications.
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
            className="flex-1"
          />
          <Button type="submit" disabled={generating}>
            {generating ? 'Generating...' : 'Generate API key'}
          </Button>
        </form>

        {/* One-time key reveal */}
        {revealedKey && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-700 p-4 space-y-3">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Save your API key now — it will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white dark:bg-black border px-3 py-2 text-sm font-mono break-all">
                {revealedKey.key}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(revealedKey.key, revealedKey.id)}
                className="shrink-0"
              >
                {copiedKeyId === revealedKey.id ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              This key will not be shown again. Store it in a secure location.
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
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Active keys ({activeKeys.length}/5)
            </p>
            <div className="divide-y rounded-lg border">
              {activeKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-medium truncate">{key.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {key.key_prefix}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {format(new Date(key.created_at), 'MMM d, yyyy')}
                      {' · '}
                      Last used:{' '}
                      {key.last_used_at
                        ? format(new Date(key.last_used_at), 'MMM d, yyyy')
                        : 'Never'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(key.id)}
                    disabled={revoking === key.id}
                    className="text-destructive hover:text-destructive shrink-0"
                  >
                    {revoking === key.id ? (
                      <span className="text-xs">Revoking...</span>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Revoke
                      </>
                    )}
                  </Button>
                </div>
              ))}
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
              <div className="divide-y rounded-lg border opacity-60">
                {revokedKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{key.name}</p>
                        <Badge variant="secondary" className="text-xs">Revoked</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {key.key_prefix}...
                      </p>
                      <p className="text-xs text-muted-foreground">
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
