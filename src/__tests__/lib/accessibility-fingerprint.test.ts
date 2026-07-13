import { describe, it, expect } from 'vitest';
import {
  calculateFindingFingerprint,
  normalizeSelector,
  normalizePageUrl,
  sanitizeHtmlExcerpt,
} from '@/lib/accessibility/fingerprint';

const BASE: Parameters<typeof calculateFindingFingerprint>[0] = {
  profileId:          'profile-1',
  ruleId:             'color-contrast',
  normalizedPageUrl:  'https://example.com/about',
  normalizedSelector: '.hero-btn',
};

describe('normalizeSelector', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeSelector('')).toBe('');
  });

  it('collapses whitespace', () => {
    expect(normalizeSelector('  .foo   .bar  ')).toBe('.foo .bar');
  });

  it('truncates to 200 chars', () => {
    const long = '.a'.repeat(150); // 300 chars
    expect(normalizeSelector(long).length).toBeLessThanOrEqual(200);
  });

  it('returns stable output for same input', () => {
    const sel = 'form > input[type="text"]';
    expect(normalizeSelector(sel)).toBe(normalizeSelector(sel));
  });
});

describe('normalizePageUrl', () => {
  it('strips query string', () => {
    expect(normalizePageUrl('https://example.com/page?foo=bar')).toBe(
      'https://example.com/page',
    );
  });

  it('strips fragment', () => {
    expect(normalizePageUrl('https://example.com/page#section')).toBe(
      'https://example.com/page',
    );
  });

  it('removes trailing slash on non-root paths', () => {
    expect(normalizePageUrl('https://example.com/page/')).toBe(
      'https://example.com/page',
    );
  });

  it('preserves root domain', () => {
    const result = normalizePageUrl('https://example.com/');
    expect(result).toContain('example.com');
  });

  it('returns stable output for same url', () => {
    const url = 'https://example.com/about?ref=home#top';
    expect(normalizePageUrl(url)).toBe(normalizePageUrl(url));
  });
});

describe('sanitizeHtmlExcerpt', () => {
  it('strips HTML tags', () => {
    expect(sanitizeHtmlExcerpt('<button class="btn">Click me</button>')).not.toContain('<');
  });

  it('keeps text content', () => {
    const result = sanitizeHtmlExcerpt('<p>Hello world</p>');
    expect(result).toContain('Hello world');
  });

  it('truncates to 500 chars', () => {
    const html = '<span>' + 'x'.repeat(1000) + '</span>';
    expect(sanitizeHtmlExcerpt(html).length).toBeLessThanOrEqual(500);
  });

  it('handles empty input', () => {
    expect(sanitizeHtmlExcerpt('')).toBe('');
  });

  it('handles null-like input gracefully', () => {
    expect(() => sanitizeHtmlExcerpt(undefined as unknown as string)).not.toThrow();
  });
});

describe('calculateFindingFingerprint', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const fp = calculateFindingFingerprint(BASE);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same inputs produce same fingerprint', () => {
    expect(calculateFindingFingerprint(BASE)).toBe(calculateFindingFingerprint(BASE));
  });

  it('different ruleId produces different fingerprint', () => {
    const fp1 = calculateFindingFingerprint(BASE);
    const fp2 = calculateFindingFingerprint({ ...BASE, ruleId: 'image-alt' });
    expect(fp1).not.toBe(fp2);
  });

  it('different profileId produces different fingerprint', () => {
    const fp1 = calculateFindingFingerprint(BASE);
    const fp2 = calculateFindingFingerprint({ ...BASE, profileId: 'profile-2' });
    expect(fp1).not.toBe(fp2);
  });

  it('different normalizedPageUrl produces different fingerprint', () => {
    const fp1 = calculateFindingFingerprint(BASE);
    const fp2 = calculateFindingFingerprint({ ...BASE, normalizedPageUrl: 'https://example.com/other' });
    expect(fp1).not.toBe(fp2);
  });

  it('different normalizedSelector produces different fingerprint', () => {
    const fp1 = calculateFindingFingerprint(BASE);
    const fp2 = calculateFindingFingerprint({ ...BASE, normalizedSelector: '.other-btn' });
    expect(fp1).not.toBe(fp2);
  });
});
