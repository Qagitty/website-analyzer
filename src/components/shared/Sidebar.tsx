'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { UserMenu } from '@/components/shared/UserMenu';
import { Code2, ShieldCheck, BarChart2, Users } from 'lucide-react';
import { WebScoreLogo } from '@/components/shared/WebScoreLogo';

const NAV_ITEMS = [
  { href: '/dashboard',       label: 'Dashboard' },
  { href: '/analyze',         label: 'Analyze',    exact: true },
  { href: '/analyze/compare', label: 'Compare',    icon: BarChart2 },
  { href: '/reports',         label: 'Reports' },
  { href: '/monitors',        label: 'Monitors' },
  { href: '/leads',           label: 'Leads',      icon: Users },
  { href: '/compliance',      label: 'Compliance', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-background flex-col">
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
        <Link href="/dashboard">
          <WebScoreLogo size={26} className="text-base" />
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                ((item as any).exact ? pathname === item.href : pathname.startsWith(item.href))
                  ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-l-2 border-orange-500 pl-[10px]'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/docs"
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            pathname.startsWith('/docs')
              ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-l-2 border-orange-500 pl-[10px]'
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
