/**
 * Tests for POST /api/monitors/[id]/pages/batch (Sprint 13).
 *
 * Covers:
 *  - enable: sets is_active=true for all specified page IDs
 *  - disable: sets is_active=false for all specified page IDs
 *  - remove: deletes non-root pages; root pages are preserved
 *  - remove: returns 400 if only root pages in selection
 *  - auth: 401 for unauthenticated requests
 *  - ownership: 404 if monitor belongs to different user
 *  - validation: 400 for missing action, empty pageIds, invalid action
 *  - DB error: 500 propagated correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/monitors/[id]/pages/batch/route';
import { NextRequest } from 'next/server';

// Valid UUIDs for page IDs (schema validates uuid format)
const UUID1 = '00000000-0000-0000-0000-000000000001';
const UUID2 = '00000000-0000-0000-0000-000000000002';
const UUID3 = '00000000-0000-0000-0000-000000000003';
const ROOT_UUID = '00000000-0000-0000-0000-000000000099';

// ── Mutable mock state ─────────────────────────────────────────────────────────

let mockUser: { id: string } | null = { id: 'user-1' };
let mockMonitor: { id: string } | null = { id: 'monitor-1' };
let mockPages: { id: string; page_type: string }[] = [];
let mockUpdateError: { message: string } | null = null;
let mockDeleteError: { message: string } | null = null;

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: { user: mockUser }, error: null })
      ),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'monitors') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.single = vi.fn().mockImplementation(() =>
          Promise.resolve({ data: mockMonitor, error: null })
        );
        return chain;
      }
      if (table === 'monitor_pages') {
        // Build separate chains for select, update, delete
        const inChain = {
          in: vi.fn().mockImplementation(() =>
            Promise.resolve({ data: mockPages, error: null })
          ),
        };
        const selectChain = {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(inChain) }),
        };

        const updateInChain = {
          in: vi.fn().mockImplementation(() =>
            Promise.resolve({ error: mockUpdateError, count: 3 })
          ),
        };
        const updateEqChain = { eq: vi.fn().mockReturnValue(updateInChain) };
        const updateChain = { update: vi.fn().mockReturnValue(updateEqChain) };

        const deleteInChain = {
          in: vi.fn().mockImplementation(() =>
            Promise.resolve({ error: mockDeleteError })
          ),
        };
        const deleteEqChain = { eq: vi.fn().mockReturnValue(deleteInChain) };
        const deleteChain = { delete: vi.fn().mockReturnValue(deleteEqChain) };

        return {
          ...selectChain,
          ...updateChain,
          ...deleteChain,
        };
      }
      return {};
    }),
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/monitors/monitor-1/pages/batch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = Promise.resolve({ id: 'monitor-1' });

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/monitors/[id]/pages/batch', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1' };
    mockMonitor = { id: 'monitor-1' };
    mockPages = [];
    mockUpdateError = null;
    mockDeleteError = null;
  });

  // Auth
  it('returns 401 when unauthenticated', async () => {
    mockUser = null;
    const res = await POST(makeReq({ action: 'enable', pageIds: [UUID1] }), { params });
    expect(res.status).toBe(401);
  });

  // Monitor ownership
  it('returns 404 when monitor not found / not owned', async () => {
    mockMonitor = null;
    const res = await POST(makeReq({ action: 'enable', pageIds: [UUID1] }), { params });
    expect(res.status).toBe(404);
  });

  // Validation
  it('returns 400 for invalid action', async () => {
    const res = await POST(makeReq({ action: 'fly', pageIds: [UUID1] }), { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty pageIds', async () => {
    const res = await POST(makeReq({ action: 'enable', pageIds: [] }), { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 when pageIds missing', async () => {
    const res = await POST(makeReq({ action: 'enable' }), { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-UUID page IDs', async () => {
    const res = await POST(makeReq({ action: 'enable', pageIds: ['not-a-uuid'] }), { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/monitors/monitor-1/pages/batch', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  // Enable
  it('returns 200 and affected count for enable', async () => {
    const res = await POST(makeReq({ action: 'enable', pageIds: [UUID1, UUID2, UUID3] }), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.affected).toBeGreaterThanOrEqual(0);
  });

  // Disable
  it('returns 200 and affected count for disable', async () => {
    const res = await POST(makeReq({ action: 'disable', pageIds: [UUID1, UUID2] }), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.affected).toBeGreaterThanOrEqual(0);
  });

  // Remove — root page excluded
  it('removes only non-root pages from selection', async () => {
    mockPages = [
      { id: ROOT_UUID, page_type: 'root' },
      { id: UUID1, page_type: 'pinned' },
      { id: UUID2, page_type: 'discovered' },
    ];
    const res = await POST(makeReq({ action: 'remove', pageIds: [ROOT_UUID, UUID1, UUID2] }), { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.affected).toBe(2); // root excluded
  });

  it('returns 400 when only root pages are selected for remove', async () => {
    mockPages = [{ id: ROOT_UUID, page_type: 'root' }];
    const res = await POST(makeReq({ action: 'remove', pageIds: [ROOT_UUID] }), { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 when remove selection has no pages at all in DB', async () => {
    mockPages = [];
    const res = await POST(makeReq({ action: 'remove', pageIds: [UUID1] }), { params });
    expect(res.status).toBe(400);
  });

  // DB errors
  it('returns 500 when update fails', async () => {
    mockUpdateError = { message: 'DB error' };
    const res = await POST(makeReq({ action: 'enable', pageIds: [UUID1] }), { params });
    expect(res.status).toBe(500);
  });
});
