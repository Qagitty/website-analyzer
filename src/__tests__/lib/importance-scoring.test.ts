import { describe, it, expect } from 'vitest';
import { scorePageImportance, rankByImportance } from '@/lib/monitoring/discovery';
import type { DiscoveredPage } from '@/lib/monitoring/discovery';

describe('scorePageImportance', () => {
  it('scores nav links highest (800 points)', () => {
    const navUrls = new Set(['https://example.com/pricing']);
    const score = scorePageImportance('https://example.com/pricing', 0, navUrls);
    expect(score).toBeGreaterThanOrEqual(800);
  });

  it('scores sitemap priority > 0.7 at 700 points', () => {
    const score = scorePageImportance('https://example.com/about', 0, new Set(), 0.8);
    expect(score).toBeGreaterThanOrEqual(700);
  });

  it('scores business-critical paths at 600 points', () => {
    const paths = ['/pricing', '/about', '/contact', '/features', '/demo', '/signup', '/login'];
    for (const path of paths) {
      const score = scorePageImportance(`https://example.com${path}`, 0, new Set());
      expect(score).toBeGreaterThanOrEqual(600);
    }
  });

  it('penalizes deeper pages (50 points per level)', () => {
    const depth0 = scorePageImportance('https://example.com/blog', 0, new Set());
    const depth2 = scorePageImportance('https://example.com/blog', 2, new Set());
    expect(depth0 - depth2).toBe(100);
  });

  it('adds link count bonus (10 per extra reference, capped at 100)', () => {
    const once = scorePageImportance('https://example.com/faq', 0, new Set(), undefined, 1);
    const tenTimes = scorePageImportance('https://example.com/faq', 0, new Set(), undefined, 11);
    expect(tenTimes - once).toBe(100); // capped at 100
  });

  it('is deterministic for same inputs', () => {
    const navUrls = new Set(['https://example.com/about']);
    const a = scorePageImportance('https://example.com/about', 1, navUrls, 0.9, 3);
    const b = scorePageImportance('https://example.com/about', 1, navUrls, 0.9, 3);
    expect(a).toBe(b);
  });
});

describe('rankByImportance', () => {
  it('sorts pages by importanceScore descending', () => {
    const pages: DiscoveredPage[] = [
      { url: 'https://example.com/blog', source: 'crawl', depth: 2, importanceScore: 100 },
      { url: 'https://example.com/pricing', source: 'crawl', depth: 0, importanceScore: 800 },
      { url: 'https://example.com/about', source: 'crawl', depth: 0, importanceScore: 600 },
    ];
    const ranked = rankByImportance(pages);
    expect(ranked[0].url).toContain('/pricing');
    expect(ranked[1].url).toContain('/about');
    expect(ranked[2].url).toContain('/blog');
  });

  it('uses URL as tiebreaker for determinism', () => {
    const pages: DiscoveredPage[] = [
      { url: 'https://example.com/z-page', source: 'crawl', depth: 0, importanceScore: 0 },
      { url: 'https://example.com/a-page', source: 'crawl', depth: 0, importanceScore: 0 },
    ];
    const ranked = rankByImportance(pages);
    expect(ranked[0].url).toContain('/a-page');
  });

  it('does not mutate the input array', () => {
    const pages: DiscoveredPage[] = [
      { url: 'https://example.com/b', source: 'crawl', depth: 0, importanceScore: 50 },
      { url: 'https://example.com/a', source: 'crawl', depth: 0, importanceScore: 100 },
    ];
    const copy = [...pages];
    rankByImportance(pages);
    expect(pages[0].url).toBe(copy[0].url);
  });
});
