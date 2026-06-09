/**
 * Tests for GET /api/compare/[id]
 * Validates response shape and owner-checking logic.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockUser = { id: 'user-abc', email: 'test@test.com' };

const mockComparison = {
  id: 'comp-111',
  user_id: 'user-abc',
  analysis_ids: ['anal-aaa', 'anal-bbb'],
  labels: ['mysite.com', 'competitor.com'],
  created_at: '2026-06-01T12:00:00Z',
};

const mockAnalyses = [
  {
    id: 'anal-aaa',
    url: 'https://mysite.com',
    status: 'completed',
    lighthouse_scores: { performance: 85, accessibility: 90, seo: 88, bestPractices: 92 },
    ai_insights: null,
    screenshot_url: null,
    completed_at: '2026-06-01T12:01:00Z',
    error_message: null,
  },
  {
    id: 'anal-bbb',
    url: 'https://competitor.com',
    status: 'completed',
    lighthouse_scores: { performance: 62, accessibility: 72, seo: 75, bestPractices: 78 },
    ai_insights: null,
    screenshot_url: null,
    completed_at: '2026-06-01T12:01:30Z',
    error_message: null,
  },
];

type FnReturn = {
  data: unknown;
  error: unknown;
};

let compSelectResult: FnReturn = { data: mockComparison, error: null };
let analysisSelectResult: FnReturn = { data: mockAnalyses, error: null };
let authGetUserResult = { data: { user: mockUser }, error: null };

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockImplementation(() => Promise.resolve(authGetUserResult)),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'comparisons') {
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(compSelectResult),
        };
      }
      // analyses
      return {
        select: vi.fn().mockReturnThis(),
        in:     vi.fn().mockReturnThis(),
        eq:     vi.fn().mockResolvedValue(analysisSelectResult),
      };
    }),
  }),
}));

import { GET } from '@/app/api/compare/[id]/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(id: string) {
  return new NextRequest(`http://localhost/api/compare/${id}`);
}

function makeProps(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  compSelectResult     = { data: mockComparison, error: null };
  analysisSelectResult = { data: mockAnalyses, error: null };
  authGetUserResult    = { data: { user: mockUser }, error: null };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/compare/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    authGetUserResult = { data: { user: null } as any, error: 'no auth' as any };
    const res = await GET(makeReq('comp-111'), makeProps('comp-111'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when comparison not found', async () => {
    compSelectResult = { data: null, error: { message: 'not found' } };
    const res = await GET(makeReq('comp-111'), makeProps('comp-111'));
    expect(res.status).toBe(404);
  });

  it('returns comparison with analyses in correct order', async () => {
    const res = await GET(makeReq('comp-111'), makeProps('comp-111'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toBe('comp-111');
    expect(body.analyses).toHaveLength(2);
    expect(body.analyses[0].id).toBe('anal-aaa');
    expect(body.analyses[0].label).toBe('mysite.com');
    expect(body.analyses[1].id).toBe('anal-bbb');
    expect(body.analyses[1].label).toBe('competitor.com');
  });

  it('sets allDone=true when all analyses are completed', async () => {
    const res = await GET(makeReq('comp-111'), makeProps('comp-111'));
    const body = await res.json();
    expect(body.allDone).toBe(true);
    expect(body.anyFailed).toBe(false);
  });

  it('sets anyFailed=true when at least one analysis failed', async () => {
    analysisSelectResult = {
      data: [
        { ...mockAnalyses[0] },
        { ...mockAnalyses[1], status: 'failed', error_message: 'timeout' },
      ],
      error: null,
    };
    const res = await GET(makeReq('comp-111'), makeProps('comp-111'));
    const body = await res.json();
    expect(body.anyFailed).toBe(true);
    expect(body.allDone).toBe(true);
  });

  it('sets allDone=false when some analyses still running', async () => {
    analysisSelectResult = {
      data: [
        { ...mockAnalyses[0] },
        { ...mockAnalyses[1], status: 'running', lighthouse_scores: null },
      ],
      error: null,
    };
    const res = await GET(makeReq('comp-111'), makeProps('comp-111'));
    const body = await res.json();
    expect(body.allDone).toBe(false);
  });

  it('returns lighthouse_scores from each analysis', async () => {
    const res = await GET(makeReq('comp-111'), makeProps('comp-111'));
    const body = await res.json();
    expect(body.analyses[0].lighthouse_scores.performance).toBe(85);
    expect(body.analyses[1].lighthouse_scores.performance).toBe(62);
  });
});
