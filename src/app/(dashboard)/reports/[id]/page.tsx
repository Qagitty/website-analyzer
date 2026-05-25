import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { ReportHeader } from '@/components/reports/ReportHeader';
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

export default async function ReportPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: raw } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user!.id)
    .single();

  const analysis = raw as unknown as Analysis | null;
  if (!analysis || analysis.status !== 'completed') notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-10">
      <ReportHeader analysis={analysis} />
      <ScreenshotViewer url={analysis.screenshot_url} siteUrl={analysis.url} />
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
      <SecurityHeadersSection securityHeaders={(analysis.lighthouse_scores as any)?.securityHeaders} />
      <ResourceAuditSection resourceAudit={(analysis.network_requests as any)?.resourceAudit} />
      {analysis.accessibility_issues && (
        <EAAComplianceSection
          issues={(analysis.accessibility_issues as any) ?? []}
          accessibilityScore={(analysis.lighthouse_scores as any)?.accessibility ?? null}
        />
      )}
      {analysis.accessibility_issues && (
        <AccessibilitySection
          issues={analysis.accessibility_issues as any}
          aiInsights={(analysis.ai_insights as any)?.accessibility?.interpretedIssues ?? null}
        />
      )}
      {analysis.console_errors && (
        <ConsoleErrorsSection errors={analysis.console_errors as any} />
      )}
      {analysis.ai_insights && (
        <AIInsightsSection insights={analysis.ai_insights as any} />
      )}
      {analysis.design_screenshot_url && (
        <DesignComparisonSection
          comparison={(analysis.design_comparison as any) ?? {}}
          designScreenshotUrl={analysis.design_screenshot_url ?? null}
          liveScreenshotUrl={analysis.screenshot_url ?? null}
        />
      )}
      {analysis.lighthouse_scores && (
        <LLMReadinessSection scores={analysis.lighthouse_scores as any} />
      )}
      {analysis.crawl_pages && (
        <CrawledPagesSection pages={analysis.crawl_pages as any} />
      )}
    </div>
  );
}
