/**
 * Tests for src/lib/error-projects/fingerprint.ts
 * Covers: calculateFingerprint consistency, projectId isolation,
 * custom fingerprint priority, message normalization, normalizeStackTitle.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFingerprint,
  normalizeStackTitle,
} from '@/lib/error-projects/fingerprint';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = {
  projectId:     'proj-abc',
  exceptionType: 'TypeError',
  message:       'Cannot read property of null',
  topFrame:      { filename: 'https://example.com/app.js', function: 'render' },
};

// ── calculateFingerprint ──────────────────────────────────────────────────────

describe('calculateFingerprint', () => {
  it('returns a 40-char hex string', () => {
    const fp = calculateFingerprint(BASE);
    expect(fp).toHaveLength(40);
    expect(/^[0-9a-f]+$/.test(fp)).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const a = calculateFingerprint(BASE);
    const b = calculateFingerprint({ ...BASE });
    expect(a).toBe(b);
  });

  it('differs when projectId changes (project isolation)', () => {
    const a = calculateFingerprint(BASE);
    const b = calculateFingerprint({ ...BASE, projectId: 'proj-xyz' });
    expect(a).not.toBe(b);
  });

  it('differs when exceptionType changes', () => {
    const a = calculateFingerprint(BASE);
    const b = calculateFingerprint({ ...BASE, exceptionType: 'ReferenceError' });
    expect(a).not.toBe(b);
  });

  it('differs when topFrame filename changes', () => {
    const a = calculateFingerprint(BASE);
    const b = calculateFingerprint({ ...BASE, topFrame: { ...BASE.topFrame, filename: 'https://example.com/other.js' } });
    expect(a).not.toBe(b);
  });

  it('differs when topFrame function changes', () => {
    const a = calculateFingerprint(BASE);
    const b = calculateFingerprint({ ...BASE, topFrame: { ...BASE.topFrame, function: 'onClick' } });
    expect(a).not.toBe(b);
  });

  it('defaults exceptionType to "Error" when missing', () => {
    const withoutType  = calculateFingerprint({ projectId: 'p', message: 'x' });
    const withError    = calculateFingerprint({ projectId: 'p', exceptionType: 'Error', message: 'x' });
    expect(withoutType).toBe(withError);
  });

  it('normalizes UUIDs in messages before hashing', () => {
    const a = calculateFingerprint({ projectId: 'p', exceptionType: 'E', message: 'id 550e8400-e29b-41d4-a716-446655440000 not found' });
    const b = calculateFingerprint({ projectId: 'p', exceptionType: 'E', message: 'id 123e4567-e89b-12d3-a456-426614174000 not found' });
    expect(a).toBe(b);
  });

  it('normalizes numbers in messages before hashing', () => {
    const a = calculateFingerprint({ projectId: 'p', exceptionType: 'E', message: 'failed after 3 retries' });
    const b = calculateFingerprint({ projectId: 'p', exceptionType: 'E', message: 'failed after 9 retries' });
    expect(a).toBe(b);
  });

  it('normalizes hex strings in messages before hashing', () => {
    const a = calculateFingerprint({ projectId: 'p', exceptionType: 'E', message: 'checksum deadbeefcafe mismatch' });
    const b = calculateFingerprint({ projectId: 'p', exceptionType: 'E', message: 'checksum cafebabe0011 mismatch' });
    // both are 12-char hex tokens → normalized to {hex}, same fingerprint
    expect(a).toBe(b);
  });

  it('custom fingerprint overrides default grouping', () => {
    const custom  = calculateFingerprint({ ...BASE, customFingerprint: ['my-group', 'v1'] });
    const normal  = calculateFingerprint(BASE);
    expect(custom).not.toBe(normal);
  });

  it('custom fingerprint is deterministic', () => {
    const a = calculateFingerprint({ ...BASE, customFingerprint: ['bucket-a'] });
    const b = calculateFingerprint({ ...BASE, customFingerprint: ['bucket-a'] });
    expect(a).toBe(b);
  });

  it('custom fingerprint differs when values differ', () => {
    const a = calculateFingerprint({ ...BASE, customFingerprint: ['bucket-a'] });
    const b = calculateFingerprint({ ...BASE, customFingerprint: ['bucket-b'] });
    expect(a).not.toBe(b);
  });

  it('strips origin from topFrame filename before hashing', () => {
    const withOrigin    = calculateFingerprint({ ...BASE, topFrame: { filename: 'https://example.com/app.js', function: 'f' } });
    const withOtherHost = calculateFingerprint({ ...BASE, topFrame: { filename: 'https://cdn.other.com/app.js', function: 'f' } });
    // After stripping origin, both become /app.js — should be equal
    expect(withOrigin).toBe(withOtherHost);
  });

  it('handles missing topFrame gracefully', () => {
    const fp = calculateFingerprint({ projectId: 'p', exceptionType: 'E', message: 'oops' });
    expect(fp).toHaveLength(40);
  });
});

// ── normalizeStackTitle ───────────────────────────────────────────────────────

describe('normalizeStackTitle', () => {
  it('formats as "Type: message"', () => {
    expect(normalizeStackTitle('TypeError', 'Cannot read property')).toBe('TypeError: Cannot read property');
  });

  it('defaults type to "Error" when undefined', () => {
    expect(normalizeStackTitle(undefined, 'Something went wrong')).toBe('Error: Something went wrong');
  });

  it('truncates long messages to 100 chars', () => {
    const long = 'a'.repeat(150);
    const result = normalizeStackTitle('E', long);
    expect(result).toBe(`E: ${'a'.repeat(100)}`);
  });
});
