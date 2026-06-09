import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkWebRateLimit, getClientIp } from '@/lib/rate-limit/web';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

// POST /api/auth/check-email
// Checks whether an email address is already registered before the client
// calls supabase.auth.signUp(). Uses the service-role client so it can
// read auth.users without exposing credentials to the browser.
//
// 200 { available: true }   — email is free, proceed with signUp
// 409 { error: '...' }      — email already registered
// 400 { error: '...' }      — validation error
export async function POST(req: NextRequest) {
  // Rate limit: 5 requests per minute per IP — prevents email enumeration at scale
  const limited = await checkWebRateLimit(req, 'check-email', 5, 60);
  if (limited) return limited;

  // Reject oversized bodies (max 1 KB — only an email address is expected)
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 1024) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  const supabase = createServiceRoleClient();

  // email_exists() is a SECURITY DEFINER function (migration 015) that does
  // an indexed point-lookup on auth.users — O(log n) regardless of user count.
  const { data: exists, error } = await supabase.rpc('email_exists', {
    p_email: email,
  });

  if (error) {
    console.error('[check-email] email_exists rpc error:', error.message);
    // Fail open — signUp will catch duplicates if the function is unavailable.
    return NextResponse.json({ available: true });
  }

  if (exists) {
    return NextResponse.json(
      { error: 'This email is already registered. Please sign in or use a different email.' },
      { status: 409 }
    );
  }

  return NextResponse.json({ available: true });
}
