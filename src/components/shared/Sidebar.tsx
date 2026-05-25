'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { UserMenu } from '@/components/shared/UserMenu';
import { Code2, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/analyze',   label: 'Analyze' },
  { href: '/reports',   label: 'Reports' },
  { href: '/monitors',  label: 'Monitors' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-background flex-col">
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-base text-foreground">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-white" />
          </div>
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
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-l-2 border-indigo-500 pl-[10px]'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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
              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-l-2 border-indigo-500 pl-[10px]'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Code2 className="h-4 w-4" />
          Docs
        </Link>
      </nav>
      <UserMenu />
    </aside>
  );
}
