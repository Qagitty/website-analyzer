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

  it('encrypted output is v2 format: "v2:<iv>.<ciphertext>.<authtag>" (SE4 — PBKDF2 KDF)', () => {
    const stored = encryptApiKey('wa_live_test');
    expect(stored.startsWith('v2:')).toBe(true);
    const [iv, ct, tag] = stored.slice(3).split('.');
    expect(iv).toMatch(/^[0-9a-f]+$/);  // iv hex  (12 bytes = 24 chars)
    expect(ct).toMatch(/^[0-9a-f]+$/);  // ciphertext hex
    expect(tag).toMatch(/^[0-9a-f]+$/); // auth tag hex
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
    // SE7 — decryptApiKey returns null on GCM auth failures instead of throwing.
    const stored = encryptApiKey('wa_live_test');
    expect(stored.startsWith('v2:')).toBe(true);
    const [iv, ct, tag] = stored.slice(3).split('.');
    const tampered = `v2:${iv}.${ct}ff.${tag}`; // corrupt ciphertext
    expect(decryptApiKey(tampered)).toBeNull();
  });

  it('decrypts legacy v1 format (SHA-256 KDF) for backward compatibility', () => {
    // v1 keys already in the DB must still decrypt after the SE4 PBKDF2 upgrade.
    const crypto = require('crypto');
    const secret = process.env.API_KEY_ENCRYPTION_SECRET!;
    const legacyKey = crypto.createHash('sha256').update(secret).digest();
    const raw = 'wa_live_legacy_key_test_value_xyz';
    const iv  = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', legacyKey, iv);
    const enc  = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
    const v1stored = `${iv.toString('hex')}.${enc.toString('hex')}.${cipher.getAuthTag().toString('hex')}`;
    // Must NOT start with 'v2:' (that's what triggers PBKDF2 path)
    expect(v1stored.startsWith('v2:')).toBe(false);
    expect(decryptApiKey(v1stored)).toBe(raw);
  });
});
