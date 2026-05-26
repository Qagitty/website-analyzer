import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

const schema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters'),
});

// PATCH /api/user/password
// Verifies the current password against Supabase Auth before updating.
// Uses the Supabase Auth token endpoint for verification (no admin-only
// "verify password" method exists in the JS SDK).
export async function PATCH(req: NextRequest) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json(
      { error: 'No email address associated with this account.' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'New password must be different from your current password.' },
      { status: 400 }
    );
  }

  // ── Step 1: verify current password ──────────────────────────────────────
  // Supabase Admin SDK has no "verifyPassword" method, so we hit the Auth
  // token endpoint directly. Any non-200 means the password is wrong.
  const verifyRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({ email: user.email, password: currentPassword }),
    }
  );

  if (!verifyRes.ok) {
    return NextResponse.json(
      { error: 'Current password is incorrect.' },
      { status: 400 }
    );
  }

  // ── Step 2: update to new password ────────────────────────────────────────
  const adminSupabase = createServiceRoleClient();
  const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (updateError) {
    console.error('[password] updateUserById error:', updateError.message);
    return NextResponse.json(
      { error: 'Failed to update password. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
