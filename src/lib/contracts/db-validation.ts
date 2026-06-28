/**
 * §24 — Database JSON validation on read.
 *
 * Existing JSON columns may contain data written by any historic schema version.
 * Do NOT assume stored JSON is trustworthy.
 *
 * When loading:
 *  1. Detect schema version.
 *  2. Validate.
 *  3. Adapt legacy data.
 *  4. Log validation failures.
 *  5. Avoid crashing report rendering.
 *
 * Return a controlled report-unavailable state when data cannot be normalized.
 */

import type { LighthouseScores } from '@/types/analysis';

// ─── Schema version detection ──────────────────────────────────────────────────

export type DbSchemaVersion = 'v1-legacy' | 'v2' | 'unknown';

/**
 * Detects the schema version of a stored lighthouse_scores blob.
 * v2 = has at least one structured audit object.
 * v1-legacy = only flat numeric scores.
 */
export function detectLighthouseSchemaVersion(raw: unknown): DbSchemaVersion {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'unknown';
  const r = raw as Record<string, unknown>;
  if (
    r.performanceAudit ||
    r.seoAudit ||
    r.accessibilityAudit ||
    r.bestPracticesAudit ||
    r.llmReadinessAudit ||
    r.securityHeadersAudit
  ) {
    return 'v2';
  }
  if (
    typeof r.performance === 'number' ||
    typeof r.accessibility === 'number' ||
    r.performance === null
  ) {
    return 'v1-legacy';
  }
  return 'unknown';
}

// ─── Score clamping ────────────────────────────────────────────────────────────

const CLAMPABLE_SCORE_KEYS = [
  'performance',
  'accessibility',
  'seo',
  'bestPractices',
  'llmReadiness',
] as const;

function clampDbScore(
  value: unknown,
  key: string,
  analysisId: string,
): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    console.warn(`[db-validation][${analysisId}] ${key} is not finite (${value}) — returning null`);
    return null;
  }
  if (n < 0 || n > 100) {
    console.warn(`[db-validation][${analysisId}] ${key}=${n} out of [0,100] — clamping`);
    return Math.min(100, Math.max(0, n));
  }
  return n;
}

// ─── Main validator ────────────────────────────────────────────────────────────

/**
 * Validates and sanitizes a lighthouse_scores blob loaded from the database.
 * Returns null when the blob is critically malformed (not an object).
 * Numeric scores outside [0, 100] are clamped and logged.
 *
 * §41 — Logs schema version and any clamping events for observability.
 */
export function validateDbLighthouseScores(
  raw: unknown,
  analysisId: string,
): LighthouseScores | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    console.warn(
      `[db-validation][${analysisId}] lighthouse_scores is not an object — discarding`,
    );
    return null;
  }

  const version = detectLighthouseSchemaVersion(raw);
  console.info(`[db-validation][${analysisId}] schema version: ${version}`);

  const r = raw as Record<string, unknown>;
  const sanitized: Record<string, unknown> = { ...r };

  for (const key of CLAMPABLE_SCORE_KEYS) {
    if (key in sanitized) {
      sanitized[key] = clampDbScore(sanitized[key], key, analysisId);
    }
  }

  return sanitized as unknown as LighthouseScores;
}

// ─── Generic JSON column parser ────────────────────────────────────────────────

/**
 * Safely parses a raw JSON string from a DB column.
 * Returns null on parse error rather than throwing.
 */
export function safeParseDbJson<T = unknown>(
  raw: string | null | undefined,
  columnName: string,
  analysisId: string,
): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(
      `[db-validation][${analysisId}] Failed to parse JSON column "${columnName}"`,
    );
    return null;
  }
}

// ─── Page array validator ──────────────────────────────────────────────────────

/**
 * Validates the crawl_pages array from the database.
 * Filters out entries that are not plain objects.
 * Assigns a deterministic fallback pageId if missing (§14).
 */
export function validateDbCrawlPages(
  raw: unknown,
  analysisId: string,
): Record<string, unknown>[] {
  if (!Array.isArray(raw)) {
    if (raw !== null && raw !== undefined) {
      console.warn(`[db-validation][${analysisId}] crawl_pages is not an array — discarding`);
    }
    return [];
  }

  return raw
    .filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        console.warn(`[db-validation][${analysisId}] crawl_pages: skipping non-object entry`);
        return false;
      }
      return true;
    })
    .map((page, index) => {
      if (!page.pageId && page.url) {
        // §14 — Assign stable fallback ID from URL when pageId is absent
        const urlHash = Buffer.from(String(page.url))
          .toString('base64url')
          .slice(0, 16);
        return { ...page, pageId: `legacy-${urlHash}-${index}` };
      }
      return page;
    });
}
