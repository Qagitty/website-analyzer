/**
 * Environment variable validation — §37
 *
 * Call validateEnv() once at server startup (e.g. in next.config.js or root
 * layout server component). In test environments set SKIP_ENV_VALIDATION=true
 * to bypass (CI build uses placeholder values).
 *
 * Never log the actual values — log only which variables are missing.
 */

export interface EnvConfig {
  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  // Redis
  upstashRedisUrl: string;
  upstashRedisToken: string;
  // AI
  anthropicApiKey: string;
  // Worker
  cloudflareWorkerUrl: string;
  cloudflareWorkerAuthToken: string;
  workerCallbackSecret: string;
  // Stripe
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  // App
  appUrl: string;
}

type Severity = 'required' | 'optional';

interface VarSpec {
  env: string;
  severity: Severity;
  validate?: (value: string) => string | null; // returns error message or null
}

const SPECS: VarSpec[] = [
  // Supabase
  {
    env: 'NEXT_PUBLIC_SUPABASE_URL',
    severity: 'required',
    validate: isUrl,
  },
  {
    env: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    severity: 'required',
    validate: minLength(20),
  },
  {
    env: 'SUPABASE_SERVICE_ROLE_KEY',
    severity: 'required',
    validate: minLength(20),
  },
  // Redis
  {
    env: 'UPSTASH_REDIS_URL',
    severity: 'required',
    validate: isUrl,
  },
  {
    env: 'UPSTASH_REDIS_TOKEN',
    severity: 'required',
    validate: minLength(10),
  },
  // AI
  {
    env: 'ANTHROPIC_API_KEY',
    severity: 'required',
    validate: minLength(10),
  },
  // Cloudflare Worker
  {
    env: 'CLOUDFLARE_WORKER_URL',
    severity: 'required',
    validate: isUrl,
  },
  {
    env: 'CLOUDFLARE_WORKER_AUTH_TOKEN',
    severity: 'required',
    validate: minLength(16),
  },
  {
    env: 'WORKER_CALLBACK_SECRET',
    severity: 'required',
    validate: minLength(32),
  },
  // Stripe
  {
    env: 'STRIPE_SECRET_KEY',
    severity: 'required',
    validate: (v) => (v.startsWith('sk_') ? null : 'Must start with sk_live_ or sk_test_'),
  },
  {
    env: 'STRIPE_WEBHOOK_SECRET',
    severity: 'required',
    validate: (v) => (v.startsWith('whsec_') ? null : 'Must start with whsec_'),
  },
  // App
  {
    env: 'NEXT_PUBLIC_APP_URL',
    severity: 'required',
    validate: isUrl,
  },
  // Unified Queue — optional; safe defaults in service.ts
  {
    env: 'QUEUE_GLOBAL_CONCURRENCY',
    severity: 'optional',
    validate: isPositiveInt,
  },
  {
    env: 'QUEUE_DEFAULT_LEASE_SECONDS',
    severity: 'optional',
    validate: isPositiveInt,
  },
  {
    env: 'QUEUE_DEFAULT_MAX_ATTEMPTS',
    severity: 'optional',
    validate: isPositiveInt,
  },
  {
    env: 'QUEUE_DEDUPE_TTL_SECONDS',
    severity: 'optional',
    validate: isPositiveInt,
  },
  {
    env: 'QUEUE_SCHEDULER_BATCH_SIZE',
    severity: 'optional',
    validate: isPositiveInt,
  },
  {
    env: 'QUEUE_CONSUMER_BATCH_SIZE',
    severity: 'optional',
    validate: isPositiveInt,
  },
  {
    env: 'QUEUE_ORIGIN_HEAVY_DELAY_MS',
    severity: 'optional',
    validate: isNonNegativeInt,
  },
  {
    env: 'QUEUE_JOB_RETENTION_DAYS',
    severity: 'optional',
    validate: isPositiveInt,
  },
  {
    env: 'QUEUE_DLQ_RETENTION_DAYS',
    severity: 'optional',
    validate: isPositiveInt,
  },
  // Admin API — optional (no access if not set)
  {
    env: 'ADMIN_API_SECRET',
    severity: 'optional',
    validate: minLength(32),
  },
  // Monitor tuning — optional; defaults are used if absent
  {
    env: 'MONITOR_GLOBAL_CONCURRENCY',
    severity: 'optional',
    validate: isPositiveInt,
  },
  {
    env: 'MONITOR_ORIGIN_DELAY_MS',
    severity: 'optional',
    validate: isNonNegativeInt,
  },
  {
    env: 'MONITOR_JOB_MAX_ATTEMPTS',
    severity: 'optional',
    validate: isPositiveInt,
  },
  {
    env: 'MONITOR_JOB_LEASE_SECONDS',
    severity: 'optional',
    validate: isPositiveInt,
  },
  {
    env: 'MONITOR_DISCOVERY_TIMEOUT_MS',
    severity: 'optional',
    validate: isPositiveInt,
  },
];

// ─── Validators ───────────────────────────────────────────────────────────────

function isUrl(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return `Must be an http or https URL, got: ${u.protocol}`;
    }
    return null;
  } catch {
    return 'Must be a valid URL';
  }
}

function minLength(n: number) {
  return (value: string): string | null =>
    value.length < n ? `Must be at least ${n} characters` : null;
}

function isPositiveInt(value: string): string | null {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? null : 'Must be a positive integer';
}

function isNonNegativeInt(value: string): string | null {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 ? null : 'Must be a non-negative integer';
}

// ─── Main export ─────────────────────────────────────────────────────────────

export type EnvValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

export function validateEnv(): EnvValidationResult {
  if (process.env['SKIP_ENV_VALIDATION'] === 'true') {
    return { valid: true };
  }

  const errors: string[] = [];

  for (const spec of SPECS) {
    const value = process.env[spec.env];

    if (!value) {
      if (spec.severity === 'required') {
        errors.push(`Missing required env var: ${spec.env}`);
      }
      continue;
    }

    if (spec.validate) {
      const err = spec.validate(value);
      if (err) {
        errors.push(`Invalid ${spec.env}: ${err}`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Call this at server startup. Throws if validation fails so the process
 * exits immediately rather than serving broken requests.
 */
export function assertEnv(): void {
  const result = validateEnv();
  if (!result.valid) {
    // Log variable names only — never log values
    const msg = [
      'Environment validation failed. Fix the following before starting the server:',
      ...result.errors.map((e) => `  • ${e}`),
    ].join('\n');
    console.error(msg);
    throw new Error('Invalid server configuration — see above for details.');
  }
}
