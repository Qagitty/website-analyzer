import { describe, it, expect } from 'vitest';
import { normalizeMonitorUrl, isSameOriginAs } from '@/lib/monitoring/url-normalizer';

describe('normalizeMonitorUrl — tracking param removal', () => {
  it('strips utm_source and utm_medium', () => {
    const { normalizedUrl } = normalizeMonitorUrl('https://example.com/page?utm_source=email&utm_medium=cpc');
    expect(normalizedUrl).toBe('https://example.com/page');
  });

  it('strips gclid and fbclid', () => {
    const { normalizedUrl } = normalizeMonitorUrl('https://example.com/?gclid=abc123&fbclid=xyz');
    expect(normalizedUrl).toBe('https://example.com/');
  });

  it('preserves meaningful query params', () => {
    const { normalizedUrl } = normalizeMonitorUrl('https://example.com/search?q=test&lang=en');
    expect(normalizedUrl).toContain('q=test');
    expect(normalizedUrl).toContain('lang=en');
  });

  it('removes fragment', () => {
    const { normalizedUrl } = normalizeMonitorUrl('https://example.com/page#section');
    expect(normalizedUrl).not.toContain('#');
  });

  it('removes default https port 443', () => {
    const { normalizedUrl } = normalizeMonitorUrl('https://example.com:443/page');
    expect(normalizedUrl).not.toContain(':443');
  });

  it('removes default http port 80', () => {
    const { normalizedUrl } = normalizeMonitorUrl('http://example.com:80/page');
    expect(normalizedUrl).not.toContain(':80');
  });

  it('lowercases hostname', () => {
    const { normalizedUrl } = normalizeMonitorUrl('https://EXAMPLE.COM/page');
    expect(normalizedUrl).toContain('example.com');
  });

  it('strips trailing slash from non-root paths', () => {
    const { normalizedUrl } = normalizeMonitorUrl('https://example.com/about/');
    expect(normalizedUrl).toBe('https://example.com/about');
  });

  it('keeps trailing slash on root path', () => {
    const { normalizedUrl } = normalizeMonitorUrl('https://example.com/');
    expect(normalizedUrl).toBe('https://example.com/');
  });

  it('sorts remaining query params deterministically', () => {
    const { normalizedUrl: a } = normalizeMonitorUrl('https://example.com/?z=1&a=2');
    const { normalizedUrl: b } = normalizeMonitorUrl('https://example.com/?a=2&z=1');
    expect(a).toBe(b);
  });

  it('rejects non-http protocols', () => {
    const result = normalizeMonitorUrl('ftp://example.com/file');
    expect(result.error).toBeDefined();
    expect(result.normalizedUrl).toBe('');
  });

  it('rejects URLs with embedded credentials', () => {
    const result = normalizeMonitorUrl('https://user:pass@example.com/');
    expect(result.error).toBeDefined();
  });

  it('rejects URLs over 2048 chars', () => {
    const long = `https://example.com/${'a'.repeat(2100)}`;
    const result = normalizeMonitorUrl(long);
    expect(result.error).toBeDefined();
  });

  it('resolves relative URLs against rootUrl', () => {
    const { normalizedUrl } = normalizeMonitorUrl('/about', 'https://example.com');
    expect(normalizedUrl).toBe('https://example.com/about');
  });
});

describe('isSameOriginAs', () => {
  it('returns true for same origin', () => {
    expect(isSameOriginAs('https://example.com/page', 'https://example.com')).toBe(true);
  });

  it('returns false for different domain', () => {
    expect(isSameOriginAs('https://evil.com/page', 'https://example.com')).toBe(false);
  });

  it('returns false for different protocol', () => {
    expect(isSameOriginAs('http://example.com/page', 'https://example.com')).toBe(false);
  });

  it('returns false for different port', () => {
    expect(isSameOriginAs('https://example.com:8080/page', 'https://example.com')).toBe(false);
  });
});
