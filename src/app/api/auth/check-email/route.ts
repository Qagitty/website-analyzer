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

  // Fetch all users and look for a matching email.
  // listUsers() supports up to 1000 per page; fine for early-stage projects.
  // For scale (>10k users) replace with a SECURITY DEFINER SQL function:
  //   SELECT EXISTS(SELECT 1 FROM auth.users WHERE lower(email) = lower($1))
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    console.error('[check-email] admin.listUsers error:', error.message);
    // If we can't check, allow the client to proceed — signUp will catch dupes.
    return NextResponse.json({ available: true });
  }

  const exists = data.users.some(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (exists) {
    return NextResponse.json(
      { error: 'This email is already registered. Please sign in or use a different email.' },
      { status: 409 }
    );
  }

  return NextResponse.json({ available: true });
}
