/**
 * Deterministic finding fingerprints for cross-assessment deduplication.
 *
 * Security notes:
 *  - sanitizeHtmlExcerpt: strips all HTML tags; output is plain text only.
 *    Never render the output as HTML — it may still contain angle brackets
 *    from escaped entities; always text-encode before display.
 *  - normalizeSelector strips generated hash IDs to prevent fingerprint
 *    churn on pages with dynamically generated attribute values.
 */

import { createHash } from 'crypto';

export interface FingerprintInput {
  profileId:         string;
  normalizedPageUrl: string;
  ruleId:            string;
  normalizedSelector: string;
}

/**
 * Compute a stable SHA-256 fingerprint for a finding.
 * Same inputs always produce the same fingerprint regardless of assessment ID.
 */
export function calculateFindingFingerprint(input: FingerprintInput): string {
  const { profileId, normalizedPageUrl, ruleId, normalizedSelector } = input;
  const raw = `${profileId}|${normalizedPageUrl}|${ruleId}|${normalizedSelector}`;
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * Normalize a CSS selector for stable fingerprinting.
 * Removes generated hash-like IDs (e.g. #abc12345) to prevent churn
 * when pages regenerate ID attributes on each render.
 */
export function normalizeSelector(selector: string): string {
  return selector
    // Replace ID references that look like generated hashes (8+ hex chars)
    .replace(/#[a-f0-9]{8,}/gi, '#[id]')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Hard cap — selectors longer than 200 chars are unstable
    .slice(0, 200);
}

/**
 * Normalize a page URL for stable fingerprinting.
 * Strips query string and fragment — both are volatile across sessions.
 */
export function normalizePageUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    // Remove trailing slash for consistency
    return u.toString().replace(/\/$/, '');
  } catch {
    // If URL is unparseable, return trimmed original
    return url.trim();
  }
}

/**
 * Strip all HTML tags from an excerpt and limit to 500 characters.
 * The result is safe for storage but must still be text-encoded before
 * rendering in HTML contexts.
 *
 * NEVER render raw HTML from analysis results — always call this function first.
 */
export function sanitizeHtmlExcerpt(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')     // strip tags
    .replace(/\s+/g, ' ')        // collapse whitespace
    .trim()
    .slice(0, 500);
}
