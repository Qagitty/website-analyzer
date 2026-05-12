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
    <aside className="hidden md:flex w-56 shrink-0 border-r border-white/5 bg-[#0A0A0F] flex-col">
      <div className="p-4 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-base text-[#F8FAFC]">
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
                ? 'bg-indigo-500/10 text-indigo-300 border-l-2 border-indigo-500 pl-[10px]'
                : 'text-[#94A3B8] hover:bg-white/5 hover:text-white'
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
              ? 'bg-indigo-500/10 text-indigo-300 border-l-2 border-indigo-500 pl-[10px]'
              : 'text-[#94A3B8] hover:bg-white/5 hover:text-white'
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
