'use client';

import { useState, useEffect, useRef } from 'react';

interface Credits {
  credits: number;
  creditsUsed: number;
  /** True only during the very first load — subsequent polls are silent */
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCredits(): Credits {
  const [credits, setCredits] = useState(0);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const fetch_ = async () => {
    // Only show loading spinner on the very first fetch
    if (!initialized.current) setLoading(true);

    try {
      const res = await fetch('/api/user/credits');
      if (!res.ok) throw new Error('Failed to load credits');
      const data = await res.json();
      setCredits(data.credits);
      setCreditsUsed(data.creditsUsed);
      setError(null);
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
    fetch_();

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetch_();
    };
    document.addEventListener('visibilitychange', onVisible);

    const interval = setInterval(fetch_, 30_000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { credits, creditsUsed, loading, error, refresh: fetch_ };
}
