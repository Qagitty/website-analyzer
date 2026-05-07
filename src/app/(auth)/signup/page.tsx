import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from '@/components/auth/SignupForm';

export const metadata: Metadata = { title: 'Create Account' };

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="text-[#94A3B8] mt-1">Start analyzing websites for free</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-[#94A3B8]">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
