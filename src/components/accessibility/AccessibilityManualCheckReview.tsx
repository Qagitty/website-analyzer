'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { ManualCheckItem } from './AccessibilityManualCheckGrid';

const RESULT_OPTIONS = [
  { value: 'pass',           label: 'Pass',            description: 'Check fully meets the requirement' },
  { value: 'partial',        label: 'Partial',         description: 'Check partially meets the requirement' },
  { value: 'fail',           label: 'Fail',            description: 'Check does not meet the requirement' },
  { value: 'not_applicable', label: 'Not applicable',  description: 'This check does not apply to the site' },
  { value: 'not_tested',     label: 'Not tested',      description: 'Not yet evaluated' },
];

interface Props {
  check:      ManualCheckItem;
  onSaved?:   (resultId: string, newResult: string, notes: string) => void;
  onCancel?:  () => void;
}

export function AccessibilityManualCheckReview({ check, onSaved, onCancel }: Props) {
  const [result, setResult] = useState(check.result);
  const [notes,  setNotes]  = useState(check.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // Block bulk auto-pass (enforced by API too, but guard client-side)
    if (result === 'pass' && !notes.trim()) {
      toast.error('Please add notes describing how you verified this passes.');
      return;
    }

    setSaving(true);
    try {
      const endpoint = check.resultId
        ? `/api/accessibility/manual-check-results/${check.resultId}`
        : null;

      if (!endpoint) {
        toast.error('Cannot save — result ID not found. Please refresh.');
        return;
      }

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, notes }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Save failed');
      }

      toast.success('Manual check updated.');
      onSaved?.(check.resultId!, result, notes);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{check.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{check.description}</p>
        {check.wcag_criteria && check.wcag_criteria.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {check.wcag_criteria.map((c) => (
              <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Result selector */}
        <div className="space-y-1.5">
          <Label htmlFor={`result-${check.id}`}>Result</Label>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger id={`result-${check.id}`} aria-label="Select check result">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESULT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div>
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor={`notes-${check.id}`}>
            Notes {result === 'pass' ? <span className="text-red-500">*</span> : '(optional)'}
          </Label>
          <Textarea
            id={`notes-${check.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              result === 'pass'
                ? 'Describe how you verified this passes (required for Pass)…'
                : 'Optional: describe what was tested, observed issues, or evidence…'
            }
            rows={4}
            className="text-sm"
          />
          {result === 'pass' && !notes.trim() && (
            <p className="text-xs text-amber-600">
              Notes are required when marking a check as Pass to prevent auto-pass without review.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || (result === 'pass' && !notes.trim())}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
