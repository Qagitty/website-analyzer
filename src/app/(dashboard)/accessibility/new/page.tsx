export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AccessibilityWizard } from '@/components/accessibility/AccessibilityWizard';
import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New accessibility profile — WebScore',
};

export default async function NewAccessibilityProfilePage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-indigo-500" aria-hidden="true" />
          New accessibility profile
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set up an accessibility profile to begin running regional risk assessments and collecting technical conformance evidence.
        </p>
      </div>
      <AccessibilityWizard />
    </main>
  );
}
