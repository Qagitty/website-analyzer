import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { decryptApiKey } from '@/lib/api-keys/generate';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: key } = await (supabase as any)
    .from('api_keys')
    .select('key_encrypted, revoked_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (key.revoked_at) return NextResponse.json({ error: 'Key is revoked' }, { status: 410 });
  if (!key.key_encrypted) {
    return NextResponse.json(
      { error: 'This key was generated before reveal support was added. Please revoke it and create a new one.' },
      { status: 404 }
    );
  }

  try {
    const raw = decryptApiKey(key.key_encrypted);
    return NextResponse.json({ key: raw });
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt key' }, { status: 500 });
  }
}
