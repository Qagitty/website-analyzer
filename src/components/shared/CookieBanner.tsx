'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cookie_consent')) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    document.cookie = 'cookie_consent=accepted; max-age=31536000; path=/; SameSite=Lax';
    window.dispatchEvent(new Event('cookie_consent_accepted'));
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    document.cookie = 'cookie_consent=declined; max-age=31536000; path=/; SameSite=Lax';
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <p className="text-sm text-muted-foreground leading-relaxed">
          We use essential cookies to operate the Service and optional analytics cookies to understand
          usage and improve performance. Analytics cookies are only activated after your consent.{' '}
          <Link href="/cookies" className="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors">
            Cookie Policy
          </Link>
          {' '}·{' '}
          <Link href="/privacy" className="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors">
            Privacy Policy
          </Link>
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
          >
            Reject optional
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 transition-all"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
