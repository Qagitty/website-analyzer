import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { SAMPLE_ANALYSIS } from '@/lib/sample-report/data';
import { ExecSummarySection } from '@/components/reports/ExecSummarySection';
import { FixRoadmapSection } from '@/components/reports/FixRoadmapSection';
import { PerformanceSection } from '@/components/reports/PerformanceSection';
import { EAAComplianceSection } from '@/components/reports/EAAComplianceSection';
import { AccessibilitySection } from '@/components/reports/AccessibilitySection';
import { ConsoleErrorsSection } from '@/components/reports/ConsoleErrorsSection';
import { AIInsightsSection } from '@/components/reports/AIInsightsSection';
import { LLMReadinessSection } from '@/components/reports/LLMReadinessSection';
import { CrawledPagesSection } from '@/components/reports/CrawledPagesSection';
import { SecurityHeadersSection } from '@/components/reports/SecurityHeadersSection';
import { ResourceAuditSection } from '@/components/reports/ResourceAuditSection';
import { ScoreBreakdownSection } from '@/components/reports/ScoreBreakdownSection';

export const metadata: Metadata = {
  title: 'Sample Website Audit Report | WebsiteAnalyzer',
  description:
    'See a real website audit report in action — performance, accessibility, SEO, AI readiness, and a prioritised fix roadmap.',
  openGraph: {
    title: 'Sample Website Audit Report',
    description:
      'Performance, accessibility, SEO, AI readiness, and a prioritised fix roadmap — all in one report.',
    type: 'website',
  },
};

const analysis = SAMPLE_ANALYSIS;
const scores   = analysis.lighthouse_scores!;

export default function SampleReportPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Top banner ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-indigo-600/90 backdrop-blur border-b border-indigo-500/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">
              This is a <strong>sample report</strong> for a fictional website — showing what you get after an audit.
            </span>
          </div>
          <Link
            href="/signup"
            className="shrink-0 rounded-full bg-white text-indigo-700 text-xs font-semibold px-3 py-1.5 hover:bg-indigo-50 transition-colors"
          >
            Audit your site free →
          </Link>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 md:space-y-12">

        {/* Back nav */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>

        {/* Report title */}
        <div>
          <p className="text-sm text-muted-foreground font-medium mb-1 uppercase tracking-wide">
            Sample Audit Report
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gradient">
            Greenleaf Garden Centre
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">
            greenleaf-garden.example.com
          </p>
        </div>

        {/* Executive Summary */}
        <ExecSummarySection
          url={analysis.url}
          scores={scores}
          aiSummary={analysis.ai_summary}
          completedAt={analysis.completed_at}
        />

        {/* Fix Roadmap — the star of Sprint 2 */}
        <FixRoadmapSection insights={analysis.ai_insights?.insights} />

        {/* Performance */}
        <PerformanceSection
          scores={scores as any}
          resourceAudit={(analysis.network_requests as any)?.resourceAudit}
          htmlBytes={(analysis.network_requests as any)?.totalBytes}
          analysisUrl={analysis.url}
          completedAt={analysis.completed_at ?? undefined}
        />

        {/* Score breakdown */}
        {(scores as any).scoreBreakdown && (
          <ScoreBreakdownSection
            breakdown={(scores as any).scoreBreakdown}
            scores={{
              performance:   scores.performance,
              bestPractices: scores.bestPractices,
              seo:           scores.seo,
              accessibility: scores.accessibility,
            }}
          />
        )}

        {/* Security headers */}
        <SecurityHeadersSection securityHeaders={(scores as any).securityHeaders} />

        {/* Resource audit (legacy detail) */}
        <ResourceAuditSection resourceAudit={(analysis.network_requests as any)?.resourceAudit} />

        {/* EAA compliance */}
        <EAAComplianceSection accessibilityIssues={analysis.accessibility_issues as any} />

        {/* Accessibility issues */}
        {analysis.accessibility_issues && (
          <AccessibilitySection
            issues={analysis.accessibility_issues as any}
            aiInsights={(analysis.ai_insights as any)?.accessibility?.interpretedIssues ?? null}
            analysisId={analysis.id}
            url={analysis.url}
          />
        )}

        {/* Console errors */}
        {analysis.console_errors && (
          <ConsoleErrorsSection errors={analysis.console_errors as any} />
        )}

        {/* AI Insights */}
        {analysis.ai_insights && (
          <AIInsightsSection insights={analysis.ai_insights as any} />
        )}

        {/* LLM Readiness */}
        <LLMReadinessSection scores={scores as any} />

        {/* Crawled pages */}
        <CrawledPagesSection crawledPages={analysis.crawl_pages as any} />

        {/* ── CTA footer ──────────────────────────────────────────── */}
        <div className="rounded-2xl bg-indigo-500/5 border border-indigo-500/20 p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold">Ready to see your website&apos;s results?</h2>
          <p className="text-muted-foreground max-w-md mx-auto text-sm">
            Get a full audit like this for your site in under 60 seconds — completely free, no credit card needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold px-6 py-3 text-sm hover:opacity-90 transition-opacity"
            >
              <Sparkles className="h-4 w-4" />
              Run free audit
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-border text-sm font-medium px-6 py-3 hover:bg-accent transition-colors"
            >
              Sign in
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Free tier includes 3 full audits. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}
