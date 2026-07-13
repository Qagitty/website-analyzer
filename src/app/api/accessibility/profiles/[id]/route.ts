/**
 * GET    /api/accessibility/profiles/[id] — get profile with details
 * PATCH  /api/accessibility/profiles/[id] — update profile
 * DELETE /api/accessibility/profiles/[id] — archive profile (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name:                      z.string().min(1).max(200).optional(),
  targetMarkets:             z.array(z.string()).optional(),
  organizationType:          z.string().optional(),
  serviceCategories:         z.array(z.string()).optional(),
  publicSector:              z.boolean().nullable().optional(),
  providesConsumerServices:  z.boolean().nullable().optional(),
  selectedStandards:         z.array(z.string()).optional(),
  assessmentPageMode:        z.enum(['homepage', 'important', 'all', 'custom']).optional(),
  status:                    z.enum(['active', 'paused', 'archived']).optional(),
  schedule:                  z.record(z.unknown()).optional(),
}).strict();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getProfileWithOwnerCheck(supabase: any, profileId: string, userId: string) {
  const { data, error } = await supabase
    .from('accessibility_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

// GET /api/accessibility/profiles/[id]
export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getProfileWithOwnerCheck(supabase, id, user.id);
  if (error || !data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Also fetch journeys
  const { data: journeys } = await supabase
    .from('accessibility_critical_journeys')
    .select('*')
    .eq('profile_id', id)
    .order('priority', { ascending: true });

  return NextResponse.json({ ...data, criticalJourneys: journeys ?? [] });
}

// PATCH /api/accessibility/profiles/[id]
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await getProfileWithOwnerCheck(supabase, id, user.id);
  if (!existing) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined)                    updates.name = d.name;
  if (d.targetMarkets !== undefined)           updates.target_markets = d.targetMarkets;
  if (d.organizationType !== undefined)        updates.organization_type = d.organizationType;
  if (d.serviceCategories !== undefined)       updates.service_categories = d.serviceCategories;
  if (d.publicSector !== undefined)            updates.public_sector = d.publicSector;
  if (d.providesConsumerServices !== undefined) updates.provides_consumer_services = d.providesConsumerServices;
  if (d.selectedStandards !== undefined) {
    updates.selected_standards = d.selectedStandards;
    updates.selected_standard_ids = d.selectedStandards;
  }
  if (d.assessmentPageMode !== undefined)      updates.assessment_page_mode = d.assessmentPageMode;
  if (d.status !== undefined) {
    updates.status = d.status;
    updates.is_active = d.status !== 'archived';
  }
  if (d.schedule !== undefined)                updates.schedule = d.schedule;

  const { data: updated, error } = await supabase
    .from('accessibility_profiles')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}

// DELETE /api/accessibility/profiles/[id] — soft-delete (archive)
export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await getProfileWithOwnerCheck(supabase, id, user.id);
  if (!existing) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  await supabase
    .from('accessibility_profiles')
    .update({ is_active: false, status: 'archived' })
    .eq('id', id)
    .eq('user_id', user.id);

  return NextResponse.json({ success: true });
}
