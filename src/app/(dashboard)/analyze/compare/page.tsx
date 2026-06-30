import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { hasFeature, getLimits } from '@/lib/billing/limits';
import { CompareInput } from '@/components/analyze/CompareInput';
import type { PlanId } from '@/lib/stripe/plans';

export const metadata: Metadata = { title: 'Compare Competitors' };

export default async function CompareAnalyzePage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: subscription }, { data: settings }] = await Promise.all([
    supabase.from('subscriptions').select('plan').eq('user_id', user.id).single(),
    supabase.from('user_settings').select('credits').eq('user_id', user.id).single(),
  ]);

  const plan          = (subscription?.plan ?? 'free') as PlanId;
  const credits       = (settings as any)?.credits ?? 0;
  const canCompare    = hasFeature(plan, 'competitorCompare');
  const maxCompetitors = getLimits(plan).competitorUrls;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gradient">Compare Competitors</h1>
        <p className="text-muted-foreground">
          Analyze your site alongside up to {maxCompetitors} competitor{maxCompetitors !== 1 ? 's' : ''}.
          Each URL uses 1 credit.
        </p>
      </div>

      {/* Plan gate */}
      {!canCompare ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-3">
          <div className="text-3xl">🏆</div>
          <h2 className="text-lg font-semibold">Competitor comparison requires Pro</h2>
          <p className="text-sm text-muted-foreground">
            Upgrade to Pro to compare your site against 1 competitor, or Agency to compare up to 3.
          </p>
          <a
            href="/settings"
            className="inline-block mt-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:from-orange-400 hover:to-orange-400 transition-colors"
          >
            Upgrade plan →
          </a>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-6">
          <CompareInput
            credits={credits}
            maxCompetitors={maxCompetitors}
            plan={plan}
          />
        </div>
      )}

      {/* How it works */}
      {canCompare && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '🔗', label: 'Enter URLs',      desc: 'Add your site + up to ' + maxCompetitors + ' competitor(s)' },
            { icon: '⚙️', label: 'AI Analyzes All', desc: 'Performance, accessibility & SEO for each' },
            { icon: '📊', label: 'Side-by-side',    desc: 'See where you win and where to improve' },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-card border border-border rounded-xl p-4 space-y-1"
            >
              <span className="text-2xl">{item.icon}</span>
              <p className="font-medium text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
