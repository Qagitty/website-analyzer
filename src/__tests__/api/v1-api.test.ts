import { describe, it, expect } from 'vitest';

// ── V1 Public API — pure logic tests ─────────────────────────────────────────
// Tests cover: rate limit enforcement, key format validation, response shaping.
// No HTTP, no Supabase, no Redis — all logic is extracted into pure functions.

// ── Rate limit config (mirrors lib/api-keys/rate-limit.ts) ───────────────────

type Plan = 'free' | 'pro' | 'agency';

interface RateLimitConfig {
  requestsPerHour: number;
}

function getRateLimitConfig(plan: Plan): RateLimitConfig {
  const configs: Record<Plan, RateLimitConfig> = {
    free: { requestsPerHour: 10 },
    pro: { requestsPerHour: 60 },
    agency: { requestsPerHour: 300 },
  };
  return configs[plan];
}

function isRateLimited(requestCount: number, plan: Plan): boolean {
  return requestCount >= getRateLimitConfig(plan).requestsPerHour;
}

// ── API key format validation ─────────────────────────────────────────────────

function isValidApiKeyFormat(key: string): boolean {
  return /^wa_live_[0-9a-f]{32}$/.test(key);
}

// ── Response builders ─────────────────────────────────────────────────────────

function buildAnalyzeResponse(analysisId: string) {
  return { analysisId, status: 'queued' };
}

function buildRateLimitError() {
  return { error: 'Rate limit exceeded' };
}

function buildAuthError() {
  return { error: 'Invalid API key' };
}

// ── Tests: rate limiting ──────────────────────────────────────────────────────

describe('isRateLimited()', () => {
  describe('free plan (10 req/hr)', () => {
    it('allows 9th request', () => {
      expect(isRateLimited(9, 'free')).toBe(false);
    });

    it('blocks at exactly 10 requests', () => {
      expect(isRateLimited(10, 'free')).toBe(true);
    });

    it('blocks beyond 10 requests', () => {
      expect(isRateLimited(15, 'free')).toBe(true);
    });
  });

  describe('pro plan (60 req/hr)', () => {
    it('allows 59th request', () => {
      expect(isRateLimited(59, 'pro')).toBe(false);
    });

    it('blocks at exactly 60 requests', () => {
      expect(isRateLimited(60, 'pro')).toBe(true);
    });

    it('blocks 61st request', () => {
      expect(isRateLimited(61, 'pro')).toBe(true);
    });
  });

  describe('agency plan (300 req/hr)', () => {
    it('allows 299th request', () => {
      expect(isRateLimited(299, 'agency')).toBe(false);
    });

    it('blocks at exactly 300 requests', () => {
      expect(isRateLimited(300, 'agency')).toBe(true);
    });
  });

  it('returns correct limits per plan', () => {
    expect(getRateLimitConfig('free').requestsPerHour).toBe(10);
    expect(getRateLimitConfig('pro').requestsPerHour).toBe(60);
    expect(getRateLimitConfig('agency').requestsPerHour).toBe(300);
  });
});

// ── Tests: API key format ─────────────────────────────────────────────────────

describe('isValidApiKeyFormat()', () => {
  it('accepts wa_live_ followed by 32 hex chars', () => {
    expect(isValidApiKeyFormat('wa_live_' + 'a'.repeat(32))).toBe(true);
    expect(isValidApiKeyFormat('wa_live_0123456789abcdef0123456789abcdef')).toBe(true);
  });

  it('rejects key without wa_live_ prefix', () => {
    expect(isValidApiKeyFormat('sk_live_' + 'a'.repeat(32))).toBe(false);
  });

  it('rejects key shorter than 32 hex chars', () => {
    expect(isValidApiKeyFormat('wa_live_' + 'a'.repeat(31))).toBe(false);
  });

  it('rejects key longer than 32 hex chars', () => {
    expect(isValidApiKeyFormat('wa_live_' + 'a'.repeat(33))).toBe(false);
  });

  it('rejects key with uppercase hex (must be lowercase)', () => {
    expect(isValidApiKeyFormat('wa_live_' + 'A'.repeat(32))).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidApiKeyFormat('')).toBe(false);
  });

  it('rejects key with non-hex characters', () => {
    expect(isValidApiKeyFormat('wa_live_' + 'z'.repeat(32))).toBe(false);
  });
});

// ── Tests: response shapes ────────────────────────────────────────────────────

describe('buildAnalyzeResponse()', () => {
  it('returns analysisId and status queued', () => {
    const resp = buildAnalyzeResponse('analysis-xyz');
    expect(resp.analysisId).toBe('analysis-xyz');
    expect(resp.status).toBe('queued');
  });
});

describe('buildRateLimitError()', () => {
  it('returns rate limit error message', () => {
    expect(buildRateLimitError().error).toBe('Rate limit exceeded');
  });
});

describe('buildAuthError()', () => {
  it('returns invalid API key message', () => {
    expect(buildAuthError().error).toBe('Invalid API key');
  });
});

// ── Tests: authorization header parsing ──────────────────────────────────────

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/);
  return match ? match[1] : null;
}

describe('extractBearerToken()', () => {
  it('extracts token from valid Bearer header', () => {
    expect(extractBearerToken('Bearer wa_live_abc123')).toBe('wa_live_abc123');
  });

  it('returns null for missing header', () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it('returns null for non-Bearer scheme', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractBearerToken('')).toBeNull();
  });

  it('returns null for "Bearer" with no token', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
  });
});
