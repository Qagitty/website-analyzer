'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { UserMenu } from '@/components/shared/UserMenu';
import { Code2, Zap, ShieldCheck, BarChart2, Users } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard',       label: 'Dashboard' },
  { href: '/analyze',         label: 'Analyze',    exact: true },
  { href: '/analyze/compare', label: 'Compare',    icon: BarChart2 },
  { href: '/reports',         label: 'Reports' },
  { href: '/monitors',        label: 'Monitors' },
  { href: '/leads',           label: 'Leads',      icon: Users },
  { href: '/compliance',      label: 'Compliance', icon: ShieldCheck },
];

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open navigation menu"
          className="md:hidden flex flex-col justify-center gap-1.5 p-2 rounded-md hover:bg-muted"
        >
          <span className="block w-5 h-0.5 bg-current" />
          <span className="block w-5 h-0.5 bg-current" />
          <span className="block w-5 h-0.5 bg-current" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 flex flex-col">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 font-bold text-base text-foreground"
          >
            <div className="h-7 w-7 rounded bg-orange-600 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-white" />
            </div>
            WebAnalyzer
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = (item as any).exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
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
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith('/docs')
                ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-l-2 border-orange-500 pl-[10px]'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Code2 className="h-4 w-4 shrink-0" />
            Docs
          </Link>
        </nav>

        {/* User account at bottom — same as desktop */}
        <UserMenu />
      </SheetContent>
    </Sheet>
  );
}
