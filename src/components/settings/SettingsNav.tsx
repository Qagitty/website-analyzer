'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/settings',               label: 'General',       exact: true  },
  { href: '/settings/notifications', label: 'Notifications', exact: false },
  { href: '/settings/billing',       label: 'Billing',       exact: false },
  { href: '/settings/team',          label: 'Team',          exact: false },
  { href: '/settings/developers',    label: 'Developers',    exact: false },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-0 border-b border-border overflow-x-auto">
      {TABS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              active
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
