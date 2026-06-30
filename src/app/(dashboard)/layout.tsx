import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/shared/Sidebar';
import { Navbar } from '@/components/shared/Navbar';
import { NOINDEX_NOFOLLOW_ROBOTS } from '@/lib/seo/robots';

export const metadata: Metadata = { robots: NOINDEX_NOFOLLOW_ROBOTS };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = (await headers()).get('x-pathname') ?? '';

  // /docs is public — render without sidebar when not logged in
  if (!user && pathname === '/docs') {
    return <>{children}</>;
  }

  if (!user) redirect('/login');

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar user={user!} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
