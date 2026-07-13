/**
 * GET  /api/accessibility/statements/[id]/versions — list versions
 * POST /api/accessibility/statements/[id]/versions — create new version
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  content: z.record(z.unknown()),
});

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: statementId } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership via statement
  const { data: stmt } = await supabase
    .from('accessibility_statements')
    .select('id')
    .eq('id', statementId)
    .eq('user_id', user.id)
    .single();

  if (!stmt) return NextResponse.json({ error: 'Statement not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('accessibility_statement_versions')
    .select('*')
    .eq('statement_id', statementId)
    .order('version', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id: statementId } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: stmt } = await supabase
    .from('accessibility_statements')
    .select('id, version')
    .eq('id', statementId)
    .eq('user_id', user.id)
    .single();

  if (!stmt) return NextResponse.json({ error: 'Statement not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const nextVersion = ((stmt as Record<string, unknown>).version as number ?? 1) + 1;

  const { data: version, error } = await supabase
    .from('accessibility_statement_versions')
    .insert({
      statement_id:   statementId,
      version:        nextVersion,
      version_number: nextVersion,
      content:        parsed.data.content,
      source_snapshot: { savedAt: new Date().toISOString() },
      changed_by:     user.id,
      created_by:     user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update statement version counter
  await supabase
    .from('accessibility_statements')
    .update({ version: nextVersion, content: parsed.data.content })
    .eq('id', statementId);

  return NextResponse.json(version, { status: 201 });
}
