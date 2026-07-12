/**
 * Atomic per-origin execution throttle.
 *
 * Solves two distinct safety problems:
 *   1. Concurrency: at most N heavy jobs may run for one origin at the same time.
 *   2. Delay:       a minimum interval must elapse between consecutive job starts.
 *
 * Atomicity model (Upstash Redis, no Lua):
 *   Acquisition uses Redis SET NX as the atomic primitive.
 *   For concurrency = 1 (the default), SET NX provides true mutual exclusion.
 *   The next_at check uses a read-then-NX pattern; a post-NX double-check
 *   within lease ownership catches the residual TOCTOU window.
 *
 * Release:
 *   The lease value encodes the lease token. We GET, compare, then DEL.
 *   There is a small race window between GET and DEL if the TTL expires at that
 *   exact instant and a new worker acquires a lease. This window is bounded to
 *   one Redis round-trip duration (~1–5 ms) and is mitigated by the TTL-based
 *   auto-expiry as a fallback. Without Lua EVAL this is the safest practical approach.
 *
 * Redis outage:
 *   Any Redis error during acquisition causes the caller to reschedule the job
 *   (fail-closed). The job is never executed without a confirmed origin lease.
 *
 * Key namespace (all under queue:v1:origin:):
 *   :lease     — active execution lock (SET NX, TTL = lease duration)
 *   :next_at   — Unix-ms earliest-next-start (TTL > delayMs)
 *   :cooldown  — cooldown-until ISO-8601 (from 429 / upstream signals)
 *   :suspended — suspension reason string (from operational controls)
 */

import { redis } from '@/lib/queue/redis';
import { Q } from './keys';
import { calculateBackoffWithUpstream } from './backoff';
import { ORIGIN_POLICY_CONFIG } from './origin-policy';
import { createLogger } from '@/lib/logger';
import crypto from 'crypto';

const log = createLogger({ category: 'queue:origin-throttle' });

// ─── Result types ─────────────────────────────────────────────────────────────

export type OriginLeaseAcquireResult =
  | {
      acquired: true;
      /** Random token used for token-checked release. */
      leaseToken: string;
      /** Unix-ms when the origin lease expires (auto-expiry via TTL). */
      leaseExpiresAt: number;
      /** Unix-ms before which no subsequent job should start. */
      nextAvailableAt: number;
    }
  | {
      acquired: false;
      reason:
        | 'active_origin_job'   // another job holds the origin lease
        | 'origin_delay'        // next_at timestamp not yet reached
        | 'origin_cooldown'     // upstream signalled backoff (e.g. 429)
        | 'origin_suspended';   // operational suspension
      /** Unix-ms when the origin will next be eligible. */
      eligibleAt: number;
    };

export interface AcquireOriginLeaseOptions {
  originHash:           string;
  leaseDurationSeconds: number;
  minimumDelayMs:       number;
  jobId:                string;
  workerId:             string;
}

export interface SetOriginCooldownOptions {
  originHash:         string;
  retryAfterHeader?:  string | number | null;
  /** Fallback cooldown if no Retry-After is present (ms). */
  fallbackDelayMs?:   number;
}

export interface SuspendOriginOptions {
  originHash:      string;
  reason:          string;
  durationSeconds: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function leaseToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function encodeLeaseValue(token: string, jobId: string, workerId: string): string {
  return `${token}|${jobId}|${workerId}`;
}

function decodeLeaseToken(value: string): string {
  return value.split('|')[0] ?? '';
}

// ─── Acquire ─────────────────────────────────────────────────────────────────

/**
 * Atomically attempt to acquire the origin execution lease.
 *
 * Ordering:
 *   1. Read next_at, cooldown, suspended in a pipeline (one round-trip).
 *   2. Reject fast without any write if ineligible.
 *   3. Attempt SET NX on the lease key (atomic).
 *   4. If acquired, double-check next_at under lease ownership.
 *   5. Set new next_at (protected by lease ownership).
 *
 * Throws on Redis failure — caller must handle as fail-closed.
 */
export async function tryAcquireOriginLease(
  opts: AcquireOriginLeaseOptions,
): Promise<OriginLeaseAcquireResult> {
  const now = Date.now();
  const {
    originHash,
    leaseDurationSeconds,
    minimumDelayMs,
    jobId,
    workerId,
  } = opts;

  const nextAtKey   = Q.originNextAt(originHash);
  const leaseKey    = Q.originLease(originHash);
  const cooldownKey = Q.originCooldown(originHash);
  const suspendKey  = Q.originSuspended(originHash);

  // ── Step 1: Read current state (pipeline) ─────────────────────────────────
  const [nextAtRaw, cooldownRaw, suspendedRaw] = await Promise.all([
    redis.get<string>(nextAtKey),
    redis.get<string>(cooldownKey),
    redis.get<string>(suspendKey),
  ]);

  // ── Step 2: Fast rejection without any write ──────────────────────────────
  if (suspendedRaw) {
    log.info('origin_lease_acquire_attempt', { originHash, result: 'origin_suspended', jobId });
    // Suspension has a TTL — use it as eligibleAt approximation
    const suspendedUntil = now + leaseDurationSeconds * 1000;
    return { acquired: false, reason: 'origin_suspended', eligibleAt: suspendedUntil };
  }

  if (cooldownRaw) {
    const cooldownUntilMs = new Date(cooldownRaw).getTime();
    if (!Number.isNaN(cooldownUntilMs) && cooldownUntilMs > now) {
      log.info('origin_lease_acquire_attempt', { originHash, result: 'origin_cooldown', jobId, eligibleAt: cooldownUntilMs });
      return { acquired: false, reason: 'origin_cooldown', eligibleAt: cooldownUntilMs };
    }
  }

  const nextAtMs = nextAtRaw ? parseInt(nextAtRaw, 10) : 0;
  if (!Number.isNaN(nextAtMs) && nextAtMs > now) {
    log.info('origin_lease_acquire_attempt', { originHash, result: 'origin_delay', jobId, eligibleAt: nextAtMs });
    return { acquired: false, reason: 'origin_delay', eligibleAt: nextAtMs };
  }

  // ── Step 3: Atomic lease acquisition via SET NX ───────────────────────────
  const token     = leaseToken();
  const leaseVal  = encodeLeaseValue(token, jobId, workerId);
  const leaseExpiresAt = now + leaseDurationSeconds * 1000;

  const acquired = await redis.set(leaseKey, leaseVal, {
    nx: true,
    ex: leaseDurationSeconds,
  });

  if (!acquired) {
    log.info('origin_lease_acquire_attempt', { originHash, result: 'active_origin_job', jobId });
    // Another worker holds the lease. Eligibility: lease will expire at most leaseSecs from now.
    return { acquired: false, reason: 'active_origin_job', eligibleAt: leaseExpiresAt };
  }

  // ── Step 4: Double-check next_at under lease ownership ───────────────────
  // There is a race: between step 2 and step 3 another job could have finished
  // and written a new next_at. We now own the lease so we can check safely.
  const nextAtRecheck = await redis.get<string>(nextAtKey);
  const nextAtMsRecheck = nextAtRecheck ? parseInt(nextAtRecheck, 10) : 0;
  if (!Number.isNaN(nextAtMsRecheck) && nextAtMsRecheck > now) {
    // Release the lease — we aren't eligible yet
    await _releaseLeaseByToken(leaseKey, token);
    log.info('origin_lease_acquire_attempt', { originHash, result: 'origin_delay_recheck', jobId, eligibleAt: nextAtMsRecheck });
    return { acquired: false, reason: 'origin_delay', eligibleAt: nextAtMsRecheck };
  }

  // ── Step 5: Advance next_at (protected by lease ownership) ───────────────
  // nextAvailableAt is now + minimumDelayMs. This prevents the NEXT job from
  // starting before the delay elapses, even if this job completes early.
  const nextAvailableAt = now + minimumDelayMs;
  const nextAtTtlSeconds = Math.ceil(minimumDelayMs / 1000) + 60; // extra 60s buffer
  await redis.set(nextAtKey, String(nextAvailableAt), { ex: nextAtTtlSeconds });

  log.info('origin_lease_acquired', {
    originHash,
    jobId,
    workerId,
    leaseExpiresAt: new Date(leaseExpiresAt).toISOString(),
    nextAvailableAt: new Date(nextAvailableAt).toISOString(),
  });

  return { acquired: true, leaseToken: token, leaseExpiresAt, nextAvailableAt };
}

// ─── Release ──────────────────────────────────────────────────────────────────

/**
 * Release the origin execution lease.
 * Token-checked: only the caller that holds `leaseToken` may release it.
 *
 * Race note: GET + compare + DEL is not a single atomic operation. If the
 * lease TTL expires between GET and DEL, a new worker may have acquired a new
 * lease that we would accidentally delete. This is mitigated by:
 *   a. The TTL-based auto-expiry is the true safety net.
 *   b. The window is bounded to one Redis round-trip (~1–5 ms).
 *   c. The new worker's lease would have a different token that we compare.
 * Without Lua EVAL (not available via Upstash REST SDK) this is the safest approach.
 *
 * Does NOT delete or reduce next_at — the delay must still be respected by
 * subsequent jobs regardless of when this job finished.
 */
export async function releaseOriginLease(
  originHash: string,
  leaseToken: string,
): Promise<void> {
  const leaseKey = Q.originLease(originHash);

  let currentVal: string | null;
  try {
    currentVal = await redis.get<string>(leaseKey);
  } catch (err) {
    log.warn('origin_lease_release_failed', {
      originHash,
      error: err instanceof Error ? err.message.slice(0, 100) : 'unknown',
    });
    // Rely on TTL auto-expiry. Do not propagate — the job already succeeded or failed.
    return;
  }

  if (!currentVal) {
    // Already expired or released — nothing to do.
    return;
  }

  const storedToken = decodeLeaseToken(currentVal);
  if (storedToken !== leaseToken) {
    // A different worker now owns the lease (e.g. crash recovery re-acquired).
    // Do NOT delete it.
    log.warn('origin_lease_release_token_mismatch', { originHash });
    return;
  }

  try {
    await redis.del(leaseKey);
    log.info('origin_lease_released', { originHash });
  } catch (err) {
    log.warn('origin_lease_release_failed', {
      originHash,
      error: err instanceof Error ? err.message.slice(0, 100) : 'unknown',
    });
    // TTL-based auto-expiry is the fallback.
  }
}

// Token-checked delete used internally (e.g. double-check release in acquire).
async function _releaseLeaseByToken(leaseKey: string, token: string): Promise<void> {
  const current = await redis.get<string>(leaseKey).catch(() => null);
  if (!current) return;
  if (decodeLeaseToken(current) !== token) return;
  await redis.del(leaseKey).catch(() => {});
}

// ─── Cooldown ─────────────────────────────────────────────────────────────────

/**
 * Set an origin cooldown after a 429, repeated 503, or other upstream signal.
 *
 * The cooldown-until timestamp is stored as ISO-8601. The TTL on the Redis key
 * is derived from the same value so the key auto-expires when the cooldown ends.
 *
 * Security: retryAfterHeader is clamped to maxCooldownMs (2 hours) to prevent
 * an attacker-controlled header from suspending jobs indefinitely.
 */
export async function setOriginCooldown(opts: SetOriginCooldownOptions): Promise<void> {
  const { originHash, retryAfterHeader, fallbackDelayMs = 60_000 } = opts;

  // Calculate cooldown duration using the same bounded backoff as job retries.
  // We pass attempt = 2 as a reasonable escalation starting point.
  const rawMs = calculateBackoffWithUpstream(2, retryAfterHeader ?? null);
  const clampedMs = Math.min(rawMs, ORIGIN_POLICY_CONFIG.maxCooldownMs());
  const actualMs = Math.max(clampedMs, fallbackDelayMs);

  const cooldownUntil = new Date(Date.now() + actualMs);
  const ttlSeconds = Math.ceil(actualMs / 1000) + 5; // tiny buffer

  await redis.set(
    Q.originCooldown(originHash),
    cooldownUntil.toISOString(),
    { ex: ttlSeconds },
  );

  log.info('origin_cooldown_set', {
    originHash,
    cooldownUntil: cooldownUntil.toISOString(),
    durationMs: actualMs,
  });
}

/**
 * Suspend an origin for operational reasons (e.g. WAF challenge, CAPTCHA detected).
 * Unlike a cooldown, suspension must be explicitly lifted or will expire via TTL.
 */
export async function suspendOrigin(opts: SuspendOriginOptions): Promise<void> {
  const { originHash, reason, durationSeconds } = opts;
  await redis.set(
    Q.originSuspended(originHash),
    reason.slice(0, 200), // bounded
    { ex: Math.max(60, durationSeconds) },
  );
  log.info('origin_suspended', { originHash, reason: reason.slice(0, 100), durationSeconds });
}

/**
 * Remove an origin suspension (operational use).
 */
export async function unsuspendOrigin(originHash: string): Promise<void> {
  await redis.del(Q.originSuspended(originHash));
  log.info('origin_unsuspended', { originHash });
}

/**
 * Read current origin state for observability / admin.
 * Returns only safe fields — no raw URLs.
 */
export async function getOriginState(originHash: string): Promise<{
  hasActiveLease: boolean;
  nextAvailableAt: number | null;
  cooldownUntil: string | null;
  isSuspended: boolean;
}> {
  const [leaseRaw, nextAtRaw, cooldownRaw, suspendedRaw] = await Promise.all([
    redis.get<string>(Q.originLease(originHash)),
    redis.get<string>(Q.originNextAt(originHash)),
    redis.get<string>(Q.originCooldown(originHash)),
    redis.get<string>(Q.originSuspended(originHash)),
  ]);

  return {
    hasActiveLease:  !!leaseRaw,
    nextAvailableAt: nextAtRaw ? parseInt(nextAtRaw, 10) : null,
    cooldownUntil:   cooldownRaw ?? null,
    isSuspended:     !!suspendedRaw,
  };
}
