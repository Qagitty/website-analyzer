import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET — accept an invite via token
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', req.url));
  }

  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    // Redirect to login and preserve token so they can re-visit after signing in
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', `/api/team/accept?token=${token}`);
    return NextResponse.redirect(loginUrl);
  }

  // Find a pending invite matching the token
  const { data: invite } = await (supabase as any)
    .from('team_members')
    .select('id, status')
    .eq('invite_token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (!invite) {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', req.url));
  }

  // Accept the invite
  const { error: updateError } = await (supabase as any)
    .from('team_members')
    .update({
      status: 'active',
      member_id: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (updateError) {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', req.url));
  }

  return NextResponse.redirect(new URL('/dashboard?invited=1', req.url));
}
