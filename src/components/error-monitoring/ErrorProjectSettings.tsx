'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Project {
  id:               string;
  name:             string;
  environment:      string;
  allowed_origins:  string[];
  status:           string;
}

interface Props {
  project: Project;
}

export function ErrorProjectSettings({ project }: Props) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/error-monitoring/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Settings saved.');
      router.refresh();
    } catch {
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const rotateKey = async () => {
    setRotating(true);
    try {
      const res = await fetch(`/api/error-monitoring/projects/${project.id}/rotate-key`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setNewKey(data.ingestionKey as string);
      setShowRotateConfirm(false);
      toast.success('Key rotated. Copy the new key — it will not be shown again.');
    } catch {
      toast.error('Failed to rotate key.');
    } finally {
      setRotating(false);
    }
  };

  const toggleStatus = async () => {
    const newStatus = project.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch(`/api/error-monitoring/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Project ${newStatus === 'active' ? 'enabled' : 'disabled'}.`);
      router.refresh();
    } catch {
      toast.error('Failed to update status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="project-name">Project name</label>
        <div className="flex gap-2">
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="max-w-sm"
          />
          <Button onClick={saveSettings} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Rotate key */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-2">
          <KeyRound className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Rotate ingestion key</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rotating invalidates the old key immediately. Update your SDK before rotating.
            </p>
          </div>
        </div>

        {newKey ? (
          <div className="space-y-2">
            <p className="text-xs text-amber-400 font-medium">New key (copy now — shown once):</p>
            <code className="block text-xs font-mono bg-[#0A0A0F] border border-amber-500/30 rounded p-3 break-all text-amber-300">
              {newKey}
            </code>
          </div>
        ) : showRotateConfirm ? (
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-xs text-red-400">Old key stops working immediately.</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={rotateKey}
              disabled={rotating}
            >
              {rotating ? 'Rotating…' : 'Confirm rotate'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRotateConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            onClick={() => setShowRotateConfirm(true)}
          >
            Rotate key
          </Button>
        )}
      </div>

      {/* Enable/disable */}
      <div className="border border-border rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            {project.status === 'active' ? 'Disable project' : 'Enable project'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {project.status === 'active'
              ? 'Stops accepting new events without deleting data.'
              : 'Re-enable to accept events again.'}
          </p>
        </div>
        <Button
          size="sm"
          variant={project.status === 'active' ? 'outline' : 'default'}
          className={project.status === 'active' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'bg-indigo-600 hover:bg-indigo-700'}
          onClick={toggleStatus}
        >
          {project.status === 'active' ? 'Disable' : 'Enable'}
        </Button>
      </div>
    </div>
  );
}
