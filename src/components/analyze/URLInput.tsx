'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ImageIcon, X, ChevronDown, ChevronUp } from 'lucide-react';

const urlSchema = z.string().url('Please enter a valid URL including https://');

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
    const result = urlSchema.safeParse(value);
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

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix, keep only the base64 part
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    setUrl(trimmed);
    if (!validate(trimmed)) return;

    setLoading(true);
    try {
      let designScreenshotBase64: string | null = null;
      let designMimeType: string | null = null;

      if (designFile) {
        designScreenshotBase64 = await toBase64(designFile);
        designMimeType = designFile.type;
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmed,
          ...(designScreenshotBase64 && { designScreenshotBase64, designMimeType }),
        }),
      });

      if (res.status === 402) {
        toast.error('No credits remaining. Please upgrade your plan.');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to start analysis');
      }

      const { analysisId } = await res.json();
      router.push(`/analyze/${analysisId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="https://example.com"
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
        <p className="text-xs text-[#475569]">
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
          <div className="mt-3 bg-[#13131A] border border-white/5 rounded-xl p-4 space-y-3">
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
                    ? 'border-indigo-500/50 bg-indigo-500/5'
                    : 'border-white/10 hover:border-indigo-500/30 hover:bg-white/[0.02]'}
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
              <div className="relative rounded-lg overflow-hidden border border-white/10 bg-[#1C1C27]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={designPreview}
                  alt="Design preview"
                  className="h-16 w-24 object-cover rounded-lg border border-white/10"
                />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <span className="rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                    {designFile?.name}
                  </span>
                  <button
                    type="button"
                    onClick={clearDesign}
                    className="rounded bg-black/60 p-0.5 text-[#475569] hover:text-muted-foreground transition-colors text-xs"
                    aria-label="Remove design"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="bg-[#1C1C27] text-muted-foreground border border-white/10 text-xs px-2 py-0.5 rounded-full">Optional</span>
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
