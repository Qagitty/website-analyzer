import { describe, it, expect, beforeEach } from 'vitest';
import { generateApiKey, hashApiKey, encryptApiKey, decryptApiKey } from '@/lib/api-keys/generate';

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

describe('encryptApiKey / decryptApiKey', () => {
  beforeEach(() => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'test-secret-for-unit-tests-only-32chars!!';
  });

  it('round-trips: decrypt(encrypt(raw)) === raw', () => {
    const raw = 'wa_live_abc1234567890abcdef123456';
    const stored = encryptApiKey(raw);
    expect(decryptApiKey(stored)).toBe(raw);
  });

  it('encrypted output has three dot-separated segments (iv.ciphertext.authtag)', () => {
    const stored = encryptApiKey('wa_live_test');
    const parts = stored.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]+$/); // iv hex
    expect(parts[1]).toMatch(/^[0-9a-f]+$/); // ciphertext hex
    expect(parts[2]).toMatch(/^[0-9a-f]+$/); // auth tag hex
  });

  it('two encryptions of the same value produce different ciphertexts (random IV)', () => {
    const raw = 'wa_live_same_key';
    expect(encryptApiKey(raw)).not.toBe(encryptApiKey(raw));
  });

  it('both results still decrypt correctly despite different IVs', () => {
    const raw = 'wa_live_same_key';
    expect(decryptApiKey(encryptApiKey(raw))).toBe(raw);
    expect(decryptApiKey(encryptApiKey(raw))).toBe(raw);
  });

  it('throws when API_KEY_ENCRYPTION_SECRET is not set', () => {
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    expect(() => encryptApiKey('wa_live_test')).toThrow('API_KEY_ENCRYPTION_SECRET is not set');
  });

  it('returns null on tampered ciphertext (auth tag mismatch)', () => {
    // SE7 — decryptApiKey now returns null on parse errors instead of throwing.
    const stored = encryptApiKey('wa_live_test');
    const [iv, ct, tag] = stored.split('.');
    const tampered = `${iv}.${ct}ff.${tag}`; // corrupt ciphertext
    expect(decryptApiKey(tampered)).toBeNull();
  });
});
