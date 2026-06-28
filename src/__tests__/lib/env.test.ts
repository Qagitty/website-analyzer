/**
 * Environment variable validation — §37
 *
 * Tests that validateEnv() and assertEnv() correctly enforce required variables,
 * format rules, and secret-length minimums.
 * Does NOT test with real secret values — always uses synthetic inputs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateEnv, assertEnv } from '@/lib/env';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type EnvSnapshot = Record<string, string | undefined>;

const VALID_ENV: EnvSnapshot = {
  NEXT_PUBLIC_SUPABASE_URL:       'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
  SUPABASE_SERVICE_ROLE_KEY:      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service',
  UPSTASH_REDIS_URL:              'https://test.upstash.io',
  UPSTASH_REDIS_TOKEN:            'AYQKabc123def456ghi',
  ANTHROPIC_API_KEY:              'sk-ant-test-key-placeholder-abc123',
  CLOUDFLARE_WORKER_URL:          'https://analyzer.test.workers.dev',
  CLOUDFLARE_WORKER_AUTH_TOKEN:   'at-least-sixteen-chars-token-here',
  WORKER_CALLBACK_SECRET:         'at-least-thirty-two-chars-secret-here-xyz',
  STRIPE_SECRET_KEY:              'sk_test_placeholder_key_here',
  STRIPE_WEBHOOK_SECRET:          'whsec_placeholder_secret_here',
  NEXT_PUBLIC_APP_URL:            'https://test.example.com',
};

let savedEnv: EnvSnapshot = {};

beforeEach(() => {
  // Snapshot the current env
  savedEnv = {};
  for (const key of Object.keys(VALID_ENV)) {
    savedEnv[key] = process.env[key];
  }
  savedEnv['SKIP_ENV_VALIDATION'] = process.env['SKIP_ENV_VALIDATION'];

  // Remove skip flag and load valid env
  delete process.env['SKIP_ENV_VALIDATION'];
  for (const [k, v] of Object.entries(VALID_ENV)) {
    process.env[k] = v;
  }
});

afterEach(() => {
  // Restore all env vars
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('validateEnv — valid configuration', () => {
  it('returns valid=true when all required vars are present and correct', () => {
    const result = validateEnv();
    expect(result.valid).toBe(true);
  });

  it('returns valid=true when SKIP_ENV_VALIDATION=true (regardless of other vars)', () => {
    process.env['SKIP_ENV_VALIDATION'] = 'true';
    delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const result = validateEnv();
    expect(result.valid).toBe(true);
  });
});

// ─── Missing required vars ────────────────────────────────────────────────────

describe('validateEnv — missing required vars', () => {
  const REQUIRED_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'UPSTASH_REDIS_URL',
    'UPSTASH_REDIS_TOKEN',
    'ANTHROPIC_API_KEY',
    'CLOUDFLARE_WORKER_URL',
    'CLOUDFLARE_WORKER_AUTH_TOKEN',
    'WORKER_CALLBACK_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_APP_URL',
  ];

  for (const varName of REQUIRED_VARS) {
    it(`returns valid=false when ${varName} is missing`, () => {
      delete process.env[varName];
      const result = validateEnv();
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.includes(varName))).toBe(true);
      }
    });
  }
});

// ─── Format validation ────────────────────────────────────────────────────────

describe('validateEnv — format validation', () => {
  it('rejects NEXT_PUBLIC_SUPABASE_URL that is not a URL', () => {
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'not-a-url';
    const result = validateEnv();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('NEXT_PUBLIC_SUPABASE_URL'))).toBe(true);
    }
  });

  it('rejects UPSTASH_REDIS_URL that is not a URL', () => {
    process.env['UPSTASH_REDIS_URL'] = 'redis://localhost:6379';
    // The validator checks for http/https — redis:// should fail
    const result = validateEnv();
    expect(result.valid).toBe(false);
  });

  it('rejects STRIPE_SECRET_KEY not starting with sk_', () => {
    process.env['STRIPE_SECRET_KEY'] = 'pk_test_should_not_work';
    const result = validateEnv();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('STRIPE_SECRET_KEY'))).toBe(true);
    }
  });

  it('rejects STRIPE_WEBHOOK_SECRET not starting with whsec_', () => {
    process.env['STRIPE_WEBHOOK_SECRET'] = 'wrong_prefix_secret';
    const result = validateEnv();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('STRIPE_WEBHOOK_SECRET'))).toBe(true);
    }
  });

  it('rejects WORKER_CALLBACK_SECRET shorter than 32 chars', () => {
    process.env['WORKER_CALLBACK_SECRET'] = 'too-short';
    const result = validateEnv();
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('WORKER_CALLBACK_SECRET'))).toBe(true);
    }
  });

  it('rejects CLOUDFLARE_WORKER_AUTH_TOKEN shorter than 16 chars', () => {
    process.env['CLOUDFLARE_WORKER_AUTH_TOKEN'] = 'short';
    const result = validateEnv();
    expect(result.valid).toBe(false);
  });
});

// ─── assertEnv ────────────────────────────────────────────────────────────────

describe('assertEnv', () => {
  it('does not throw when config is valid', () => {
    expect(() => assertEnv()).not.toThrow();
  });

  it('throws when a required var is missing', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    expect(() => assertEnv()).toThrow('Invalid server configuration');
  });

  it('error message does not contain secret values', () => {
    process.env['STRIPE_SECRET_KEY'] = 'pk_wrong_format_value';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      assertEnv();
    } catch {
      // expected
    }
    // The logged error must not contain the actual value
    const logged = consoleSpy.mock.calls.flat().join('\n');
    expect(logged).not.toContain('pk_wrong_format_value');
    consoleSpy.mockRestore();
  });
});
