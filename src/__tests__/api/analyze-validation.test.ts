import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the schema used in /api/analyze/route.ts
// Testing validation logic in isolation — no HTTP, no Supabase, no Redis.
const analyzeSchema = z.object({
  url: z
    .string()
    .url('Invalid URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'URL must start with http:// or https://'
    ),
});

describe('POST /api/analyze — URL validation schema', () => {
  describe('valid URLs', () => {
    const validUrls = [
      'https://example.com',
      'http://example.com',
      'https://www.google.com',
      'https://sub.domain.example.com/path?query=1#hash',
      'https://example.com:8080',
      'http://localhost:3000',
    ];

    it.each(validUrls)('accepts "%s"', (url) => {
      const result = analyzeSchema.safeParse({ url });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('rejects missing protocol (example.com)', () => {
      const result = analyzeSchema.safeParse({ url: 'example.com' });
      expect(result.success).toBe(false);
    });

    it('rejects plain text', () => {
      const result = analyzeSchema.safeParse({ url: 'not-a-url' });
      expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
      const result = analyzeSchema.safeParse({ url: '' });
      expect(result.success).toBe(false);
    });

    it('rejects ftp:// protocol', () => {
      const result = analyzeSchema.safeParse({ url: 'ftp://example.com' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toMatch(/http/i);
      }
    });

    it('rejects missing url field entirely', () => {
      const result = analyzeSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects null', () => {
      const result = analyzeSchema.safeParse({ url: null });
      expect(result.success).toBe(false);
    });

    it('rejects javascript: protocol', () => {
      const result = analyzeSchema.safeParse({ url: 'javascript:alert(1)' });
      expect(result.success).toBe(false);
    });
  });

  describe('error messages', () => {
    it('returns "Invalid URL" for malformed input', () => {
      const result = analyzeSchema.safeParse({ url: 'not-a-url' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid URL');
      }
    });

    it('returns protocol error for ftp://', () => {
      const result = analyzeSchema.safeParse({ url: 'ftp://example.com' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('http');
      }
    });
  });
});
