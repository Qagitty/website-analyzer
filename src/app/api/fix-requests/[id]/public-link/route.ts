import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { hasFeature } from '@/lib/billing/limits';
import { z } from 'zod';

const createSchema = z.object({
  expiresInHours:      z.number().int().min(1).max(8760).default(168),
  accessScope:         z.enum(['standard', 'full_technical']).default('standard'),
  canAcknowledge:      z.boolean().default(true),
  canPostMessages:     z.boolean().default(false),
  canSubmitResponse:   z.boolean().default(false),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: fr } = await supabase.from('fix_requests').select('id').eq('id', params.id).eq('user_id', user.id).single();
  if (!fr) return NextResponse.json({ error: 'Fix request not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('fix_request_public_links')
    .select('id, access_scope, can_acknowledge, can_post_messages, can_submit_response, expires_at, is_revoked, view_count, created_at')
    .eq('fix_request_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const serviceClient = createServiceRoleClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings } = await supabase.from('user_settings').select('plan').eq('user_id', user.id).single();
  if (!hasFeature(settings?.plan ?? 'free', 'fixRequestExternalLinks')) {
    return NextResponse.json({ error: 'External links require a Pro plan.', code: 'FEATURE_GATE_fixRequestExternalLinks' }, { status: 403 });
  }

  const { data: fr } = await supabase.from('fix_requests').select('id').eq('id', params.id).eq('user_id', user.id).single();
  if (!fr) return NextResponse.json({ error: 'Fix request not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const d = parsed.data;
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(Date.now() + d.expiresInHours * 3_600_000).toISOString();

  const { data: link, error: linkErr } = await serviceClient
    .from('fix_request_public_links')
    .insert({
      fix_request_id:       params.id,
      user_id:              user.id,
      token,
      access_scope:         d.accessScope,
      can_acknowledge:      d.canAcknowledge,
      can_post_messages:    d.canPostMessages,
      can_submit_response:  d.canSubmitResponse,
      expires_at:           expiresAt,
    })
    .select('id, expires_at')
    .single();

  if (linkErr || !link) return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });

  await serviceClient.from('fix_request_activities').insert({
    fix_request_id: params.id,
    user_id:        user.id,
    event_type:     'public_link_created',
    metadata:       { linkId: link.id, accessScope: d.accessScope, expiresAt },
  });

  return NextResponse.json({
    id:         link.id,
    url:        `${process.env.NEXT_PUBLIC_APP_URL}/fix-request/${token}`,
    expiresAt:  link.expires_at,
    accessScope: d.accessScope,
  }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const serviceClient = createServiceRoleClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: fr } = await supabase.from('fix_requests').select('id').eq('id', params.id).eq('user_id', user.id).single();
  if (!fr) return NextResponse.json({ error: 'Fix request not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const linkId = searchParams.get('link_id');
  if (!linkId) return NextResponse.json({ error: 'link_id is required' }, { status: 400 });

  const { error } = await serviceClient
    .from('fix_request_public_links')
    .update({ is_revoked: true, revoked_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('fix_request_id', params.id);

  if (error) return NextResponse.json({ error: 'Failed to revoke link' }, { status: 500 });

  await serviceClient.from('fix_request_activities').insert({
    fix_request_id: params.id,
    user_id:        user.id,
    event_type:     'public_link_revoked',
    metadata:       { linkId },
  });

  return NextResponse.json({ revoked: true });
}
