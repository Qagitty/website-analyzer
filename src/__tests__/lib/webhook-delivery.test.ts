import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch before importing the module
const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
global.fetch = mockFetch;

import { deliverWebhook, WebhookPayload } from '@/lib/webhooks/deliver';

const basePayload: WebhookPayload = {
  event: 'analysis.completed',
  analysisId: 'analysis-123',
  url: 'https://example.com',
  scores: { performance: 85, accessibility: 90, seo: 88, bestPractices: 92 },
  reportUrl: 'https://app.example.com/reports/analysis-123',
  timestamp: new Date().toISOString(),
};

beforeEach(() => {
  mockFetch.mockClear();
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
});

describe('deliverWebhook', () => {
  it('calls fetch with correct URL and method POST', async () => {
    const url = 'https://hooks.example.com/test';
    await deliverWebhook(url, 'secret', basePayload);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [calledUrl, options] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe(url);
    expect(options.method).toBe('POST');
  });

  it('sets X-WebAnalyzer-Signature header', async () => {
    await deliverWebhook('https://hooks.example.com/test', 'mysecret', basePayload);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-WebAnalyzer-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('sets X-WebAnalyzer-Event header matching the event', async () => {
    await deliverWebhook('https://hooks.example.com/test', 'secret', basePayload);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-WebAnalyzer-Event']).toBe('analysis.completed');
  });

  it('sends JSON body with correct payload for non-Slack URL', async () => {
    await deliverWebhook('https://hooks.example.com/test', 'secret', basePayload);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.event).toBe('analysis.completed');
    expect(body.analysisId).toBe('analysis-123');
    expect(body.url).toBe('https://example.com');
  });

  it('sends Slack Block Kit format for hooks.slack.com URL', async () => {
    await deliverWebhook('https://hooks.slack.com/services/T00/B00/xxx', 'secret', basePayload);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.blocks).toBeDefined();
  });

  it('Slack payload has blocks array', async () => {
    await deliverWebhook('https://hooks.slack.com/services/T00/B00/xxx', 'secret', basePayload);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(Array.isArray(body.blocks)).toBe(true);
    expect(body.blocks.length).toBeGreaterThan(0);
  });

  it('Slack payload contains report URL button when reportUrl provided', async () => {
    await deliverWebhook(
      'https://hooks.slack.com/services/T00/B00/xxx',
      'secret',
      { ...basePayload, reportUrl: 'https://app.example.com/reports/abc' }
    );
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    // Find the actions block with a button that has the reportUrl
    const actionsBlock = body.blocks.find((b: any) => b.type === 'actions');
    expect(actionsBlock).toBeDefined();
    const button = actionsBlock.elements?.[0];
    expect(button?.url).toBe('https://app.example.com/reports/abc');
  });
});
