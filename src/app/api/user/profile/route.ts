import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  displayName: z
    .string()
    .max(80)
    .transform((v) => v.trim())
    .refine((v) => v === '' || /^[\p{L}\p{N}\s'\-_.]+$/u.test(v), {
      message: 'Name contains invalid characters',
    })
    .optional(),
  notifications: z
    .object({
      email_on_complete: z.boolean(),
      email_on_fail: z.boolean(),
      weekly_digest: z.boolean(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
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

  const { displayName, notifications } = parsed.data;
  const updates: PromiseLike<any>[] = [];

  // Save display name to Supabase auth metadata
  if (displayName !== undefined) {
    updates.push(
      supabase.auth.updateUser({ data: { full_name: displayName } })
    );
  }

  // Save notification prefs to user_settings
  if (notifications !== undefined) {
    updates.push(
      supabase
        .from('user_settings')
        .update({ notifications })
        .eq('user_id', user.id)
        .then((r) => r)
    );
  }

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
