import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { URLInput } from '@/components/analyze/URLInput';

export const metadata: Metadata = { title: 'Analyze Website' };

export default async function AnalyzePage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from('user_settings')
    .select('credits')
    .eq('user_id', user!.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Hero header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gradient">Analyze a Website</h1>
        <p className="text-muted-foreground">
          Enter a URL to get a full performance, accessibility, and AI analysis.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-[#13131A] border border-white/5 rounded-xl p-6">
        <URLInput credits={settings?.credits ?? 0} />
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: '⚡', label: 'Performance', desc: 'Lighthouse scores + Core Web Vitals' },
          { icon: '♿', label: 'Accessibility', desc: 'WCAG compliance checks' },
          { icon: '🤖', label: 'AI Insights', desc: 'Claude-powered recommendations' },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-[#13131A] border border-white/5 rounded-xl p-4 space-y-1"
          >
            <div className="text-xl">{item.icon}</div>
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
