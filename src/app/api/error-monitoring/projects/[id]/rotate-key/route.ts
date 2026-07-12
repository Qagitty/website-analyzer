/**
 * POST /api/error-monitoring/projects/[id]/rotate-key
 * Generates a new ingestion key. Old key is invalidated immediately.
 * Returns the raw key — shown only once.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateErrorProjectKey } from '@/lib/error-projects/generate-key';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, props: Params) {
  void req;
  const { id } = await props.params;
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await supabase
    .from('error_projects')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { raw, hash, prefix, encrypted } = generateErrorProjectKey();

  const { error } = await supabase
    .from('error_projects')
    .update({
      ingestion_key_hash:      hash,
      ingestion_key_prefix:    prefix,
      ingestion_key_encrypted: encrypted,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'Failed to rotate key' }, { status: 500 });

  return NextResponse.json({ ingestionKey: raw, prefix });
}
