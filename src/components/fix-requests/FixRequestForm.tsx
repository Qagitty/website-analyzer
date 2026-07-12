'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { FixRequestType, FixRequestSeverity } from '@/types/fix-request';

const REQUEST_TYPES: { value: FixRequestType; label: string }[] = [
  { value: 'fix',          label: 'Fix — implement a specific remediation' },
  { value: 'audit',        label: 'Audit — investigate and confirm root cause' },
  { value: 'estimate',     label: 'Estimate — provide effort/cost estimate' },
  { value: 'review',       label: 'Review — review a proposed fix' },
  { value: 'verification', label: 'Verification — confirm fix is complete' },
  { value: 'consultation', label: 'Consultation — advice without commitment' },
];

const SEVERITIES: { value: FixRequestSeverity; label: string }[] = [
  { value: 'critical',      label: 'Critical' },
  { value: 'high',          label: 'High' },
  { value: 'medium',        label: 'Medium' },
  { value: 'low',           label: 'Low' },
  { value: 'informational', label: 'Informational' },
];

export function FixRequestForm() {
  const router = useRouter();
  const [requestType, setRequestType] = useState<FixRequestType>('fix');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState<FixRequestSeverity>('medium');
  const [technicalDescription, setTechnicalDescription] = useState('');
  const [affectedUrlsText, setAffectedUrlsText] = useState('');
  const [recommendedFix, setRecommendedFix] = useState('');
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState('');

  function validateTitle(v: string) {
    if (v.length < 3) {
      setTitleError('Title must be at least 3 characters');
      return false;
    }
    if (v.length > 200) {
      setTitleError('Title must be at most 200 characters');
      return false;
    }
    setTitleError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateTitle(title)) return;

    const affectedUrls = affectedUrlsText
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 20);

    setLoading(true);
    try {
      const res = await fetch('/api/fix-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType,
          title: title.trim(),
          summary: summary.trim() || undefined,
          severity,
          technicalDescription: technicalDescription.trim() || undefined,
          affectedUrls,
          recommendedFix: recommendedFix.trim() || undefined,
          sourceType: 'manual',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create');
      }
      const data = await res.json();
      toast.success('Fix request created');
      router.push(`/fix-requests/${data.fixRequest?.id ?? data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Request Type */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Request Type</Label>
        <RadioGroup value={requestType} onValueChange={(v) => setRequestType(v as FixRequestType)}>
          <div className="grid grid-cols-1 gap-2">
            {REQUEST_TYPES.map((rt) => (
              <div key={rt.value} className="flex items-start gap-3 rounded-lg border border-border p-3 has-[input:checked]:border-indigo-500/50 has-[input:checked]:bg-indigo-500/5">
                <RadioGroupItem value={rt.value} id={`type-${rt.value}`} className="mt-0.5" />
                <Label htmlFor={`type-${rt.value}`} className="cursor-pointer font-normal">
                  {rt.label}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">
          Title <span className="text-red-400">*</span>
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) validateTitle(e.target.value);
          }}
          placeholder="Brief description of the issue"
          maxLength={200}
          className="bg-card border-border"
          aria-invalid={!!titleError}
        />
        {titleError && <p className="text-xs text-red-400">{titleError}</p>}
      </div>

      {/* Severity */}
      <div className="space-y-1.5">
        <Label>Severity</Label>
        <Select value={severity} onValueChange={(v) => setSeverity(v as FixRequestSeverity)}>
          <SelectTrigger className="bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {SEVERITIES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="space-y-1.5">
        <Label htmlFor="summary">Summary</Label>
        <Textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Short description of the problem and its impact"
          maxLength={1000}
          rows={3}
          className="bg-card border-border resize-none"
        />
      </div>

      {/* Technical Description */}
      <div className="space-y-1.5">
        <Label htmlFor="technical">Technical Description</Label>
        <Textarea
          id="technical"
          value={technicalDescription}
          onChange={(e) => setTechnicalDescription(e.target.value)}
          placeholder="Detailed technical context, root cause analysis, code snippets…"
          rows={5}
          className="bg-card border-border resize-none"
        />
      </div>

      {/* Affected URLs */}
      <div className="space-y-1.5">
        <Label htmlFor="affected-urls">Affected URLs (one per line, max 20)</Label>
        <Textarea
          id="affected-urls"
          value={affectedUrlsText}
          onChange={(e) => setAffectedUrlsText(e.target.value)}
          placeholder="https://example.com/page"
          rows={3}
          className="bg-card border-border resize-none font-mono text-sm"
        />
      </div>

      {/* Recommended Fix */}
      <div className="space-y-1.5">
        <Label htmlFor="recommended-fix">Recommended Fix</Label>
        <Textarea
          id="recommended-fix"
          value={recommendedFix}
          onChange={(e) => setRecommendedFix(e.target.value)}
          placeholder="Describe the suggested approach or paste a code snippet"
          rows={4}
          className="bg-card border-border resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/fix-requests')}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {loading ? 'Creating…' : 'Create Fix Request'}
        </Button>
      </div>
    </form>
  );
}
