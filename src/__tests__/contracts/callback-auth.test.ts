/**
 * §9  — Callback signature validation.
 * §10 — Idempotent write support.
 * §35 — Contract tests between Worker and backend.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  signCallback,
  verifyCallbackSignature,
  generateIdempotencyKey,
} from '@/lib/contracts/callback-auth';

const SECRET = 'test-secret-abc123';
const BODY = JSON.stringify({ analysisId: 'test-001', status: 'completed' });

// ─── signCallback ─────────────────────────────────────────────────────────────

describe('signCallback', () => {
  it('produces all four required headers', () => {
    const headers = signCallback(BODY, SECRET);
    expect(headers['X-Callback-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(headers['X-Callback-Timestamp']).toBeTruthy();
    expect(headers['X-Callback-Version']).toBe('v1');
    expect(headers['X-Idempotency-Key']).toBeTruthy();
  });

  it('uses a provided timestamp', () => {
    const ts = '2026-06-27T10:00:00.000Z';
    const headers = signCallback(BODY, SECRET, { timestamp: ts });
    expect(headers['X-Callback-Timestamp']).toBe(ts);
  });

  it('uses a provided idempotency key', () => {
    const key = 'my-idem-key';
    const headers = signCallback(BODY, SECRET, { idempotencyKey: key });
    expect(headers['X-Idempotency-Key']).toBe(key);
  });

  it('produces different signatures for different bodies', () => {
    const ts = '2026-06-27T10:00:00.000Z';
    const h1 = signCallback('body1', SECRET, { timestamp: ts });
    const h2 = signCallback('body2', SECRET, { timestamp: ts });
    expect(h1['X-Callback-Signature']).not.toBe(h2['X-Callback-Signature']);
  });

  it('produces different signatures for different secrets', () => {
    const ts = '2026-06-27T10:00:00.000Z';
    const h1 = signCallback(BODY, 'secret-a', { timestamp: ts });
    const h2 = signCallback(BODY, 'secret-b', { timestamp: ts });
    expect(h1['X-Callback-Signature']).not.toBe(h2['X-Callback-Signature']);
  });
});

// ─── verifyCallbackSignature ──────────────────────────────────────────────────

function makeHeaders(extra: Record<string, string | null> = {}): { get(name: string): string | null } {
  const map: Record<string, string | null> = { ...extra };
  return {
    get(name: string) {
      return map[name.toLowerCase()] ?? null;
    },
  };
}

describe('verifyCallbackSignature', () => {
  it('verifies a correctly signed callback', () => {
    const ts = new Date().toISOString();
    const signed = signCallback(BODY, SECRET, { timestamp: ts, idempotencyKey: 'key-1' });
    const headers = makeHeaders({
      'x-callback-signature': signed['X-Callback-Signature'],
      'x-callback-timestamp': signed['X-Callback-Timestamp'],
      'x-idempotency-key': signed['X-Idempotency-Key'],
    });
    const result = verifyCallbackSignature(BODY, SECRET, headers);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.idempotencyKey).toBe('key-1');
    }
  });

  it('returns valid=true when no HMAC headers (legacy Bearer-only path)', () => {
    const headers = makeHeaders();
    const result = verifyCallbackSignature(BODY, SECRET, headers);
    expect(result.valid).toBe(true);
  });

  it('rejects when signature is present but timestamp is missing', () => {
    const headers = makeHeaders({
      'x-callback-signature': 'sha256=abc',
    });
    const result = verifyCallbackSignature(BODY, SECRET, headers);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('missing-headers');
    }
  });

  it('rejects when timestamp is present but signature is missing', () => {
    const headers = makeHeaders({
      'x-callback-timestamp': new Date().toISOString(),
    });
    const result = verifyCallbackSignature(BODY, SECRET, headers);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('missing-headers');
    }
  });

  it('rejects an expired timestamp (>5 minutes old)', () => {
    const oldTs = new Date(Date.now() - 6 * 60 * 1_000).toISOString();
    const signed = signCallback(BODY, SECRET, { timestamp: oldTs });
    const headers = makeHeaders({
      'x-callback-signature': signed['X-Callback-Signature'],
      'x-callback-timestamp': oldTs,
    });
    const result = verifyCallbackSignature(BODY, SECRET, headers);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('expired');
    }
  });

  it('rejects a future timestamp (>5 minutes ahead)', () => {
    const futureTs = new Date(Date.now() + 6 * 60 * 1_000).toISOString();
    const signed = signCallback(BODY, SECRET, { timestamp: futureTs });
    const headers = makeHeaders({
      'x-callback-signature': signed['X-Callback-Signature'],
      'x-callback-timestamp': futureTs,
    });
    const result = verifyCallbackSignature(BODY, SECRET, headers);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('expired');
    }
  });

  it('rejects a tampered body', () => {
    const ts = new Date().toISOString();
    const signed = signCallback(BODY, SECRET, { timestamp: ts });
    const headers = makeHeaders({
      'x-callback-signature': signed['X-Callback-Signature'],
      'x-callback-timestamp': ts,
    });
    const tamperedBody = BODY + ' TAMPERED';
    const result = verifyCallbackSignature(tamperedBody, SECRET, headers);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('invalid-signature');
    }
  });

  it('rejects a wrong secret', () => {
    const ts = new Date().toISOString();
    const signed = signCallback(BODY, SECRET, { timestamp: ts });
    const headers = makeHeaders({
      'x-callback-signature': signed['X-Callback-Signature'],
      'x-callback-timestamp': ts,
    });
    const result = verifyCallbackSignature(BODY, 'wrong-secret', headers);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('invalid-signature');
    }
  });

  it('rejects a malformed timestamp', () => {
    const headers = makeHeaders({
      'x-callback-signature': 'sha256=abc',
      'x-callback-timestamp': 'not-a-date',
    });
    const result = verifyCallbackSignature(BODY, SECRET, headers);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('malformed-timestamp');
    }
  });

  it('round-trips: sign then verify succeeds', () => {
    const ts = new Date().toISOString();
    const idem = 'round-trip-key';
    const headers = signCallback(BODY, SECRET, { timestamp: ts, idempotencyKey: idem });
    const headerObj = makeHeaders({
      'x-callback-signature': headers['X-Callback-Signature'],
      'x-callback-timestamp': headers['X-Callback-Timestamp'],
      'x-idempotency-key': headers['X-Idempotency-Key'],
    });
    const result = verifyCallbackSignature(BODY, SECRET, headerObj);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.idempotencyKey).toBe(idem);
    }
  });
});

// ─── generateIdempotencyKey (§10) ────────────────────────────────────────────

describe('generateIdempotencyKey', () => {
  it('produces a non-empty string', () => {
    const key = generateIdempotencyKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('produces unique keys on successive calls', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(100);
  });
});
