'use client';

import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, ExternalLink } from 'lucide-react';

const urlSchema = z.string().url('Please enter a valid URL');
const emailSchema = z.string().email('Please enter a valid email address');

function normalizeUrl(v: string): string {
  const t = v.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

interface Props {
  widgetKey:   string;
  brandColor:  string;
  showEmail:   boolean;
  buttonText:  string;
}

export function WidgetForm({ widgetKey, brandColor, showEmail, buttonText }: Props) {
  const [url, setUrl]         = useState('');
  const [email, setEmail]     = useState('');
  const [urlError, setUrlErr] = useState('');
  const [emailError, setEmailErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ reportUrl: string; message: string } | null>(null);
  const [submitError, setSubmitError] = useState('');

  const validateUrl = (v: string) => {
    const r = urlSchema.safeParse(normalizeUrl(v));
    if (!r.success) { setUrlErr(r.error.errors[0].message); return false; }
    setUrlErr('');
    return true;
  };

  const validateEmail = (v: string) => {
    if (!v) return true; // optional
    const r = emailSchema.safeParse(v);
    if (!r.success) { setEmailErr(r.error.errors[0].message); return false; }
    setEmailErr('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const norm = normalizeUrl(url);
    setUrl(norm);
    const urlOk   = validateUrl(norm);
    const emailOk = validateEmail(email);
    if (!urlOk || !emailOk) return;

    setLoading(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/widget/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          key:   widgetKey,
          url:   norm,
          email: email || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setResult({ reportUrl: data.reportUrl, message: data.message });
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: brandColor }} />
        <div>
          <h2 className="text-lg font-bold text-foreground">Analysis Started!</h2>
          <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
        </div>
        <a
          href={result.reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: brandColor }}
        >
          View Report
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={() => { setResult(null); setUrl(''); setEmail(''); }}
          className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
        >
          Analyze another site →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
      {/* URL */}
      <div className="space-y-1.5">
        <Label htmlFor="wa-url">Your website URL</Label>
        <Input
          id="wa-url"
          type="text"
          placeholder="example.com"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (urlError) validateUrl(e.target.value);
          }}
          aria-invalid={!!urlError}
          className={urlError ? 'border-red-500/60' : ''}
          autoComplete="url"
        />
        {urlError && <p className="text-xs text-red-400">{urlError}</p>}
      </div>

      {/* Email (optional) */}
      {showEmail && (
        <div className="space-y-1.5">
          <Label htmlFor="wa-email" className="flex items-center gap-2">
            Your email
            <span className="text-xs text-muted-foreground/60 font-normal">(optional)</span>
          </Label>
          <Input
            id="wa-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) validateEmail(e.target.value);
            }}
            aria-invalid={!!emailError}
            className={emailError ? 'border-red-500/60' : ''}
            autoComplete="email"
          />
          {emailError && <p className="text-xs text-red-400">{emailError}</p>}
        </div>
      )}

      {submitError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
          <p className="text-sm text-red-400">{submitError}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full text-white font-semibold transition-opacity hover:opacity-90"
        style={{ backgroundColor: brandColor, border: 'none' }}
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing…</>
        ) : buttonText}
      </Button>

      <p className="text-xs text-muted-foreground/60 text-center">
        Analysis takes ~60 seconds. No account required.
      </p>
    </form>
  );
}
