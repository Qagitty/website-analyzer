import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-keys/authenticate';
import { checkRateLimit } from '@/lib/api-keys/rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  url: z.string().url(),
});

function rateLimitHeaders(remaining: number, limit: number) {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
  };
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get('Authorization'));
  if (!auth) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  const { allowed, remaining, limit } = await checkRateLimit(auth.keyId, auth.plan);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Upgrade your plan for more requests.' },
      { status: 429, headers: rateLimitHeaders(0, limit) }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Check credits
  const { data: hasCredit } = await supabase.rpc('use_credit', { p_user_id: auth.userId });
  if (!hasCredit) {
    return NextResponse.json(
      { error: 'Insufficient credits' },
      { status: 402, headers: rateLimitHeaders(remaining, limit) }
    );
  }

  const { data: analysis } = await (supabase as any)
    .from('analyses')
    .insert({ user_id: auth.userId, url: parsed.data.url, status: 'pending' })
    .select('id')
    .single();

  if (!analysis) {
    return NextResponse.json({ error: 'Failed to create analysis' }, { status: 500 });
  }

  // Trigger Cloudflare Worker
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`;
  fetch(`${process.env.CLOUDFLARE_WORKER_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      analysisId: analysis.id,
      url: parsed.data.url,
      callbackUrl,
      authToken: process.env.WORKER_CALLBACK_SECRET,
    }),
  }).catch(console.error);

  return NextResponse.json(
    { analysisId: analysis.id, status: 'queued', url: parsed.data.url },
    { status: 202, headers: rateLimitHeaders(remaining, limit) }
  );
}
