import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  checkWebRateLimit,
  checkAccountLockout,
  recordAuthFailure,
  clearAuthFailures,
} from '@/lib/rate-limit/web';

// Top-100 most commonly used passwords. Checked case-insensitively.
// Keeping this inline avoids a runtime file read in the serverless function.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  '123456789', '1234567890', '12345678901', '123456789012',
  'iloveyou', 'sunshine', 'princess', 'welcome', 'shadow', 'monkey',
  'dragon', 'master', 'abc123456', 'passw0rd', 'passw0rd1',
  'letmein1', 'football', 'baseball', 'soccer', 'hockey', 'basketball',
  'superman', 'batman', 'spiderman', 'starwars', 'trustno1',
  'admin123', 'admin1234', 'login123', 'welcome1', 'welcome12',
  'qwerty123', 'qwerty1234', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
  'changeme', 'changeme1', 'letmein12', 'hello123', 'hello1234',
  'summer123', 'winter123', 'spring123', 'autumn123', 'monday123',
  'january1', 'february1', 'march1234', 'april123', 'november1',
  'december1', 'birthday1', 'chocolate', 'computer1', 'internet1',
  'freedom12', 'liberty12', 'justice12', 'america12', 'michael12',
  'jessica12', 'charlie12', 'thomas123', 'george123', 'jordan123',
  'hunter123', 'ranger123', 'hunter12!', 'pass@word1', 'p@ssword1',
  'p@ssw0rd1', 'abc@12345', 'test@1234', 'demo@1234', 'user@1234',
]);

// Min 12 chars with at least one uppercase, one lowercase, and one digit.
// Using a regex refine rather than separate zod .regex() calls to give a single
// clear error message instead of confusing multiple failures.
const schema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(12, 'New password must be at least 12 characters')
    .refine(
      (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p),
      'New password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
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

  // Rate limit: 5 attempts per 15 minutes per user — brute-force protection
  const limited = await checkWebRateLimit(req, 'password-change', 5, 900, user.id);
  if (limited) return limited;

  // Account lockout: block after 10 consecutive failures for 30 minutes
  const locked = await checkAccountLockout('password-change', user.id);
  if (locked) return locked;

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

  if (COMMON_PASSWORDS.has(newPassword.toLowerCase())) {
    return NextResponse.json(
      { error: 'This password is too common. Please choose a more unique password.' },
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
    // Track consecutive failures — locks account after 10 bad attempts for 30 min.
    await recordAuthFailure('password-change', user.id, 10, 1800);
    // Artificial delay on failure to slow timing-based brute force (200–400 ms).
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 200));
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

  // Clear failure counter on successful password change.
  await clearAuthFailures('password-change', user.id);
  return NextResponse.json({ success: true });
}
