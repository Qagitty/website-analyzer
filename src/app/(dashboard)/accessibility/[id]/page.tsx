export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccessibilityRiskBadge } from '@/components/accessibility/AccessibilityRiskBadge';
import { AccessibilityMultiCoverageBar } from '@/components/accessibility/AccessibilityCoverageBar';
import { Globe, Calendar, ShieldCheck, Plus } from 'lucide-react';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  return { title: `Accessibility profile — WebScore`, description: `Profile ${id}` };
}

export default async function AccessibilityProfilePage(props: Props) {
  const { id } = await props.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('accessibility_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!profile) notFound();

  const { data: assessments } = await supabase
    .from('accessibility_assessments')
    .select('id, status, type, started_at, completed_at, coverage_percent, manual_checks_required, manual_checks_completed, latest_risk_level')
    .eq('profile_id', id)
    .order('started_at', { ascending: false })
    .limit(20);

  const latest = assessments?.[0] ?? null;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-indigo-500 shrink-0" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight truncate">{profile.name}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-3 w-3" aria-hidden="true" />
            <span>{profile.site_url}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AccessibilityRiskBadge level={profile.latest_risk_level} />
          <Button asChild>
            <Link href={`/accessibility/${id}?assess=1`}>
              <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Run assessment
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Risk level',   value: profile.latest_risk_level ?? 'Not assessed' },
          { label: 'Assessments', value: String(assessments?.length ?? 0) },
          { label: 'Status',       value: profile.status ?? 'active' },
          { label: 'Last assessed', value: profile.last_assessed_at
            ? new Date(profile.last_assessed_at).toLocaleDateString()
            : 'Never' },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold text-sm mt-0.5 capitalize">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {latest && (
        <AccessibilityMultiCoverageBar
          pageCoverage={latest.coverage_percent ?? 0}
          manualCoverage={
            latest.manual_checks_required
              ? Math.round(((latest.manual_checks_completed ?? 0) / latest.manual_checks_required) * 100)
              : undefined
          }
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="assessments">
        <TabsList>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="assessments" className="pt-4">
          {!assessments || assessments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
              <p className="font-medium">No assessments yet</p>
              <p className="text-sm mt-1">Run your first accessibility risk assessment to get started.</p>
            </div>
          ) : (
            <ul className="space-y-2" role="list">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {assessments.map((a: any) => (
                <li key={a.id}>
                  <Link
                    href={`/accessibility/assessments/${a.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    aria-label={`Assessment from ${a.started_at ? new Date(a.started_at).toLocaleDateString() : 'unknown date'}, status: ${a.status}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        {a.started_at
                          ? new Date(a.started_at).toLocaleString()
                          : 'Pending'}
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {a.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {typeof a.coverage_percent === 'number' && (
                        <span className="text-xs text-muted-foreground">
                          {a.coverage_percent}% coverage
                        </span>
                      )}
                      <AccessibilityRiskBadge level={a.latest_risk_level} size="sm" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="settings" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <dl className="space-y-2">
                {[
                  ['Site URL', profile.site_url],
                  ['Assessment page mode', profile.assessment_page_mode ?? 'sitemap'],
                  ['Schedule', profile.schedule ?? 'Manual only'],
                  ['Public sector', profile.public_sector ? 'Yes' : 'No'],
                  ['Consumer services', profile.provides_consumer_services ? 'Yes' : 'No'],
                  ['Selected standards', (profile.selected_standards as string[] | null)?.join(', ') ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-2">
                    <dt className="font-medium text-muted-foreground w-48 shrink-0">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
