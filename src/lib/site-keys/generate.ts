/**
 * Site key generation for Connected Sites.
 *
 * Key format: ws_site_<32 random hex chars>
 *
 * Site keys are PUBLIC — they appear in the customer's HTML source.
 * Security does NOT rely on the key being secret. It relies on:
 *   - verified origin matching
 *   - rate limits
 *   - site-key hash lookup
 *   - RLS preventing cross-tenant access
 *
 * We still encrypt for storage to support dashboard reveal (the user may
 * need to copy the key again after initial generation).
 *
 * The encryption key is shared with API key encryption (same env var)
 * because both follow the same security model and KDF parameters.
 */

import crypto from 'crypto';
import { encryptApiKey, decryptApiKey } from '@/lib/api-keys/generate';

export const SITE_KEY_PREFIX = 'ws_site_';

export function generateSiteKey(): {
  raw: string;
  hash: string;
  prefix: string;
  encrypted: string;
} {
  const random    = crypto.randomBytes(16).toString('hex');
  const raw       = `${SITE_KEY_PREFIX}${random}`;
  const hash      = hashSiteKey(raw);
  const prefix    = raw.slice(0, 16); // "ws_site_" + first 8 chars
  const encrypted = encryptApiKey(raw); // reuse same AES-256-GCM/PBKDF2 path
  return { raw, hash, prefix, encrypted };
}

export function hashSiteKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function revealSiteKey(encrypted: string): string | null {
  return decryptApiKey(encrypted);
}

export function isSiteKeyFormat(value: string): boolean {
  // ws_site_ + exactly 32 lowercase hex chars
  return /^ws_site_[0-9a-f]{32}$/.test(value);
}

/**
 * Generate a cryptographically strong one-time verification token.
 * The raw token is shown to the user once; only the hash is stored.
 */
export function generateVerificationToken(): {
  raw: string;
  hash: string;
  encrypted: string;
} {
  const raw       = crypto.randomBytes(24).toString('hex'); // 48 hex chars = 192 bits
  const hash      = crypto.createHash('sha256').update(raw).digest('hex');
  const encrypted = encryptApiKey(raw);
  return { raw, hash, encrypted };
}

export function hashVerificationToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function revealVerificationToken(encrypted: string): string | null {
  return decryptApiKey(encrypted);
}
