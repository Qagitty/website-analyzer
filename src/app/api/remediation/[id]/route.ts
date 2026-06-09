import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSchema = z.object({
  status:      z.enum(['open', 'in_progress', 'resolved', 'verified']).optional(),
  notes:       z.string().nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  due_date:    z.string().nullable().optional(),
});

// PATCH /api/remediation/[id] — update status, notes, assigned_to, due_date
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('remediation_items')
    .update(parsed.data)
    .eq('id', params.id)
    .eq('user_id', user.id)          // RLS + owner check
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/remediation/[id] — remove a tracked item
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('remediation_items')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
