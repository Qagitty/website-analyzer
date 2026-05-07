import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { AnalysisProgress } from '@/components/analyze/AnalysisProgress';

export const metadata: Metadata = { title: 'Analysis in Progress' };

export default async function AnalysisStatusPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('analyses')
    .select('status, queue_position, url, error_message')
    .eq('id', params.id)
    .single();

  const initialData = data
    ? {
        status: data.status as any,
        queuePosition: data.queue_position ?? undefined,
        url: data.url,
        errorMessage: data.error_message ?? undefined,
      }
    : undefined;

  return (
    <div className="max-w-xl mx-auto mt-16 space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Analyzing your website</h1>
        <p className="text-muted-foreground mt-2">
          This usually takes 30–60 seconds. You&apos;ll be redirected when done.
        </p>
      </div>
      <AnalysisProgress analysisId={params.id} initialData={initialData} />
    </div>
  );
}
