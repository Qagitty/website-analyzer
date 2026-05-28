import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { isSsrfUrl } from '@/lib/webhooks/deliver';
import { z } from 'zod';

const schema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .refine((u) => !isSsrfUrl(u), 'Webhook URL must be a public HTTPS URL'),
  events: z
    .array(z.enum(['analysis.completed', 'score.dropped']))
    .min(1, 'Select at least one event'),
  active: z.boolean().default(true),
});

export async function GET(_req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Omit 'secret' from the list — it is only returned once at creation time.
  // Users who need to rotate it can delete and recreate the webhook.
  const { data } = await (supabase as any)
    .from('webhooks')
    .select('id, url, events, active, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Max 5 webhooks per user
  const { count } = await (supabase as any)
    .from('webhooks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: 'Maximum 5 webhooks allowed' }, { status: 400 });
  }

  const { data, error } = await (supabase as any)
    .from('webhooks')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
