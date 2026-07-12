import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

async function getOwnedSite(supabase: ReturnType<typeof createServerClient>, userId: string, siteId: string) {
  const { data, error } = await supabase
    .from('connected_sites')
    .select('*')
    .eq('id', siteId)
    .eq('user_id', userId)
    .single();
  return { site: data, error };
}

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { site, error } = await getOwnedSite(supabase, user.id, params.id);
  if (error || !site) return NextResponse.json({ error: 'Not found', code: 'CONNECTED_SITE_NOT_FOUND' }, { status: 404 });

  // Fetch related data
  const [{ data: keys }, { data: status }, { data: challenges }] = await Promise.all([
    supabase.from('connected_site_keys').select('id, key_prefix, status, created_at, rotated_at, last_used_at').eq('connected_site_id', site.id),
    supabase.from('site_connection_status').select('*').eq('connected_site_id', site.id).maybeSingle(),
    supabase.from('site_verification_challenges').select('id, method, expires_at, consumed_at, attempt_count, created_at').eq('connected_site_id', site.id).is('consumed_at', null).order('created_at', { ascending: false }).limit(1),
  ]);

  return NextResponse.json({ site, keys, status, activeChallenge: challenges?.[0] ?? null });
}

const UpdateSiteSchema = z.object({
  name:                        z.string().min(1).max(128).trim().optional(),
  is_enabled:                  z.boolean().optional(),
  telemetry_enabled:           z.boolean().optional(),
  indexing_diagnostics_enabled: z.boolean().optional(),
  crawler_visibility_enabled:  z.boolean().optional(),
  environment:                 z.enum(['production', 'staging', 'development']).optional(),
  monitor_id:                  z.string().uuid().nullable().optional(),
});

export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { site, error } = await getOwnedSite(supabase, user.id, params.id);
  if (error || !site) return NextResponse.json({ error: 'Not found', code: 'CONNECTED_SITE_NOT_FOUND' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = UpdateSiteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const { data: updated, error: updateErr } = await supabase
    .from('connected_sites')
    .update(parsed.data)
    .eq('id', site.id)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json({ site: updated });
}

export async function DELETE(req: NextRequest, props: Params) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { site, error } = await getOwnedSite(supabase, user.id, params.id);
  if (error || !site) return NextResponse.json({ error: 'Not found', code: 'CONNECTED_SITE_NOT_FOUND' }, { status: 404 });

  // Revoke all keys first (service-role not needed — RLS allows owner to update)
  await supabase
    .from('connected_site_keys')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('connected_site_id', site.id);

  // Mark site revoked (preserve for report history; don't hard-delete)
  await supabase
    .from('connected_sites')
    .update({ verification_status: 'revoked', is_enabled: false })
    .eq('id', site.id);

  return NextResponse.json({ revoked: true });
}
