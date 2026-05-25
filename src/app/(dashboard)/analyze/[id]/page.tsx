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
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gradient">Analyzing your website</h1>
        <p className="text-muted-foreground text-sm">
          This usually takes 30–60 seconds. You&apos;ll be redirected when done.
        </p>
      </div>

      {/* Progress card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <AnalysisProgress analysisId={params.id} initialData={initialData} />
      </div>
    </div>
  );
}
