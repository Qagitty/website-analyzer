'use client';

import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { MobileSidebar } from '@/components/shared/MobileSidebar';

export function Navbar({ user }: { user: User }) {
  const router = useRouter();
  const supabase = createBrowserClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-14 border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shrink-0">
      {/* Hamburger — only mounted on mobile so no ghost box on desktop */}
      <div className="md:hidden">
        <MobileSidebar />
      </div>
      {/* Spacer so right-side controls stay right on desktop */}
      <div className="hidden md:block" />
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <span className="text-sm text-[#94A3B8] truncate max-w-[140px] md:max-w-none hidden xs:block">
          {user.email}
        </span>
        <ThemeToggle />
        <Button variant="outline" size="sm" onClick={signOut} className="border-white/10 text-[#94A3B8] hover:bg-white/5 hover:text-white">
          Sign out
        </Button>
      </div>
    </header>
  );
}
