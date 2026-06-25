import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getSignedUrlOrNull } from '@/lib/supabase/storage';
import { ReportHeader } from '@/components/reports/ReportHeader';
import { ExecSummarySection } from '@/components/reports/ExecSummarySection';
import { FixRoadmapSection } from '@/components/reports/FixRoadmapSection';
import { PerformanceSection } from '@/components/reports/PerformanceSection';
import { EAAComplianceSection } from '@/components/reports/EAAComplianceSection';
import { AccessibilitySection } from '@/components/reports/AccessibilitySection';
import { ConsoleErrorsSection } from '@/components/reports/ConsoleErrorsSection';
import { AIInsightsSection } from '@/components/reports/AIInsightsSection';
import { ScreenshotViewer } from '@/components/reports/ScreenshotViewer';
import { DesignComparisonSection } from '@/components/reports/DesignComparisonSection';
import { LLMReadinessSection } from '@/components/reports/LLMReadinessSection';
import { CrawledPagesSection } from '@/components/reports/CrawledPagesSection';
import { SecurityHeadersSection } from '@/components/reports/SecurityHeadersSection';
import { ResourceAuditSection } from '@/components/reports/ResourceAuditSection';
import { ScoreBreakdownSection } from '@/components/reports/ScoreBreakdownSection';
import type { Analysis } from '@/types/analysis';

export const metadata: Metadata = { title: 'Report' };

export default async function ReportPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: raw } = await supabase
    .from('analyses')
    .select(
      'id, url, status, screenshot_url, design_screenshot_url, design_comparison, ' +
      'lighthouse_scores, console_errors, accessibility_issues, network_requests, ' +
      'ai_insights, ai_summary, is_public, error_message, created_at, completed_at, crawl_pages'
    )
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  const analysis = raw as unknown as Analysis | null;
  if (!analysis) notFound();
  if (analysis.status !== 'completed') redirect(`/analyze/${params.id}`);

  // Resolve storage paths → time-limited signed URLs (1 h).
  // Screenshots are in a PRIVATE bucket — never served as public URLs.
  const [screenshotSignedUrl, designSignedUrl] = await Promise.all([
    getSignedUrlOrNull(supabase, analysis.screenshot_url),
    getSignedUrlOrNull(supabase, analysis.design_screenshot_url),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-10">
      <ReportHeader analysis={analysis} />

      {/* Executive summary — scores + plain-language AI overview */}
      {analysis.lighthouse_scores && (
        <ExecSummarySection
          url={analysis.url}
          scores={analysis.lighthouse_scores as any}
          aiSummary={analysis.ai_summary}
          completedAt={analysis.completed_at}
        />
      )}

      {/* Fix roadmap — prioritised issues with code snippets */}
      {analysis.ai_insights && (
        <FixRoadmapSection insights={(analysis.ai_insights as any)?.insights} />
      )}

      <ScreenshotViewer url={screenshotSignedUrl} siteUrl={analysis.url} />
      {analysis.lighthouse_scores && (
        <PerformanceSection scores={analysis.lighthouse_scores as any} />
      )}
      {(analysis.lighthouse_scores as any)?.scoreBreakdown && (
        <ScoreBreakdownSection
          breakdown={(analysis.lighthouse_scores as any).scoreBreakdown}
          scores={{
            performance: (analysis.lighthouse_scores as any).performance,
            bestPractices: (analysis.lighthouse_scores as any).bestPractices,
            seo: (analysis.lighthouse_scores as any).seo,
            accessibility: (analysis.lighthouse_scores as any).accessibility,
          }}
        />
      )}
      <SecurityHeadersSection
        securityHeaders={(analysis.lighthouse_scores as any)?.securityHeaders}
        crawledPages={analysis.crawl_pages as any}
      />
      <ResourceAuditSection resourceAudit={(analysis.network_requests as any)?.resourceAudit} />
      <EAAComplianceSection
        accessibilityIssues={(analysis.accessibility_issues as any) ?? undefined}
      />
      {analysis.accessibility_issues && (
        <AccessibilitySection
          issues={analysis.accessibility_issues as any}
          aiInsights={(analysis.ai_insights as any)?.accessibility?.interpretedIssues ?? null}
          analysisId={analysis.id}
          url={analysis.url}
        />
      )}
      {analysis.console_errors && (
        <ConsoleErrorsSection errors={analysis.console_errors as any} />
      )}
      {analysis.ai_insights && (
        <AIInsightsSection insights={analysis.ai_insights as any} />
      )}
      <DesignComparisonSection
        designComparison={(analysis.design_comparison as any) ?? undefined}
        designScreenshotUrl={designSignedUrl ?? undefined}
        screenshotUrl={screenshotSignedUrl ?? undefined}
      />
      {analysis.lighthouse_scores && (
        <LLMReadinessSection scores={analysis.lighthouse_scores as any} />
      )}
      <CrawledPagesSection crawledPages={analysis.crawl_pages as any} />
    </div>
  );
}
