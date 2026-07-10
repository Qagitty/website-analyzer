/**
 * Tests for /api/monitors/[id]/pages — list, add, remove pages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Supabase mock setup ──────────────────────────────────────────────────────

const mockUser = { id: 'user-1' };

function makeChain(returnData: unknown, returnError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ['from', 'select', 'insert', 'upsert', 'update', 'delete',
    'eq', 'neq', 'order', 'limit', 'single', 'head'];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  // terminal
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: returnData, error: returnError });
  (chain.select as ReturnType<typeof vi.fn>).mockReturnValue({
    ...chain,
    // Make select also resolve for list queries
    then: (fn: (v: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(fn({ data: returnData, error: returnError })),
  });
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));
vi.mock('@/lib/security/url-validator', () => ({
  validateAnalysisUrl: (url: string) => ({
    valid: url.startsWith('https://') || url.startsWith('http://'),
  }),
}));
vi.mock('@/lib/billing/limits', () => ({
  getLimits: () => ({ crawlPages: 10 }),
  hasFeature: () => true,
  featureGateError: (f: string) => ({ error: `requires ${f}` }),
}));

import { createServerClient } from '@/lib/supabase/server';

function setupSupabase({
  user = mockUser,
  monitor = { id: 'mon-1', user_id: 'user-1' },
  pages = [] as unknown[],
  sub = { plan: 'pro' },
  pageCount = 0,
}: {
  user?: { id: string } | null;
  monitor?: unknown;
  pages?: unknown[];
  sub?: unknown;
  pageCount?: number;
} = {}) {
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : 'no user' }) },
    from: vi.fn().mockImplementation((table: string) => ({
      select: vi.fn().mockImplementation(() => {
        const chain = {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            if (table === 'monitors') return Promise.resolve({ data: monitor, error: null });
            if (table === 'subscriptions') return Promise.resolve({ data: sub, error: null });
            if (table === 'monitor_pages') return Promise.resolve({ data: pages[0] ?? null, error: null });
            return Promise.resolve({ data: null, error: null });
          }),
          // list resolve
          then: (fn: (v: { data: unknown[]; error: null; count?: number }) => unknown) =>
            Promise.resolve(fn({ data: pages, error: null, count: pageCount })),
        };
        return chain;
      }),
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'page-1', url: 'https://example.com/about' }, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        then: (fn: (v: { error: null }) => unknown) => Promise.resolve(fn({ error: null })),
      }),
    })),
  };
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);
  return supabase;
}

// ── Import routes after mocks are set ────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe('GET /api/monitors/[id]/pages', () => {
  it('returns 401 for unauthenticated requests', async () => {
    setupSupabase({ user: null });
    const { GET } = await import('@/app/api/monitors/[id]/pages/route');
    const req = new NextRequest('http://localhost/api/monitors/mon-1/pages');
    const res = await GET(req, { params: { id: 'mon-1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when monitor does not belong to user', async () => {
    setupSupabase({ monitor: null });
    const { GET } = await import('@/app/api/monitors/[id]/pages/route');
    const req = new NextRequest('http://localhost/api/monitors/mon-1/pages');
    const res = await GET(req, { params: { id: 'mon-1' } });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/monitors/[id]/pages', () => {
  it('returns 400 for invalid URL', async () => {
    setupSupabase();
    const { POST } = await import('@/app/api/monitors/[id]/pages/route');
    const req = new NextRequest('http://localhost/api/monitors/mon-1/pages', {
      method: 'POST',
      body: JSON.stringify({ url: 'not-a-url' }),
    });
    const res = await POST(req, { params: { id: 'mon-1' } });
    expect(res.status).toBe(400);
  });

  it('rejects private/blocked URLs via SSRF check', async () => {
    setupSupabase();
    const { POST } = await import('@/app/api/monitors/[id]/pages/route');
    const req = new NextRequest('http://localhost/api/monitors/mon-1/pages', {
      method: 'POST',
      body: JSON.stringify({ url: 'ftp://not-allowed.com' }),
    });
    const res = await POST(req, { params: { id: 'mon-1' } });
    expect(res.status).toBe(400);
  });

  it('enforces plan page limit', async () => {
    setupSupabase({ pageCount: 10 }); // already at limit
    const { POST } = await import('@/app/api/monitors/[id]/pages/route');
    const req = new NextRequest('http://localhost/api/monitors/mon-1/pages', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/page' }),
    });
    const res = await POST(req, { params: { id: 'mon-1' } });
    expect(res.status).toBe(402);
  });
});

describe('DELETE /api/monitors/[id]/pages/[pageId]', () => {
  it('refuses to delete root page', async () => {
    setupSupabase({ pages: [{ id: 'pg-1', page_type: 'root', monitor_id: 'mon-1' }] });
    const { DELETE } = await import('@/app/api/monitors/[id]/pages/[pageId]/route');
    const req = new NextRequest('http://localhost/api/monitors/mon-1/pages/pg-1', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: 'mon-1', pageId: 'pg-1' } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('root');
  });
});
