'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Team seats require the Agency plan</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upgrade to invite up to 10 collaborators and share analyses across your team.
              </p>
            </div>
            <Button asChild>
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

  const statusVariant = (status: TeamMember['status']): 'default' | 'secondary' | 'destructive' => {
    if (status === 'active') return 'default';
    if (status === 'rejected') return 'destructive';
    return 'secondary';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Members
          <Badge variant="secondary" className="ml-1">
            {members.length} / 10
          </Badge>
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
            className="flex-1"
            aria-label="Invite by email"
            disabled={inviting || members.length >= 10}
          />
          <Button
            type="submit"
            disabled={inviting || !email.trim() || members.length >= 10}
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
          <p className="text-sm text-muted-foreground py-4 text-center">
            No team members yet. Invite collaborators above.
          </p>
        ) : (
          <div className="divide-y">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-3 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.member_email}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited {new Date(member.invited_at).toLocaleDateString()}
                    {member.accepted_at && (
                      <> · Accepted {new Date(member.accepted_at).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusVariant(member.status)} className="capitalize">
                    {member.status}
                  </Badge>
                  <Badge variant="outline" className="capitalize text-xs">
                    {member.role}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={removingId === member.id}
                    onClick={() => handleRemove(member.id)}
                    aria-label={`Remove ${member.member_email}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
