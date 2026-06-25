import type { Analysis } from '@/types/analysis';

export function generateMarkdown(analysis: Analysis): string {
  const scores = analysis.lighthouse_scores as any;
  const ai = analysis.ai_insights as any;
  const lines: string[] = [];

  const date = new Date(analysis.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  lines.push(`# Website Analysis Report`);
  lines.push(`**URL:** ${analysis.url}`);
  lines.push(`**Analyzed:** ${date}`);
  lines.push(`**Status:** Completed`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Executive summary
  if (analysis.ai_summary) {
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(analysis.ai_summary);
    lines.push('');
  }

  // Scores
  if (scores) {
    lines.push('## Scores');
    lines.push('');
    lines.push('| Category | Score |');
    lines.push('|----------|-------|');
    if (scores.performance != null)   lines.push(`| Performance | ${scores.performance}/100 |`);
    if (scores.accessibility != null) lines.push(`| Accessibility | ${scores.accessibility}/100 |`);
    if (scores.seo != null)           lines.push(`| SEO | ${scores.seo}/100 |`);
    if (scores.bestPractices != null) lines.push(`| Best Practices | ${scores.bestPractices}/100 |`);
    if (scores.llmReadiness != null)  lines.push(`| LLM Readiness | ${scores.llmReadiness}/100 |`);
    lines.push('');

    if (scores.estimatedLcp != null) {
      lines.push('### Core Web Vitals');
      lines.push('');
      lines.push('| Metric | Value |');
      lines.push('|--------|-------|');
      lines.push(`| LCP (Largest Contentful Paint) | ${(scores.estimatedLcp / 1000).toFixed(1)}s |`);
      if (scores.ttfb != null) lines.push(`| TTFB (Time to First Byte) | ${scores.ttfb}ms |`);
      lines.push('');
    }
  }

  // Security headers
  if (scores?.securityHeaders?.length) {
    const headers = scores.securityHeaders as any[];
    const present = headers.filter(h => h.present).length;
    lines.push('## Security Headers');
    lines.push('');
    lines.push(`**${present}/${headers.length} headers present**`);
    lines.push('');
    for (const h of headers) {
      const icon = h.present ? '✅' : '❌';
      lines.push(`- ${icon} \`${h.header}\`${h.present && h.value ? ` — \`${h.value}\`` : ` — ${h.description}`}`);
      if (!h.present) lines.push(`  - **Fix:** \`${h.recommendation}\``);
    }
    lines.push('');
  }

  // AI Insights
  if (ai?.insights?.length) {
    lines.push('## AI Insights');
    lines.push('');
    for (const insight of ai.insights) {
      const priority = (insight.priority as string).toUpperCase();
      lines.push(`### [${priority}] ${insight.title}`);
      lines.push('');
      if (insight.description) lines.push(insight.description);
      lines.push('');
      if (insight.recommendation) {
        lines.push(`**Recommendation:** ${insight.recommendation}`);
        lines.push('');
      }
      if (insight.codeExample || insight.afterCode) {
        lines.push('```');
        lines.push(insight.afterCode ?? insight.codeExample);
        lines.push('```');
        lines.push('');
      }
    }
  }

  // Quick wins
  if (ai?.quickWins?.length) {
    lines.push('## Quick Wins');
    lines.push('');
    for (const win of ai.quickWins) {
      lines.push(`- ${win}`);
    }
    lines.push('');
  }

  // Accessibility issues
  const a11y = analysis.accessibility_issues as any[];
  if (a11y?.length) {
    lines.push('## Accessibility Issues');
    lines.push('');
    for (const issue of a11y) {
      lines.push(`### ${issue.id} (${issue.impact})`);
      lines.push('');
      lines.push(issue.description ?? '');
      if (issue.wcagCriteria?.length) {
        lines.push(`**WCAG:** ${issue.wcagCriteria.join(', ')}`);
      }
      if (issue.nodes?.length) {
        lines.push('');
        lines.push('Affected elements:');
        for (const node of issue.nodes.slice(0, 3)) lines.push(`- \`${node}\``);
      }
      lines.push('');
    }
  }

  // Console errors
  const errors = analysis.console_errors as any[];
  if (errors?.length) {
    lines.push('## Console Errors');
    lines.push('');
    for (const err of errors) {
      lines.push(`- **[${err.type?.toUpperCase() ?? 'ERROR'}]** ${err.message}`);
      if (err.source) lines.push(`  - Source: \`${err.source}\``);
    }
    lines.push('');
  }

  // Crawled pages
  const pages = analysis.crawl_pages as any[];
  if (pages?.length) {
    lines.push('## Crawled Pages');
    lines.push('');
    lines.push('| Page | Status | Perf | SEO | A11y |');
    lines.push('|------|--------|------|-----|------|');
    for (const page of pages) {
      const url = (() => { try { const u = new URL(page.url); return u.hostname + u.pathname; } catch { return page.url; } })();
      lines.push(`| ${url} | ${page.statusCode} | ${page.performance ?? '—'} | ${page.seo ?? '—'} | ${page.accessibility ?? '—'} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`*Generated by Website Analyzer · ${date}*`);

  return lines.join('\n');
}
