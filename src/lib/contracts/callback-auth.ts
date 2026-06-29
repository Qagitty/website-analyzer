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

import { createHmac, timingSafeEqual, randomUUID } from 'crypto';

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

/**
 * SE1 — Discriminated union makes "HMAC verified" vs "legacy no-headers" distinguishable
 * at compile time. Future callers that need cryptographic assurance must check
 * `authenticated === true`, not just `valid === true`.
 */
export type VerifyResult =
  | { valid: true; authenticated: true; idempotencyKey: string | undefined }
  | { valid: true; authenticated: false; reason: 'legacy-no-headers'; idempotencyKey: string | undefined }
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

  // §29 — Backward compat: no HMAC headers present → legacy Bearer path.
  // SE1 — authenticated:false so callers that need cryptographic assurance can detect this.
  if (!sig && !ts) {
    return { valid: true, authenticated: false, reason: 'legacy-no-headers', idempotencyKey };
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

  // Pad both sides to equal length for timingSafeEqual (§Gap9 — dead length check removed).
  const maxLen = Math.max(sig.length, expected.length);
  const sigBuf = Buffer.from(sig.padEnd(maxLen, '\0'));
  const expBuf = Buffer.from(expected.padEnd(maxLen, '\0'));

  if (!timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: 'invalid-signature' };
  }

  return { valid: true, authenticated: true, idempotencyKey };
}

/**
 * SE8 — crypto.randomUUID() replaces Math.random() (xorshift128+, 48-bit state,
 * predictable from prior observations) with a CSPRNG-backed UUID.
 */
export function generateIdempotencyKey(): string {
  return randomUUID();
}
