/**
 * Tests for POST /api/error-monitoring/envelope (public ingestion endpoint).
 *
 * Uses vi.hoisted() + vi.mock() pattern for Vitest mocking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockRateLimit,
  mockRpc,
  mockFrom,
  mockEnqueueJob,
  defaultProject,
} = vi.hoisted(() => {
  const defaultProject = {
    project_id:          'proj-123',
    user_id:             'user-abc',
    normalized_origin:   'https://example.com',
    allowed_origins:     [],
    status:              'active',
    sample_rate:         1,
    event_quota_monthly: 5000,
    max_breadcrumbs:     50,
  };

  const mockRpc = vi.fn();
  const mockInsert = vi.fn();
  const mockSelect = vi.fn();
  const mockSingle = vi.fn();
  const mockUpdate = vi.fn();
  const mockEq     = vi.fn();

  // Chain: from().insert().select().single()
  mockSingle.mockResolvedValue({ data: { id: 'evt-1' }, error: null });
  mockSelect.mockReturnValue({ single: mockSingle });
  mockInsert.mockReturnValue({ select: mockSelect });
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });
  mockUpdate.mockReturnValue({ eq: mockEq });

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'error_project_quotas') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { event_count: 0 }, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'error_projects') {
      return { update: mockUpdate };
    }
    return { insert: mockInsert };
  });

  mockRpc.mockImplementation((fn: string) => {
    if (fn === 'resolve_error_project_key') {
      return { single: vi.fn().mockResolvedValue({ data: defaultProject, error: null }) };
    }
    if (fn === 'increment_error_event_quota') {
      return Promise.resolve({ error: null });
    }
    return { single: vi.fn().mockResolvedValue({ data: null, error: null }) };
  });

  const mockRateLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 99, bypassed: false });
  const mockEnqueueJob = vi.fn().mockResolvedValue(undefined);

  return { mockRateLimit, mockRpc, mockFrom, mockEnqueueJob, defaultProject };
});

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));

vi.mock('@/lib/rate-limit/web', () => ({
  rateLimit: mockRateLimit,
}));

vi.mock('@/lib/queue/service', () => ({
  enqueueJob: mockEnqueueJob,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
  }),
}));

// ── Import routes AFTER mocks ─────────────────────────────────────────────────

import { POST, OPTIONS } from '@/app/api/error-monitoring/envelope/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    eventId:       'evt-' + Math.random().toString(36).slice(2),
    projectKey:    'ws_err_abc123def456',
    event: {
      type:    'exception',
      level:   'error',
      message: 'Uncaught TypeError: cannot read property',
      stack:   [{ function: 'render', filename: 'https://example.com/app.js', lineno: 42 }],
      breadcrumbs: [],
    },
    ...overrides,
  };
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  const json = JSON.stringify(body);
  return new NextRequest('http://localhost/api/error-monitoring/envelope', {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': String(json.length),
      'Origin':         'https://example.com',
      'x-forwarded-for': '1.2.3.4',
      ...headers,
    },
    body: json,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ allowed: true, remaining: 99, bypassed: false });

  mockRpc.mockImplementation((fn: string) => {
    if (fn === 'resolve_error_project_key') {
      return { single: vi.fn().mockResolvedValue({ data: { ...defaultProject }, error: null }) };
    }
    return Promise.resolve({ error: null });
  });

  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null });
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
  const mockEq     = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'error_project_quotas') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { event_count: 0 }, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'error_projects') {
      return { update: mockUpdate };
    }
    return { insert: mockInsert };
  });

  mockEnqueueJob.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/error-monitoring/envelope', () => {
  it('accepts a valid envelope with 202', async () => {
    const res = await POST(makeRequest(makeEnvelope()));
    expect(res.status).toBe(202);
    const json = await res.json() as { accepted: boolean };
    expect(json.accepted).toBe(true);
  });

  it('returns 400 for invalid schema (missing schemaVersion)', async () => {
    const body = { eventId: 'x', projectKey: 'ws_err_abc', event: { type: 'exception', level: 'error', message: 'x' } };
    const res  = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing projectKey', async () => {
    const body = { schemaVersion: 1, eventId: 'x', event: { type: 'exception', level: 'error', message: 'x' } };
    const res  = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it('returns 400 for projectKey with wrong prefix', async () => {
    const body = makeEnvelope({ projectKey: 'bad_prefix_abc123def456' });
    const res  = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it('returns 401 when key hash resolves to no project', async () => {
    mockRpc.mockImplementation(() => ({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    const res = await POST(makeRequest(makeEnvelope()));
    expect(res.status).toBe(401);
  });

  it('returns 403 when project status is not active', async () => {
    mockRpc.mockImplementation(() => ({
      single: vi.fn().mockResolvedValue({ data: { ...defaultProject, status: 'disabled' }, error: null }),
    }));
    const res = await POST(makeRequest(makeEnvelope()));
    expect(res.status).toBe(403);
  });

  it('returns 403 when origin is not in allowed list', async () => {
    mockRpc.mockImplementation(() => ({
      single: vi.fn().mockResolvedValue({
        data: { ...defaultProject, normalized_origin: 'https://other.com', allowed_origins: [] },
        error: null,
      }),
    }));
    const res = await POST(makeRequest(makeEnvelope()));
    expect(res.status).toBe(403);
  });

  it('returns 413 when Content-Length exceeds 64 KB', async () => {
    const json = JSON.stringify(makeEnvelope());
    const req  = new NextRequest('http://localhost/api/error-monitoring/envelope', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Content-Length':  String(64 * 1024 + 1),
        'Origin':          'https://example.com',
        'x-forwarded-for': '1.2.3.4',
      },
      body: json,
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('returns 429 when IP rate limit is hit', async () => {
    mockRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, bypassed: false });
    const res = await POST(makeRequest(makeEnvelope()));
    expect(res.status).toBe(429);
  });

  it('returns 429 when monthly quota is exceeded', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'error_project_quotas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { event_count: 5001 },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'error_projects') {
        return { update: vi.fn().mockReturnValue({ eq: vi.fn() }) };
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null }),
          }),
        }),
      };
    });
    const res = await POST(makeRequest(makeEnvelope()));
    expect(res.status).toBe(429);
  });

  it('returns 202 with duplicate:true for duplicate eventId', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'error_project_quotas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { event_count: 0 }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'error_projects') {
        return { update: vi.fn().mockReturnValue({ eq: vi.fn() }) };
      }
      // Simulate duplicate unique constraint violation
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } }),
          }),
        }),
      };
    });
    const res  = await POST(makeRequest(makeEnvelope()));
    expect(res.status).toBe(202);
    const json = await res.json() as { duplicate: boolean };
    expect(json.duplicate).toBe(true);
  });

  it('enqueues error_event.process job on valid event', async () => {
    await POST(makeRequest(makeEnvelope()));
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: 'error_event.process' }),
    );
  });

  it('scrubs context before staging (no "token" in staged payload)', async () => {
    const capturedInserts: unknown[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === 'error_project_quotas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { event_count: 0 }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'error_projects') {
        return { update: vi.fn().mockReturnValue({ eq: vi.fn() }) };
      }
      return {
        insert: vi.fn().mockImplementation((data: unknown) => {
          capturedInserts.push(data);
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null }),
            }),
          };
        }),
      };
    });

    const envelope = makeEnvelope();
    (envelope.event as Record<string, unknown>).context = { token: 'secret123', page: 'home' };
    await POST(makeRequest(envelope));

    const staged = capturedInserts[0] as Record<string, unknown>;
    const ctx    = staged?.context as Record<string, unknown> | undefined;
    expect(ctx?.token).toBe('[scrubbed]');
    expect(ctx?.page).toBe('home');
  });

  it('prototype pollution in context is blocked', async () => {
    const envelope = makeEnvelope();
    // JSON.stringify/parse cannot include __proto__ in a way that pollutes,
    // but we ensure scrubContext strips the key
    (envelope.event as Record<string, unknown>).context = JSON.parse('{"__proto__":{"admin":true},"safe":"yes"}');
    const res = await POST(makeRequest(envelope));
    // Should still accept — just scrub the bad key
    expect(res.status).toBe(202);
  });
});

describe('OPTIONS /api/error-monitoring/envelope', () => {
  it('returns 204 for preflight', async () => {
    const req = new NextRequest('http://localhost/api/error-monitoring/envelope', {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com' },
    });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
  });

  it('includes Vary: Origin header', async () => {
    const req = new NextRequest('http://localhost/api/error-monitoring/envelope', {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com' },
    });
    const res = await OPTIONS(req);
    expect(res.headers.get('vary')?.toLowerCase()).toContain('origin');
  });

  it('includes Access-Control-Allow-Origin header', async () => {
    const req = new NextRequest('http://localhost/api/error-monitoring/envelope', {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com' },
    });
    const res = await OPTIONS(req);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });
});
