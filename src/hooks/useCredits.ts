'use client';

import { useState, useEffect, useRef } from 'react';

interface Credits {
  credits: number;
  creditsUsed: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// Re-fetch on tab focus only if data is older than 5 minutes
const STALE_MS = 5 * 60 * 1000;

export function useCredits(): Credits {
  const [credits, setCredits] = useState(0);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const lastFetchedAt = useRef(0);

  const fetch_ = async (force = false) => {
    // Skip if data is still fresh (unless forced — initial load or explicit refresh)
    if (!force && initialized.current && Date.now() - lastFetchedAt.current < STALE_MS) return;

    if (!initialized.current) setLoading(true);
    try {
      const res = await fetch('/api/user/credits');
      if (!res.ok) throw new Error('Failed to load credits');
      const data = await res.json();
      setCredits(data.credits);
      setCreditsUsed(data.creditsUsed);
      setError(null);
      lastFetchedAt.current = Date.now();
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetch_(true);

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetch_();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { credits, creditsUsed, loading, error, refresh: () => fetch_(true) };
}
