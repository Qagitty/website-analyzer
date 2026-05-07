'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function RetryButton({ url }: { url: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const retry = async (e: React.MouseEvent) => {
    e.preventDefault(); // don't follow the parent <Link>
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.status === 402) {
        toast.error('No credits remaining. Please upgrade your plan.');
        return;
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed to start analysis');
      router.push(`/analyze/${data.analysisId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={retry} disabled={loading}>
      {loading ? '…' : '↺ Retry'}
    </Button>
  );
}
