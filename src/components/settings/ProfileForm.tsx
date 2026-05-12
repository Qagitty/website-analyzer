'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase/client';

const schema = z.object({
  displayName: z
    .string()
    .max(80, 'Max 80 characters')
    .refine(
      (v) => v === '' || /^[\p{L}\p{N}\s'\-_.]+$/u.test(v.trim()),
      'Only letters, numbers, spaces, and the characters \' - _ . are allowed'
    )
    .refine(
      (v) => v === '' || v.trim().length > 0,
      'Name cannot be only whitespace'
    )
    .optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  email: string;
  initialName: string;
}

export function ProfileForm({ email, initialName }: Props) {
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: initialName },
  });

  const handlePasswordReset = async () => {
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send reset link');
    } finally {
      setResetLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: data.displayName?.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Profile saved');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <p className="font-medium mt-0.5 text-[#475569]">{email}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground" htmlFor="displayName">
              Display name
            </label>
            <Input
              id="displayName"
              placeholder="Your name"
              className="mt-1 bg-[#0A0A0F] border-white/10 text-foreground placeholder:text-[#475569] focus:border-indigo-500/50 focus:ring-indigo-500/20"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-sm text-red-400 mt-1">{errors.displayName.message}</p>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading || !isDirty}
            className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
          >
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#94A3B8]">
          We&apos;ll send a password reset link to <strong className="text-white">{email}</strong>.
        </p>
        {resetSent ? (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
            <p className="text-sm text-emerald-400">Reset link sent to your email.</p>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={handlePasswordReset}
            disabled={resetLoading}
            className="border-white/10 hover:bg-white/5"
          >
            {resetLoading ? 'Sending…' : 'Send password reset email'}
          </Button>
        )}
      </CardContent>
    </Card>
    </>
  );
}
