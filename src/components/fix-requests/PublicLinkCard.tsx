'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface PublicLink {
  id: string;
  token: string;
  scope: string;
  expires_at: string | null;
  view_count: number;
  revoked_at: string | null;
  created_at: string;
}

interface Props {
  link: PublicLink;
  fixRequestId: string;
  onRevoked: () => void;
}

export function PublicLinkCard({ link, fixRequestId, onRevoked }: Props) {
  const [revoking, setRevoking] = useState(false);
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/fix-request/${link.token}`;
  const isExpired = link.expires_at ? new Date(link.expires_at) < new Date() : false;
  const isActive = !link.revoked_at && !isExpired;

  async function handleRevoke() {
    setRevoking(true);
    try {
      const res = await fetch(`/api/fix-requests/${fixRequestId}/public-link?linkId=${link.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to revoke');
      toast.success('Link revoked');
      onRevoked();
    } catch {
      toast.error('Failed to revoke link');
    } finally {
      setRevoking(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied');
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              isActive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
            }
          >
            {isActive ? 'Active' : link.revoked_at ? 'Revoked' : 'Expired'}
          </Badge>
          <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
            {link.scope === 'full_technical' ? 'Full Technical' : 'Summary Only'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">{shareUrl}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {link.view_count} views
          </span>
          {link.expires_at && (
            <span>
              {isExpired ? 'Expired' : 'Expires'}{' '}
              {formatDistanceToNow(new Date(link.expires_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isActive && (
          <Button size="icon" variant="ghost" onClick={handleCopy} className="h-7 w-7">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
        {isActive && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRevoke}
            disabled={revoking}
            className="h-7 w-7 text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
