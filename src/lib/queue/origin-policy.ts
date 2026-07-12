/**
 * Per-job-type execution policies for origin throttling.
 *
 * Security rules:
 *  - Every QueueJobType MUST appear in EXECUTION_POLICIES.
 *    The Record<QueueJobType, ...> type enforces this at compile time.
 *  - Numeric limits are validated server-side; callers cannot override them.
 *  - Jobs with requiresOriginThrottle = false never acquire an origin lease.
 *  - Unknown job types cause getJobExecutionPolicy() to throw — there is
 *    no default permissive policy.
 */

import { QueueJobTypes } from './types';
import type { QueueJobType } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WebsiteJobWeight = 'none' | 'light' | 'medium' | 'heavy';

/**
 * Static classification of a job type.
 * Numeric limits are in getOriginLimits() so they react to env at call time.
 */
export interface QueueJobExecutionPolicy {
  requiresOriginThrottle: boolean;
  weight: WebsiteJobWeight;
}

export interface OriginLimits {
  /** Max concurrent jobs from this weight class for one origin. */
  concurrency: number;
  /** Minimum ms between job starts for the same origin. */
  delayMs: number;
  /** How long to hold the origin lease (seconds). */
  leaseSecs: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

function envInt(name: string, defaultVal: number): number {
  const raw = process.env[name];
  if (!raw) return defaultVal;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : defaultVal;
}

/** Server-side safe limits. Callers cannot reduce below minimums. */
export const ORIGIN_POLICY_CONFIG = {
  /** Max concurrent heavy jobs per origin. Clamped 1–3. */
  heavyConcurrency:   () => Math.max(1, Math.min(envInt('QUEUE_ORIGIN_HEAVY_CONCURRENCY', 1), 3)),
  /** Minimum ms between heavy job starts per origin. Min 5000ms. */
  heavyDelayMs:       () => Math.max(5_000,  envInt('QUEUE_ORIGIN_HEAVY_DELAY_MS',  30_000)),
  /** Origin lease for heavy dispatch jobs. Min 30s. */
  heavyLeaseSecs:     () => Math.max(30,     envInt('QUEUE_ORIGIN_HEAVY_LEASE_SECONDS', 120)),
  /** Minimum ms between medium job starts per origin. Min 1000ms. */
  mediumDelayMs:      () => Math.max(1_000,  envInt('QUEUE_ORIGIN_MEDIUM_DELAY_MS', 10_000)),
  /** Origin lease for medium jobs. Min 15s. */
  mediumLeaseSecs:    () => Math.max(15,     envInt('QUEUE_ORIGIN_MEDIUM_LEASE_SECONDS', 60)),
  /** Minimum ms between light job starts per origin. Min 500ms. */
  lightDelayMs:       () => Math.max(500,    envInt('QUEUE_ORIGIN_LIGHT_DELAY_MS',  2_000)),
  /** Origin lease for light jobs. Min 10s. */
  lightLeaseSecs:     () => Math.max(10,     envInt('QUEUE_ORIGIN_LIGHT_LEASE_SECONDS', 30)),
  /** Max origin cooldown from 429 / upstream signals. 2 hours, non-configurable. */
  maxCooldownMs:      () => 2 * 60 * 60_000,
} as const;

export function getOriginLimits(weight: WebsiteJobWeight): OriginLimits {
  switch (weight) {
    case 'heavy':  return { concurrency: ORIGIN_POLICY_CONFIG.heavyConcurrency(), delayMs: ORIGIN_POLICY_CONFIG.heavyDelayMs(), leaseSecs: ORIGIN_POLICY_CONFIG.heavyLeaseSecs() };
    case 'medium': return { concurrency: 1, delayMs: ORIGIN_POLICY_CONFIG.mediumDelayMs(), leaseSecs: ORIGIN_POLICY_CONFIG.mediumLeaseSecs() };
    case 'light':  return { concurrency: 1, delayMs: ORIGIN_POLICY_CONFIG.lightDelayMs(),  leaseSecs: ORIGIN_POLICY_CONFIG.lightLeaseSecs() };
    case 'none':   return { concurrency: 0, delayMs: 0, leaseSecs: 0 };
  }
}

// ─── Policy table ─────────────────────────────────────────────────────────────
//
// Record<QueueJobType, ...> — TypeScript enforces that every QueueJobType is covered.
// Adding a new job type without adding a policy is a compile-time error.

export const EXECUTION_POLICIES: Record<QueueJobType, QueueJobExecutionPolicy> = {
  // ── Website-targeting: heavy ──────────────────────────────────────────────
  // Fires outbound HTTP to the customer's website via Cloudflare Worker.
  'analysis.run': {
    requiresOriginThrottle: true,
    weight: 'heavy',
  },
  'monitor.page_check': {
    requiresOriginThrottle: true,
    weight: 'heavy',
  },
  // ── Website-targeting: medium ─────────────────────────────────────────────
  // Fetches the root URL to discover sitemap / crawl links.
  'monitor.discovery': {
    requiresOriginThrottle: true,
    weight: 'medium',
  },
  // ── Website-targeting: light ──────────────────────────────────────────────
  // Fetches one verification resource (meta-tag or script).
  'site_connect.verify': {
    requiresOriginThrottle: true,
    weight: 'light',
  },
  // ── Internal only — no outbound customer-website requests ─────────────────
  'monitor.run': {
    requiresOriginThrottle: false,
    weight: 'none',
  },
  'alert.evaluate': {
    requiresOriginThrottle: false,
    weight: 'none',
  },
  'email.send': {
    requiresOriginThrottle: false,
    weight: 'none',
  },
  'webhook.deliver': {
    requiresOriginThrottle: false,
    weight: 'none',
  },
  'report.generate': {
    requiresOriginThrottle: false,
    weight: 'none',
  },
  'retention.cleanup': {
    requiresOriginThrottle: false,
    weight: 'none',
  },
  'site_verification.check': {
    // DNS/HTTP probe to the user's own configured domain, not a general website crawl.
    requiresOriginThrottle: false,
    weight: 'none',
  },
  'site_connect.event_process': {
    requiresOriginThrottle: false,
    weight: 'none',
  },
  'site_connect.route_candidate': {
    requiresOriginThrottle: false,
    weight: 'none',
  },
};

/**
 * Return the execution policy for a job type.
 * Throws for unregistered types — there is no default permissive policy.
 */
export function getJobExecutionPolicy(jobType: QueueJobType): QueueJobExecutionPolicy {
  const policy = EXECUTION_POLICIES[jobType];
  // This branch is unreachable given the Record type, but guard defensively.
  if (!policy) {
    throw new Error(`No execution policy defined for job type: ${jobType}`);
  }
  return policy;
}

/**
 * Verify every known QueueJobType has an execution policy.
 * Called in tests — compile-time Record<> is the primary guard.
 */
export function assertAllJobTypesHavePolicy(): void {
  const missing = QueueJobTypes.filter((t) => !(t in EXECUTION_POLICIES));
  if (missing.length > 0) {
    throw new Error(`Missing execution policy for job types: ${missing.join(', ')}`);
  }
}

/**
 * Normalize and derive the canonical origin from a URL.
 * Returns scheme + hostname + effective port, or null if invalid.
 *
 *   - lowercase hostname
 *   - default ports removed (80/http, 443/https)
 *   - credentials rejected
 *   - non-http(s) rejected
 *   - private addresses are NOT validated here (SSRF checks happen at ingestion)
 */
export function deriveNormalizedOrigin(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;

  const hostname = parsed.hostname.toLowerCase();

  let port = parsed.port;
  if ((parsed.protocol === 'http:' && port === '80') ||
      (parsed.protocol === 'https:' && port === '443')) {
    port = '';
  }

  return port ? `${parsed.protocol}//${hostname}:${port}` : `${parsed.protocol}//${hostname}`;
}

/**
 * Hash a normalized origin to a 16-char hex string suitable for Redis keys.
 * Uses the Web Crypto API (Node 18+, Edge Runtime).
 * Never store raw origins in Redis keys.
 */
export async function hashOrigin(normalizedOrigin: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizedOrigin);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}
