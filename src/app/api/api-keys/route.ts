import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateApiKey, encryptApiKey } from '@/lib/api-keys/generate';
import { checkWebRateLimit } from '@/lib/rate-limit/web';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(50).default('My API Key'),
});

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await (supabase as any)
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, requests_today, created_at, revoked_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit: 5 key creations per hour per user
  const limited = await checkWebRateLimit(req, 'api-key-create', 5, 3600, user.id);
  if (limited) return limited;

  // Max 5 active keys per user
  const { count } = await (supabase as any)
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: 'Maximum 5 active API keys allowed' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const { raw, hash, prefix } = generateApiKey();
  const encrypted = encryptApiKey(raw);

  const { data, error } = await (supabase as any)
    .from('api_keys')
    .insert({ user_id: user.id, name: parsed.data.name, key_hash: hash, key_prefix: prefix, key_encrypted: encrypted })
    .select('id, name, key_prefix, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create key' }, { status: 500 });

  // Return the raw key ONCE — never stored
  return NextResponse.json({ ...data, key: raw }, { status: 201 });
}
