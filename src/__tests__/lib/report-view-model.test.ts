/**
 * §41 — View model unit tests.
 *
 * Covers buildReportViewModel and helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  buildReportViewModel,
  buildNavSections,
  scoreGrade,
  scoreLabel,
  scoreColorClass,
  scoreBarColor,
} from '@/lib/report/view-model';
import type { Analysis } from '@/types/analysis';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: 'test-id',
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
    ai_summary: 'The site performs reasonably well overall.',
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

// ─── Score helpers ────────────────────────────────────────────────────────────

describe('scoreGrade', () => {
  it('returns A for score >= 90', () => expect(scoreGrade(95)).toBe('A'));
  it('returns B for score 75-89', () => expect(scoreGrade(80)).toBe('B'));
  it('returns C for score 60-74', () => expect(scoreGrade(65)).toBe('C'));
  it('returns D for score 45-59', () => expect(scoreGrade(50)).toBe('D'));
  it('returns F for score < 45', () => expect(scoreGrade(30)).toBe('F'));
  it('boundary: 90 is A', () => expect(scoreGrade(90)).toBe('A'));
  it('boundary: 75 is B', () => expect(scoreGrade(75)).toBe('B'));
});

describe('scoreLabel', () => {
  it('returns Excellent for >= 90', () => expect(scoreLabel(90)).toBe('Excellent'));
  it('returns Good for >= 75', () => expect(scoreLabel(75)).toBe('Good'));
  it('returns Fair for >= 60', () => expect(scoreLabel(60)).toBe('Fair'));
  it('returns Poor for >= 45', () => expect(scoreLabel(45)).toBe('Poor'));
  it('returns Critical for < 45', () => expect(scoreLabel(44)).toBe('Critical'));
});

describe('scoreColorClass', () => {
  it('returns emerald for >= 90', () => expect(scoreColorClass(90)).toBe('text-emerald-400'));
  it('returns amber for >= 50', () => expect(scoreColorClass(70)).toBe('text-amber-400'));
  it('returns red for < 50', () => expect(scoreColorClass(40)).toBe('text-red-400'));
});

describe('scoreBarColor', () => {
  it('returns emerald for >= 90', () => expect(scoreBarColor(90)).toBe('bg-emerald-500'));
  it('returns amber for 50-89', () => expect(scoreBarColor(60)).toBe('bg-amber-500'));
  it('returns red for < 50', () => expect(scoreBarColor(30)).toBe('bg-red-500'));
});

// ─── buildReportViewModel ─────────────────────────────────────────────────────

describe('buildReportViewModel', () => {
  it('returns stable ID from analysis', () => {
    const vm = buildReportViewModel(makeAnalysis());
    expect(vm.id).toBe('test-id');
  });

  it('extracts domain from URL', () => {
    const vm = buildReportViewModel(makeAnalysis({ url: 'https://example.com/path' }));
    expect(vm.domain).toBe('example.com');
    expect(vm.origin).toBe('https://example.com');
  });

  it('handles malformed URL gracefully', () => {
    const vm = buildReportViewModel(makeAnalysis({ url: 'not-a-url' }));
    expect(vm.domain).toBe('not-a-url');
    expect(vm.origin).toBe('');
  });

  it('sets analyzedAt from completed_at', () => {
    const vm = buildReportViewModel(makeAnalysis({ completed_at: '2026-06-27T10:00:00Z' }));
    expect(vm.analyzedAt).toBe('2026-06-27T10:00:00Z');
  });

  it('produces 6 categories when lighthouse_scores is present', () => {
    const vm = buildReportViewModel(makeAnalysis());
    expect(vm.categories).toHaveLength(6);
  });

  it('produces 0 categories when lighthouse_scores is null', () => {
    const vm = buildReportViewModel(makeAnalysis({ lighthouse_scores: null }));
    expect(vm.categories).toHaveLength(0);
  });

  it('category IDs are the expected set', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const ids = vm.categories.map(c => c.id);
    expect(ids).toEqual([
      'performance',
      'accessibility',
      'seo',
      'best-practices',
      'security',
      'llm-readiness',
    ]);
  });
});

// ─── Overview ─────────────────────────────────────────────────────────────────

describe('overview', () => {
  it('computes overall score from core four categories', () => {
    const vm = buildReportViewModel(makeAnalysis({
      lighthouse_scores: {
        performance: 80,
        accessibility: 80,
        bestPractices: 80,
        seo: 80,
        ttfb: 300,
      },
    }));
    expect(vm.overview.overallScore).toBe(80);
  });

  it('overall score is null when no lighthouse_scores', () => {
    const vm = buildReportViewModel(makeAnalysis({ lighthouse_scores: null }));
    expect(vm.overview.overallScore).toBeNull();
  });

  it('includes AI summary in overview', () => {
    const vm = buildReportViewModel(makeAnalysis({ ai_summary: 'Great site.' }));
    expect(vm.overview.aiSummary).toBe('Great site.');
  });

  it('overview aiSummary is null when analysis has no summary', () => {
    const vm = buildReportViewModel(makeAnalysis({ ai_summary: null }));
    expect(vm.overview.aiSummary).toBeNull();
  });

  it('pagesAnalyzed is 1 when no crawl_pages', () => {
    const vm = buildReportViewModel(makeAnalysis({ crawl_pages: null }));
    expect(vm.overview.pagesAnalyzed).toBe(1);
  });

  it('pagesAnalyzed equals crawl_pages length', () => {
    const vm = buildReportViewModel(makeAnalysis({
      crawl_pages: [
        { url: 'https://example.com', statusCode: 200, ttfb: 200, bytes: 0, title: 'Home', performance: 80, seo: 70, accessibility: 75, llmReadiness: 60 },
        { url: 'https://example.com/about', statusCode: 200, ttfb: 300, bytes: 0, title: 'About', performance: 75, seo: 65, accessibility: 70, llmReadiness: 55 },
      ],
    }));
    expect(vm.overview.pagesAnalyzed).toBe(2);
  });

  it('grade is correct letter', () => {
    const vm = buildReportViewModel(makeAnalysis({
      lighthouse_scores: { performance: 95, accessibility: 95, bestPractices: 95, seo: 95, ttfb: 200 },
    }));
    expect(vm.overview.grade).toBe('A');
  });
});

// ─── Category scores ──────────────────────────────────────────────────────────

describe('category scores', () => {
  it('performance score is available with stored value', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const perf = vm.categories.find(c => c.id === 'performance')!;
    expect(perf.score.available).toBe(true);
    expect((perf.score as any).value).toBe(85);
  });

  it('security category score is unavailable without v2 audit', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const sec = vm.categories.find(c => c.id === 'security')!;
    expect(sec.score.available).toBe(false);
  });

  it('llm-readiness score is unavailable when not in scores', () => {
    const vm = buildReportViewModel(makeAnalysis({
      lighthouse_scores: { performance: 80, accessibility: 75, bestPractices: 85, seo: 70, ttfb: 300 },
    }));
    const llm = vm.categories.find(c => c.id === 'llm-readiness')!;
    expect(llm.score.available).toBe(false);
  });

  it('llm-readiness score is available when legacy llmReadiness present', () => {
    const vm = buildReportViewModel(makeAnalysis({
      lighthouse_scores: {
        performance: 80, accessibility: 75, bestPractices: 85, seo: 70, ttfb: 300,
        llmReadiness: 72,
      },
    }));
    const llm = vm.categories.find(c => c.id === 'llm-readiness')!;
    expect(llm.score.available).toBe(true);
    expect((llm.score as any).value).toBe(72);
  });

  it('scores are clamped to 0-100', () => {
    const vm = buildReportViewModel(makeAnalysis({
      lighthouse_scores: { performance: 150, accessibility: -5, bestPractices: 85, seo: 70, ttfb: 300 },
    }));
    const perf = vm.categories.find(c => c.id === 'performance')!;
    const acc = vm.categories.find(c => c.id === 'accessibility')!;
    expect((perf.score as any).value).toBe(100);
    expect((acc.score as any).value).toBe(0);
  });

  it('isLegacy is true for all categories without v2 audits', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const coreIds = ['performance', 'accessibility', 'seo', 'best-practices'];
    const coreCats = vm.categories.filter(c => coreIds.includes(c.id));
    expect(coreCats.every(c => c.isLegacy)).toBe(true);
  });
});

// ─── Performance category with fetch-only limitation ─────────────────────────

describe('performance category limitations', () => {
  it('sets topLimitation for fetch-only mode', () => {
    const vm = buildReportViewModel(makeAnalysis({
      lighthouse_scores: {
        performance: 80,
        accessibility: 75,
        bestPractices: 85,
        seo: 70,
        ttfb: 300,
        measurementMode: 'fetch-only',
        performanceAudit: {
          score: 80,
          scoreVersion: 'perf-v2',
          measurementMode: 'fetch-only',
          measuredAt: '2026-06-27T10:00:00Z',
          testedUrl: 'https://example.com',
          finalUrl: 'https://example.com',
          metrics: {
            lcp: { name: 'LCP', value: null, unit: 'ms', status: 'unavailable', threshold: null, source: 'not-measured', confidence: 'none', isMeasured: false, description: '' },
            cls: { name: 'CLS', value: null, unit: 'score', status: 'unavailable', threshold: null, source: 'not-measured', confidence: 'none', isMeasured: false, description: '' },
            ttfb: { name: 'TTFB', value: 300, unit: 'ms', status: 'good', threshold: null, source: 'fetch-timing', confidence: 'high', isMeasured: true, description: '' },
            tbt: { name: 'TBT', value: null, unit: 'ms', status: 'unavailable', threshold: null, source: 'not-measured', confidence: 'none', isMeasured: false, description: '' },
            fcp: { name: 'FCP', value: null, unit: 'ms', status: 'unavailable', threshold: null, source: 'not-measured', confidence: 'none', isMeasured: false, description: '' },
            inp: { name: 'INP', value: null, unit: 'ms', status: 'unavailable', threshold: null, source: 'not-measured', confidence: 'none', isMeasured: false, description: '' },
          },
          scoreBreakdown: [],
          resources: { requestCount: null, transferredBytes: null, jsBytes: null, cssBytes: null, imageBytes: null, fontBytes: null, thirdPartyBytes: null },
          warnings: [],
        },
      },
    }));
    const perf = vm.categories.find(c => c.id === 'performance')!;
    expect(perf.topLimitation).toContain('Fetch-only');
  });
});

// ─── buildNavSections ─────────────────────────────────────────────────────────

describe('buildNavSections', () => {
  it('always includes overview', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const sections = buildNavSections(vm, false, false, false);
    expect(sections.some(s => s.id === 'overview')).toBe(true);
  });

  it('excludes console-errors section when no errors', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const sections = buildNavSections(vm, false, false, false);
    expect(sections.some(s => s.id === 'console-errors')).toBe(false);
  });

  it('includes console-errors when hasConsoleErrors is true', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const sections = buildNavSections(vm, true, false, false);
    expect(sections.some(s => s.id === 'console-errors')).toBe(true);
  });

  it('includes crawled-pages when hasCrawlPages is true', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const sections = buildNavSections(vm, false, false, true);
    expect(sections.some(s => s.id === 'crawled-pages')).toBe(true);
  });

  it('excludes design section when no design comparison', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const sections = buildNavSections(vm, false, false, false);
    expect(sections.some(s => s.id === 'design')).toBe(false);
  });

  it('sections are in the expected display order', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const sections = buildNavSections(vm, false, false, false);
    const ids = sections.map(s => s.id);
    // Overview must come first
    expect(ids[0]).toBe('overview');
    // Core audit sections come before optional ones
    const perfIdx = ids.indexOf('performance');
    const accIdx = ids.indexOf('accessibility');
    expect(perfIdx).toBeGreaterThan(0);
    expect(accIdx).toBeGreaterThan(0);
    expect(perfIdx).toBeLessThan(accIdx);
  });

  it('performance section includes score', () => {
    const vm = buildReportViewModel(makeAnalysis());
    const sections = buildNavSections(vm, false, false, false);
    const perfSection = sections.find(s => s.id === 'performance')!;
    expect(perfSection.score).not.toBeNull();
    expect(perfSection.score!.available).toBe(true);
  });
});
