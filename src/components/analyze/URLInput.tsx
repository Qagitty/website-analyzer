'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ImageIcon, X, ChevronDown, ChevronUp } from 'lucide-react';

const urlSchema = z.string().url('Please enter a valid domain (e.g. example.com)');

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE_MB = 10;

export function URLInput({ credits }: { credits: number }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDesign, setShowDesign] = useState(false);
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [designPreview, setDesignPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const validate = (value: string): boolean => {
    const result = urlSchema.safeParse(normalizeUrl(value));
    if (!result.success) {
      setError(result.error.errors[0].message);
      return false;
    }
    setError('');
    return true;
  };

  const handleDesignFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Please upload a PNG, JPG, or WebP image');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_SIZE_MB}MB`);
      return;
    }
    setDesignFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setDesignPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearDesign = () => {
    setDesignFile(null);
    setDesignPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleDesignFile(file);
  };

  // Compress image to JPEG ≤1920px wide before base64-encoding.
  // Prevents 413 FUNCTION_PAYLOAD_TOO_LARGE on Vercel (4.5MB limit).
  const compressImage = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX_WIDTH = 1920;
        let { width, height } = img;
        if (width > MAX_WIDTH) {
          height = Math.round(height * MAX_WIDTH / width);
          width = MAX_WIDTH;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = objectUrl;
    });

  const [loadingLabel, setLoadingLabel] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    setUrl(normalized);
    if (!validate(normalized)) return;

    setLoading(true);
    setLoadingLabel('Checking site…');
    setError('');
    try {
      let designScreenshotBase64: string | null = null;
      let designMimeType: string | null = null;

      if (designFile) {
        const compressed = await compressImage(designFile);
        designScreenshotBase64 = compressed.base64;
        designMimeType = compressed.mimeType;
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalized,
          ...(designScreenshotBase64 && { designScreenshotBase64, designMimeType }),
        }),
      });

      if (res.status === 402) {
        toast.error('No credits remaining. Please upgrade your plan.');
        return;
      }

      if (res.status === 422) {
        const data = await res.json();
        setError(data.error ?? 'This URL could not be reached.');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to start analysis');
      }

      setLoadingLabel('Starting…');
      const { analysisId } = await res.json();
      router.push(`/analyze/${analysisId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="example.com"
          value={url}
          onChange={(e) => {
            const v = e.target.value;
            setUrl(v);
            if (error) validate(v.trim());
          }}
          className="flex-1"
          aria-label="Website URL"
          aria-invalid={!!error}
        />
        <Button type="submit" disabled={loading || credits === 0}>
          {loading ? 'Starting...' : 'Analyze'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {credits === 0 && (
        <p className="text-sm text-amber-400">
          No credits remaining.{' '}
          <a href="/settings" className="underline">Upgrade your plan</a>.
        </p>
      )}

      {credits > 0 && (
        <p className="text-xs text-muted-foreground/60">
          {credits} credit{credits !== 1 ? 's' : ''} remaining
        </p>
      )}

      {/* Design comparison toggle */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            setShowDesign((v) => !v);
            if (showDesign) clearDesign();
          }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDesign ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showDesign ? 'Hide design comparison' : '+ Compare with your design (optional)'}
        </button>

        {showDesign && (
          <div className="mt-3 bg-card border border-border rounded-xl p-4 space-y-3">
            {!designPreview ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
                  p-6 cursor-pointer transition-colors select-none
                  ${dragOver
                    ? 'border-orange-500/50 bg-orange-600/5'
                    : 'border-border hover:border-orange-300 dark:border-orange-900/50 hover:bg-white/[0.02]'}
                `}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Upload your design screenshot</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Drag & drop or click — PNG, JPG, WebP up to {MAX_SIZE_MB}MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDesignFile(file);
                  }}
                />
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-border bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={designPreview}
                  alt="Design preview"
                  className="h-16 w-24 object-cover rounded-lg border border-border"
                />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <span className="rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                    {designFile?.name}
                  </span>
                  <button
                    type="button"
                    onClick={clearDesign}
                    className="rounded bg-black/60 p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors text-xs"
                    aria-label="Remove design"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="bg-secondary text-muted-foreground border border-border text-xs px-2 py-0.5 rounded-full">Optional</span>
              <p className="text-xs text-muted-foreground">
                Claude AI will compare your design with the live site and highlight differences.
              </p>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
