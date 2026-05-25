import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'dns/promises';
import { createServerClient } from '@/lib/supabase/server';
import { uploadDesignScreenshot } from '@/lib/supabase/storage';
import { z } from 'zod';

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const schema = z.object({
  url: z
    .string()
    .trim()
    .transform(normalizeUrl)
    .pipe(z.string().url('Invalid URL')),
  designScreenshotBase64: z.string().optional(),
  designMimeType: z
    .string()
    .optional()
    .refine(
      (v) => !v || ACCEPTED_MIME.includes(v),
      'Unsupported image type'
    ),
});

// Verify the URL resolves and a server responds before consuming a credit.
// Step 1: explicit DNS lookup — catches NXDOMAIN definitively regardless of Vercel's network.
// Step 2: HTTP reachability — any response (even 4xx/5xx) means the host is up.
async function checkUrlReachable(url: string): Promise<{ ok: boolean; error?: string }> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { ok: false, error: 'Invalid URL.' };
  }

  // DNS check — fastest way to detect non-existent domains
  try {
    await lookup(hostname);
  } catch (err: any) {
    const dnsError = err?.code as string | undefined;
    if (dnsError === 'ENOTFOUND' || dnsError === 'EAI_NONAME' || dnsError === 'EAI_AGAIN') {
      return {
        ok: false,
        error: 'This domain does not exist. Please check the URL for typos.',
      };
    }
    // Unknown DNS error — fall through and let the HTTP check decide
  }

  // HTTP reachability check — HEAD first (fast), fall back to GET
  const attempt = async (method: 'HEAD' | 'GET'): Promise<boolean> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      await fetch(url, { method, redirect: 'follow', signal: ctrl.signal });
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const headOk = await attempt('HEAD');
    if (headOk) return { ok: true };
    const getOk = await attempt('GET');
    if (getOk) return { ok: true };
    return {
      ok: false,
      error: 'The URL could not be reached. Please check that the domain exists and the site is online.',
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        error: 'The URL timed out during reachability check. The site may be down or very slow.',
      };
    }
    return {
      ok: false,
      error: 'The URL could not be reached. Please check that the domain exists and the site is online.',
    };
  }
}

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

  // Pre-check: verify the URL resolves before spending a credit
  const reachable = await checkUrlReachable(url);
  if (!reachable.ok) {
    return NextResponse.json({ error: reachable.error }, { status: 422 });
  }

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
