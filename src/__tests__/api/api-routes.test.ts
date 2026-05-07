import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mutable Supabase state shared across tests ──────────────────────────────
// vi.mock() is hoisted, so we control per-test behaviour through these variables.
let mockUser: object | null = { id: 'user-123', email: 'test@example.com' };
let mockAuthError: object | null = null;
let mockRpcResult = true;
let mockInsertData: object | null = { id: 'analysis-abc' };
let mockInsertError: object | null = null;
let mockSelectData: object | null = null;
let mockSelectError: object | null = null;

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockImplementation(async () => ({
        data: { user: mockUser },
        error: mockAuthError,
      })),
    },
    rpc: vi.fn().mockImplementation(async () => ({ data: mockRpcResult, error: null })),
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(async () => ({
            data: mockInsertData,
            error: mockInsertError,
          })),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(async () => ({
            data: mockSelectData,
            error: mockSelectError,
          })),
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(async () => ({
              data: mockSelectData,
              error: mockSelectError,
            })),
          }),
        }),
        // Supports .select(...).in(...).neq(...) used for queue position counting
        in: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}));

vi.mock('@/lib/queue/redis', () => ({
  redis: {
    lpush: vi.fn().mockResolvedValue(1),
    llen: vi.fn().mockResolvedValue(1),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function resetDefaults() {
  mockUser = { id: 'user-123', email: 'test@example.com' };
  mockAuthError = null;
  mockRpcResult = true;
  mockInsertData = { id: 'analysis-abc' };
  mockInsertError = null;
  mockSelectData = null;
  mockSelectError = null;
}

function setUnauthenticated() {
  mockUser = null;
  mockAuthError = { message: 'No session' };
}

// ─── Import routes (after mocks are registered) ───────────────────────────────
import { POST as analyzePost } from '@/app/api/analyze/route';
import { GET as creditsGet } from '@/app/api/user/credits/route';
import { GET as reportGet } from '@/app/api/reports/[id]/route';

// ─── POST /api/analyze ───────────────────────────────────────────────────────
describe('POST /api/analyze', () => {
  beforeEach(resetDefaults);

  it('returns 401 when user is not authenticated', async () => {
    setUnauthenticated();
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await analyzePost(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid URL', async () => {
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url: 'not-a-url' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await analyzePost(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing url field', async () => {
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await analyzePost(req);
    expect(res.status).toBe(400);
  });

  it('returns 402 when user has no credits', async () => {
    mockRpcResult = false;
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await analyzePost(req);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toMatch(/credit/i);
  });

  it('returns 500 if analysis insert fails', async () => {
    mockInsertData = null;
    mockInsertError = { message: 'DB error' };
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await analyzePost(req);
    expect(res.status).toBe(500);
  });

  it('returns 202 with analysisId on success', async () => {
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await analyzePost(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.analysisId).toBe('analysis-abc');
    expect(body.status).toBe('queued');
  });
});

// ─── GET /api/user/credits ───────────────────────────────────────────────────
describe('GET /api/user/credits', () => {
  beforeEach(resetDefaults);

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated();
    const res = await creditsGet();
    expect(res.status).toBe(401);
  });

  it('returns 404 when settings not found', async () => {
    mockSelectData = null;
    mockSelectError = { message: 'No row' };
    const res = await creditsGet();
    expect(res.status).toBe(404);
  });

  it('returns credits and creditsUsed on success', async () => {
    mockSelectData = { credits: 7, credits_used: 2 };
    const res = await creditsGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.credits).toBe(7);
    expect(body.creditsUsed).toBe(2);
  });
});

// ─── GET /api/reports/[id] ───────────────────────────────────────────────────
describe('GET /api/reports/[id]', () => {
  beforeEach(resetDefaults);

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticated();
    const req = new NextRequest('http://localhost/api/reports/abc');
    const res = await reportGet(req, { params: { id: 'abc' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when analysis not found or belongs to another user', async () => {
    mockSelectData = null;
    mockSelectError = { message: 'Not found' };
    const req = new NextRequest('http://localhost/api/reports/nonexistent');
    const res = await reportGet(req, { params: { id: 'nonexistent' } });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Report not found');
  });

  it('returns 200 with analysis data when found', async () => {
    mockSelectData = {
      id: 'analysis-123',
      user_id: 'user-123',
      url: 'https://example.com',
      status: 'completed',
    };
    const req = new NextRequest('http://localhost/api/reports/analysis-123');
    const res = await reportGet(req, { params: { id: 'analysis-123' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('analysis-123');
    expect(body.url).toBe('https://example.com');
  });
});
