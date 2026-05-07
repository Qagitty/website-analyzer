import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  agencyName:    z.string().max(60).optional(),
  brandColor:    z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
  showPoweredBy: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation error' },
      { status: 400 }
    );
  }

  const { agencyName, brandColor, showPoweredBy } = parsed.data;

  // Build a typed partial update object; cast to any to bypass stale codegen
  // (columns are added by migration 007 but generated types may not reflect them yet)
  const updates: Record<string, string | boolean | null> = {};
  if (agencyName    !== undefined) updates['agency_name']     = agencyName || null;
  if (brandColor    !== undefined) updates['brand_color']     = brandColor;
  if (showPoweredBy !== undefined) updates['show_powered_by'] = showPoweredBy;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: 'No changes' }, { status: 200 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('user_settings') as any)
    .update(updates)
    .eq('user_id', user.id)
    .select('agency_name, brand_color, show_powered_by')
    .single();

  if (error) {
    console.error('Branding update error:', error);
    return NextResponse.json({ error: 'Failed to update branding settings' }, { status: 500 });
  }

  return NextResponse.json({
    agencyName:    (data as any).agency_name,
    brandColor:    (data as any).brand_color,
    showPoweredBy: (data as any).show_powered_by,
  });
}
