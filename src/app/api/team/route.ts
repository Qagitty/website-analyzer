import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendTeamInvite } from '@/lib/email/resend';
import { hasFeature, getLimits, featureGateError } from '@/lib/billing/limits';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

// GET — list all team members for the current user (as owner)
export async function GET() {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: members, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }

  return NextResponse.json(members ?? []);
}

// POST — invite a new team member
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Feature gate: team members require Agency+
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();
  const plan = subscription?.plan ?? 'free';

  if (!hasFeature(plan, 'teamMembers')) {
    return NextResponse.json(featureGateError('teamMembers', 'agency'), { status: 403 });
  }

  // Check team size limit per plan
  const { count } = await supabase
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id);

  const maxMembers = getLimits(plan).teamMembers;
  if ((count ?? 0) >= maxMembers - 1) { // -1 to account for the owner
    return NextResponse.json(
      { error: `Your plan allows up to ${maxMembers} team members including yourself.` },
      { status: 402 }
    );
  }

  // Validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Check for duplicate invite
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('owner_id', user.id)
    .eq('member_email', email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Already invited' }, { status: 409 });
  }

  // Insert the invite row (expires 7 days from now)
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: newMember, error: insertError } = await supabase
    .from('team_members')
    .insert({ owner_id: user.id, member_email: email, invite_expires_at: inviteExpiresAt })
    .select()
    .single();

  if (insertError || !newMember) {
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }

  // Send invite email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const acceptUrl = `${appUrl}/api/team/accept?token=${newMember.invite_token}`;

  await sendTeamInvite({
    to: email,
    inviterEmail: user.email ?? 'A teammate',
    acceptUrl,
  });

  return NextResponse.json(newMember, { status: 201 });
}
