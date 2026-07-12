/**
 * Tests for src/lib/error-projects/scrub.ts
 * Covers: sanitizeUrl, scrubContext, truncateStackFrames, truncateBreadcrumbs.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeUrl,
  scrubContext,
  truncateStackFrames,
  truncateBreadcrumbs,
} from '@/lib/error-projects/scrub';

// ── sanitizeUrl ───────────────────────────────────────────────────────────────

describe('sanitizeUrl', () => {
  it('returns undefined for undefined input', () => {
    expect(sanitizeUrl(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(sanitizeUrl('')).toBeUndefined();
  });

  it('returns undefined for invalid URL', () => {
    expect(sanitizeUrl('not-a-url')).toBeUndefined();
  });

  it('removes "token" query param', () => {
    const result = sanitizeUrl('https://example.com/page?token=abc123&page=2');
    expect(result).toBeDefined();
    expect(result).not.toContain('token');
    expect(result).toContain('page=2');
  });

  it('removes "password" query param', () => {
    const result = sanitizeUrl('https://example.com/?password=secret');
    expect(result).toBeDefined();
    expect(result).not.toContain('password');
  });

  it('removes "access_token" query param', () => {
    const result = sanitizeUrl('https://example.com/?access_token=eyJ');
    expect(result).toBeDefined();
    expect(result).not.toContain('access_token');
  });

  it('keeps non-sensitive query params', () => {
    const result = sanitizeUrl('https://example.com/?page=3&sort=desc');
    expect(result).toContain('page=3');
    expect(result).toContain('sort=desc');
  });

  it('preserves pathname', () => {
    const result = sanitizeUrl('https://example.com/products/123');
    expect(result).toContain('/products/123');
  });

  it('truncates to 2048 chars max', () => {
    const long = 'https://example.com/?' + 'x='.padEnd(4096, 'a');
    const result = sanitizeUrl(long);
    if (result) {
      expect(result.length).toBeLessThanOrEqual(2048);
    }
  });
});

// ── scrubContext ──────────────────────────────────────────────────────────────

describe('scrubContext', () => {
  it('returns primitive values unchanged', () => {
    expect(scrubContext(42)).toBe(42);
    expect(scrubContext(true)).toBe(true);
    expect(scrubContext(null)).toBeNull();
  });

  it('truncates long strings to 2048 chars', () => {
    const long = 'a'.repeat(3000);
    const result = scrubContext(long);
    expect(typeof result).toBe('string');
    expect((result as string).length).toBe(2048);
  });

  it('scrubs known sensitive key "token"', () => {
    const result = scrubContext({ token: 'secret123', data: 'ok' }) as Record<string, unknown>;
    expect(result.token).toBe('[scrubbed]');
    expect(result.data).toBe('ok');
  });

  it('scrubs "password" key', () => {
    const result = scrubContext({ password: 'hunter2' }) as Record<string, unknown>;
    expect(result.password).toBe('[scrubbed]');
  });

  it('scrubs "email" key', () => {
    const result = scrubContext({ email: 'user@example.com' }) as Record<string, unknown>;
    expect(result.email).toBe('[scrubbed]');
  });

  it('scrubs "api_key" key', () => {
    const result = scrubContext({ api_key: 'sk-abc' }) as Record<string, unknown>;
    expect(result.api_key).toBe('[scrubbed]');
  });

  it('does NOT include "__proto__" as own property in output (prototype pollution guard)', () => {
    const input = Object.create(null) as Record<string, unknown>;
    input['__proto__'] = { isAdmin: true };
    input['safe'] = 'value';
    const result = scrubContext(input) as Record<string, unknown>;
    // __proto__ must not be an own property on the output
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
    expect(result['safe']).toBe('value');
  });

  it('does NOT pass "constructor" key into output object (prototype pollution guard)', () => {
    const result = scrubContext({ constructor: 'sneaky', user: 'alice' }) as Record<string, unknown>;
    // constructor is stripped — own-property check must be false
    expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(false);
    expect(result['user']).toBe('alice');
  });

  it('truncates at depth > 4 (6-level deep value becomes [truncated])', () => {
    // depth=0: root, depth=1: a's value, ..., depth=5: e's value → '[truncated]'
    const nested = { a: { b: { c: { d: { e: { f: 'deep' } } } } } };
    const result = scrubContext(nested) as Record<string, unknown>;
    const a = result.a as Record<string, unknown>;
    const b = a.b as Record<string, unknown>;
    const c = b.c as Record<string, unknown>;
    const d = c.d as Record<string, unknown>;
    // At depth=5 the value of key 'e' is truncated
    expect(d.e).toBe('[truncated]');
  });

  it('limits array to 20 items', () => {
    const arr = Array.from({ length: 30 }, (_, i) => i);
    const result = scrubContext(arr) as unknown[];
    expect(result.length).toBe(20);
  });

  it('adds __truncated flag after 50 keys', () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 55; i++) big[`key${i}`] = i;
    const result = scrubContext(big) as Record<string, unknown>;
    expect(result['__truncated']).toBe(true);
  });
});

// ── truncateStackFrames ───────────────────────────────────────────────────────

describe('truncateStackFrames', () => {
  it('returns same array when under 100 items', () => {
    const frames = Array.from({ length: 10 }, (_, i) => ({ line: i }));
    expect(truncateStackFrames(frames)).toHaveLength(10);
  });

  it('truncates to 100 frames when over limit', () => {
    const frames = Array.from({ length: 150 }, (_, i) => ({ line: i }));
    const result = truncateStackFrames(frames);
    expect(result).toHaveLength(100);
    expect((result[0] as { line: number }).line).toBe(0);
  });
});

// ── truncateBreadcrumbs ───────────────────────────────────────────────────────

describe('truncateBreadcrumbs', () => {
  it('returns all items when under max', () => {
    const crumbs = [1, 2, 3];
    expect(truncateBreadcrumbs(crumbs, 10)).toHaveLength(3);
  });

  it('keeps the LAST n items (most recent)', () => {
    const crumbs = [1, 2, 3, 4, 5];
    const result = truncateBreadcrumbs(crumbs, 3);
    expect(result).toEqual([3, 4, 5]);
  });

  it('returns empty array for empty input', () => {
    expect(truncateBreadcrumbs([], 5)).toHaveLength(0);
  });
});
