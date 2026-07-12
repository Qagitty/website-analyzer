import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { getFeatures } from '@/lib/billing/limits';
import { FixRequestForm } from '@/components/fix-requests/FixRequestForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New Fix Request' };

export default async function NewFixRequestPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  const plan = (subscription?.plan ?? 'free') as 'free' | 'pro' | 'agency' | 'compliance';
  const features = getFeatures(plan);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/fix-requests"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Fix Requests
        </Link>
        <h1 className="text-3xl font-bold text-gradient">New Fix Request</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create a structured request for a developer to review or fix a finding
        </p>
      </div>

      {!features.fixRequests ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Pro plan required</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fix Requests require a Pro plan or higher.{' '}
              <Link href="/settings/billing" className="text-indigo-400 hover:underline">
                Upgrade now
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-6">
          <FixRequestForm />
        </div>
      )}
    </div>
  );
}
