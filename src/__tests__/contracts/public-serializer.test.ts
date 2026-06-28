/**
 * §23 — Public serializer tests.
 * Verify that public surfaces strip internal fields and only expose
 * screenshot URL when is_public=true.
 */

import { describe, it, expect } from 'vitest';
import {
  serializePublicReport,
  serializePublicReportSummary,
} from '@/lib/serializers/public-report';
import { SCHEMA_VERSIONS } from '@/lib/contracts/schemas';
import type { Analysis } from '@/types/analysis';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: 'report-abc-123',
    user_id: 'private-user-uuid-do-not-expose',
    url: 'https://example.com',
    status: 'completed',
    screenshot_url: 'https://storage.example.com/screenshots/report-abc-123.png',
    design_screenshot_url: null,
    design_comparison: null,
    lighthouse_scores: {
      performance: 85,
      accessibility: 72,
      seo: 90,
      bestPractices: 88,
      ttfb: 320,
      llmReadiness: 65,
      measurementMode: 'browser',
    },
    console_errors: null,
    accessibility_issues: null,
    network_requests: null,
    ai_insights: {
      summary: 'The site is well-structured but has performance opportunities.',
      overallScore: 84,
      insights: [
        {
          category: 'performance',
          priority: 'medium',
          title: 'Reduce unused JavaScript',
          description: 'Several large bundles are loaded eagerly.',
          recommendation: 'Use code splitting.',
          estimatedImpact: 'Could reduce LCP by ~200ms.',
        },
      ],
      quickWins: ['Enable gzip compression', 'Add image alt attributes'],
    },
    ai_summary: 'The site performs well but has some accessibility gaps.',
    is_public: false,
    error_message: null,
    queue_position: null,
    started_at: null,
    completed_at: '2026-06-27T10:00:00Z',
    created_at: '2026-06-27T09:00:00Z',
    updated_at: '2026-06-27T10:00:00Z',
    crawl_pages: null,
    ...overrides,
  };
}

// ─── serializePublicReport ────────────────────────────────────────────────────

describe('serializePublicReport', () => {
  it('includes required public fields', () => {
    const a = makeAnalysis();
    const result = serializePublicReport(a);
    expect(result.id).toBe('report-abc-123');
    expect(result.url).toBe('https://example.com');
    expect(result.status).toBe('completed');
    expect(result.completedAt).toBe('2026-06-27T10:00:00Z');
    expect(result.createdAt).toBe('2026-06-27T09:00:00Z');
    expect(result.aiSummary).toBe('The site performs well but has some accessibility gaps.');
  });

  it('includes schemaVersion', () => {
    const result = serializePublicReport(makeAnalysis());
    expect(result.schemaVersion).toBe(SCHEMA_VERSIONS.REPORT_API);
  });

  it('§23 — does NOT expose user_id', () => {
    const result = serializePublicReport(makeAnalysis());
    expect((result as unknown as Record<string, unknown>).user_id).toBeUndefined();
  });

  it('exposes correct scores', () => {
    const result = serializePublicReport(makeAnalysis());
    expect(result.scores.performance).toBe(85);
    expect(result.scores.accessibility).toBe(72);
    expect(result.scores.seo).toBe(90);
    expect(result.scores.bestPractices).toBe(88);
    expect(result.scores.llmReadiness).toBe(65);
  });

  it('returns null scores when lighthouse_scores is null', () => {
    const result = serializePublicReport(makeAnalysis({ lighthouse_scores: null }));
    expect(result.scores.performance).toBeNull();
    expect(result.scores.accessibility).toBeNull();
    expect(result.scores.seo).toBeNull();
    expect(result.scores.bestPractices).toBeNull();
    expect(result.scores.llmReadiness).toBeNull();
  });

  it('exposes measurementMode from lighthouse_scores', () => {
    const result = serializePublicReport(makeAnalysis());
    expect(result.measurementMode).toBe('browser');
  });

  it('returns null measurementMode when lighthouse_scores is null', () => {
    const result = serializePublicReport(makeAnalysis({ lighthouse_scores: null }));
    expect(result.measurementMode).toBeNull();
  });

  it('§23 — screenshotUrl is null when is_public=false', () => {
    const a = makeAnalysis({ is_public: false });
    const result = serializePublicReport(a);
    expect(result.screenshotUrl).toBeNull();
  });

  it('§23 — screenshotUrl is included when is_public=true', () => {
    const a = makeAnalysis({ is_public: true });
    const result = serializePublicReport(a);
    expect(result.screenshotUrl).toBe('https://storage.example.com/screenshots/report-abc-123.png');
  });

  it('screenshotUrl is null when is_public=true but screenshot_url is null', () => {
    const a = makeAnalysis({ is_public: true, screenshot_url: null });
    const result = serializePublicReport(a);
    expect(result.screenshotUrl).toBeNull();
  });

  it('includes sanitized AI insights', () => {
    const result = serializePublicReport(makeAnalysis());
    expect(result.aiInsights).not.toBeNull();
    expect(result.aiInsights!.summary).toBe('The site is well-structured but has performance opportunities.');
    expect(result.aiInsights!.overallScore).toBe(84);
    expect(result.aiInsights!.quickWins).toEqual(['Enable gzip compression', 'Add image alt attributes']);
    expect(result.aiInsights!.insights).toHaveLength(1);
  });

  it('returns null aiInsights when ai_insights is null', () => {
    const result = serializePublicReport(makeAnalysis({ ai_insights: null }));
    expect(result.aiInsights).toBeNull();
  });

  it('counts pages from crawl_pages when present', () => {
    const a = makeAnalysis({
      crawl_pages: [
        { url: 'https://example.com', statusCode: 200, ttfb: 100, bytes: 0, title: 'Home', performance: 80, seo: 70, accessibility: 75, llmReadiness: 60 },
        { url: 'https://example.com/about', statusCode: 200, ttfb: 120, bytes: 0, title: 'About', performance: 75, seo: 65, accessibility: 70, llmReadiness: 55 },
      ],
    });
    const result = serializePublicReport(a);
    expect(result.pagesAnalyzed).toBe(2);
  });

  it('returns pagesAnalyzed=1 when crawl_pages is null', () => {
    const result = serializePublicReport(makeAnalysis({ crawl_pages: null }));
    expect(result.pagesAnalyzed).toBe(1);
  });

  it('returns pagesAnalyzed=1 when crawl_pages is empty', () => {
    const result = serializePublicReport(makeAnalysis({ crawl_pages: [] }));
    expect(result.pagesAnalyzed).toBe(1);
  });

  it('§23 — does NOT expose internal error details in main fields', () => {
    const a = makeAnalysis({ error_message: 'Internal: DB connection failed at row 42' });
    const result = serializePublicReport(a);
    expect((result as unknown as Record<string, unknown>).error_message).toBeUndefined();
    expect((result as unknown as Record<string, unknown>).errorMessage).toBeUndefined();
  });
});

// ─── serializePublicReportSummary ─────────────────────────────────────────────

describe('serializePublicReportSummary', () => {
  it('includes required summary fields', () => {
    const a = makeAnalysis();
    const result = serializePublicReportSummary(a);
    expect(result.id).toBe('report-abc-123');
    expect(result.url).toBe('https://example.com');
    expect(result.status).toBe('completed');
    expect(result.scores.performance).toBe(85);
    expect(result.aiSummary).toBe('The site performs well but has some accessibility gaps.');
    expect(result.pagesAnalyzed).toBe(1);
  });

  it('includes schemaVersion', () => {
    const result = serializePublicReportSummary(makeAnalysis());
    expect(result.schemaVersion).toBe(SCHEMA_VERSIONS.REPORT_API);
  });

  it('§23 — does NOT expose user_id', () => {
    const result = serializePublicReportSummary(makeAnalysis());
    expect((result as unknown as Record<string, unknown>).user_id).toBeUndefined();
  });

  it('§23 — does NOT include aiInsights (summary endpoint only)', () => {
    const result = serializePublicReportSummary(makeAnalysis());
    expect((result as unknown as Record<string, unknown>).aiInsights).toBeUndefined();
  });

  it('§23 — does NOT include screenshotUrl (summary endpoint only)', () => {
    const result = serializePublicReportSummary(makeAnalysis({ is_public: true }));
    expect((result as unknown as Record<string, unknown>).screenshotUrl).toBeUndefined();
  });

  it('includes measurementMode', () => {
    const result = serializePublicReportSummary(makeAnalysis());
    expect(result.measurementMode).toBe('browser');
  });
});
