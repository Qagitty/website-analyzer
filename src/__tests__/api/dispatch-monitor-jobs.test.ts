/**
 * Tests for GET /api/cron/dispatch-monitor-jobs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockPopReadyJobs = vi.fn();
vi.mock('@/lib/monitoring/queue', () => ({
  popReadyJobs: mockPopReadyJobs,
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.CLOUDFLARE_WORKER_URL = 'https://worker.example.com';
  process.env.CLOUDFLARE_WORKER_AUTH_TOKEN = 'test-worker-token';
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function makeReq(authHeader?: string) {
  return new NextRequest('http://localhost/api/cron/dispatch-monitor-jobs', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('GET /api/cron/dispatch-monitor-jobs', () => {
  it('returns 401 without valid cron secret', async () => {
    const { GET } = await import('@/app/api/cron/dispatch-monitor-jobs/route');
    const res = await GET(makeReq('Bearer wrong'));
    expect(res.status).toBe(401);
  });

  it('returns 503 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import('@/app/api/cron/dispatch-monitor-jobs/route');
    const res = await GET(makeReq());
    expect(res.status).toBe(503);
  });

  it('returns dispatched=0 when queue is empty', async () => {
    mockPopReadyJobs.mockResolvedValue([]);
    const { GET } = await import('@/app/api/cron/dispatch-monitor-jobs/route');
    const res = await GET(makeReq('Bearer test-cron-secret'));
    const body = await res.json();
    expect(body.dispatched).toBe(0);
  });

  it('dispatches ready jobs to the Cloudflare Worker', async () => {
    mockPopReadyJobs.mockResolvedValue([
      {
        analysisId: 'a1',
        url: 'https://example.com/',
        monitorId: 'mon-1',
        monitorRunId: 'run-1',
        monitorUserId: 'user-1',
        callbackUrl: 'https://app.example.com/api/analyze/callback',
        scheduledAt: Date.now() - 5_000,
      },
    ]);
    const { GET } = await import('@/app/api/cron/dispatch-monitor-jobs/route');
    const res = await GET(makeReq('Bearer test-cron-secret'));
    const body = await res.json();
    expect(body.dispatched).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://worker.example.com/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-worker-token',
        }),
      }),
    );
  });

  it('does NOT include authToken in the Worker body (security §7)', async () => {
    mockPopReadyJobs.mockResolvedValue([
      {
        analysisId: 'a1',
        url: 'https://example.com/',
        monitorId: 'mon-1',
        monitorRunId: 'run-1',
        monitorUserId: 'user-1',
        callbackUrl: 'https://app.example.com/api/analyze/callback',
        scheduledAt: Date.now() - 1_000,
      },
    ]);
    const { GET } = await import('@/app/api/cron/dispatch-monitor-jobs/route');
    await GET(makeReq('Bearer test-cron-secret'));

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body).not.toHaveProperty('authToken');
  });
});
