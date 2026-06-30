'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { UserPlus, Trash2, Lock, Users } from 'lucide-react';

export interface TeamMember {
  id: string;
  member_email: string;
  member_id: string | null;
  role: string;
  status: 'pending' | 'active' | 'rejected';
  invited_at: string;
  accepted_at: string | null;
}

interface Props {
  isPro: boolean;
  initialMembers: TeamMember[];
  ownerEmail: string;
}

export function TeamMembersForm({ isPro, initialMembers, ownerEmail }: Props) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!isPro) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-secondary border border-border rounded-xl p-8 flex flex-col items-center gap-4 text-center">
            <Lock className="h-8 w-8 text-muted-foreground/60" />
            <div>
              <p className="font-medium text-foreground">Team seats require the Agency plan</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upgrade to invite up to 10 collaborators and share analyses across your team.
              </p>
            </div>
            <Button
              asChild
              className="bg-orange-600 text-white hover:from-orange-400 hover:to-orange-400"
            >
              <Link href="/settings">Upgrade to Agency</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setInviting(true);
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to send invite');
      }

      setMembers((prev) => [data as TeamMember, ...prev]);
      setEmail('');
      toast.success(`Invite sent to ${data.member_email}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/team/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to remove member');
      }
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast.success('Team member removed');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Members
          <span className="ml-1 bg-secondary text-muted-foreground border border-border text-xs font-medium px-2.5 py-0.5 rounded-full">
            {members.length} / 10
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Invite form */}
        <form onSubmit={handleInvite} className="flex gap-2">
          <Input
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-orange-500/50 focus:ring-orange-400/20"
            aria-label="Invite by email"
            disabled={inviting || members.length >= 10}
          />
          <Button
            type="submit"
            disabled={inviting || !email.trim() || members.length >= 10}
            className="bg-orange-600 text-white hover:from-orange-400 hover:to-orange-400"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            {inviting ? 'Sending…' : 'Send Invite'}
          </Button>
        </form>

        {members.length >= 10 && (
          <p className="text-sm text-muted-foreground">
            Team seat limit of 10 reached. Remove a member to invite someone new.
          </p>
        )}

        {/* Members list */}
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 py-4 text-center">
            No team members yet. Invite collaborators above.
          </p>
        ) : (
          <div>
            {members.map((member) => {
              const statusClass = (() => {
                const base = 'text-xs font-medium px-2.5 py-0.5 rounded-full capitalize';
                if (member.status === 'active')  return `${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`;
                if (member.status === 'pending') return `${base} bg-amber-500/10 text-amber-400 border border-amber-500/20`;
                return `${base} bg-red-500/10 text-red-400 border border-red-500/20`;
              })();
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-3 border-b border-border gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{member.member_email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited {new Date(member.invited_at).toLocaleDateString()}
                      {member.accepted_at && (
                        <> · Accepted {new Date(member.accepted_at).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={statusClass}>{member.status}</span>
                    <span className="bg-secondary text-muted-foreground border border-border text-xs px-2 py-0.5 rounded-full capitalize">
                      {member.role}
                    </span>
                    <button
                      type="button"
                      className="text-red-400/50 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
                      disabled={removingId === member.id}
                      onClick={() => handleRemove(member.id)}
                      aria-label={`Remove ${member.member_email}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
