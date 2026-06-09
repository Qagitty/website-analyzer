import { createServerClient as _createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
import type { Database } from '@/types/database';

export function createServerClient() {
  const cookieStore = (cookies() as unknown as UnsafeUnwrappedCookies);
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
