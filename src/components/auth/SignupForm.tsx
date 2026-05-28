'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .refine(
      (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p),
      'Password must contain uppercase, lowercase, and a number'
    ),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const supabase = createBrowserClient();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const [emailError, setEmailError] = useState('');

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setEmailError('');
    try {
      // ── Step 1: server-side email uniqueness check ─────────────────────
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      if (checkRes.status === 409) {
        const { error } = await checkRes.json();
        setEmailError(error ?? 'This email is already registered.');
        return;
      }

      if (!checkRes.ok) {
        const { error } = await checkRes.json().catch(() => ({}));
        throw new Error(error ?? 'Validation failed');
      }

      // ── Step 2: proceed with Supabase signup ───────────────────────────
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
      });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast.error(err.message ?? 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <p className="font-medium text-emerald-400">Check your email</p>
        <p className="text-sm text-emerald-400/70 mt-1">
          We sent a confirmation link to your email address.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Input
          type="email"
          placeholder="Email address"
          {...register('email')}
          onChange={(e) => {
            register('email').onChange(e);
            if (emailError) setEmailError('');
          }}
        />
        {(errors.email || emailError) && (
          <p className="mt-1 text-sm text-red-400">
            {emailError || errors.email?.message}
          </p>
        )}
      </div>
      <div>
        <div className="relative">
          <Input type={showPassword ? 'text' : 'password'} placeholder="Password (12+ chars, A-Z, 0-9)" className="pr-10" {...register('password')} />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>}
      </div>
      <div>
        <div className="relative">
          <Input type={showConfirm ? 'text' : 'password'} placeholder="Confirm password" className="pr-10" {...register('confirmPassword')} />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Create free account'}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Includes 3 free analyses. No credit card required.
      </p>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground/60">Or</span>
        </div>
      </div>

      <OAuthButtons />
    </form>
  );
}
