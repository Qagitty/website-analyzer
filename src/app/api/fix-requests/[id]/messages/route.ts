import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature } from '@/lib/billing/limits';
import { z } from 'zod';

const createSchema = z.object({
  content:    z.string().min(1).max(5_000),
  visibility: z.enum(['internal', 'recipient_visible']).default('internal'),
  format:     z.enum(['text', 'markdown']).default('text'),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await supabase.from('user_settings').select('plan').eq('user_id', user.id).single();
  if (!hasFeature(settings?.plan ?? 'free', 'fixRequests')) {
    return NextResponse.json({ error: 'Fix requests require a Pro plan.' }, { status: 403 });
  }

  // Verify ownership
  const { data: fr } = await supabase.from('fix_requests').select('id').eq('id', params.id).eq('user_id', user.id).single();
  if (!fr) return NextResponse.json({ error: 'Fix request not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('fix_request_messages')
    .select('id, visibility, format, content, sender_display_name, sender_is_external, edited_at, created_at')
    .eq('fix_request_id', params.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await supabase.from('user_settings').select('plan').eq('user_id', user.id).single();
  if (!hasFeature(settings?.plan ?? 'free', 'fixRequests')) {
    return NextResponse.json({ error: 'Fix requests require a Pro plan.' }, { status: 403 });
  }

  const { data: fr } = await supabase.from('fix_requests').select('id, status').eq('id', params.id).eq('user_id', user.id).single();
  if (!fr) return NextResponse.json({ error: 'Fix request not found' }, { status: 404 });
  if (['closed', 'cancelled'].includes(fr.status)) {
    return NextResponse.json({ error: 'Cannot add messages to a closed or cancelled request.' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const { data: msg, error: insertErr } = await supabase
    .from('fix_request_messages')
    .insert({
      fix_request_id:     params.id,
      user_id:            user.id,
      visibility:         parsed.data.visibility,
      format:             parsed.data.format,
      content:            parsed.data.content,
      sender_is_external: false,
    })
    .select('id, visibility, created_at')
    .single();

  if (insertErr || !msg) return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });

  await supabase.from('fix_request_activities').insert({
    fix_request_id: params.id,
    user_id:        user.id,
    event_type:     'message_created',
    metadata:       { visibility: parsed.data.visibility, messageId: msg.id },
  });

  return NextResponse.json(msg, { status: 201 });
}
