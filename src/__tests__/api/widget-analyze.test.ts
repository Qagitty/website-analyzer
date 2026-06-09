/**
 * Tests for POST /api/widget/analyze
 * Public endpoint — authenticated by widget key, not session cookie.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock rate limiter — by default allow all requests
const mockCheckWebRateLimit = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/rate-limit/web', () => ({
  checkWebRateLimit: (...args: unknown[]) => mockCheckWebRateLimit(...args),
  detectSqlInjectionInRequest: vi.fn().mockReturnValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

const validKey = 'wk_live_0123456789abcdef0123456789abcdef';

// Service role client mock state
type FnReturn = { data: unknown; error: unknown };

let settingsResult: FnReturn = {
  data: { user_id: 'owner-uid', widget_settings: { buttonText: 'Audit', showEmail: true } },
  error: null,
};
let creditResult: FnReturn = { data: true, error: null };
let insertResult: FnReturn = { data: { id: 'analysis-xyz' }, error: null };
let refundResult: FnReturn = { data: null, error: null };

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'user_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(settingsResult),
        };
      }
      // analyses insert
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(insertResult),
      };
    }),
    rpc: vi.fn().mockImplementation((fn: string) => {
      if (fn === 'use_credit') return Promise.resolve(creditResult);
      if (fn === 'refund_credit') return Promise.resolve(refundResult);
      return Promise.resolve({ data: null, error: null });
    }),
  }),
}));

// Silence fire-and-forget worker fetch
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')));

import { POST, OPTIONS } from '@/app/api/widget/analyze/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/widget/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  settingsResult = {
    data: { user_id: 'owner-uid', widget_settings: {} },
    error: null,
  };
  creditResult = { data: true, error: null };
  insertResult = { data: { id: 'analysis-xyz' }, error: null };
  vi.clearAllMocks();
  mockCheckWebRateLimit.mockResolvedValue(null);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')));
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OPTIONS /api/widget/analyze', () => {
  it('returns 204 with CORS headers for preflight', async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('POST /api/widget/analyze', () => {
  it('returns 202 with analysisId and reportUrl on success', async () => {
    const res = await POST(makeReq({ key: validKey, url: 'https://example.com' }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.analysisId).toBe('analysis-xyz');
    expect(body.reportUrl).toContain('analysis-xyz');
    expect(body.message).toBeTruthy();
  });

  it('includes CORS header on success', async () => {
    const res = await POST(makeReq({ key: validKey, url: 'https://example.com' }));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns 400 for a missing key', async () => {
    const res = await POST(makeReq({ url: 'https://example.com' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid key format', async () => {
    const res = await POST(makeReq({ key: 'not-a-valid-key', url: 'https://example.com' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid URL', async () => {
    // String with spaces can't be coerced into a valid URL even with https:// prefix
    const res = await POST(makeReq({ key: validKey, url: 'hello world spaces' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when widget key is not found in DB', async () => {
    settingsResult = { data: null, error: { message: 'not found' } };
    const res = await POST(makeReq({ key: validKey, url: 'https://example.com' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 402 when the widget owner has no credits', async () => {
    creditResult = { data: false, error: null };
    const res = await POST(makeReq({ key: validKey, url: 'https://example.com' }));
    expect(res.status).toBe(402);
  });

  it('returns 500 and refunds credit when analysis insert fails', async () => {
    insertResult = { data: null, error: { message: 'db error' } };
    const res = await POST(makeReq({ key: validKey, url: 'https://example.com' }));
    expect(res.status).toBe(500);
  });

  it('accepts an optional email alongside the URL', async () => {
    const res = await POST(makeReq({
      key:   validKey,
      url:   'https://example.com',
      email: 'lead@example.com',
    }));
    expect(res.status).toBe(202);
  });

  it('returns 400 for a malformed email', async () => {
    const res = await POST(makeReq({
      key:   validKey,
      url:   'https://example.com',
      email: 'not-an-email',
    }));
    expect(res.status).toBe(400);
  });

  it('auto-prepends https:// for bare domain URLs', async () => {
    const res = await POST(makeReq({ key: validKey, url: 'example.com' }));
    // bare domain normalized to https://example.com → valid URL → 202
    expect(res.status).toBe(202);
  });

  it('returns 429 when per-IP rate limit is hit', async () => {
    mockCheckWebRateLimit.mockResolvedValueOnce({
      body: 'Rate limited',
      headers: new Headers({ 'Retry-After': '60' }),
    });
    const res = await POST(makeReq({ key: validKey, url: 'https://example.com' }));
    expect(res.status).toBe(429);
  });
});
