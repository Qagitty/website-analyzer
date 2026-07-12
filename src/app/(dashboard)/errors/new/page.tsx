'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function NewErrorProjectPage() {
  const router = useRouter();

  const [name, setName]         = useState('');
  const [origin, setOrigin]     = useState('');
  const [environment, setEnv]   = useState<'production' | 'staging' | 'development' | 'custom'>('production');
  const [loading, setLoading]   = useState(false);
  const [newKey, setNewKey]     = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !origin.trim()) {
      toast.error('Name and origin are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/error-monitoring/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), normalizedOrigin: origin.trim(), environment }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? 'Failed to create project.');
        return;
      }
      setNewKey((data as { ingestionKey: string }).ingestionKey);
      setProjectId((data as { id: string }).id);
    } catch {
      toast.error('Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (newKey && projectId) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gradient">Project created!</h1>
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Your ingestion key is ready</p>
              <p className="text-xs text-muted-foreground mt-1">
                This key is shown <strong>once only</strong>. Copy it now and add it to your SDK configuration.
              </p>
            </div>
          </div>
          <div className="relative">
            <code className="block text-sm font-mono bg-[#0A0A0F] border border-indigo-500/30 rounded p-4 break-all text-indigo-300">
              {newKey}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-7 text-xs"
              onClick={copyKey}
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
        <Button
          className="bg-indigo-600 hover:bg-indigo-700 w-full"
          onClick={() => router.push(`/errors/${projectId}`)}
        >
          Continue to installation guide
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/errors"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold text-gradient">New Error Project</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="name">Project name</label>
          <Input
            id="name"
            placeholder="My Website"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="origin">Website origin</label>
          <Input
            id="origin"
            type="url"
            placeholder="https://example.com"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Only events from this origin will be accepted.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="environment">Environment</label>
          <select
            id="environment"
            value={environment}
            onChange={(e) => setEnv(e.target.value as typeof environment)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 w-full"
        >
          {loading ? 'Creating…' : 'Create project'}
        </Button>
      </form>
    </div>
  );
}
