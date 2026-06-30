import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getSignedUrlOrNull } from '@/lib/supabase/storage';
import { buildReportViewModel, buildNavSections } from '@/lib/report/view-model';
import { ReportNav } from '@/components/reports/ReportNav';
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
import { SEOSection } from '@/components/reports/SEOSection';
import { BestPracticesSection } from '@/components/reports/BestPracticesSection';
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

  const [screenshotSignedUrl, designSignedUrl] = await Promise.all([
    getSignedUrlOrNull(supabase, analysis.screenshot_url),
    getSignedUrlOrNull(supabase, analysis.design_screenshot_url),
  ]);

  // §3 — build normalized view model; all components below consume it
  const vm = buildReportViewModel(analysis);

  const hasConsoleErrors = !!(analysis.console_errors?.length);
  const hasDesignComparison = !!(analysis.design_comparison);
  const crawlPageCount = analysis.crawl_pages?.length ?? 0;
  const actionPlanCount = ((analysis.ai_insights as any)?.insights as any[] | null)?.length ?? 0;

  const navSections = buildNavSections(vm, hasConsoleErrors, hasDesignComparison, crawlPageCount, actionPlanCount);

  return (
    <div className="flex gap-8 max-w-[1280px] mx-auto">
      {/* §7 — Sticky navigation sidebar (desktop) + horizontal pill nav (mobile) */}
      <ReportNav sections={navSections} />

      {/* Main report content */}
      <main className="flex-1 min-w-0 space-y-10 pb-16">
        <ReportHeader analysis={analysis} />

        {/* §4 — Executive overview with coverage / confidence / audit scope */}
        <section id="overview" aria-labelledby="overview-heading" className="scroll-mt-20">
          <ExecSummarySection vm={vm} />
        </section>

        {/* §18 — Action plan (prioritised fix roadmap) */}
        {analysis.ai_insights && (
          <section id="action-plan" aria-labelledby="action-plan-heading" className="scroll-mt-20">
            <FixRoadmapSection insights={(analysis.ai_insights as any)?.insights} />
          </section>
        )}

        <ScreenshotViewer url={screenshotSignedUrl} siteUrl={analysis.url} />

        {/* Performance */}
        {analysis.lighthouse_scores && (
          <section id="performance" aria-labelledby="performance-heading" className="scroll-mt-20">
            <PerformanceSection
              scores={analysis.lighthouse_scores as any}
              resourceAudit={(analysis.network_requests as any)?.resourceAudit}
              htmlBytes={(analysis.network_requests as any)?.totalBytes}
              analysisUrl={analysis.url}
              completedAt={analysis.completed_at ?? undefined}
            />
          </section>
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

        <ResourceAuditSection resourceAudit={(analysis.network_requests as any)?.resourceAudit} />

        {/* Accessibility */}
        <section id="accessibility" aria-labelledby="accessibility-heading" className="scroll-mt-20">
          <EAAComplianceSection
            accessibilityIssues={(analysis.accessibility_issues as any) ?? undefined}
          />
          {(analysis.lighthouse_scores as any)?.accessibilityAudit ? (
            <AccessibilitySection
              accessibilityAudit={(analysis.lighthouse_scores as any).accessibilityAudit}
              aiInsights={(analysis.ai_insights as any)?.accessibility?.interpretedIssues ?? null}
              analysisId={analysis.id}
              url={analysis.url}
            />
          ) : analysis.accessibility_issues ? (
            <AccessibilitySection
              issues={analysis.accessibility_issues as any}
              aiInsights={(analysis.ai_insights as any)?.accessibility?.interpretedIssues ?? null}
              analysisId={analysis.id}
              url={analysis.url}
            />
          ) : null}
        </section>

        {/* SEO */}
        <section id="seo" aria-labelledby="seo-heading" className="scroll-mt-20">
          <SEOSection
            seoAudit={(analysis.lighthouse_scores as any)?.seoAudit ?? null}
            legacyScore={analysis.lighthouse_scores?.seo}
            legacyChecks={(analysis.lighthouse_scores as any)?.scoreBreakdown?.seo}
          />
        </section>

        {/* Best Practices */}
        <section id="best-practices" aria-labelledby="best-practices-heading" className="scroll-mt-20">
          <BestPracticesSection
            bestPracticesAudit={(analysis.lighthouse_scores as any)?.bestPracticesAudit ?? null}
            legacyScore={analysis.lighthouse_scores?.bestPractices}
            legacyChecks={(analysis.lighthouse_scores as any)?.scoreBreakdown?.bestPractices}
          />
        </section>

        {/* Security Headers */}
        <section id="security" aria-labelledby="security-heading" className="scroll-mt-20">
          <SecurityHeadersSection
            securityHeadersAudit={(analysis.lighthouse_scores as any)?.securityHeadersAudit}
            securityHeaders={(analysis.lighthouse_scores as any)?.securityHeaders}
            crawledPages={analysis.crawl_pages as any}
          />
        </section>

        {/* AI Readiness */}
        {analysis.lighthouse_scores && (
          <section id="llm-readiness" aria-labelledby="llm-readiness-heading" className="scroll-mt-20">
            <LLMReadinessSection scores={analysis.lighthouse_scores as any} />
          </section>
        )}

        {/* Console errors */}
        {hasConsoleErrors && (
          <section id="console-errors" aria-labelledby="console-errors-heading" className="scroll-mt-20">
            <ConsoleErrorsSection errors={analysis.console_errors as any} />
          </section>
        )}

        {/* AI insights */}
        {analysis.ai_insights && (
          <AIInsightsSection insights={analysis.ai_insights as any} />
        )}

        {/* Design comparison */}
        {hasDesignComparison && (
          <section id="design" aria-labelledby="design-heading" className="scroll-mt-20">
            <DesignComparisonSection
              designComparison={(analysis.design_comparison as any) ?? undefined}
              designScreenshotUrl={designSignedUrl ?? undefined}
              screenshotUrl={screenshotSignedUrl ?? undefined}
            />
          </section>
        )}

        {/* Crawled pages */}
        {crawlPageCount > 0 && (
          <section id="crawled-pages" aria-labelledby="crawled-pages-heading" className="scroll-mt-20">
            <CrawledPagesSection
              crawledPages={analysis.crawl_pages as any}
              crawlCoverage={(analysis.lighthouse_scores as any)?.crawlCoverage}
            />
          </section>
        )}
      </main>
    </div>
  );
}
