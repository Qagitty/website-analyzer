'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, Webhook, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

interface Props {
  initialWebhooks: WebhookRow[];
}

const EVENT_LABELS: Record<string, string> = {
  'analysis.completed': 'Analysis completed',
  'score.dropped': 'Score dropped',
};

function isSlackUrl(url: string) {
  return url.includes('hooks.slack.com') || url.includes('hooks.slack-gov.com');
}

function truncateUrl(url: string, maxLen = 52) {
  try {
    const { hostname, pathname } = new URL(url);
    const full = hostname + pathname;
    return full.length > maxLen ? full.slice(0, maxLen) + '…' : full;
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + '…' : url;
  }
}

export function WebhooksForm({ initialWebhooks }: Props) {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>(initialWebhooks);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<Set<string>>(
    new Set(['analysis.completed', 'score.dropped'])
  );
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleEvent = (event: string) => {
    setNewEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) {
        next.delete(event);
      } else {
        next.add(event);
      }
      return next;
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    if (newEvents.size === 0) {
      toast.error('Select at least one event');
      return;
    }
    if (webhooks.length >= 5) {
      toast.error('Maximum 5 webhooks allowed');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl.trim(),
          events: Array.from(newEvents),
          active: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to add webhook');
        return;
      }

      const created: WebhookRow = await res.json();
      setWebhooks((prev) => [created, ...prev]);
      setNewUrl('');
      setNewEvents(new Set(['analysis.completed', 'score.dropped']));
      toast.success('Webhook added');
    } catch {
      toast.error('Failed to add webhook');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (webhook: WebhookRow) => {
    setTogglingId(webhook.id);
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !webhook.active }),
      });

      if (!res.ok) {
        toast.error('Failed to update webhook');
        return;
      }

      const updated: WebhookRow = await res.json();
      setWebhooks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      toast.success(updated.active ? 'Webhook enabled' : 'Webhook disabled');
    } catch {
      toast.error('Failed to update webhook');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        toast.error('Failed to delete webhook');
        return;
      }
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success('Webhook deleted');
    } catch {
      toast.error('Failed to delete webhook');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Webhooks</CardTitle>
        </div>
        <CardDescription>
          Get notified in Slack or any HTTP endpoint when analyses complete or scores drop.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Add webhook form */}
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://hooks.slack.com/… or https://your-endpoint.com/webhook"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1 bg-[#0A0A0F] border-white/10 text-foreground placeholder:text-[#475569] focus:border-indigo-500/50 focus:ring-indigo-500/20"
              aria-label="Webhook URL"
            />
            <Button
              type="submit"
              size="sm"
              disabled={adding || !newUrl.trim() || webhooks.length >= 5}
              className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
            >
              <Plus className="h-4 w-4 mr-1" />
              {adding ? 'Adding…' : 'Add'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-4">
            {(['analysis.completed', 'score.dropped'] as const).map((event) => (
              <label key={event} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newEvents.has(event)}
                  onChange={() => toggleEvent(event)}
                  className="rounded border-muted-foreground/30"
                />
                <span className="text-sm">{EVENT_LABELS[event]}</span>
              </label>
            ))}
          </div>

          {isSlackUrl(newUrl) && (
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Slack incoming webhook detected — payload will be formatted as a Slack message.
            </p>
          )}

          {webhooks.length >= 5 && (
            <p className="text-xs text-amber-400">Maximum of 5 webhooks reached.</p>
          )}
        </form>

        {/* Existing webhooks list */}
        {webhooks.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Active webhooks ({webhooks.length}/5)
            </p>
            <div className="rounded-lg border border-white/5">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0 px-3"
                >
                  {/* Status dot */}
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      webhook.active ? 'bg-emerald-400' : 'bg-[#475569]'
                    }`}
                  />

                  {/* URL + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-sm text-muted-foreground truncate">
                        {truncateUrl(webhook.url)}
                      </span>
                      {isSlackUrl(webhook.url) && (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-0.5 rounded-full">
                          Slack
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {webhook.events.map((ev) => (
                        <span key={ev} className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs px-2 py-0.5 rounded-full">
                          {EVENT_LABELS[ev] ?? ev}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={webhook.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-white/5 transition-colors"
                      title="Open URL"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleToggle(webhook)}
                      disabled={togglingId === webhook.id}
                      className="text-xs px-2 py-1 rounded border border-indigo-500/30 text-indigo-300 bg-transparent hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
                      title={webhook.active ? 'Disable' : 'Enable'}
                    >
                      {togglingId === webhook.id
                        ? '…'
                        : webhook.active
                        ? 'Disable'
                        : 'Enable'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(webhook.id)}
                      disabled={deletingId === webhook.id}
                      className="p-1.5 rounded text-red-400/50 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Delete webhook"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4 border border-white/5 rounded-lg">
            No webhooks configured yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
