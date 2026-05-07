import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the Zod schema from /api/monitors/route.ts
// Tests run in isolation — no HTTP, no Supabase, no Redis.
const monitorSchema = z.object({
  url: z
    .string()
    .trim()
    .url('Invalid URL')
    .refine((u) => u.startsWith('http://') || u.startsWith('https://')),
  frequency: z.enum(['daily', 'weekly']).default('weekly'),
  notify_on_score_drop: z.boolean().default(true),
  score_drop_threshold: z.number().int().min(1).max(50).default(10),
});

// ── URL validation ────────────────────────────────────────────────────────────
describe('POST /api/monitors — URL validation', () => {
  it('accepts a valid https URL', () => {
    const result = monitorSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid http URL', () => {
    const result = monitorSchema.safeParse({ url: 'http://example.com' });
    expect(result.success).toBe(true);
  });

  it('trims whitespace from URL', () => {
    const result = monitorSchema.safeParse({ url: '  https://example.com  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe('https://example.com');
    }
  });

  it('rejects URL without protocol', () => {
    const result = monitorSchema.safeParse({ url: 'example.com' });
    expect(result.success).toBe(false);
  });

  it('rejects ftp:// protocol', () => {
    const result = monitorSchema.safeParse({ url: 'ftp://example.com' });
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    const result = monitorSchema.safeParse({ url: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing url field', () => {
    const result = monitorSchema.safeParse({ frequency: 'daily' });
    expect(result.success).toBe(false);
  });
});

// ── frequency validation ──────────────────────────────────────────────────────
describe('POST /api/monitors — frequency validation', () => {
  it('accepts "daily"', () => {
    const result = monitorSchema.safeParse({ url: 'https://example.com', frequency: 'daily' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.frequency).toBe('daily');
  });

  it('accepts "weekly"', () => {
    const result = monitorSchema.safeParse({ url: 'https://example.com', frequency: 'weekly' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.frequency).toBe('weekly');
  });

  it('defaults to "weekly" when omitted', () => {
    const result = monitorSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.frequency).toBe('weekly');
  });

  it('rejects invalid frequency value', () => {
    const result = monitorSchema.safeParse({ url: 'https://example.com', frequency: 'monthly' });
    expect(result.success).toBe(false);
  });

  it('rejects numeric frequency', () => {
    const result = monitorSchema.safeParse({ url: 'https://example.com', frequency: 7 });
    expect(result.success).toBe(false);
  });
});

// ── notify_on_score_drop validation ──────────────────────────────────────────
describe('POST /api/monitors — notify_on_score_drop', () => {
  it('accepts true', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com', notify_on_score_drop: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notify_on_score_drop).toBe(true);
  });

  it('accepts false', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com', notify_on_score_drop: false });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notify_on_score_drop).toBe(false);
  });

  it('defaults to true when omitted', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notify_on_score_drop).toBe(true);
  });

  it('rejects string "true"', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com', notify_on_score_drop: 'true' });
    expect(r.success).toBe(false);
  });
});

// ── score_drop_threshold validation ──────────────────────────────────────────
describe('POST /api/monitors — score_drop_threshold', () => {
  it('accepts value of 1 (minimum)', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com', score_drop_threshold: 1 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.score_drop_threshold).toBe(1);
  });

  it('accepts value of 50 (maximum)', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com', score_drop_threshold: 50 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.score_drop_threshold).toBe(50);
  });

  it('accepts value of 10', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com', score_drop_threshold: 10 });
    expect(r.success).toBe(true);
  });

  it('defaults to 10 when omitted', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.score_drop_threshold).toBe(10);
  });

  it('rejects 0 (below minimum)', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com', score_drop_threshold: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects 51 (above maximum)', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com', score_drop_threshold: 51 });
    expect(r.success).toBe(false);
  });

  it('rejects non-integer (float)', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com', score_drop_threshold: 5.5 });
    expect(r.success).toBe(false);
  });

  it('rejects string value', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com', score_drop_threshold: '10' });
    expect(r.success).toBe(false);
  });
});

// ── full valid payload ────────────────────────────────────────────────────────
describe('POST /api/monitors — full valid payloads', () => {
  it('accepts a complete valid payload', () => {
    const r = monitorSchema.safeParse({
      url: 'https://example.com',
      frequency: 'daily',
      notify_on_score_drop: true,
      score_drop_threshold: 15,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({
        url: 'https://example.com',
        frequency: 'daily',
        notify_on_score_drop: true,
        score_drop_threshold: 15,
      });
    }
  });

  it('applies all defaults when only URL is provided', () => {
    const r = monitorSchema.safeParse({ url: 'https://example.com' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.frequency).toBe('weekly');
      expect(r.data.notify_on_score_drop).toBe(true);
      expect(r.data.score_drop_threshold).toBe(10);
    }
  });

  it('accepts notify=false with threshold (threshold still validated even if not notifying)', () => {
    const r = monitorSchema.safeParse({
      url: 'https://example.com',
      notify_on_score_drop: false,
      score_drop_threshold: 25,
    });
    expect(r.success).toBe(true);
  });
});
