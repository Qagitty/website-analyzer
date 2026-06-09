import { createServiceRoleClient } from '@/lib/supabase/server';
import { hashApiKey } from './generate';

interface AuthResult {
  userId: string;
  plan: string;
  keyId: string;
}

export async function authenticateApiKey(authHeader: string | null): Promise<AuthResult | null> {
  if (!authHeader?.startsWith('Bearer wa_live_')) return null;
  const raw = authHeader.slice(7); // remove "Bearer "
  const hash = hashApiKey(raw);

  const supabase = createServiceRoleClient();

  const { data: key } = await supabase
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', hash)
    .single();

  if (!key || key.revoked_at) return null;

  // Get user plan
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', key.user_id)
    .single();

  // Update last_used_at (fire and forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', key.id)
    .then(() => {});

  return {
    userId: key.user_id,
    plan: sub?.plan ?? 'free',
    keyId: key.id,
  };
}
