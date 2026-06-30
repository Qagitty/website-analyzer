'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
          <p className="text-sm text-emerald-400">
            We&apos;ve sent a password reset link to <strong>{email}</strong>. Check your inbox and click the link to reset your password.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive an email? Check your spam folder or{' '}
          <button onClick={() => setSent(false)} className="text-orange-500 hover:text-orange-500 underline">
            try again
          </button>
          .
        </p>
        <Link href="/login" className="block text-sm text-center text-muted-foreground hover:text-white transition-colors mt-2">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading || !email}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{' '}
        <Link href="/login" className="text-orange-500 hover:text-orange-500 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
