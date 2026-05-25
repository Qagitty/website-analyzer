'use client';

import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';

export function ConsentAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('cookie_consent') === 'accepted') {
      setConsented(true);
    }
    const handler = () => setConsented(true);
    window.addEventListener('cookie_consent_accepted', handler);
    return () => window.removeEventListener('cookie_consent_accepted', handler);
  }, []);

  if (!consented) return null;
  return <Analytics />;
}
