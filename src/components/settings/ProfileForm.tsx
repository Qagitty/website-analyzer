'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase/client';

const profileSchema = z.object({
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

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

interface Props {
  email: string;
  initialName: string;
}

export function ProfileForm({ email, initialName }: Props) {
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  // ── Profile form ───────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: initialName },
  });

  const onProfileSubmit = async (data: ProfileFormData) => {
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

  // ── Password form ──────────────────────────────────────────────────────────
  const {
    register: regPw,
    handleSubmit: handlePwSubmit,
    formState: { errors: pwErrors },
    reset: resetPwForm,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setPwLoading(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to update password');
      toast.success('Password updated successfully');
      resetPwForm();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send reset link');
    }
  };

  return (
    <>
      {/* ── Profile card ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <p className="font-medium mt-0.5 text-muted-foreground/60">{email}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground" htmlFor="displayName">
                Display name
              </label>
              <Input
                id="displayName"
                placeholder="Your name"
                className="mt-1 bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500/50 focus:ring-indigo-500/20"
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

      {/* ── Change Password card ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePwSubmit(onPasswordSubmit)} className="space-y-4">

            {/* Current password */}
            <div>
              <label className="text-sm text-muted-foreground" htmlFor="currentPassword">
                Current password
              </label>
              <div className="relative mt-1">
                <Input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Enter current password"
                  className="pr-10 bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500/50 focus:ring-indigo-500/20"
                  {...regPw('currentPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.currentPassword && (
                <p className="text-sm text-red-400 mt-1">{pwErrors.currentPassword.message}</p>
              )}
            </div>

            {/* New password */}
            <div>
              <label className="text-sm text-muted-foreground" htmlFor="newPassword">
                New password
              </label>
              <div className="relative mt-1">
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  className="pr-10 bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500/50 focus:ring-indigo-500/20"
                  {...regPw('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.newPassword && (
                <p className="text-sm text-red-400 mt-1">{pwErrors.newPassword.message}</p>
              )}
            </div>

            {/* Confirm new password */}
            <div>
              <label className="text-sm text-muted-foreground" htmlFor="confirmPassword">
                Confirm new password
              </label>
              <div className="relative mt-1">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  className="pr-10 bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500/50 focus:ring-indigo-500/20"
                  {...regPw('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.confirmPassword && (
                <p className="text-sm text-red-400 mt-1">{pwErrors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              <Button
                type="submit"
                disabled={pwLoading}
                className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
              >
                {pwLoading ? 'Updating…' : 'Update password'}
              </Button>

              {/* Forgot password fallback */}
              {forgotSent ? (
                <p className="text-xs text-emerald-400">Reset link sent to {email}</p>
              ) : (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Forgot current password?
                </button>
              )}
            </div>

          </form>
        </CardContent>
      </Card>
    </>
  );
}
