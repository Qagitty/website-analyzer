import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockIn = vi.fn();
const mockRange = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

// Chain builder — each method returns an object with all query methods
function makeChain(terminal: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    update: vi.fn(() => chain),
    range: vi.fn(() => chain),
    ...terminal,
  };
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock('@/lib/stripe/plans', () => ({
  PLAN_CREDITS: { free: 3, pro: 100, agency: 99_999 },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): Request {
  return new Request('http://localhost/api/cron/reset-credits', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/cron/reset-credits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  it('returns 401 when authorization header is missing', async () => {
    const { GET } = await import('@/app/api/cron/reset-credits/route');
    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when authorization header is wrong', async () => {
    const { GET } = await import('@/app/api/cron/reset-credits/route');
    const res = await GET(makeRequest('Bearer wrong-secret') as any);
    expect(res.status).toBe(401);
  });

  it('returns 200 with reset count when there are no free users', async () => {
    // First page returns empty — loop exits immediately
    const subscriptionsChain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue({
      select: vi.fn(() => subscriptionsChain),
      update: vi.fn(() => subscriptionsChain),
    });
    subscriptionsChain.eq = vi.fn(() => subscriptionsChain);
    subscriptionsChain.range = vi.fn(() => Promise.resolve({ data: [], error: null }));

    const { GET } = await import('@/app/api/cron/reset-credits/route');
    const res = await GET(makeRequest('Bearer test-secret') as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reset).toBe(0);
    expect(body.creditsPerUser).toBe(3);
  });

  it('returns 200 and correct reset count for a single page of free users', async () => {
    const freeUsers = [
      { user_id: 'u1' },
      { user_id: 'u2' },
      { user_id: 'u3' },
    ];

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              range: vi.fn(() =>
                Promise.resolve(
                  callCount++ === 0
                    ? { data: freeUsers, error: null }  // first page
                    : { data: [], error: null }          // second page (terminates)
                )
              ),
            })),
          })),
        };
      }
      // user_settings update
      return {
        update: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    const { GET } = await import('@/app/api/cron/reset-credits/route');
    const res = await GET(makeRequest('Bearer test-secret') as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reset).toBe(3);
    expect(body.creditsPerUser).toBe(3);
  });

  it('returns 500 when the subscriptions fetch fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              range: vi.fn(() =>
                Promise.resolve({ data: null, error: { message: 'DB unavailable' } })
              ),
            })),
          })),
        };
      }
      return {};
    });

    const { GET } = await import('@/app/api/cron/reset-credits/route');
    const res = await GET(makeRequest('Bearer test-secret') as any);
    expect(res.status).toBe(500);
  });

  it('returns 500 when the user_settings update fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              range: vi.fn(() =>
                Promise.resolve({ data: [{ user_id: 'u1' }], error: null })
              ),
            })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          in: vi.fn(() =>
            Promise.resolve({ error: { message: 'Update failed' } })
          ),
        })),
      };
    });

    const { GET } = await import('@/app/api/cron/reset-credits/route');
    const res = await GET(makeRequest('Bearer test-secret') as any);
    expect(res.status).toBe(500);
  });
});
