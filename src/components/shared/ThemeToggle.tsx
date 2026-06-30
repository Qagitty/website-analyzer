'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-[52px] h-[28px]" />;

  const isDark = theme === 'dark';

  return (
    <button
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative inline-flex h-[26px] w-[48px] shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isDark
          ? 'bg-orange-600 border-orange-600'
          : 'bg-muted border-border'
      }`}
    >
      {/* Track icons */}
      <span className="absolute left-1.5 text-[10px] select-none">
        {isDark ? '🌙' : ''}
      </span>
      <span className="absolute right-1.5 text-[10px] select-none">
        {isDark ? '' : '☀️'}
      </span>
      {/* Thumb */}
      <span
        className={`inline-block h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          isDark ? 'translate-x-[24px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}
