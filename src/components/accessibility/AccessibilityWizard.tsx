'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Profile basics' },
  { id: 2, label: 'Site details' },
  { id: 3, label: 'Standards' },
  { id: 4, label: 'Jurisdictions' },
  { id: 5, label: 'Sector' },
  { id: 6, label: 'Assessment scope' },
  { id: 7, label: 'Schedule' },
  { id: 8, label: 'Critical journeys' },
  { id: 9, label: 'Review & create' },
];

const STANDARD_OPTIONS = [
  { value: 'wcag21_a',  label: 'WCAG 2.1 Level A' },
  { value: 'wcag21_aa', label: 'WCAG 2.1 Level AA (recommended)' },
  { value: 'wcag22_aa', label: 'WCAG 2.2 Level AA' },
  { value: 'en301549',  label: 'EN 301 549 (EU)' },
  { value: 'section508', label: 'Section 508 (US)' },
];

const JURISDICTION_OPTIONS = [
  { value: 'eu_eaa',          label: 'EU — European Accessibility Act' },
  { value: 'eu_public',       label: 'EU — Public Sector Bodies Directive' },
  { value: 'uk_public',       label: 'UK — Public Sector Bodies Regulations' },
  { value: 'us_section508',   label: 'US — Section 508' },
  { value: 'us_ada',          label: 'US — ADA Title II' },
  { value: 'ca_aoda',         label: 'CA — AODA' },
  { value: 'au_dda',          label: 'AU — Disability Discrimination Act' },
];

const SCHEDULE_OPTIONS = [
  { value: 'none',    label: 'Manual only' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

interface WizardData {
  name:                    string;
  site_url:                string;
  description:             string;
  selected_standards:      string[];
  jurisdictions:           string[];
  public_sector:           boolean;
  provides_consumer_services: boolean;
  assessment_page_mode:    string;
  page_urls:               string;
  schedule:                string;
  journeys:                { name: string; description: string }[];
}

const initialData: WizardData = {
  name:                    '',
  site_url:                '',
  description:             '',
  selected_standards:      ['wcag21_aa'],
  jurisdictions:           [],
  public_sector:           false,
  provides_consumer_services: false,
  assessment_page_mode:    'sitemap',
  page_urls:               '',
  schedule:                'none',
  journeys:                [],
};

export function AccessibilityWizard() {
  const [step,    setStep]    = useState(1);
  const [data,    setData]    = useState<WizardData>(initialData);
  const [saving,  setSaving]  = useState(false);
  const [journey, setJourney] = useState({ name: '', description: '' });
  const router                = useRouter();

  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const toggleSet = (key: 'selected_standards' | 'jurisdictions', value: string) => {
    setData((prev) => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };

  const addJourney = () => {
    if (!journey.name.trim()) return;
    setData((prev) => ({ ...prev, journeys: [...prev.journeys, { ...journey }] }));
    setJourney({ name: '', description: '' });
  };

  const handleCreate = async () => {
    if (!data.name.trim() || !data.site_url.trim()) {
      toast.error('Profile name and site URL are required.');
      return;
    }

    setSaving(true);
    try {
      const body = {
        name:                       data.name,
        site_url:                   data.site_url.startsWith('http') ? data.site_url : `https://${data.site_url}`,
        description:                data.description || null,
        selected_standards:         data.selected_standards,
        jurisdiction_ids:           data.jurisdictions,
        public_sector:              data.public_sector,
        provides_consumer_services: data.provides_consumer_services,
        assessment_page_mode:       data.assessment_page_mode,
        schedule:                   data.schedule === 'none' ? null : data.schedule,
        page_urls:                  data.page_urls
          ? data.page_urls.split('\n').map((u) => u.trim()).filter(Boolean)
          : [],
        journeys:                   data.journeys,
      };

      const res = await fetch('/api/accessibility/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to create profile');
      }

      const { id } = await res.json();
      toast.success('Accessibility profile created.');
      router.push(`/accessibility/${id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setSaving(false);
    }
  };

  const canAdvance = () => {
    if (step === 1) return data.name.trim().length > 0;
    if (step === 2) return data.site_url.trim().length > 0;
    if (step === 3) return data.selected_standards.length > 0;
    return true;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Step indicator */}
      <nav aria-label="Wizard steps">
        <ol className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s) => (
            <li key={s.id} className="flex items-center gap-1 shrink-0">
              <button
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  s.id === step
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : s.id < step
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-border text-muted-foreground'
                }`}
                onClick={() => s.id < step && setStep(s.id)}
                aria-current={s.id === step ? 'step' : undefined}
                aria-label={`Step ${s.id}: ${s.label}${s.id < step ? ' (completed)' : ''}`}
                disabled={s.id > step}
              >
                {s.id < step ? <Check className="h-3 w-3" /> : s.id}
              </button>
              {s.id < STEPS.length && <div className="h-px w-4 bg-border" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <p className="text-sm font-medium mt-2">{STEPS[step - 1].label}</p>
      </nav>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Step 1: Basics */}
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="wizard-name">Profile name <span className="text-red-500">*</span></Label>
                <Input
                  id="wizard-name"
                  value={data.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Main website accessibility"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wizard-desc">Description</Label>
                <Textarea
                  id="wizard-desc"
                  value={data.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Optional: describe the scope of this accessibility profile"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Step 2: Site details */}
          {step === 2 && (
            <div className="space-y-1.5">
              <Label htmlFor="wizard-url">Site URL <span className="text-red-500">*</span></Label>
              <Input
                id="wizard-url"
                value={data.site_url}
                onChange={(e) => set('site_url', e.target.value)}
                placeholder="https://example.com"
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                The root URL of the website this profile covers.
              </p>
            </div>
          )}

          {/* Step 3: Standards */}
          {step === 3 && (
            <fieldset>
              <legend className="text-sm font-medium mb-3">
                Select standards to check against <span className="text-red-500">*</span>
              </legend>
              <div className="space-y-2">
                {STANDARD_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={data.selected_standards.includes(opt.value)}
                      onCheckedChange={() => toggleSet('selected_standards', opt.value)}
                      aria-label={opt.label}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Step 4: Jurisdictions */}
          {step === 4 && (
            <fieldset>
              <legend className="text-sm font-medium mb-1">
                Relevant jurisdictions
              </legend>
              <p className="text-xs text-muted-foreground mb-3">
                Select the legal jurisdictions where your site operates. This informs the regional accessibility risk assessment — it does not certify legal compliance.
              </p>
              <div className="space-y-2">
                {JURISDICTION_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={data.jurisdictions.includes(opt.value)}
                      onCheckedChange={() => toggleSet('jurisdictions', opt.value)}
                      aria-label={opt.label}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Step 5: Sector */}
          {step === 5 && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Organisation type</legend>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={data.public_sector}
                  onCheckedChange={(v) => set('public_sector', Boolean(v))}
                  aria-label="Public sector organisation"
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Public sector</p>
                  <p className="text-xs text-muted-foreground">Government, local authorities, public bodies</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={data.provides_consumer_services}
                  onCheckedChange={(v) => set('provides_consumer_services', Boolean(v))}
                  aria-label="Provides consumer-facing services"
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Consumer-facing services</p>
                  <p className="text-xs text-muted-foreground">E-commerce, banking, transport, communications</p>
                </div>
              </label>
            </fieldset>
          )}

          {/* Step 6: Assessment scope */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wizard-page-mode">Page selection mode</Label>
                <Select value={data.assessment_page_mode} onValueChange={(v) => set('assessment_page_mode', v)}>
                  <SelectTrigger id="wizard-page-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sitemap">From sitemap.xml</SelectItem>
                    <SelectItem value="crawl">Crawl from root URL</SelectItem>
                    <SelectItem value="manual">Manual URL list</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {data.assessment_page_mode === 'manual' && (
                <div className="space-y-1.5">
                  <Label htmlFor="wizard-urls">Page URLs (one per line)</Label>
                  <Textarea
                    id="wizard-urls"
                    value={data.page_urls}
                    onChange={(e) => set('page_urls', e.target.value)}
                    placeholder="https://example.com&#10;https://example.com/about&#10;https://example.com/contact"
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 7: Schedule */}
          {step === 7 && (
            <div className="space-y-1.5">
              <Label htmlFor="wizard-schedule">Assessment schedule</Label>
              <Select value={data.schedule} onValueChange={(v) => set('schedule', v)}>
                <SelectTrigger id="wizard-schedule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Automated assessments run on this cadence. You can always trigger a manual assessment at any time.
              </p>
            </div>
          )}

          {/* Step 8: Critical journeys */}
          {step === 8 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Critical journeys are key user flows to include in every assessment (e.g. login, checkout, form submission).
              </p>
              <div className="space-y-2">
                <Input
                  value={journey.name}
                  onChange={(e) => setJourney((j) => ({ ...j, name: e.target.value }))}
                  placeholder="Journey name (e.g. User registration)"
                  aria-label="Journey name"
                />
                <Input
                  value={journey.description}
                  onChange={(e) => setJourney((j) => ({ ...j, description: e.target.value }))}
                  placeholder="Optional description"
                  aria-label="Journey description"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addJourney}
                  disabled={!journey.name.trim()}
                >
                  Add journey
                </Button>
              </div>
              {data.journeys.length > 0 && (
                <ul className="space-y-1" role="list">
                  {data.journeys.map((j, i) => (
                    <li key={i} className="flex items-center justify-between text-sm border rounded p-2">
                      <span className="font-medium">{j.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setData((prev) => ({ ...prev, journeys: prev.journeys.filter((_, idx) => idx !== i) }))}
                        aria-label={`Remove journey ${j.name}`}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Step 9: Review */}
          {step === 9 && (
            <div className="space-y-4 text-sm">
              <CardHeader className="px-0 pt-0 pb-2">
                <CardTitle className="text-base">Review your profile</CardTitle>
              </CardHeader>
              <dl className="space-y-2">
                {[
                  ['Name', data.name],
                  ['Site URL', data.site_url],
                  ['Description', data.description || '—'],
                  ['Standards', data.selected_standards.map((s) => STANDARD_OPTIONS.find((o) => o.value === s)?.label ?? s).join(', ') || '—'],
                  ['Jurisdictions', data.jurisdictions.map((j) => JURISDICTION_OPTIONS.find((o) => o.value === j)?.label ?? j).join(', ') || 'None selected'],
                  ['Public sector', data.public_sector ? 'Yes' : 'No'],
                  ['Consumer services', data.provides_consumer_services ? 'Yes' : 'No'],
                  ['Page mode', data.assessment_page_mode],
                  ['Schedule', SCHEDULE_OPTIONS.find((o) => o.value === data.schedule)?.label ?? data.schedule],
                  ['Critical journeys', data.journeys.length > 0 ? data.journeys.map((j) => j.name).join(', ') : 'None'],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-2">
                    <dt className="font-medium w-40 shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="break-all">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          Back
        </Button>

        {step < 9 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create profile'}
          </Button>
        )}
      </div>
    </div>
  );
}
