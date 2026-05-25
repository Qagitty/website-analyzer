'use client';

import type { User } from '@supabase/supabase-js';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { MobileSidebar } from '@/components/shared/MobileSidebar';

export function Navbar({ user }: { user: User }) {
  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="md:hidden">
        <MobileSidebar />
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <span className="text-sm text-muted-foreground truncate max-w-[140px] md:max-w-none hidden xs:block">
          {user.email}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
