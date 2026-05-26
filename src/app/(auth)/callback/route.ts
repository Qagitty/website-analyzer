import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendWelcomeEmail } from '@/lib/email/resend';
import { redis } from '@/lib/queue/redis';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Send welcome email exactly once per user.
      // Redis SET NX is atomic: returns 1 if the key was created (first time),
      // null if it already existed (email was already sent).
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const key = `welcome_email_sent:${user.id}`;
          const isFirst = await redis.set(key, '1', { nx: true });
          if (isFirst) {
            await sendWelcomeEmail({
              to: user.email,
              name: user.user_metadata?.full_name ?? user.user_metadata?.name,
            });
          }
        }
      } catch (emailErr) {
        // Non-fatal — never block the redirect over an email failure
        console.error('[auth/callback] welcome email error:', emailErr);
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
