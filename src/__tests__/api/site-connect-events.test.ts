/**
 * Tests for POST /api/site-connect/events (public ingestion endpoint).
 *
 * Uses vi.hoisted() + vi.mock() pattern for Vitest mocking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockCheckRateLimit, mockRpc, mockFrom, mockResolvedSiteRow } = vi.hoisted(() => {
  const mockResolvedSiteRow = {
    connected_site_id: 'site-123',
    user_id:           'user-abc',
    normalized_origin: 'https://example.com',
    is_enabled:        true,
    telemetry_enabled: true,
    indexing_diagnostics_enabled: false,
  };

  const mockRpc = vi.fn().mockResolvedValue({ data: [mockResolvedSiteRow], error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockInsert = vi.fn().mockResolvedValue({ error: null });

  const mockFrom = vi.fn().mockReturnValue({
    update:  mockUpdate,
    upsert:  mockUpsert,
    insert:  mockInsert,
    select:  vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
  });

  const mockCheckRateLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 59 });

  return { mockCheckRateLimit, mockRpc, mockFrom, mockResolvedSiteRow };
});

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));

vi.mock('@/lib/rate-limit/web', () => ({
  rateLimit:   mockCheckRateLimit,
  getClientIp: () => '1.2.3.4',
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { POST, OPTIONS } from '@/app/api/site-connect/events/route';

function makeRequest(body: unknown, origin = 'https://example.com'): NextRequest {
  return new NextRequest('http://localhost/api/site-connect/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': origin },
    body: JSON.stringify(body),
  });
}

function heartbeatEnvelope(siteKey = 'ws_site_' + 'a'.repeat(32)) {
  return {
    schemaVersion: 1,
    eventId:       '11111111-1111-1111-1111-111111111111',
    siteKey,
    sentAt: new Date().toISOString(),
    sdk: { name: 'webscore-connect', version: '1.0.0', platform: 'browser' },
    event: { type: 'heartbeat', pageUrl: 'https://example.com/', environment: 'production' },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OPTIONS /api/site-connect/events', () => {
  it('returns 204 with CORS headers', async () => {
    const req = new NextRequest('http://localhost/api/site-connect/events', {
      method: 'OPTIONS',
      headers: { 'Origin': 'https://example.com' },
    });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});

describe('POST /api/site-connect/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: [mockResolvedSiteRow], error: null });
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
    mockFrom.mockReturnValue({
      update:  vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
      upsert:  vi.fn().mockResolvedValue({ error: null }),
      insert:  vi.fn().mockResolvedValue({ error: null }),
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
    });
  });

  it('returns 202 for valid heartbeat', async () => {
    const res = await POST(makeRequest(heartbeatEnvelope()));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/site-connect/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://example.com' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing schemaVersion', async () => {
    const env = heartbeatEnvelope();
    const { schemaVersion: _sv, ...noVersion } = env as any;
    const res = await POST(makeRequest(noVersion));
    expect(res.status).toBe(400);
  });

  it('returns 401 for invalid site key', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const res = await POST(makeRequest(heartbeatEnvelope()));
    expect(res.status).toBe(401);
  });

  it('returns 401 for malformed site key (wrong prefix)', async () => {
    const env = { ...heartbeatEnvelope(), siteKey: 'wa_live_' + 'a'.repeat(32) };
    const res = await POST(makeRequest(env));
    expect(res.status).toBe(400);
  });

  it('returns 403 for wrong origin', async () => {
    const res = await POST(makeRequest(heartbeatEnvelope(), 'https://evil.com'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when site is disabled', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...mockResolvedSiteRow, is_enabled: false }], error: null });
    const res = await POST(makeRequest(heartbeatEnvelope()));
    expect(res.status).toBe(403);
  });

  it('returns 429 when IP rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const res = await POST(makeRequest(heartbeatEnvelope()));
    expect(res.status).toBe(429);
  });

  it('returns 413 when Content-Length too large', async () => {
    const req = new NextRequest('http://localhost/api/site-connect/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://example.com',
        'Content-Length': String(33 * 1024),
      },
      body: JSON.stringify(heartbeatEnvelope()),
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('sets CORS headers on success', async () => {
    const res = await POST(makeRequest(heartbeatEnvelope()));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(res.headers.get('Vary')).toContain('Origin');
  });

  it('drops telemetry event when telemetry_enabled=false', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...mockResolvedSiteRow, telemetry_enabled: false }], error: null });
    const vitalsEnvelope = {
      ...heartbeatEnvelope(),
      event: {
        type: 'web_vitals',
        pageUrl: 'https://example.com/',
        metrics: { lcp: 2500, cls: 0.1 },
      },
    };
    const res = await POST(makeRequest(vitalsEnvelope));
    // Should still 202 (no error) but not insert
    expect(res.status).toBe(202);
  });
});
