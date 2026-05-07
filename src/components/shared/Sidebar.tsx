'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CreditsDisplay } from '@/components/dashboard/CreditsDisplay';
import { useCredits } from '@/hooks/useCredits';
import { Code2 } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/analyze',   label: 'Analyze' },
  { href: '/reports',   label: 'Reports' },
  { href: '/monitors',  label: 'Monitors' },
  { href: '/settings',  label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { credits, loading } = useCredits();

  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r bg-muted/20 flex-col">
      <div className="p-4 border-b">
        <Link href="/dashboard" className="font-bold text-lg">
          WebAnalyzer
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/docs"
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            pathname.startsWith('/docs')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Code2 className="h-4 w-4" />
          Docs
        </Link>
      </nav>
      {loading ? (
        <div className="px-3 py-2">
          <div className="h-9 rounded-md bg-muted animate-pulse" />
        </div>
      ) : (
        <CreditsDisplay credits={credits} />
      )}
    </aside>
  );
}
