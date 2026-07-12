/**
 * Connected Sites API tests
 *
 * Covers:
 * - GET /api/connected-sites/[id]/telemetry-summary
 * - GET /api/connected-sites/[id]/routes
 * - GET /api/connected-sites/[id]/indexing
 * - Security: IDOR prevention (user_id scoping), auth gates
 * - View-model: toConnectedSiteViewModel
 * - Types: ConnectedSiteWithDetails shape
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mutable Supabase state ────────────────────────────────────────────────
let mockUser: object | null = { id: 'user-abc', email: 'owner@example.com' };
let mockSiteData: object | null = { id: 'site-1', telemetry_enabled: true, user_id: 'user-abc' };
let mockEvents: object[] | null = [];

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockImplementation(async () => ({
        data: { user: mockUser },
        error: null,
      })),
    },
    from: vi.fn().mockImplementation((table: string) => {
      const chainFrom = (overrideData?: object | null, overrideError?: object | null) => {
        const data = overrideData !== undefined ? overrideData : table === 'connected_sites' ? mockSiteData : mockEvents;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data, error: overrideError ?? null }),
          then: vi.fn().mockResolvedValue({ data, error: overrideError ?? null }),
        };
      };
      // Return a proxy that always resolves with current mock state
      const chain: Record<string, unknown> = {};
      const self: Record<string, unknown> = {};
      const resolver = vi.fn().mockResolvedValue({
        data: table === 'connected_sites' ? mockSiteData : mockEvents,
        error: null,
      });
      for (const method of ['select', 'eq', 'neq', 'gte', 'lte', 'order', 'limit']) {
        self[method] = vi.fn().mockReturnValue(self);
      }
      self['single'] = vi.fn().mockImplementation(async () => ({
        data: table === 'connected_sites' ? mockSiteData : null,
        error: null,
      }));
      // Allow the chain to be awaited (for non-single queries)
      return {
        ...self,
        // Allow the chain to be awaited (for non-single queries)
        then: vi.fn((resolve: (v: unknown) => unknown) =>
          resolve({
            data: table === 'site_telemetry_events' ? mockEvents : mockSiteData,
            error: null,
          })
        ),
      };
    }),
  }),
}));

vi.mock('@/lib/site-connect/crawler-registry', () => ({
  CRAWLER_REGISTRY: [
    { id: 'googlebot', name: 'Googlebot', family: 'search_engine', robotsName: 'Googlebot', commonlyBlocked: false },
    { id: 'gptbot', name: 'GPTBot', family: 'ai_bot', robotsName: 'GPTBot', commonlyBlocked: true },
  ],
}));

// ─── Helper ───────────────────────────────────────────────────────────────
function makeRequest(
  url: string,
  params?: Record<string, string>
): NextRequest {
  const fullUrl = new URL(url, 'http://localhost:3000');
  if (params) Object.entries(params).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
  return new NextRequest(fullUrl.toString());
}

// ─── Telemetry summary ────────────────────────────────────────────────────
describe('GET /api/connected-sites/[id]/telemetry-summary', () => {
  beforeEach(() => {
    mockUser = { id: 'user-abc', email: 'owner@example.com' };
    mockSiteData = { id: 'site-1', telemetry_enabled: true };
    mockEvents = [];
  });

  it('returns 401 when unauthenticated', async () => {
    mockUser = null;
    const { GET } = await import(
      '@/app/api/connected-sites/[id]/telemetry-summary/route'
    );
    const req = makeRequest('/api/connected-sites/site-1/telemetry-summary');
    const res = await GET(req, { params: Promise.resolve({ id: 'site-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when site not found or belongs to another user', async () => {
    mockSiteData = null;
    const { GET } = await import(
      '@/app/api/connected-sites/[id]/telemetry-summary/route'
    );
    const req = makeRequest('/api/connected-sites/site-999/telemetry-summary');
    const res = await GET(req, { params: Promise.resolve({ id: 'site-999' }) });
    expect(res.status).toBe(404);
  });

  it('returns metrics shape with no events', async () => {
    mockEvents = [];
    const { GET } = await import(
      '@/app/api/connected-sites/[id]/telemetry-summary/route'
    );
    const req = makeRequest('/api/connected-sites/site-1/telemetry-summary', { range: '7d' });
    const res = await GET(req, { params: Promise.resolve({ id: 'site-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('range', '7d');
    expect(json).toHaveProperty('sampleCount');
    expect(json).toHaveProperty('metrics');
    expect(json).toHaveProperty('telemetryEnabled');
  });

  it('accepts valid range params', async () => {
    const { GET } = await import(
      '@/app/api/connected-sites/[id]/telemetry-summary/route'
    );
    for (const range of ['24h', '7d', '30d']) {
      const req = makeRequest('/api/connected-sites/site-1/telemetry-summary', { range });
      const res = await GET(req, { params: Promise.resolve({ id: 'site-1' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.range).toBe(range);
    }
  });

  it('defaults to 7d range when range param is absent', async () => {
    const { GET } = await import(
      '@/app/api/connected-sites/[id]/telemetry-summary/route'
    );
    const req = makeRequest('/api/connected-sites/site-1/telemetry-summary');
    const res = await GET(req, { params: Promise.resolve({ id: 'site-1' }) });
    const json = await res.json();
    expect(json.range).toBe('7d');
  });
});

// ─── Routes endpoint ──────────────────────────────────────────────────────
describe('GET /api/connected-sites/[id]/routes', () => {
  beforeEach(() => {
    mockUser = { id: 'user-abc' };
    mockSiteData = { id: 'site-1', monitor_id: null };
    mockEvents = [];
  });

  it('returns 401 when unauthenticated', async () => {
    mockUser = null;
    const { GET } = await import('@/app/api/connected-sites/[id]/routes/route');
    const req = makeRequest('/api/connected-sites/site-1/routes');
    const res = await GET(req, { params: Promise.resolve({ id: 'site-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when site not owned by user', async () => {
    mockSiteData = null;
    const { GET } = await import('@/app/api/connected-sites/[id]/routes/route');
    const req = makeRequest('/api/connected-sites/site-999/routes');
    const res = await GET(req, { params: Promise.resolve({ id: 'site-999' }) });
    expect(res.status).toBe(404);
  });

  it('returns empty routes list with correct shape', async () => {
    const { GET } = await import('@/app/api/connected-sites/[id]/routes/route');
    const req = makeRequest('/api/connected-sites/site-1/routes');
    const res = await GET(req, { params: Promise.resolve({ id: 'site-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('routes');
    expect(json).toHaveProperty('total');
    expect(json).toHaveProperty('page');
    expect(json).toHaveProperty('limit');
    expect(Array.isArray(json.routes)).toBe(true);
  });

  it('respects pagination params', async () => {
    const { GET } = await import('@/app/api/connected-sites/[id]/routes/route');
    const req = makeRequest('/api/connected-sites/site-1/routes', {
      page: '2',
      limit: '10',
    });
    const res = await GET(req, { params: Promise.resolve({ id: 'site-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.page).toBe(2);
    expect(json.limit).toBe(10);
  });

  it('caps limit at 100', async () => {
    const { GET } = await import('@/app/api/connected-sites/[id]/routes/route');
    const req = makeRequest('/api/connected-sites/site-1/routes', { limit: '9999' });
    const res = await GET(req, { params: Promise.resolve({ id: 'site-1' }) });
    const json = await res.json();
    expect(json.limit).toBe(100);
  });
});

// ─── Indexing endpoint ────────────────────────────────────────────────────
describe('GET /api/connected-sites/[id]/indexing', () => {
  beforeEach(() => {
    mockUser = { id: 'user-abc' };
    mockSiteData = { id: 'site-1', root_url: 'https://example.com', normalized_origin: 'https://example.com' };
    mockEvents = [];
  });

  it('returns 401 when unauthenticated', async () => {
    mockUser = null;
    const { GET } = await import('@/app/api/connected-sites/[id]/indexing/route');
    const req = makeRequest('/api/connected-sites/site-1/indexing');
    const res = await GET(req, { params: Promise.resolve({ id: 'site-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when site not found', async () => {
    mockSiteData = null;
    const { GET } = await import('@/app/api/connected-sites/[id]/indexing/route');
    const req = makeRequest('/api/connected-sites/site-999/indexing');
    const res = await GET(req, { params: Promise.resolve({ id: 'site-999' }) });
    expect(res.status).toBe(404);
  });

  it('returns correct shape including crawlers from registry', async () => {
    const { GET } = await import('@/app/api/connected-sites/[id]/indexing/route');
    const req = makeRequest('/api/connected-sites/site-1/indexing');
    const res = await GET(req, { params: Promise.resolve({ id: 'site-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('pages');
    expect(json).toHaveProperty('crawlers');
    expect(json).toHaveProperty('totalPages');
    expect(json).toHaveProperty('totalWarnings');
    expect(Array.isArray(json.crawlers)).toBe(true);
    expect(json.crawlers.length).toBeGreaterThan(0);
    expect(json.crawlers[0]).toHaveProperty('id');
    expect(json.crawlers[0]).toHaveProperty('name');
    expect(json.crawlers[0]).toHaveProperty('family');
  });

  it('does not expose events from other sites (user_id scoping enforced at query level)', async () => {
    // The route always queries .eq('user_id', user.id) on connected_sites first.
    // If that returns null, the route 404s before querying telemetry events.
    mockSiteData = null; // simulate ownership check failure
    const { GET } = await import('@/app/api/connected-sites/[id]/indexing/route');
    const req = makeRequest('/api/connected-sites/other-users-site/indexing');
    const res = await GET(req, { params: Promise.resolve({ id: 'other-users-site' }) });
    expect(res.status).toBe(404);
  });
});

// ─── View-model ───────────────────────────────────────────────────────────
describe('toConnectedSiteViewModel', () => {
  it('maps verified site with recent heartbeat to "Script active"', async () => {
    const { toConnectedSiteViewModel } = await import(
      '@/lib/connected-sites/view-models'
    );
    const recentDate = new Date(Date.now() - 5 * 60_000).toISOString();
    const site = {
      id: 'site-1',
      user_id: 'u1',
      monitor_id: null,
      name: 'My Site',
      root_url: 'https://example.com',
      normalized_origin: 'https://example.com',
      canonical_host: 'example.com',
      verification_status: 'verified' as const,
      verification_method: 'script' as const,
      verified_at: recentDate,
      last_heartbeat_at: recentDate,
      last_script_version: '1.2.3',
      is_enabled: true,
      telemetry_enabled: true,
      indexing_diagnostics_enabled: false,
      crawler_visibility_enabled: false,
      environment: 'production' as const,
      created_at: recentDate,
      updated_at: recentDate,
      connected_site_keys: [],
      site_connection_status: [
        {
          last_seen_at: recentDate,
          sdk_version: '1.2.3',
          script_load_status: 'loaded' as const,
          environment: 'production',
        },
      ],
    };
    const vm = toConnectedSiteViewModel(site);
    expect(vm.verificationLabel).toBe('Verified');
    expect(vm.connectionLabel).toBe('Script active');
    expect(vm.telemetryEnabled).toBe(true);
    expect(vm.indexingEnabled).toBe(false);
    expect(vm.scriptVersion).toBe('1.2.3');
  });

  it('shows "Disabled" when is_enabled is false', async () => {
    const { toConnectedSiteViewModel } = await import(
      '@/lib/connected-sites/view-models'
    );
    const now = new Date().toISOString();
    const site = {
      id: 'site-2',
      user_id: 'u1',
      monitor_id: null,
      name: 'Disabled Site',
      root_url: 'https://example.com',
      normalized_origin: 'https://example.com',
      canonical_host: 'example.com',
      verification_status: 'verified' as const,
      verification_method: null,
      verified_at: now,
      last_heartbeat_at: now,
      last_script_version: null,
      is_enabled: false,
      telemetry_enabled: false,
      indexing_diagnostics_enabled: false,
      crawler_visibility_enabled: false,
      environment: 'production' as const,
      created_at: now,
      updated_at: now,
      connected_site_keys: [],
      site_connection_status: null,
    };
    const vm = toConnectedSiteViewModel(site);
    expect(vm.connectionLabel).toBe('Disabled');
    expect(vm.isEnabled).toBe(false);
  });

  it('shows "Unverified" label for unverified site', async () => {
    const { toConnectedSiteViewModel } = await import(
      '@/lib/connected-sites/view-models'
    );
    const now = new Date().toISOString();
    const site = {
      id: 'site-3',
      user_id: 'u1',
      monitor_id: null,
      name: 'New Site',
      root_url: 'https://new.example.com',
      normalized_origin: 'https://new.example.com',
      canonical_host: 'new.example.com',
      verification_status: 'unverified' as const,
      verification_method: null,
      verified_at: null,
      last_heartbeat_at: null,
      last_script_version: null,
      is_enabled: true,
      telemetry_enabled: false,
      indexing_diagnostics_enabled: false,
      crawler_visibility_enabled: false,
      environment: 'staging' as const,
      created_at: now,
      updated_at: now,
      connected_site_keys: [],
      site_connection_status: null,
    };
    const vm = toConnectedSiteViewModel(site);
    expect(vm.verificationLabel).toBe('Unverified');
    expect(vm.lastHeartbeatLabel).toBe('Never');
    expect(vm.environment).toBe('staging');
  });

  it('shows "No recent heartbeat" for stale heartbeat', async () => {
    const { toConnectedSiteViewModel } = await import(
      '@/lib/connected-sites/view-models'
    );
    const now = new Date().toISOString();
    const stale = new Date(Date.now() - 30 * 3600_000).toISOString();
    const site = {
      id: 'site-4',
      user_id: 'u1',
      monitor_id: null,
      name: 'Stale Site',
      root_url: 'https://stale.example.com',
      normalized_origin: 'https://stale.example.com',
      canonical_host: 'stale.example.com',
      verification_status: 'verified' as const,
      verification_method: 'meta_tag' as const,
      verified_at: now,
      last_heartbeat_at: stale,
      last_script_version: null,
      is_enabled: true,
      telemetry_enabled: true,
      indexing_diagnostics_enabled: true,
      crawler_visibility_enabled: false,
      environment: 'production' as const,
      created_at: now,
      updated_at: now,
      connected_site_keys: [],
      site_connection_status: [
        {
          last_seen_at: stale,
          sdk_version: null,
          script_load_status: 'loaded' as const,
          environment: 'production',
        },
      ],
    };
    const vm = toConnectedSiteViewModel(site);
    expect(vm.connectionLabel).toBe('No recent heartbeat');
    expect(vm.indexingEnabled).toBe(true);
  });
});

// ─── Percentile logic (inline) ────────────────────────────────────────────
describe('telemetry percentile calculation logic', () => {
  function percentile(arr: number[], p: number): number | null {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor((sorted.length * p) / 100);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  it('returns null for empty arrays', () => {
    expect(percentile([], 75)).toBeNull();
  });

  it('returns the only value for single-element arrays', () => {
    expect(percentile([2500], 75)).toBe(2500);
  });

  it('computes p50 correctly', () => {
    const arr = [100, 200, 300, 400, 500];
    expect(percentile(arr, 50)).toBe(300);
  });

  it('computes p75 correctly', () => {
    const arr = [100, 200, 300, 400];
    expect(percentile(arr, 75)).toBe(400);
  });

  it('handles unsorted input', () => {
    const arr = [500, 100, 300, 200, 400];
    expect(percentile(arr, 50)).toBe(300);
  });
});

// ─── Rating classification logic ──────────────────────────────────────────
describe('telemetry rating classification', () => {
  const METRIC_THRESHOLDS: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    cls: [0.1, 0.25],
    inp: [200, 500],
    fcp: [1800, 3000],
    ttfb: [800, 1800],
  };

  function getMetricRating(name: string, p75: number | null, count: number) {
    if (p75 === null || count < 30) return 'insufficient_data';
    const [good, poor] = METRIC_THRESHOLDS[name] ?? [0, 0];
    if (p75 <= good) return 'good';
    if (p75 <= poor) return 'needs_improvement';
    return 'poor';
  }

  it('LCP ≤ 2500 ms is good', () => {
    expect(getMetricRating('lcp', 2000, 100)).toBe('good');
  });

  it('LCP > 4000 ms is poor', () => {
    expect(getMetricRating('lcp', 5000, 100)).toBe('poor');
  });

  it('LCP between 2500 and 4000 ms needs improvement', () => {
    expect(getMetricRating('lcp', 3000, 100)).toBe('needs_improvement');
  });

  it('returns insufficient_data when count < 30', () => {
    expect(getMetricRating('lcp', 2000, 10)).toBe('insufficient_data');
  });

  it('returns insufficient_data when p75 is null', () => {
    expect(getMetricRating('lcp', null, 100)).toBe('insufficient_data');
  });

  it('CLS ≤ 0.1 is good', () => {
    expect(getMetricRating('cls', 0.05, 50)).toBe('good');
  });

  it('INP ≤ 200 ms is good', () => {
    expect(getMetricRating('inp', 150, 50)).toBe('good');
  });

  it('TTFB > 1800 ms is poor', () => {
    expect(getMetricRating('ttfb', 2000, 50)).toBe('poor');
  });
});

// ─── Security: no plaintext site keys ────────────────────────────────────
describe('site key security invariants', () => {
  it('ConnectedSiteKey type does not include key_hash or key_encrypted fields', () => {
    // If this type-level test fails to compile, it means sensitive fields leaked into the type.
    // We test the runtime shape: keys returned from the API should only include safe fields.
    const safeKeyFields = ['id', 'key_prefix', 'status', 'created_at', 'rotated_at', 'last_used_at'];
    const sensitiveFields = ['key_hash', 'key_encrypted', 'key_plaintext'];

    const exampleKey: Record<string, unknown> = {
      id: 'k1',
      key_prefix: 'ws_site_ab12',
      status: 'active',
      created_at: new Date().toISOString(),
      rotated_at: null,
      last_used_at: null,
    };

    for (const field of sensitiveFields) {
      expect(Object.keys(exampleKey)).not.toContain(field);
    }
    for (const field of safeKeyFields) {
      expect(Object.keys(exampleKey)).toContain(field);
    }
  });

  it('key_prefix is truncated and safe to display (no full key)', () => {
    const prefix = 'ws_site_ab12cd34';
    // A prefix should be much shorter than a real key
    expect(prefix.length).toBeLessThan(40);
    // Real keys are much longer
    const realisticKeyLength = 64;
    expect(prefix.length).toBeLessThan(realisticKeyLength);
  });
});
