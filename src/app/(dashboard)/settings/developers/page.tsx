import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { ApiKeysForm } from '@/components/settings/ApiKeysForm';
import { WebhooksForm } from '@/components/settings/WebhooksForm';
import { Code2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Settings — Developers' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="bg-card border border-border rounded-xl p-6">{children}</div>
    </section>
  );
}

export default async function DevelopersPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: webhooks }, { data: apiKeys }] = await Promise.all([
    (supabase as any)
      .from('webhooks')
      .select('id, url, events, active, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, requests_today, created_at, revoked_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-8">
      {/* Docs banner */}
      <div className="flex items-center justify-between bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-5 py-4">
        <div className="flex items-center gap-3">
          <Code2 className="h-5 w-5 text-indigo-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">API Documentation</p>
            <p className="text-xs text-muted-foreground">Full REST API reference with examples.</p>
          </div>
        </div>
        <Link
          href="/docs"
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View docs
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <Section title="API Keys">
        <ApiKeysForm initialKeys={(apiKeys as any) ?? []} />
      </Section>

      <Section title="Webhooks">
        <WebhooksForm initialWebhooks={(webhooks as any) ?? []} />
      </Section>
    </div>
  );
}
