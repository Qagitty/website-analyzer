import { describe, it, expect } from 'vitest';

// ── Team invite — pure business logic tests ───────────────────────────────────
// Tests cover: invite token validation, email matching, status transitions,
// and accept-invite guard logic.

type InviteStatus = 'pending' | 'active' | 'rejected';

interface TeamMember {
  id: string;
  email: string;
  role: 'member' | 'admin';
  status: InviteStatus;
  invite_token: string;
  member_id?: string;
  accepted_at?: string;
}

// ── Invite token validation ───────────────────────────────────────────────────

function isValidInviteToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  return token.trim().length >= 16;
}

describe('isValidInviteToken()', () => {
  it('accepts a valid UUID-style token', () => {
    expect(isValidInviteToken('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts any string >= 16 chars', () => {
    expect(isValidInviteToken('a'.repeat(16))).toBe(true);
  });

  it('rejects token shorter than 16 chars', () => {
    expect(isValidInviteToken('short')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidInviteToken('')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidInviteToken(undefined)).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    expect(isValidInviteToken('                ')).toBe(false);
  });
});

// ── Email matching guard ──────────────────────────────────────────────────────

function emailMatchesInvite(inviteEmail: string, loggedInEmail: string): boolean {
  return inviteEmail.toLowerCase().trim() === loggedInEmail.toLowerCase().trim();
}

describe('emailMatchesInvite()', () => {
  it('matches identical emails', () => {
    expect(emailMatchesInvite('user@example.com', 'user@example.com')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(emailMatchesInvite('User@Example.COM', 'user@example.com')).toBe(true);
  });

  it('trims whitespace before comparing', () => {
    expect(emailMatchesInvite(' user@example.com ', 'user@example.com')).toBe(true);
  });

  it('rejects different emails', () => {
    expect(emailMatchesInvite('alice@example.com', 'bob@example.com')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(emailMatchesInvite('', 'bob@example.com')).toBe(false);
  });
});

// ── Accept-invite guard ───────────────────────────────────────────────────────

function canAcceptInvite(
  member: TeamMember | null,
  loggedInEmail: string
): { allowed: boolean; reason?: string } {
  if (!member) return { allowed: false, reason: 'This invitation is invalid or has expired' };
  if (member.status !== 'pending') return { allowed: false, reason: 'This invitation is invalid or has expired' };
  if (!emailMatchesInvite(member.email, loggedInEmail)) {
    return { allowed: false, reason: 'This invitation was sent to a different email address' };
  }
  return { allowed: true };
}

describe('canAcceptInvite()', () => {
  const pendingMember: TeamMember = {
    id: 'member-1',
    email: 'alice@example.com',
    role: 'member',
    status: 'pending',
    invite_token: 'valid-token-that-is-long-enough',
  };

  it('allows acceptance when pending and email matches', () => {
    const result = canAcceptInvite(pendingMember, 'alice@example.com');
    expect(result.allowed).toBe(true);
  });

  it('blocks when member not found (null)', () => {
    const result = canAcceptInvite(null, 'alice@example.com');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('invalid or has expired');
  });

  it('blocks when invite is already active', () => {
    const activeMember = { ...pendingMember, status: 'active' as InviteStatus };
    const result = canAcceptInvite(activeMember, 'alice@example.com');
    expect(result.allowed).toBe(false);
  });

  it('blocks when invite is rejected', () => {
    const rejectedMember = { ...pendingMember, status: 'rejected' as InviteStatus };
    const result = canAcceptInvite(rejectedMember, 'alice@example.com');
    expect(result.allowed).toBe(false);
  });

  it('blocks when logged-in email does not match invite email', () => {
    const result = canAcceptInvite(pendingMember, 'bob@example.com');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('different email address');
  });

  it('email check is case-insensitive', () => {
    const result = canAcceptInvite(pendingMember, 'ALICE@EXAMPLE.COM');
    expect(result.allowed).toBe(true);
  });
});

// ── Status transition after acceptance ───────────────────────────────────────

function acceptInvite(member: TeamMember, memberId: string): TeamMember {
  return {
    ...member,
    status: 'active',
    member_id: memberId,
    accepted_at: new Date().toISOString(),
  };
}

describe('acceptInvite()', () => {
  const pendingMember: TeamMember = {
    id: 'member-1',
    email: 'alice@example.com',
    role: 'member',
    status: 'pending',
    invite_token: 'valid-token-that-is-long-enough',
  };

  it('sets status to active', () => {
    const accepted = acceptInvite(pendingMember, 'user-abc');
    expect(accepted.status).toBe('active');
  });

  it('sets member_id', () => {
    const accepted = acceptInvite(pendingMember, 'user-abc');
    expect(accepted.member_id).toBe('user-abc');
  });

  it('sets accepted_at timestamp', () => {
    const accepted = acceptInvite(pendingMember, 'user-abc');
    expect(accepted.accepted_at).toBeTruthy();
    expect(new Date(accepted.accepted_at!).getTime()).not.toBeNaN();
  });

  it('does not mutate the original member', () => {
    acceptInvite(pendingMember, 'user-abc');
    expect(pendingMember.status).toBe('pending');
    expect(pendingMember.member_id).toBeUndefined();
  });
});

// ── Invite email schema ───────────────────────────────────────────────────────

import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['member', 'admin']).default('member'),
});

describe('Team invite schema validation', () => {
  it('accepts valid email with default role', () => {
    const r = inviteSchema.safeParse({ email: 'user@example.com' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.role).toBe('member');
  });

  it('accepts admin role', () => {
    const r = inviteSchema.safeParse({ email: 'user@example.com', role: 'admin' });
    expect(r.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const r = inviteSchema.safeParse({ email: 'notanemail', role: 'member' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const r = inviteSchema.safeParse({ email: 'user@example.com', role: 'superadmin' });
    expect(r.success).toBe(false);
  });

  it('rejects missing email', () => {
    const r = inviteSchema.safeParse({ role: 'member' });
    expect(r.success).toBe(false);
  });
});
