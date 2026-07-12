'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  fixRequestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (shareLink?: string) => void;
  canWebhook: boolean;
  canTeamAssign: boolean;
}

type Channel = 'email' | 'whatsapp_link' | 'telegram_share' | 'webhook' | 'internal_assignment' | 'external_link';

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: 'email',               label: 'Email' },
  { value: 'whatsapp_link',       label: 'WhatsApp Link' },
  { value: 'telegram_share',      label: 'Telegram Share' },
  { value: 'external_link',       label: 'External Link' },
  { value: 'webhook',             label: 'Webhook' },
  { value: 'internal_assignment', label: 'Team Assignment' },
];

export function SendRequestDialog({
  fixRequestId,
  open,
  onOpenChange,
  onSuccess,
  canWebhook,
  canTeamAssign,
}: Props) {
  const [channel, setChannel] = useState<Channel>('email');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [webhookId, setWebhookId] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [loading, setLoading] = useState(false);

  const availableChannels = CHANNEL_OPTIONS.filter((c) => {
    if (c.value === 'webhook' && !canWebhook) return false;
    if (c.value === 'internal_assignment' && !canTeamAssign) return false;
    return true;
  });

  async function handleSend() {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { channel };
      if (channel === 'email') body.recipientEmail = recipientEmail;
      if (channel === 'whatsapp_link' || channel === 'telegram_share') body.phoneE164 = phoneE164;
      if (channel === 'webhook') body.webhookId = webhookId;
      if (channel === 'internal_assignment') body.assigneeUserId = assigneeUserId;

      const res = await fetch(`/api/fix-requests/${fixRequestId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to send');
      }
      const data = await res.json();
      toast.success('Request sent successfully');
      onOpenChange(false);
      onSuccess?.(data.shareLink);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0F] border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>Send Fix Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Delivery Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
              <SelectTrigger className="bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {availableChannels.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {channel === 'email' && (
            <div className="space-y-1.5">
              <Label>Recipient Email</Label>
              <Input
                type="email"
                placeholder="developer@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="bg-card border-border"
              />
            </div>
          )}

          {(channel === 'whatsapp_link' || channel === 'telegram_share') && (
            <div className="space-y-1.5">
              <Label>Phone Number (E.164)</Label>
              <Input
                type="tel"
                placeholder="+15551234567"
                value={phoneE164}
                onChange={(e) => setPhoneE164(e.target.value)}
                className="bg-card border-border"
              />
            </div>
          )}

          {channel === 'webhook' && (
            <div className="space-y-1.5">
              <Label>Webhook ID</Label>
              <Input
                placeholder="Webhook endpoint ID"
                value={webhookId}
                onChange={(e) => setWebhookId(e.target.value)}
                className="bg-card border-border"
              />
            </div>
          )}

          {channel === 'internal_assignment' && (
            <div className="space-y-1.5">
              <Label>Assignee User ID</Label>
              <Input
                placeholder="Team member user ID"
                value={assigneeUserId}
                onChange={(e) => setAssigneeUserId(e.target.value)}
                className="bg-card border-border"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
