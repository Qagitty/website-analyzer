export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccessibilityRiskBadge } from '@/components/accessibility/AccessibilityRiskBadge';
import { AccessibilityMultiCoverageBar } from '@/components/accessibility/AccessibilityCoverageBar';
import { AccessibilityFindingsList } from '@/components/accessibility/AccessibilityFindingsList';
import { AccessibilityManualCheckGrid } from '@/components/accessibility/AccessibilityManualCheckGrid';
import { ChevronLeft, Calendar } from 'lucide-react';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Accessibility assessment — WebScore',
};

export default async function AccessibilityAssessmentPage(props: Props) {
  const { id } = await props.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch assessment with profile ownership check via join
  const { data: assessment } = await supabase
    .from('accessibility_assessments')
    .select(`
      *,
      accessibility_profiles!inner(id, name, site_url, user_id)
    `)
    .eq('id', id)
    .eq('accessibility_profiles.user_id', user.id)
    .single();

  if (!assessment) notFound();

  const profile = assessment.accessibility_profiles as unknown as {
    id: string; name: string; site_url: string;
  };

  // Fetch manual checks catalog + results for this assessment
  const { data: manualChecksRaw } = await supabase
    .from('accessibility_manual_check_catalog')
    .select(`
      id, name, description, wcag_criteria,
      accessibility_manual_check_results(id, result, notes, reviewed_at)
    `)
    .order('name');

  // Flatten manual checks for the grid
  const manualChecks = (manualChecksRaw ?? []).map((c: {
    id: string; name: string; description: string; wcag_criteria?: string[];
    accessibility_manual_check_results?: { id: string; result: string; notes?: string; reviewed_at?: string }[];
  }) => {
    const result = c.accessibility_manual_check_results?.[0];
    return {
      id:             c.id,
      resultId:       result?.id,
      name:           c.name,
      description:    c.description,
      wcag_criteria:  c.wcag_criteria,
      result:         result?.result ?? 'not_tested',
      notes:          result?.notes,
      reviewed_at:    result?.reviewed_at,
    };
  });

  const pagesTotal      = assessment.page_count ?? 0;
  const pagesDone       = (pagesTotal - (assessment.pages_failed ?? 0));
  const pageCoverage    = pagesTotal > 0 ? Math.round((pagesDone / pagesTotal) * 100) : 0;
  const manualRequired  = assessment.manual_checks_required ?? 0;
  const manualCompleted = assessment.manual_checks_completed ?? 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/accessibility/${profile.id}`}>
            <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            {profile.name}
          </Link>
        </Button>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Accessibility assessment</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {assessment.started_at
              ? new Date(assessment.started_at).toLocaleString()
              : 'Not started'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{assessment.status}</Badge>
          <AccessibilityRiskBadge level={assessment.latest_risk_level} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pages assessed',       value: `${pagesDone}/${pagesTotal}` },
          { label: 'Automated findings',   value: String(assessment.automated_findings_count ?? 0) },
          { label: 'Manual checks',        value: `${manualCompleted}/${manualRequired}` },
          { label: 'Engine version',       value: assessment.engine_version ?? '—' },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold text-sm mt-0.5">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AccessibilityMultiCoverageBar
        pageCoverage={pageCoverage}
        manualCoverage={manualRequired > 0 ? Math.round((manualCompleted / manualRequired) * 100) : undefined}
      />

      {/* Tabs */}
      <Tabs defaultValue="findings">
        <TabsList>
          <TabsTrigger value="findings">Automated findings</TabsTrigger>
          <TabsTrigger value="manual">Manual checks</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="pt-4">
          <AccessibilityFindingsList assessmentId={id} />
        </TabsContent>

        <TabsContent value="manual" className="pt-4">
          <AccessibilityManualCheckGrid checks={manualChecks} />
        </TabsContent>

        <TabsContent value="pages" className="pt-4">
          <PagesTable assessmentId={id} supabase={supabase} />
        </TabsContent>
      </Tabs>

      {/* Statement link */}
      {assessment.status === 'completed' && (
        <div className="pt-2 border-t border-border">
          <Button variant="outline" asChild>
            <Link href={`/accessibility/${profile.id}/statements`}>
              Generate accessibility statement
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Statements are drafts that require review before publication. Manual review required.
          </p>
        </div>
      )}
    </main>
  );
}

async function PagesTable({
  assessmentId,
  supabase,
}: {
  assessmentId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const { data: pages } = await supabase
    .from('accessibility_assessment_pages')
    .select('id, page_url, normalized_url, status, automated_findings_count, error_code, completed_at')
    .eq('assessment_id', assessmentId)
    .order('page_url')
    .limit(100);

  if (!pages || pages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No pages recorded for this assessment.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Assessed pages">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground text-xs">
            <th className="py-2 pr-4 font-medium">Page URL</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Findings</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((p: { id: string; page_url: string; status: string; automated_findings_count?: number; error_code?: string }) => (
            <tr key={p.id} className="border-b border-border last:border-0">
              <td className="py-2 pr-4 break-all max-w-xs truncate font-mono text-xs">{p.page_url}</td>
              <td className="py-2 pr-4">
                <Badge variant="outline" className="text-xs capitalize">{p.status}</Badge>
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {p.automated_findings_count ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
