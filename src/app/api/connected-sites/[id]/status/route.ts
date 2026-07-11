import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site, error: siteErr } = await supabase
    .from('connected_sites')
    .select('id, verification_status, last_heartbeat_at, last_script_version, is_enabled')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (siteErr || !site) return NextResponse.json({ error: 'Not found', code: 'CONNECTED_SITE_NOT_FOUND' }, { status: 404 });

  const { data: status } = await supabase
    .from('site_connection_status')
    .select('*')
    .eq('connected_site_id', site.id)
    .maybeSingle();

  const now = Date.now();
  const lastSeen = status?.last_seen_at ? new Date(status.last_seen_at).getTime() : null;
  const staleThresholdMs = 25 * 3600 * 1000; // 25 hours

  return NextResponse.json({
    verificationStatus: site.verification_status,
    scriptActive:       !!lastSeen && now - lastSeen < staleThresholdMs,
    lastHeartbeat:      status?.last_seen_at ?? null,
    sdkVersion:         status?.sdk_version ?? null,
    scriptLoadStatus:   status?.script_load_status ?? 'unknown',
    environment:        status?.environment ?? null,
    isEnabled:          site.is_enabled,
    warnings: buildWarnings(site, status, now, staleThresholdMs),
  });
}

function buildWarnings(
  site: { verification_status: string; is_enabled: boolean },
  status: { last_seen_at?: string | null; sdk_version?: string | null; script_load_status?: string | null } | null,
  now: number,
  staleMs: number,
): string[] {
  const warnings: string[] = [];
  if (site.verification_status !== 'verified') warnings.push('Site not yet verified');
  if (!site.is_enabled) warnings.push('Site is disabled');
  if (!status) warnings.push('Script not detected — no heartbeat received');
  else {
    const lastSeen = new Date(status.last_seen_at!).getTime();
    if (now - lastSeen > staleMs) warnings.push('No heartbeat for over 24 hours');
    if (status.script_load_status === 'origin_rejected') warnings.push('Origin rejected — check that normalized_origin matches your site');
    if (status.script_load_status === 'csp_blocked') warnings.push('CSP may be blocking the connection script');
    if (status.script_load_status === 'config_error') warnings.push('Script configuration error detected');
  }
  return warnings;
}
