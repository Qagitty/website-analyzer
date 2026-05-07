import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey } from '@/lib/api-keys/generate';

describe('generateApiKey', () => {
  it('returns a key starting with wa_live_', () => {
    const { raw } = generateApiKey();
    expect(raw.startsWith('wa_live_')).toBe(true);
  });

  it('raw key is 40 chars (wa_live_ + 32 hex)', () => {
    const { raw } = generateApiKey();
    // "wa_live_" = 8 chars + 32 hex chars = 40
    expect(raw.length).toBe(40);
  });

  it('hash is 64-char hex string', () => {
    const { hash } = generateApiKey();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('prefix is first 15 chars of raw key', () => {
    const { raw, prefix } = generateApiKey();
    expect(prefix).toBe(raw.slice(0, 15));
  });

  it('two calls produce different keys', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it('hash of raw key matches returned hash', () => {
    const { raw, hash } = generateApiKey();
    expect(hashApiKey(raw)).toBe(hash);
  });
});

describe('hashApiKey', () => {
  it('produces consistent SHA-256 hash for same input', () => {
    const input = 'wa_live_abc123';
    expect(hashApiKey(input)).toBe(hashApiKey(input));
  });

  it('produces different hash for different input', () => {
    expect(hashApiKey('wa_live_aaa')).not.toBe(hashApiKey('wa_live_bbb'));
  });
});
