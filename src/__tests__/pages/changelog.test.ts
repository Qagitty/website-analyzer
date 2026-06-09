/**
 * Tests for the changelog data (RELEASES array) and its invariants.
 * We test the data model separately from the UI so the tests run fast
 * without needing to render the full page.
 */
import { describe, it, expect } from 'vitest';
import { RELEASES } from '@/data/changelog';

describe('RELEASES data', () => {
  it('has at least 5 entries', () => {
    expect(RELEASES.length).toBeGreaterThanOrEqual(5);
  });

  it('every release has required fields', () => {
    for (const r of RELEASES) {
      expect(typeof r.version).toBe('string');
      expect(r.version.length).toBeGreaterThan(0);
      expect(typeof r.date).toBe('string');
      expect(typeof r.tag).toBe('string');
      expect(typeof r.title).toBe('string');
      expect(typeof r.summary).toBe('string');
      expect(Array.isArray(r.items)).toBe(true);
      expect(r.items.length).toBeGreaterThan(0);
    }
  });

  it('dates are in ISO YYYY-MM-DD format', () => {
    for (const r of RELEASES) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('tags are one of the allowed values', () => {
    const allowed = new Set(['Feature', 'Improvement', 'Fix', 'Security']);
    for (const r of RELEASES) {
      expect(allowed.has(r.tag)).toBe(true);
    }
  });

  it('releases are sorted newest-first by date', () => {
    for (let i = 0; i < RELEASES.length - 1; i++) {
      const a = new Date(RELEASES[i].date).getTime();
      const b = new Date(RELEASES[i + 1].date).getTime();
      expect(a).toBeGreaterThanOrEqual(b);
    }
  });

  it('no two releases share the same version number', () => {
    const versions = RELEASES.map((r) => r.version);
    const unique = new Set(versions);
    expect(unique.size).toBe(versions.length);
  });

  it('each release has at least 2 items', () => {
    for (const r of RELEASES) {
      expect(r.items.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('the most recent release title is not empty', () => {
    expect(RELEASES[0].title.trim().length).toBeGreaterThan(0);
  });

  it('all item strings are non-empty', () => {
    for (const r of RELEASES) {
      for (const item of r.items) {
        expect(item.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
