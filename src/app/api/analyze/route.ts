import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { uploadDesignScreenshot } from '@/lib/supabase/storage';
import { z } from 'zod';

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const schema = z.object({
  url: z
    .string()
    .trim()
    .url('Invalid URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'URL must start with http:// or https://'
    ),
  designScreenshotBase64: z.string().optional(),
  designMimeType: z
    .string()
    .optional()
    .refine(
      (v) => !v || ACCEPTED_MIME.includes(v),
      'Unsupported image type'
    ),
});

export async function POST(req: NextRequest) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { url, designScreenshotBase64, designMimeType } = parsed.data;

  const { data: hasCredit, error: creditError } = await supabase.rpc('use_credit', {
    p_user_id: user.id,
  });

  if (creditError || !hasCredit) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.' },
      { status: 402 }
    );
  }

  const { data: analysis, error: insertError } = await supabase
    .from('analyses')
    .insert({ user_id: user.id, url, status: 'pending' })
    .select('id')
    .single();

  if (insertError || !analysis) {
    await supabase.rpc('refund_credit', { p_user_id: user.id });
    return NextResponse.json({ error: 'Failed to create analysis' }, { status: 500 });
  }

  // Upload design screenshot if provided
  let designScreenshotUrl: string | null = null;
  if (designScreenshotBase64 && designMimeType) {
    try {
      // Use service role client via createServiceRoleClient is not available here,
      // but uploads to public bucket are fine with the anon key via RLS
      const buffer = Buffer.from(designScreenshotBase64, 'base64');
      const { createServiceRoleClient } = await import('@/lib/supabase/server');
      const serviceSupabase = createServiceRoleClient();
      designScreenshotUrl = await uploadDesignScreenshot(serviceSupabase, analysis.id, buffer, designMimeType);
      await (supabase.from('analyses') as any)
        .update({ design_screenshot_url: designScreenshotUrl })
        .eq('id', analysis.id);
    } catch (uploadErr) {
      console.error('[analyze] design screenshot upload failed (non-fatal):', uploadErr);
    }
  }

  // Count analyses ahead in queue (pending/queued, created before this one)
  const { count: queuePosition } = await supabase
    .from('analyses')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'queued', 'running'])
    .neq('id', analysis.id);

  await supabase
    .from('analyses')
    .update({ status: 'queued', queue_position: (queuePosition ?? 0) + 1 })
    .eq('id', analysis.id);

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`;
  const workerUrl = `${process.env.CLOUDFLARE_WORKER_URL}/analyze`;

  console.log('[analyze] dispatching to worker:', { analysisId: analysis.id, workerUrl, callbackUrl });

  fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      analysisId: analysis.id,
      url,
      callbackUrl,
      authToken: process.env.WORKER_CALLBACK_SECRET,
    }),
  }).then(async (res) => {
    const text = await res.text().catch(() => '');
    console.log('[analyze] worker response:', res.status, text);
  }).catch((err) => {
    console.error('[analyze] worker fetch failed:', err);
  });

  return NextResponse.json(
    { analysisId: analysis.id, status: 'queued', queuePosition: (queuePosition ?? 0) + 1 },
    { status: 202 }
  );
}
