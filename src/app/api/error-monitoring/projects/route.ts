/**
 * GET  /api/error-monitoring/projects — list user's error projects
 * POST /api/error-monitoring/projects — create a new error project
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateErrorProjectKey } from '@/lib/error-projects/generate-key';
import { hasFeature, getErrorMonitoringLimits } from '@/lib/billing/limits';
import { z } from 'zod';

const createSchema = z.object({
  name:             z.string().min(1).max(100),
  normalizedOrigin: z.string().url().max(512),
  environment:      z.enum(['production', 'staging', 'development', 'custom']).default('production'),
  connectedSiteId:  z.string().uuid().optional(),
  allowedOrigins:   z.array(z.string().url().max(512)).max(10).default([]),
});

export async function GET(req: NextRequest) {
  void req;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('error_projects')
    .select(
      'id,name,normalized_origin,environment,status,ingestion_key_prefix,last_event_at,created_at,connected_site_id,event_quota_monthly,retention_days',
    )
    .eq('user_id', user.id)
    .neq('status', 'revoked')
    .order('created_at', { ascending: false });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Plan check
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = (sub?.plan ?? 'free') as string;

  if (!hasFeature(plan, 'errorMonitoring')) {
    return NextResponse.json(
      { error: 'Error monitoring requires Pro plan', code: 'ERROR_PROJECT_LIMIT_REACHED' },
      { status: 403 },
    );
  }

  // Project count check
  const emLimits = getErrorMonitoringLimits(plan);
  const { count } = await supabase
    .from('error_projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'revoked');

  if ((count ?? 0) >= emLimits.errorMonitoringProjects) {
    return NextResponse.json(
      {
        error: `Your plan allows up to ${emLimits.errorMonitoringProjects} error monitoring project(s).`,
        code:  'ERROR_PROJECT_LIMIT_REACHED',
      },
      { status: 403 },
    );
  }

  const body   = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { raw, hash, prefix, encrypted } = generateErrorProjectKey();

  // Normalize origin to scheme+host only
  let normalizedOrigin: string;
  try {
    const u      = new URL(parsed.data.normalizedOrigin);
    normalizedOrigin = u.origin;
  } catch {
    return NextResponse.json({ error: 'Invalid origin URL' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('error_projects')
    .insert({
      user_id:                user.id,
      name:                   parsed.data.name,
      normalized_origin:      normalizedOrigin,
      environment:            parsed.data.environment,
      connected_site_id:      parsed.data.connectedSiteId ?? null,
      allowed_origins:        parsed.data.allowedOrigins,
      ingestion_key_prefix:   prefix,
      ingestion_key_hash:     hash,
      ingestion_key_encrypted: encrypted,
      event_quota_monthly:    emLimits.errorMonitoringEvents,
      retention_days:         emLimits.errorMonitoringRetentionDays,
    })
    .select('id,name,normalized_origin,environment,ingestion_key_prefix')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });

  return NextResponse.json({ ...data, ingestionKey: raw }, { status: 201 });
}
