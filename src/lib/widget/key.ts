import crypto from 'crypto';

/**
 * Widget keys are *public* keys (safe to embed in client HTML).
 * They only permit submitting URLs for analysis — no read access.
 *
 * Format: wk_live_<32 hex chars>
 * Storage: plaintext in user_settings.widget_key
 *   (unlike API keys which are hashed — widget keys need fast lookup
 *    on the public /widget/[key] page without requiring a secret comparison)
 *
 * Security: rate-limited to 20 submissions/day per key.
 */

export function generateWidgetKey(): string {
  return `wk_live_${crypto.randomBytes(16).toString('hex')}`;
}

/** Validate format of a widget key. */
export function isValidWidgetKeyFormat(key: string): boolean {
  return /^wk_live_[0-9a-f]{32}$/.test(key);
}
