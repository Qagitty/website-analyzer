import type { Analysis } from '@/types/analysis';

export function generateJSON(analysis: Analysis): string {
  const scores = analysis.lighthouse_scores as any;
  const ai = analysis.ai_insights as any;

  const output = {
    meta: {
      url: analysis.url,
      analyzedAt: analysis.created_at,
      completedAt: analysis.completed_at,
      reportId: analysis.id,
      generator: 'Website Analyzer',
    },
    scores: scores ? {
      performance:    scores.performance    ?? null,
      accessibility:  scores.accessibility  ?? null,
      seo:            scores.seo            ?? null,
      bestPractices:  scores.bestPractices  ?? null,
      llmReadiness:   scores.llmReadiness   ?? null,
      coreWebVitals: {
        estimatedLcp: scores.estimatedLcp ?? null,
        ttfb:         scores.ttfb         ?? null,
      },
    } : null,
    securityHeaders: scores?.securityHeaders ?? null,
    aiSummary:       analysis.ai_summary,
    aiInsights:      ai?.insights ?? null,
    quickWins:       ai?.quickWins ?? null,
    accessibilityIssues: analysis.accessibility_issues,
    consoleErrors:       analysis.console_errors,
    crawledPages:        analysis.crawl_pages,
    resourceAudit:       (analysis.network_requests as any)?.resourceAudit ?? null,
  };

  return JSON.stringify(output, null, 2);
}
