'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Lock, ImageIcon, X, Loader2 } from 'lucide-react';
import type { PlanId } from '@/lib/stripe/plans';

interface BrandingFormProps {
  plan: PlanId;
  initialAgencyName: string;
  initialBrandColor: string;
  initialShowPoweredBy: boolean;
  initialLogoPath?: string | null;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE_MB = 2;

export function BrandingForm({
  plan,
  initialAgencyName,
  initialBrandColor,
  initialShowPoweredBy,
  initialLogoPath,
}: BrandingFormProps) {
  const isPro          = plan === 'pro' || plan === 'agency' || plan === 'compliance';
  const isWhiteLabel   = plan === 'agency' || plan === 'compliance';

  const [agencyName, setAgencyName]         = useState(initialAgencyName);
  const [brandColor, setBrandColor]         = useState(initialBrandColor);
  const [showPoweredBy, setShowPoweredBy]   = useState(initialShowPoweredBy);
  const [saving, setSaving]                 = useState(false);

  // Logo state
  const [logoPath, setLogoPath]             = useState<string | null>(initialLogoPath ?? null);
  const [logoPreview, setLogoPreview]       = useState<string | null>(null);
  const [logoFile, setLogoFile]             = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo]   = useState(false);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  const handleLogoFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Use PNG, JPG, or WebP only');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Logo must be under ${MAX_SIZE_MB}MB`);
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append('logo', logoFile);
      const res = await fetch('/api/user/logo', { method: 'POST', body: form });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error ?? 'Upload failed');
      }
      const { logoPath: newPath } = await res.json();
      setLogoPath(newPath);
      setLogoFile(null);
      toast.success('Logo uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoPreview(null);
    setLogoFile(null);
    if (logoPath) {
      await fetch('/api/user/logo', { method: 'DELETE' });
      setLogoPath(null);
      toast.success('Logo removed');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // If a logo file is staged, upload it first
      if (logoFile) await handleUploadLogo();

      const res = await fetch('/api/user/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyName, brandColor, showPoweredBy }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? 'Failed to save branding settings');
      }

      toast.success('Branding settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>White-label Branding</CardTitle>
          <Badge variant="default" className="text-xs">
            {isWhiteLabel ? 'Agency' : isPro ? 'Pro' : 'Pro required'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Agency name — Pro+ */}
        <div className="space-y-1.5">
          <Label htmlFor="agencyName">Agency Name</Label>
          {isPro ? (
            <Input
              id="agencyName"
              type="text"
              placeholder="Your Agency Name"
              maxLength={60}
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
            />
          ) : (
            <div className="relative">
              <Input id="agencyName" disabled placeholder="Upgrade to Pro to set agency name" />
              <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/40" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Shown in the header of exported PDF reports.
          </p>
        </div>

        {/* Brand color — Pro+ */}
        <div className="space-y-1.5">
          <Label htmlFor="brandColor">Brand Color</Label>
          <div className={`flex items-center gap-3 p-3 bg-background border border-border rounded-lg ${!isPro ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              id="brandColor"
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              disabled={!isPro}
              className="h-10 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
              title="Pick brand color"
            />
            <div
              className="h-10 w-24 rounded border border-border"
              style={{ backgroundColor: brandColor }}
              aria-label={`Color preview: ${brandColor}`}
            />
            <span className="font-mono text-sm text-muted-foreground">{brandColor}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Used for headings and accents in PDF reports.
          </p>
        </div>

        {/* Logo upload — Agency+ only */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label>Agency Logo</Label>
            {!isWhiteLabel && (
              <Badge variant="outline" className="text-xs gap-1">
                <Lock className="h-3 w-3" /> Agency plan
              </Badge>
            )}
          </div>

          {isWhiteLabel ? (
            <div className="space-y-2">
              {/* Preview / placeholder */}
              {logoPreview || logoPath ? (
                <div className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logoPreview && (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-10 max-w-[120px] object-contain rounded border border-border"
                    />
                  )}
                  {!logoPreview && logoPath && (
                    <span className="text-xs text-muted-foreground font-mono">{logoPath}</span>
                  )}
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="ml-auto text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    aria-label="Remove logo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg hover:border-indigo-500/30 hover:bg-white/[0.02] transition-colors"
                >
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload logo (PNG, JPG, WebP — max {MAX_SIZE_MB}MB)
                  </span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES.join(',')}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoFile(file);
                }}
              />

              {logoFile && !uploadingLogo && (
                <p className="text-xs text-indigo-400">
                  {logoFile.name} staged — will upload on save
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg opacity-50">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Logo upload available on Agency plan
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Appears in the PDF report header. Square or wide logo works best.
          </p>
        </div>

        {/* Show "Powered by" toggle — Agency+ only */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <input
              id="showPoweredBy"
              type="checkbox"
              checked={showPoweredBy}
              onChange={(e) => {
                if (!isWhiteLabel && !e.target.checked) {
                  toast.error('Removing the "Powered by" badge requires an Agency plan.');
                  return;
                }
                setShowPoweredBy(e.target.checked);
              }}
              disabled={!isWhiteLabel && !showPoweredBy}
              className="h-4 w-4 cursor-pointer rounded accent-indigo-500 disabled:cursor-not-allowed"
            />
            <Label htmlFor="showPoweredBy" className="cursor-pointer flex items-center gap-2">
              Show &quot;Generated by WebAnalyzer&quot;
              {!isWhiteLabel && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Lock className="h-3 w-3" /> Agency to hide
                </Badge>
              )}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            When off, reports show only your agency name. Requires Agency plan.
          </p>
        </div>

        {uploadingLogo ? (
          <Button disabled className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading…
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={saving || !isPro}
            className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isPro ? 'Save Branding' : 'Pro plan required'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
