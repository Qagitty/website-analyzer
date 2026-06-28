/**
 * §27 — Legacy adapter tests.
 * §28 — Do not fabricate legacy fields.
 * §36 — Database round-trip test coverage for legacy shapes.
 */

import { describe, it, expect } from 'vitest';
import {
  LegacyFlatScoreAdapter,
  LegacyCrawledPagesAdapter,
  applyLegacyAdapters,
  isLegacyAnalysis,
} from '@/lib/adapters/legacy';
import type { Analysis } from '@/types/analysis';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeV1Analysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: 'test-id-001',
    user_id: 'user-001',
    url: 'https://example.com',
    status: 'completed',
    screenshot_url: null,
    design_screenshot_url: null,
    design_comparison: null,
    lighthouse_scores: {
      performance: 85,
      accessibility: 72,
      bestPractices: 88,
      seo: 90,
      ttfb: 320,
      // v1 legacy: NO audit objects
    },
    console_errors: null,
    accessibility_issues: null,
    network_requests: null,
    ai_insights: null,
    ai_summary: null,
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

function makeV2Analysis(overrides: Partial<Analysis> = {}): Analysis {
  return makeV1Analysis({
    lighthouse_scores: {
      performance: 85,
      accessibility: 72,
      bestPractices: 88,
      seo: 90,
      ttfb: 320,
      // v2: has at least one audit object
      seoAudit: {
        score: 90,
        scoreVersion: 'seo-v1',
        checks: [],
        coverage: { percentage: 100, supportedChecks: 5, applicableChecks: 5, executedChecks: 5, passed: 5, failed: 0, warnings: 0, manualReview: 0, unavailable: 0, notExecuted: 0 },
        confidence: { level: 'high', label: 'High confidence', score: 95, factors: [] },
      } as any,
    },
    ...overrides,
  });
}

// ─── LegacyFlatScoreAdapter ────────────────────────────────────────────────────

describe('LegacyFlatScoreAdapter', () => {
  describe('canHandle', () => {
    it('returns true for v1 analysis (flat scores, no audit objects)', () => {
      expect(LegacyFlatScoreAdapter.canHandle(makeV1Analysis())).toBe(true);
    });

    it('returns false for v2 analysis (has audit objects)', () => {
      expect(LegacyFlatScoreAdapter.canHandle(makeV2Analysis())).toBe(false);
    });

    it('returns false for null input', () => {
      expect(LegacyFlatScoreAdapter.canHandle(null)).toBe(false);
    });

    it('returns false when lighthouse_scores is null', () => {
      expect(LegacyFlatScoreAdapter.canHandle(makeV1Analysis({ lighthouse_scores: null }))).toBe(false);
    });

    it('returns true when all scores are null (partial legacy report)', () => {
      const a = makeV1Analysis({
        lighthouse_scores: {
          performance: null as any,
          accessibility: null as any,
          bestPractices: null as any,
          seo: null as any,
          ttfb: 0,
        },
      });
      expect(LegacyFlatScoreAdapter.canHandle(a)).toBe(true);
    });
  });

  describe('adapt', () => {
    it('preserves original numeric scores', () => {
      const original = makeV1Analysis();
      const adapted = LegacyFlatScoreAdapter.adapt(original);
      expect(adapted.lighthouse_scores?.performance).toBe(85);
      expect(adapted.lighthouse_scores?.accessibility).toBe(72);
      expect(adapted.lighthouse_scores?.seo).toBe(90);
      expect(adapted.lighthouse_scores?.bestPractices).toBe(88);
    });

    it('sets scoreVersion to v1-legacy when absent', () => {
      const adapted = LegacyFlatScoreAdapter.adapt(makeV1Analysis());
      expect(adapted.lighthouse_scores?.scoreVersion).toBe('v1-legacy');
    });

    it('preserves existing scoreVersion if present', () => {
      const a = makeV1Analysis({
        lighthouse_scores: { ...makeV1Analysis().lighthouse_scores!, scoreVersion: 'custom-v0' },
      });
      const adapted = LegacyFlatScoreAdapter.adapt(a);
      expect(adapted.lighthouse_scores?.scoreVersion).toBe('custom-v0');
    });

    it('sets measurementMode to fetch-only when absent', () => {
      const adapted = LegacyFlatScoreAdapter.adapt(makeV1Analysis());
      expect(adapted.lighthouse_scores?.measurementMode).toBe('fetch-only');
    });

    it('§28 — does NOT fabricate audit objects (performanceAudit, seoAudit, etc.)', () => {
      const adapted = LegacyFlatScoreAdapter.adapt(makeV1Analysis());
      expect(adapted.lighthouse_scores?.performanceAudit).toBeUndefined();
      expect(adapted.lighthouse_scores?.seoAudit).toBeUndefined();
      expect(adapted.lighthouse_scores?.accessibilityAudit).toBeUndefined();
      expect(adapted.lighthouse_scores?.bestPracticesAudit).toBeUndefined();
      expect(adapted.lighthouse_scores?.llmReadinessAudit).toBeUndefined();
      expect(adapted.lighthouse_scores?.securityHeadersAudit).toBeUndefined();
    });

    it('returns input unchanged when lighthouse_scores is null', () => {
      const a = makeV1Analysis({ lighthouse_scores: null });
      const adapted = LegacyFlatScoreAdapter.adapt(a);
      expect(adapted).toBe(a);
    });

    it('preserves other analysis fields (user_id, url, status)', () => {
      const a = makeV1Analysis();
      const adapted = LegacyFlatScoreAdapter.adapt(a);
      expect(adapted.user_id).toBe(a.user_id);
      expect(adapted.url).toBe(a.url);
      expect(adapted.status).toBe(a.status);
      expect(adapted.id).toBe(a.id);
    });
  });
});

// ─── LegacyCrawledPagesAdapter ─────────────────────────────────────────────────

describe('LegacyCrawledPagesAdapter', () => {
  describe('canHandle', () => {
    it('returns true when pages exist but some lack pageId', () => {
      const a = makeV1Analysis({
        crawl_pages: [
          { url: 'https://example.com', statusCode: 200, ttfb: 100, bytes: 0, title: 'Home', performance: 80, seo: 70, accessibility: 75, llmReadiness: 60 },
        ],
      });
      expect(LegacyCrawledPagesAdapter.canHandle(a)).toBe(true);
    });

    it('returns false when all pages already have pageId', () => {
      const a = makeV1Analysis({
        crawl_pages: [
          { url: 'https://example.com', pageId: 'page-001', statusCode: 200, ttfb: 100, bytes: 0, title: 'Home', performance: 80, seo: 70, accessibility: 75, llmReadiness: 60 },
        ],
      });
      expect(LegacyCrawledPagesAdapter.canHandle(a)).toBe(false);
    });

    it('returns false when crawl_pages is null', () => {
      expect(LegacyCrawledPagesAdapter.canHandle(makeV1Analysis({ crawl_pages: null }))).toBe(false);
    });

    it('returns false when crawl_pages is empty', () => {
      expect(LegacyCrawledPagesAdapter.canHandle(makeV1Analysis({ crawl_pages: [] }))).toBe(false);
    });
  });

  describe('adapt', () => {
    it('assigns a deterministic pageId to pages lacking one', () => {
      const a = makeV1Analysis({
        crawl_pages: [
          { url: 'https://example.com', statusCode: 200, ttfb: 100, bytes: 0, title: 'Home', performance: 80, seo: 70, accessibility: 75, llmReadiness: 60 },
        ],
      });
      const adapted = LegacyCrawledPagesAdapter.adapt(a);
      expect(adapted.crawl_pages![0].pageId).toBeTruthy();
      expect(typeof adapted.crawl_pages![0].pageId).toBe('string');
    });

    it('does not override existing pageIds', () => {
      const a = makeV1Analysis({
        crawl_pages: [
          { url: 'https://example.com', pageId: 'existing-id', statusCode: 200, ttfb: 100, bytes: 0, title: 'Home', performance: 80, seo: 70, accessibility: 75, llmReadiness: 60 },
        ],
      });
      const adapted = LegacyCrawledPagesAdapter.adapt(a);
      expect(adapted.crawl_pages![0].pageId).toBe('existing-id');
    });

    it('generates distinct pageIds for different URLs', () => {
      const a = makeV1Analysis({
        crawl_pages: [
          { url: 'https://example.com', statusCode: 200, ttfb: 100, bytes: 0, title: 'Home', performance: 80, seo: 70, accessibility: 75, llmReadiness: 60 },
          { url: 'https://example.com/about', statusCode: 200, ttfb: 100, bytes: 0, title: 'About', performance: 75, seo: 65, accessibility: 70, llmReadiness: 55 },
        ],
      });
      const adapted = LegacyCrawledPagesAdapter.adapt(a);
      const ids = adapted.crawl_pages!.map((p) => p.pageId);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('preserves all other page fields', () => {
      const a = makeV1Analysis({
        crawl_pages: [
          { url: 'https://example.com', statusCode: 200, ttfb: 100, bytes: 0, title: 'Home', performance: 80, seo: 70, accessibility: 75, llmReadiness: 60 },
        ],
      });
      const adapted = LegacyCrawledPagesAdapter.adapt(a);
      const page = adapted.crawl_pages![0];
      expect(page.url).toBe('https://example.com');
      expect(page.statusCode).toBe(200);
      expect(page.performance).toBe(80);
    });
  });
});

// ─── applyLegacyAdapters ──────────────────────────────────────────────────────

describe('applyLegacyAdapters', () => {
  it('applies flat-score adapter to a v1 report', () => {
    const a = makeV1Analysis();
    const result = applyLegacyAdapters(a);
    expect(result.lighthouse_scores?.scoreVersion).toBe('v1-legacy');
  });

  it('applies both adapters when both are needed', () => {
    const a = makeV1Analysis({
      crawl_pages: [
        { url: 'https://example.com', statusCode: 200, ttfb: 100, bytes: 0, title: 'Home', performance: 80, seo: 70, accessibility: 75, llmReadiness: 60 },
      ],
    });
    const result = applyLegacyAdapters(a);
    expect(result.lighthouse_scores?.scoreVersion).toBe('v1-legacy');
    expect(result.crawl_pages![0].pageId).toBeTruthy();
  });

  it('does not modify v2 reports', () => {
    const a = makeV2Analysis();
    const result = applyLegacyAdapters(a);
    // v2 report should not have scoreVersion overridden
    expect(result.lighthouse_scores?.scoreVersion).toBeUndefined();
  });
});

// ─── isLegacyAnalysis ─────────────────────────────────────────────────────────

describe('isLegacyAnalysis', () => {
  it('returns true for v1 analysis', () => {
    expect(isLegacyAnalysis(makeV1Analysis())).toBe(true);
  });

  it('returns false for v2 analysis', () => {
    expect(isLegacyAnalysis(makeV2Analysis())).toBe(false);
  });

  it('returns false for analysis with null scores', () => {
    expect(isLegacyAnalysis(makeV1Analysis({ lighthouse_scores: null }))).toBe(false);
  });
});
