'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, X, Loader2 } from 'lucide-react';
import type { PlanId } from '@/lib/stripe/plans';

const urlSchema = z.string().url('Please enter a valid URL (e.g. https://example.com)');

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

interface CompareInputProps {
  credits:        number;
  maxCompetitors: number;
  plan:           PlanId;
}

export function CompareInput({ credits, maxCompetitors, plan: _plan }: CompareInputProps) {
  const router = useRouter();

  // Primary URL is always index 0; competitors start at index 1
  const [primaryUrl, setPrimaryUrl]         = useState('');
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(['']);
  const [errors, setErrors]                 = useState<Record<number, string>>({});
  const [loading, setLoading]               = useState(false);

  const totalUrls = 1 + competitorUrls.filter((u) => u.trim()).length;

  const validateAll = (): boolean => {
    const newErrors: Record<number, string> = {};

    const primaryNorm = normalizeUrl(primaryUrl);
    const r = urlSchema.safeParse(primaryNorm);
    if (!r.success) newErrors[0] = r.error.errors[0].message;

    competitorUrls.forEach((u, i) => {
      const norm = normalizeUrl(u);
      if (!norm) return; // empty = ok (will be removed before submit)
      const rr = urlSchema.safeParse(norm);
      if (!rr.success) newErrors[i + 1] = rr.error.errors[0].message;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addCompetitor = () => {
    if (competitorUrls.length >= maxCompetitors) {
      toast.error(`Your plan allows up to ${maxCompetitors} competitor URL${maxCompetitors !== 1 ? 's' : ''}`);
      return;
    }
    setCompetitorUrls((prev) => [...prev, '']);
  };

  const removeCompetitor = (i: number) => {
    setCompetitorUrls((prev) => prev.filter((_, idx) => idx !== i));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[i + 1];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    const allUrls = [
      normalizeUrl(primaryUrl),
      ...competitorUrls.filter((u) => u.trim()).map(normalizeUrl),
    ];

    const creditsCost = allUrls.length;
    if (credits < creditsCost) {
      toast.error(`You need ${creditsCost} credits for this comparison but only have ${credits}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: allUrls }),
      });

      if (res.status === 403) {
        const d = await res.json();
        toast.error(d.error ?? 'Feature not available on your plan.');
        return;
      }

      if (res.status === 402) {
        const d = await res.json();
        toast.error(d.error ?? 'Insufficient credits.');
        return;
      }

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error ?? 'Failed to start comparison');
      }

      const { comparisonId } = await res.json();
      router.push(`/compare/${comparisonId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Primary URL */}
      <div className="space-y-1.5">
        <Label htmlFor="primary-url" className="flex items-center gap-2">
          Your website
          <span className="text-xs bg-orange-100 dark:bg-orange-950/40 text-orange-500 px-2 py-0.5 rounded-full">Primary</span>
        </Label>
        <Input
          id="primary-url"
          type="text"
          placeholder="example.com"
          value={primaryUrl}
          onChange={(e) => {
            setPrimaryUrl(e.target.value);
            if (errors[0]) {
              const norm = normalizeUrl(e.target.value);
              if (urlSchema.safeParse(norm).success) {
                setErrors((prev) => { const n = { ...prev }; delete n[0]; return n; });
              }
            }
          }}
          aria-invalid={!!errors[0]}
          className={errors[0] ? 'border-red-500/60' : ''}
        />
        {errors[0] && <p className="text-xs text-red-400">{errors[0]}</p>}
      </div>

      {/* Competitor URLs */}
      <div className="space-y-3">
        <Label>Competitor sites</Label>
        {competitorUrls.map((url, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <Input
                type="text"
                placeholder={`competitor${i + 1}.com`}
                value={url}
                onChange={(e) => {
                  const newUrls = [...competitorUrls];
                  newUrls[i] = e.target.value;
                  setCompetitorUrls(newUrls);
                  if (errors[i + 1]) {
                    const norm = normalizeUrl(e.target.value);
                    if (!norm || urlSchema.safeParse(norm).success) {
                      setErrors((prev) => { const n = { ...prev }; delete n[i + 1]; return n; });
                    }
                  }
                }}
                aria-invalid={!!errors[i + 1]}
                className={errors[i + 1] ? 'border-red-500/60' : ''}
              />
              {errors[i + 1] && <p className="text-xs text-red-400">{errors[i + 1]}</p>}
            </div>
            {competitorUrls.length > 1 && (
              <button
                type="button"
                onClick={() => removeCompetitor(i)}
                className="mt-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0"
                aria-label={`Remove competitor ${i + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}

        {competitorUrls.length < maxCompetitors && (
          <button
            type="button"
            onClick={addCompetitor}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-orange-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add another competitor
          </button>
        )}
      </div>

      {/* Credit info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground/60 pt-1">
        <span>
          Cost: {totalUrls} credit{totalUrls !== 1 ? 's' : ''} •{' '}
          You have: {credits}
        </span>
        {credits < totalUrls && (
          <a href="/settings" className="text-amber-400 hover:underline">Upgrade →</a>
        )}
      </div>

      <Button
        type="submit"
        disabled={loading || credits < totalUrls}
        className="w-full bg-orange-600 text-white hover:from-orange-400 hover:to-orange-400"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Starting comparison…</>
        ) : (
          `Compare ${totalUrls} site${totalUrls !== 1 ? 's' : ''}`
        )}
      </Button>
    </form>
  );
}
