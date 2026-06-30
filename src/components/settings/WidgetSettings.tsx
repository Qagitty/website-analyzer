'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Lock, Copy, RefreshCw, ExternalLink, Check, Loader2 } from 'lucide-react';
import type { PlanId } from '@/lib/stripe/plans';

interface WidgetSettingsProps {
  plan:           PlanId;
  initialKey?:    string | null;
  initialSettings?: {
    buttonText?:  string;
    buttonColor?: string;
    position?:    string;
    showEmail?:   boolean;
  } | null;
  appUrl:         string;
}

type Position = 'bottom-right' | 'bottom-left' | 'bottom-center';

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="rounded-lg bg-background border border-border p-3 text-xs font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}

export function WidgetSettings({
  plan,
  initialKey,
  initialSettings,
  appUrl,
}: WidgetSettingsProps) {
  const canUse = plan === 'agency' || plan === 'compliance';

  const [widgetKey, setWidgetKey]     = useState<string>(initialKey ?? '');
  const [buttonText, setButtonText]   = useState(initialSettings?.buttonText  ?? 'Get a Free Audit');
  const [buttonColor, setButtonColor] = useState(initialSettings?.buttonColor ?? '#6366f1');
  const [position, setPosition]       = useState<Position>((initialSettings?.position as Position) ?? 'bottom-right');
  const [showEmail, setShowEmail]     = useState(initialSettings?.showEmail   ?? true);

  const [saving, setSaving]           = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Compute embed codes from current state
  const hostedUrl    = widgetKey ? `${appUrl}/widget/${widgetKey}` : '';
  const embedScript  = widgetKey
    ? `<script src="${appUrl}/api/widget-script" data-key="${widgetKey}" data-color="${buttonColor}" data-text="${buttonText}" data-position="${position}" ${showEmail ? '' : 'data-show-email="false" '}async></script>`
    : '';
  const iframeSnippet = widgetKey
    ? `<iframe src="${hostedUrl}" width="100%" height="480" frameborder="0" title="Website Audit Widget" loading="lazy"></iframe>`
    : '';

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/widget/key', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buttonText, buttonColor, position, showEmail }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error ?? 'Save failed');
      }
      toast.success('Widget settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Regenerate the widget key? The current embed code will stop working.')) return;
    setRegenerating(true);
    try {
      const res = await fetch('/api/widget/key', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to regenerate');
      const { key } = await res.json();
      setWidgetKey(key);
      toast.success('Widget key regenerated. Update your embed code.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  };

  if (!canUse) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Lead Capture Widget</CardTitle>
            <Badge variant="outline" className="text-xs gap-1">
              <Lock className="h-3 w-3" /> Agency plan
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pb-6">
          <p className="text-sm text-muted-foreground">
            Embed a &ldquo;Get a Free Audit&rdquo; widget on any website. Visitors enter their URL,
            you get the lead + the full analysis report.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: '📡', label: 'JS snippet',     desc: 'Floating button on any page' },
              { icon: '🖼️', label: 'iframe embed',   desc: 'Inline form on landing pages' },
              { icon: '📋', label: 'Leads dashboard', desc: 'Track every audit request' },
            ].map((f) => (
              <div key={f.label} className="rounded-lg bg-background border border-border p-3 space-y-1 opacity-60">
                <span className="text-xl">{f.icon}</span>
                <p className="text-xs font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
          <a
            href="/settings"
            className="inline-block mt-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Upgrade to Agency →
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle>Lead Capture Widget</CardTitle>
            <Badge variant="default" className="text-xs">Agency</Badge>
          </div>
          {widgetKey && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <RefreshCw className="h-3 w-3" />}
              Regenerate key
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Widget key */}
        {widgetKey && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Widget key (public)</Label>
            <div className="flex items-center gap-2 p-3 bg-background border border-border rounded-lg">
              <code className="text-xs font-mono text-muted-foreground flex-1 truncate">{widgetKey}</code>
              <a
                href={hostedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-500 transition-colors shrink-0"
                title="Open hosted widget"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Appearance */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Appearance</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-btn-text">Button text</Label>
              <Input
                id="wa-btn-text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                maxLength={60}
                placeholder="Get a Free Audit"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-btn-color">Button color</Label>
              <div className="flex items-center gap-2 p-2.5 bg-background border border-border rounded-lg">
                <input
                  id="wa-btn-color"
                  type="color"
                  value={buttonColor}
                  onChange={(e) => setButtonColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-border p-0.5"
                />
                <div className="h-8 w-16 rounded border border-border shrink-0" style={{ backgroundColor: buttonColor }} />
                <span className="font-mono text-xs text-muted-foreground">{buttonColor}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-position">Floating button position</Label>
              <select
                id="wa-position"
                value={position}
                onChange={(e) => setPosition(e.target.value as Position)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-center">Bottom center</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Email field</Label>
              <div className="flex items-center gap-3 pt-2">
                <input
                  id="wa-show-email"
                  type="checkbox"
                  checked={showEmail}
                  onChange={(e) => setShowEmail(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded accent-orange-500"
                />
                <Label htmlFor="wa-show-email" className="cursor-pointer font-normal">
                  Ask for contact email
                </Label>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-orange-600 text-white hover:from-orange-400 hover:to-orange-400"
        >
          {saving ? 'Saving…' : 'Save Widget Settings'}
        </Button>

        {/* Embed codes */}
        {widgetKey && (
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Embed Codes</h3>

            <CodeBlock
              label="JavaScript snippet (floating button on any page)"
              code={embedScript}
            />

            <CodeBlock
              label="Hosted widget URL (share as a link)"
              code={hostedUrl}
            />

            <CodeBlock
              label="iframe embed (inline form on your landing page)"
              code={iframeSnippet}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
