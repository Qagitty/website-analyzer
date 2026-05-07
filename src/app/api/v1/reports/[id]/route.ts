import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-keys/authenticate';
import { checkRateLimit } from '@/lib/api-keys/rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiKey(req.headers.get('Authorization'));
  if (!auth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });

  const { allowed, remaining, limit } = await checkRateLimit(auth.keyId, auth.plan);
  if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const supabase = createServiceRoleClient();
  const { data } = await (supabase as any)
    .from('analyses')
    .select('id, url, status, lighthouse_scores, accessibility_issues, console_errors, ai_insights, ai_summary, crawl_pages, created_at, completed_at')
    .eq('id', params.id)
    .eq('user_id', auth.userId)
    .single();

  if (!data) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  return NextResponse.json(data, {
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
    },
  });
}
