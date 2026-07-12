'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  visibility: 'internal' | 'recipient_visible';
  created_at: string;
  sender_user_id: string | null;
}

interface Props {
  fixRequestId: string;
}

export function MessageThread({ fixRequestId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'internal' | 'recipient_visible'>('internal');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    try {
      const res = await fetch(`/api/fix-requests/${fixRequestId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
    // mark as read
    fetch(`/api/fix-requests/${fixRequestId}/read-state`, { method: 'POST' }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixRequestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handlePost() {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/fix-requests/${fixRequestId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), visibility }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to post');
      }
      setContent('');
      await loadMessages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post message');
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-card rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                </span>
                <Badge
                  variant="outline"
                  className={
                    msg.visibility === 'internal'
                      ? 'text-xs bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      : 'text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                  }
                >
                  {msg.visibility === 'internal' ? 'Internal' : 'Recipient visible'}
                </Badge>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <Textarea
          placeholder="Write a message…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="bg-transparent border-0 p-0 resize-none focus-visible:ring-0 text-sm"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVisibility('internal')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                visibility === 'internal'
                  ? 'bg-zinc-500/20 border-zinc-500/40 text-zinc-300'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Internal
            </button>
            <button
              type="button"
              onClick={() => setVisibility('recipient_visible')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                visibility === 'recipient_visible'
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Recipient visible
            </button>
          </div>
          <Button
            size="sm"
            onClick={handlePost}
            disabled={posting || !content.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 h-7 px-3"
          >
            <Send className="h-3 w-3 mr-1" />
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}
