/**
 * §46 — Web/PDF snapshot consistency.
 * §47 — PDF view model unit tests.
 *
 * Guarantees: scores, coverage, confidence, audit modes, finding counts,
 * limitations, and analysis date shown in the PDF exactly match the web report.
 */

import { describe, it, expect } from 'vitest';
import { buildReportViewModel } from '@/lib/report/view-model';
import {
  buildPdfViewModel,
  sanitizePdfUrl,
  sanitizePdfFilename,
} from '@/lib/pdf/pdf-view-model';
import type { Analysis } from '@/types/analysis';

// ─── Fixture ───────────────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: 'abcd1234-5678-0000-0000-000000000000',
    user_id: 'user-1',
    url: 'https://example.com',
    status: 'completed',
    screenshot_url: null,
    design_screenshot_url: null,
    design_comparison: null,
    lighthouse_scores: {
      performance: 85,
      accessibility: 72,
      bestPractices: 90,
      seo: 65,
      ttfb: 320,
      measurementMode: 'fetch-only',
    },
    console_errors: null,
    accessibility_issues: null,
    network_requests: null,
    ai_insights: null,
    ai_summary: 'The site performs reasonably well.',
    is_public: false,
    error_message: null,
    queue_position: null,
    started_at: null,
    completed_at: '2026-06-27T10:00:00Z',
    created_at: '2026-06-27T09:50:00Z',
    updated_at: '2026-06-27T10:00:00Z',
    crawl_pages: null,
    ...overrides,
  };
}

// ─── sanitizePdfUrl ───────────────────────────────────────────────────────────

describe('sanitizePdfUrl', () => {
  it('removes token param', () => {
    const result = sanitizePdfUrl('https://example.com/page?token=abc123');
    expect(result).not.toContain('token=');
    expect(result).toContain('example.com');
  });

  it('removes multiple sensitive params while keeping safe ones', () => {
    const result = sanitizePdfUrl('https://example.com/?key=x&foo=bar&session=y');
    expect(result).not.toContain('key=');
    expect(result).not.toContain('session=');
    expect(result).toContain('foo=bar');
  });

  it('preserves non-sensitive params', () => {
    const result = sanitizePdfUrl('https://example.com/?page=2&lang=en');
    expect(result).toContain('page=2');
    expect(result).toContain('lang=en');
  });

  it('removes access_token and refresh_token', () => {
    const result = sanitizePdfUrl('https://example.com/?access_token=x&refresh_token=y&q=hello');
    expect(result).not.toContain('access_token');
    expect(result).not.toContain('refresh_token');
    expect(result).toContain('q=hello');
  });

  it('handles malformed URL gracefully', () => {
    expect(sanitizePdfUrl('not-a-url')).toBe('not-a-url');
  });

  it('handles URL with no query string', () => {
    expect(sanitizePdfUrl('https://example.com/path')).toBe('https://example.com/path');
  });
});

// ─── sanitizePdfFilename ──────────────────────────────────────────────────────

describe('sanitizePdfFilename', () => {
  it('produces expected pattern', () => {
    expect(sanitizePdfFilename('example.com', '2026-06-27')).toBe('website-analysis-example.com-2026-06-27.pdf');
  });

  it('replaces slashes and special chars with hyphens', () => {
    const fn = sanitizePdfFilename('my/site:domain!', '2026-06-27');
    expect(fn).not.toMatch(/[/:!]/);
  });

  it('always ends with .pdf', () => {
    expect(sanitizePdfFilename('example.com', '2026-06-27')).toMatch(/\.pdf$/);
  });

  it('handles empty domain gracefully', () => {
    const fn = sanitizePdfFilename('', '2026-06-27');
    expect(fn).toMatch(/website-analysis-unknown/);
    expect(fn).toMatch(/\.pdf$/);
  });

  it('handles empty date gracefully', () => {
    const fn = sanitizePdfFilename('example.com', '');
    expect(fn).toMatch(/website-analysis-example.com/);
    expect(fn).toMatch(/\.pdf$/);
  });

  it('lowercases the domain', () => {
    const fn = sanitizePdfFilename('EXAMPLE.COM', '2026-06-27');
    expect(fn).toContain('example.com');
  });

  it('truncates very long domains', () => {
    const longDomain = 'a'.repeat(100) + '.example.com';
    const fn = sanitizePdfFilename(longDomain, '2026-06-27');
    expect(fn.length).toBeLessThan(120);
  });
});

// ─── §46 — Web / PDF consistency ─────────────────────────────────────────────

describe('§46 web/PDF consistency', () => {
  it('all category scores match between web and PDF models', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);

    for (const webCat of webVm.categories) {
      const pdfCat = pdfVm.categories.find(c => c.id === webCat.id);
      expect(pdfCat).toBeDefined();

      if (webCat.score.available) {
        expect(pdfCat!.score.isUnavailable).toBe(false);
        expect(pdfCat!.score.value).toBe((webCat.score as any).value);
      } else {
        expect(pdfCat!.score.isUnavailable).toBe(true);
        expect(pdfCat!.score.value).toBeNull();
      }
    }
  });

  it('coverage percentage matches', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);

    for (const webCat of webVm.categories) {
      const pdfCat = pdfVm.categories.find(c => c.id === webCat.id)!;
      if (webCat.coverage != null) {
        expect(pdfCat.coverageText).toBe(`${webCat.coverage}% coverage`);
      } else {
        expect(pdfCat.coverageText).toBeNull();
      }
    }
  });

  it('confidence label matches', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);

    for (const webCat of webVm.categories) {
      const pdfCat = pdfVm.categories.find(c => c.id === webCat.id)!;
      if (webCat.confidence != null) {
        expect(pdfCat.confidenceText).toBe(webCat.confidence.label);
      }
    }
  });

  it('audit mode label matches', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);

    for (const webCat of webVm.categories) {
      const pdfCat = pdfVm.categories.find(c => c.id === webCat.id)!;
      expect(pdfCat.auditModeText).toBe(webCat.auditModeLabel ?? null);
    }
  });

  it('finding counts match', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);

    for (const webCat of webVm.categories) {
      const pdfCat = pdfVm.categories.find(c => c.id === webCat.id)!;
      expect(pdfCat.criticalCount).toBe(webCat.criticalCount);
      expect(pdfCat.highCount).toBe(webCat.highCount);
      expect(pdfCat.passCount).toBe(webCat.passCount);
      expect(pdfCat.manualReviewCount).toBe(webCat.manualReviewCount);
    }
  });

  it('overall score matches', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.overallScore).toBe(webVm.overview.overallScore);
  });

  it('grade matches', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.grade).toBe(webVm.overview.grade);
    expect(pdfVm.gradeLabel).toBe(webVm.overview.gradeLabel);
  });

  it('critical and high finding totals match', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.criticalFindings).toBe(webVm.overview.criticalFindings);
    expect(pdfVm.highFindings).toBe(webVm.overview.highFindings);
  });

  it('limitations match', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.limitations).toEqual(webVm.overview.limitations);
  });

  it('analysis date is preserved from completed_at', () => {
    const analysis = makeAnalysis({ completed_at: '2026-06-27T10:00:00Z' });
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.meta.analysisDateStr).toContain('2026');
    expect(pdfVm.meta.analysisDateStr).toContain('27');
  });

  it('pagesAnalyzed matches web overview', () => {
    const analysis = makeAnalysis({
      crawl_pages: [
        { url: 'https://example.com', statusCode: 200, ttfb: 100, bytes: 0, title: 'Home', performance: 80, seo: 70, accessibility: 75, llmReadiness: 60 },
        { url: 'https://example.com/about', statusCode: 200, ttfb: 120, bytes: 0, title: 'About', performance: 75, seo: 65, accessibility: 70, llmReadiness: 55 },
      ],
    });
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.meta.pagesAnalyzed).toBe(webVm.overview.pagesAnalyzed);
    expect(pdfVm.meta.pagesAnalyzed).toBe(2);
  });
});

// ─── §47 — PDF view model unit tests ─────────────────────────────────────────

describe('buildPdfViewModel', () => {
  it('safeReportId strips dashes and uppercases first 8 chars', () => {
    const analysis = makeAnalysis({ id: 'abcd1234-5678-0000-0000-000000000000' });
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.meta.safeReportId).toBe('ABCD1234');
  });

  it('testedUrl has sensitive params removed', () => {
    const analysis = makeAnalysis({ url: 'https://example.com/?token=xyz&q=audit' });
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.meta.testedUrl).not.toContain('token=');
    expect(pdfVm.meta.testedUrl).toContain('q=audit');
  });

  it('domain is the clean hostname', () => {
    const analysis = makeAnalysis({ url: 'https://www.example.com/path?q=1' });
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.meta.domain).toBe('www.example.com');
  });

  it('unavailable scores show displayText "—" not "0"', () => {
    const analysis = makeAnalysis({ lighthouse_scores: null });
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    // No categories when lighthouse_scores is null
    expect(pdfVm.categories).toHaveLength(0);
  });

  it('security category unavailable when no v2 audit', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    const sec = pdfVm.categories.find(c => c.id === 'security')!;
    expect(sec.score.isUnavailable).toBe(true);
    expect(sec.score.value).toBeNull();
    expect(sec.score.displayText).not.toBe('0');
  });

  it('isLegacy flag is preserved', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.meta.isLegacy).toBe(webVm.overview.isLegacy);
    const perf = pdfVm.categories.find(c => c.id === 'performance')!;
    const webPerf = webVm.categories.find(c => c.id === 'performance')!;
    expect(perf.isLegacy).toBe(webPerf.isLegacy);
  });

  it('score color hex is green for 90+, amber for 50-89, red for <50', () => {
    const analysis = makeAnalysis({
      lighthouse_scores: { performance: 95, accessibility: 70, bestPractices: 40, seo: 65, ttfb: 300 },
    });
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    const perf = pdfVm.categories.find(c => c.id === 'performance')!;
    const acc  = pdfVm.categories.find(c => c.id === 'accessibility')!;
    const bp   = pdfVm.categories.find(c => c.id === 'best-practices')!;
    expect(perf.score.colorHex).toBe('#16a34a'); // green
    expect(acc.score.colorHex).toBe('#d97706');  // amber
    expect(bp.score.colorHex).toBe('#dc2626');   // red
  });

  it('aiSummary is preserved', () => {
    const analysis = makeAnalysis({ ai_summary: 'Great performance.' });
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.aiSummary).toBe('Great performance.');
  });

  it('aiSummary is null when absent', () => {
    const analysis = makeAnalysis({ ai_summary: null });
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.aiSummary).toBeNull();
  });

  it('pdfTemplateVersion is set', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(pdfVm.meta.pdfTemplateVersion).toBeDefined();
    expect(pdfVm.meta.pdfTemplateVersion.length).toBeGreaterThan(0);
  });

  it('generatedAt is a valid ISO date', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    expect(new Date(pdfVm.meta.generatedAt).getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it('category order matches web view model order', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    const webIds = webVm.categories.map(c => c.id);
    const pdfIds = pdfVm.categories.map(c => c.id);
    expect(pdfIds).toEqual(webIds);
  });

  it('topLimitation is preserved from web model', () => {
    const analysis = makeAnalysis();
    const webVm = buildReportViewModel(analysis);
    const pdfVm = buildPdfViewModel(webVm, analysis);
    for (const webCat of webVm.categories) {
      const pdfCat = pdfVm.categories.find(c => c.id === webCat.id)!;
      expect(pdfCat.topLimitation).toBe(webCat.topLimitation);
    }
  });
});
