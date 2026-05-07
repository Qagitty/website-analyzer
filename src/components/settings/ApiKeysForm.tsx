'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Copy, Check, Trash2, ChevronDown, ChevronRight, KeyRound } from 'lucide-react';
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
            className="flex-1 bg-[#0A0A0F] border-white/10 text-foreground placeholder:text-[#475569] focus:border-indigo-500/50 focus:ring-indigo-500/20"
          />
          <Button
            type="submit"
            disabled={generating}
            className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
          >
            {generating ? 'Generating...' : 'Generate API key'}
          </Button>
        </form>

        {/* One-time key reveal */}
        {revealedKey && (
          <div className="bg-[#0A0A0F] border border-amber-500/30 rounded-xl p-4 space-y-3">
            <p className="text-amber-400/70 text-xs">
              Save your API key now — it will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm text-amber-300 break-all">
                {revealedKey.key}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(revealedKey.key, revealedKey.id)}
                className="shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                {copiedKeyId === revealedKey.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-amber-400/70 text-xs">
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
            <p className="text-xs text-[#475569] uppercase tracking-wider">
              Active keys ({activeKeys.length}/5)
            </p>
            <div className="h-px bg-white/5" />
            <div className="rounded-lg border border-white/5">
              {activeKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 px-4 gap-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm text-foreground truncate">{key.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {key.key_prefix}...
                    </p>
                    <p className="text-xs text-[#475569]">
                      Created {format(new Date(key.created_at), 'MMM d, yyyy')}
                      {' · '}
                      Last used:{' '}
                      {key.last_used_at
                        ? format(new Date(key.last_used_at), 'MMM d, yyyy')
                        : 'Never'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(key.id)}
                    disabled={revoking === key.id}
                    className="text-red-400/50 hover:text-red-400 text-xs shrink-0 transition-colors disabled:opacity-50"
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
              <div className="rounded-lg border border-white/5 opacity-60">
                <p className="text-xs text-[#475569] uppercase tracking-wider px-4 pt-3 pb-1">Revoked</p>
                {revokedKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0 gap-4">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground truncate">{key.name}</p>
                        <span className="bg-[#1C1C27] text-[#475569] border border-white/5 text-xs px-2 py-0.5 rounded-full">Revoked</span>
                      </div>
                      <p className="font-mono text-sm text-muted-foreground">
                        {key.key_prefix}...
                      </p>
                      <p className="text-xs text-[#475569]">
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
