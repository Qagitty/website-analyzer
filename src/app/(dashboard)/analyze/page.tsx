import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { URLInput } from '@/components/analyze/URLInput';

export const metadata: Metadata = { title: 'Analyze Website' };

export default async function AnalyzePage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from('user_settings')
    .select('credits')
    .eq('user_id', user!.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Analyze a Website</h1>
        <p className="text-muted-foreground mt-2">
          Enter a URL to get a full performance, accessibility, and AI analysis.
        </p>
      </div>
      <URLInput credits={settings?.credits ?? 0} />
    </div>
  );
}
