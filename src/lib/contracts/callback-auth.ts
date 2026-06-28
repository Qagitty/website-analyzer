/**
 * §9 — Callback signature validation.
 *
 * Adds HMAC-SHA256 authentication for Worker→backend callbacks.
 * Existing Bearer-token-only callbacks continue to work (backward compat §29).
 *
 * Headers used:
 *   X-Callback-Signature   sha256=<hex>
 *   X-Callback-Timestamp   ISO-8601
 *   X-Callback-Version     v1
 *   X-Idempotency-Key      opaque string
 *
 * Signing string: `${timestamp}.${rawBody}`
 * This binds the signature to both the body content and the send time,
 * preventing replay attacks outside the allowed window.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/** Maximum age of an accepted callback timestamp. */
const REPLAY_WINDOW_MS = 5 * 60 * 1_000; // 5 minutes

export interface CallbackAuthHeaders {
  'X-Callback-Signature': string;
  'X-Callback-Timestamp': string;
  'X-Callback-Version': string;
  'X-Idempotency-Key': string;
}

export type VerifyFailReason =
  | 'missing-headers'
  | 'expired'
  | 'invalid-signature'
  | 'malformed-timestamp';

export type VerifyResult =
  | { valid: true; idempotencyKey: string | undefined }
  | { valid: false; reason: VerifyFailReason };

/**
 * Produces the HMAC headers the Worker should attach to each callback.
 * The idempotencyKey is included so the backend can detect duplicate deliveries.
 */
export function signCallback(
  rawBody: string,
  secret: string,
  options: { timestamp?: string; idempotencyKey?: string } = {},
): CallbackAuthHeaders {
  const timestamp = options.timestamp ?? new Date().toISOString();
  const idempotencyKey = options.idempotencyKey ?? generateIdempotencyKey();
  const signingString = `${timestamp}.${rawBody}`;
  const sig = createHmac('sha256', secret).update(signingString).digest('hex');
  return {
    'X-Callback-Signature': `sha256=${sig}`,
    'X-Callback-Timestamp': timestamp,
    'X-Callback-Version': 'v1',
    'X-Idempotency-Key': idempotencyKey,
  };
}

/**
 * Verifies the HMAC signature of an incoming callback.
 *
 * If neither X-Callback-Signature nor X-Callback-Timestamp is present,
 * returns `{ valid: true }` so legacy Bearer-only Workers continue to work.
 * The caller is responsible for checking the Bearer token separately.
 */
export function verifyCallbackSignature(
  rawBody: string,
  secret: string,
  headers: { get(name: string): string | null },
): VerifyResult {
  const sig = headers.get('x-callback-signature');
  const ts = headers.get('x-callback-timestamp');
  const idempotencyKey = headers.get('x-idempotency-key') ?? undefined;

  // §29 — Backward compat: no HMAC headers present → legacy Bearer path
  if (!sig && !ts) {
    return { valid: true, idempotencyKey };
  }

  if (!sig || !ts) {
    return { valid: false, reason: 'missing-headers' };
  }

  // Validate timestamp is parseable
  const tsMs = Date.parse(ts);
  if (!Number.isFinite(tsMs)) {
    return { valid: false, reason: 'malformed-timestamp' };
  }

  // §9 — Reject outside replay window
  if (Math.abs(Date.now() - tsMs) > REPLAY_WINDOW_MS) {
    return { valid: false, reason: 'expired' };
  }

  // §9 — Constant-time comparison to prevent timing attacks
  const signingString = `${ts}.${rawBody}`;
  const expected = `sha256=${createHmac('sha256', secret).update(signingString).digest('hex')}`;

  // Pad to equal length before comparison
  const sigBuf = Buffer.from(sig.padEnd(expected.length, '\0'));
  const expBuf = Buffer.from(expected.padEnd(sig.length, '\0'));

  if (sigBuf.length !== expBuf.length) {
    return { valid: false, reason: 'invalid-signature' };
  }

  if (!timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: 'invalid-signature' };
  }

  return { valid: true, idempotencyKey };
}

/** Generates a short opaque idempotency key. */
export function generateIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
