import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// Fail open when Redis is not configured (e.g. test environment).
// Production always has UPSTASH_REDIS_URL set; missing it there is a misconfiguration.
const redis =
  process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN })
    : null;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

/**
 * Fixed-window rate limiter backed by Upstash Redis.
 *
 * @param key    Unique key per subject (e.g. `rl:check-email:<ip>`)
 * @param limit  Max requests per window
 * @param windowSeconds  Window size in seconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // Fail open when Redis is unavailable — never block requests due to infra issues.
  if (!redis) {
    const now = Math.floor(Date.now() / 1000);
    return { allowed: true, remaining: limit, reset: now + windowSeconds, limit };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(now / windowSeconds);
  const redisKey = `${key}:${windowId}`;

  let count: number;
  try {
    count = (await redis.incr(redisKey)) as number;
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds + 5);
    }
  } catch {
    // Redis error — fail open rather than blocking legitimate requests
    return { allowed: true, remaining: limit, reset: now + windowSeconds, limit };
  }

  const reset = (windowId + 1) * windowSeconds;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    reset,
    limit,
  };
}

/**
 * Extract the real client IP from request headers.
 * Trusts X-Forwarded-For (set by Vercel edge) only — never user-controllable.
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

/** Standard 429 response with Retry-After header. */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = result.reset - Math.floor(Date.now() / 1000);
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, retryAfter)),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.reset),
      },
    }
  );
}

/**
 * Convenience: check rate limit and return a 429 response if exceeded.
 * Returns null if the request is allowed, or a NextResponse to return immediately.
 *
 * Usage:
 *   const limited = await checkRateLimit(req, 'check-email', 5, 60);
 *   if (limited) return limited;
 */
export async function checkWebRateLimit(
  req: NextRequest,
  namespace: string,
  limit: number,
  windowSeconds: number,
  subject?: string
): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const key = `rl:${namespace}:${subject ?? ip}`;
  const result = await rateLimit(key, limit, windowSeconds);
  if (!result.allowed) return rateLimitResponse(result);
  return null;
}

// ─── SQL injection pattern detection ─────────────────────────────────────────

const SQL_PATTERNS = [
  /(\b(select|union|insert|update|delete|drop|alter|create|exec|execute|truncate)\b.*\b(from|into|table|database|schema)\b)/i,
  /--\s*$/m,
  /;\s*(drop|delete|truncate|alter)\b/i,
  /\b0x[0-9a-f]+\b/i,
  /\bor\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
  /\band\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
  /\/\*[\s\S]*?\*\//,
  /\bxp_\w+/i,
  /\bwaitfor\s+delay\b/i,
  /\bbenchmark\s*\(/i,
  /\bsleep\s*\(\s*\d/i,
];

/**
 * Returns true if the string contains patterns that look like SQL injection.
 * Used in middleware to log and block obviously malicious input.
 */
export function looksLikeSqlInjection(value: string): boolean {
  return SQL_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Scans URL search params for SQL injection patterns.
 * Returns the offending value if found, or null.
 *
 * NOTE: Request bodies are NOT scanned here because middleware runs in the
 * Edge Runtime where req.json() would consume the body before API route
 * handlers can read it.  Body inputs are validated by Zod in each route.
 * This function covers the query-param surface only — e.g. paginated list
 * endpoints that accept ?q= search params.
 */
export function detectSqlInjectionInRequest(url: URL): string | null {
  for (const [, value] of url.searchParams) {
    if (looksLikeSqlInjection(value)) return value;
  }
  return null;
}

// ─── Account lockout helpers ──────────────────────────────────────────────────

/**
 * Check if a subject is currently locked out.
 * Returns HTTP 423 if locked, null if the request may proceed.
 *
 * F2 — fails CLOSED when Redis is unavailable: a Redis outage must not silently
 * disable brute-force protection. Returns 503 so callers retry rather than bypass.
 */
export async function checkAccountLockout(
  namespace: string,
  subject: string
): Promise<NextResponse | null> {
  if (!redis) {
    console.error('[rate-limit] checkAccountLockout: Redis not configured — failing closed');
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }
  try {
    const lockKey = `lockout:${namespace}:${subject}`;
    const locked = await redis.exists(lockKey);
    if (locked) {
      const ttl = await redis.ttl(lockKey);
      const minutes = Math.ceil(Math.max(ttl, 0) / 60);
      return NextResponse.json(
        { error: `Account temporarily locked. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` },
        { status: 423 }
      );
    }
  } catch {
    // F2 — Redis runtime error: fail closed for the same reason as above.
    console.error('[rate-limit] checkAccountLockout: Redis error — failing closed');
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }
  return null;
}

/**
 * Record a failed auth attempt. Locks the account for lockWindowSeconds after maxFails failures.
 */
export async function recordAuthFailure(
  namespace: string,
  subject: string,
  maxFails: number,
  lockWindowSeconds: number
): Promise<void> {
  if (!redis) return;
  try {
    const failKey = `fails:${namespace}:${subject}`;
    const count = (await redis.incr(failKey)) as number;
    if (count === 1) await redis.expire(failKey, lockWindowSeconds);
    if (count >= maxFails) {
      await redis.set(`lockout:${namespace}:${subject}`, '1', { ex: lockWindowSeconds });
      await redis.del(failKey);
    }
  } catch {
    // best-effort — never let failure tracking block the response
  }
}

/**
 * Clear the failure counter on a successful auth. Call this after verified success.
 */
export async function clearAuthFailures(namespace: string, subject: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`fails:${namespace}:${subject}`);
  } catch {
    // ignore
  }
}
