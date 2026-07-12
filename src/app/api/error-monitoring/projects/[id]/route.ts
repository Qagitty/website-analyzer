/**
 * GET    /api/error-monitoring/projects/[id] — get project detail
 * PATCH  /api/error-monitoring/projects/[id] — update project settings
 * DELETE /api/error-monitoring/projects/[id] — revoke project (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { ErrorProjectUpdate } from '@/types/database';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name:           z.string().min(1).max(100).optional(),
  environment:    z.enum(['production', 'staging', 'development', 'custom']).optional(),
  allowedOrigins: z.array(z.string().url().max(512)).max(10).optional(),
  sampleRate:     z.number().min(0).max(1).optional(),
  status:         z.enum(['active', 'disabled']).optional(),
  maxBreadcrumbs: z.number().int().min(0).max(100).optional(),
  captureUnhandledErrors:     z.boolean().optional(),
  captureUnhandledRejections: z.boolean().optional(),
});

export async function GET(req: NextRequest, props: Params) {
  void req;
  const { id } = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('error_projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, props: Params) {
  const { id } = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership check
  const { data: existing } = await supabase
    .from('error_projects')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body   = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const update: ErrorProjectUpdate = {};
  if (parsed.data.name !== undefined)                    update.name = parsed.data.name;
  if (parsed.data.environment !== undefined)             update.environment = parsed.data.environment;
  if (parsed.data.allowedOrigins !== undefined)          update.allowed_origins = parsed.data.allowedOrigins;
  if (parsed.data.sampleRate !== undefined)              update.sample_rate = parsed.data.sampleRate;
  if (parsed.data.status !== undefined)                  update.status = parsed.data.status;
  if (parsed.data.maxBreadcrumbs !== undefined)          update.max_breadcrumbs = parsed.data.maxBreadcrumbs;
  if (parsed.data.captureUnhandledErrors !== undefined)  update.capture_unhandled_errors = parsed.data.captureUnhandledErrors;
  if (parsed.data.captureUnhandledRejections !== undefined) update.capture_unhandled_rejections = parsed.data.captureUnhandledRejections;

  const { data, error } = await supabase
    .from('error_projects')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id,name,normalized_origin,environment,status,allowed_origins,sample_rate,max_breadcrumbs')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest, props: Params) {
  void req;
  const { id } = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('error_projects')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
