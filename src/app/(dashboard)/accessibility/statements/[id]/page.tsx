export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AccessibilityStatementEditor } from '@/components/accessibility/AccessibilityStatementEditor';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Accessibility statement — WebScore',
};

export default async function AccessibilityStatementPage(props: Props) {
  const { id } = await props.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch statement with profile ownership check
  const { data: statement } = await supabase
    .from('accessibility_statements')
    .select(`
      *,
      accessibility_profiles!inner(id, name, user_id)
    `)
    .eq('id', id)
    .eq('accessibility_profiles.user_id', user.id)
    .single();

  if (!statement) notFound();

  const profile = statement.accessibility_profiles as unknown as {
    id: string; name: string;
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/accessibility/${profile.id}`}>
            <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            {profile.name}
          </Link>
        </Button>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Accessibility statement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This is a draft statement template. Manual review required before publication.
          </p>
        </div>
        <Badge variant="outline" className="capitalize">{statement.status}</Badge>
      </div>

      <AccessibilityStatementEditor statement={statement} />
    </main>
  );
}
