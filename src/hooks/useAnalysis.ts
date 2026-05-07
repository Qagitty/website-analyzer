'use client';

import { useState, useCallback } from 'react';
import type { AnalysisStatus } from '@/types/analysis';

interface AnalysisState {
  id: string | null;
  status: AnalysisStatus | null;
  queuePosition: number | null;
  loading: boolean;
  error: string | null;
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    id: null,
    status: null,
    queuePosition: null,
    loading: false,
    error: null,
  });

  const startAnalysis = useCallback(async (url: string): Promise<string | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to start analysis');
      }

      setState((s) => ({
        ...s,
        id: data.analysisId,
        status: 'queued',
        queuePosition: data.queuePosition,
        loading: false,
      }));

      return data.analysisId;
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
      return null;
    }
  }, []);

  const updateStatus = useCallback((status: AnalysisStatus, queuePosition?: number) => {
    setState((s) => ({ ...s, status, queuePosition: queuePosition ?? s.queuePosition }));
  }, []);

  return { ...state, startAnalysis, updateStatus };
}
