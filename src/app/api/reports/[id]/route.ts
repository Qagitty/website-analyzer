import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

// How long (ms) before we declare a stuck job failed
const STALE_MS: Record<string, number> = {
  pending: 3 * 60 * 1000,  // 3 min — should transition to queued almost instantly
  queued:  10 * 60 * 1000, // 10 min — worker should have picked it up by now
  running: 8 * 60 * 1000,  // 8 min  — analysis itself should not take this long
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: analysis, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !analysis) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Auto-fail jobs that have been stuck too long (e.g. worker died mid-run)
  const staleThreshold = STALE_MS[analysis.status];
  if (staleThreshold) {
    const ageMs = Date.now() - new Date(analysis.created_at).getTime();
    if (ageMs > staleThreshold) {
      const errorMessage =
        'Analysis timed out — the worker did not respond in time. Please resubmit.';

      const admin = createServiceRoleClient();
      await admin
        .from('analyses')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', analysis.id);

      return NextResponse.json({ ...analysis, status: 'failed', error_message: errorMessage });
    }
  }

  return NextResponse.json(analysis);
}
