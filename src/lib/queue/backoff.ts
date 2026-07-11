/**
 * Bounded exponential backoff with jitter.
 *
 * Security: The retryAfterMs from upstream responses is clamped to
 * MAX_BACKOFF_MS to prevent attacker-controlled Retry-After values
 * from scheduling jobs years into the future.
 */

const BASE_MS  = 30_000;      // 30 seconds
const CAP_MS   = 30 * 60_000; // 30 minutes max
const JITTER   = 0.20;        // ±20% randomization

// Clamp value returned by an attacker-controlled Retry-After header.
const MAX_UPSTREAM_RETRY_AFTER_MS = 2 * 60 * 60_000; // 2 hours

/**
 * Calculate delay before the next retry attempt.
 *
 * @param attempt  1-based attempt number (1 = first retry after initial failure)
 * @param jitterFn Optional override for testing; defaults to Math.random()
 */
export function calculateBackoffMs(
  attempt: number,
  jitterFn: () => number = Math.random,
): number {
  const exp = Math.min(CAP_MS, BASE_MS * 2 ** (attempt - 1));
  const jitter = jitterFn() * exp * JITTER;
  return Math.round(exp + jitter);
}

/**
 * Backoff that respects an upstream Retry-After value (seconds or HTTP-date).
 * The upstream value is used only when it produces a delay LARGER than the
 * natural backoff — never to shorten the natural delay.
 * Clamped to MAX_UPSTREAM_RETRY_AFTER_MS.
 */
export function calculateBackoffWithUpstream(
  attempt: number,
  retryAfterHeader: string | number | null | undefined,
  jitterFn: () => number = Math.random,
): number {
  const natural = calculateBackoffMs(attempt, jitterFn);
  if (retryAfterHeader == null) return natural;

  let upstreamMs: number;
  if (typeof retryAfterHeader === 'number') {
    upstreamMs = retryAfterHeader * 1000;
  } else {
    // Could be seconds-as-string or an HTTP-date
    const secs = parseInt(retryAfterHeader, 10);
    if (!Number.isNaN(secs)) {
      upstreamMs = secs * 1000;
    } else {
      // Try parsing as HTTP-date
      const d = new Date(retryAfterHeader).getTime();
      upstreamMs = Number.isNaN(d) ? 0 : d - Date.now();
    }
  }

  const clamped = Math.min(Math.max(0, upstreamMs), MAX_UPSTREAM_RETRY_AFTER_MS);
  return Math.max(natural, clamped);
}

/**
 * Return the UTC ISO timestamp for when a retry should next be scheduled.
 */
export function retryScheduledFor(
  attempt: number,
  retryAfterHeader?: string | number | null,
  jitterFn?: () => number,
): string {
  const delayMs = calculateBackoffWithUpstream(attempt, retryAfterHeader, jitterFn);
  return new Date(Date.now() + delayMs).toISOString();
}

/**
 * Expected delays for documentation / tests:
 *   attempt 1 → ~30s
 *   attempt 2 → ~60s
 *   attempt 3 → ~2 min
 *   attempt 4 → ~4 min
 *   attempt 5 → ~8 min
 *   attempt 6+ → capped at ~30 min (+jitter)
 */
export const BACKOFF_EXPECTED_MS = {
  attempt1: BASE_MS,
  attempt2: BASE_MS * 2,
  attempt3: BASE_MS * 4,
  attempt4: BASE_MS * 8,
  attempt5: BASE_MS * 16,
  max:      CAP_MS,
};
