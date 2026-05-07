import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-keys/authenticate';
import { checkRateLimit } from '@/lib/api-keys/rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get('Authorization'));
  if (!auth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });

  const { allowed, remaining, limit } = await checkRateLimit(auth.keyId, auth.plan);
  if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const limitParam = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);
  const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1);
  const offset = (page - 1) * limitParam;

  const supabase = createServiceRoleClient();
  const { data, count } = await (supabase as any)
    .from('analyses')
    .select('id, url, status, created_at, completed_at', { count: 'exact' })
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limitParam - 1);

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit: limitParam, total: count ?? 0 },
  }, {
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
    },
  });
}
