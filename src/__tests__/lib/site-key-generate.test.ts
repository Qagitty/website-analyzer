import { describe, it, expect } from 'vitest';
import {
  generateSiteKey,
  hashSiteKey,
  revealSiteKey,
  isSiteKeyFormat,
  generateVerificationToken,
  hashVerificationToken,
  revealVerificationToken,
} from '@/lib/site-keys/generate';

describe('generateSiteKey', () => {
  it('returns correct structure', () => {
    const { raw, hash, prefix, encrypted } = generateSiteKey();
    expect(typeof raw).toBe('string');
    expect(typeof hash).toBe('string');
    expect(typeof prefix).toBe('string');
    expect(typeof encrypted).toBe('string');
  });

  it('raw key matches expected format', () => {
    const { raw } = generateSiteKey();
    expect(raw).toMatch(/^ws_site_[0-9a-f]{32}$/);
  });

  it('prefix is the first 16 chars', () => {
    const { raw, prefix } = generateSiteKey();
    expect(prefix).toBe(raw.slice(0, 16));
  });

  it('generates unique keys each time', () => {
    const a = generateSiteKey();
    const b = generateSiteKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
    expect(a.encrypted).not.toBe(b.encrypted);
  });

  it('hash is deterministic', () => {
    const { raw } = generateSiteKey();
    expect(hashSiteKey(raw)).toBe(hashSiteKey(raw));
  });

  it('hash differs from raw', () => {
    const { raw, hash } = generateSiteKey();
    expect(hash).not.toBe(raw);
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe('revealSiteKey', () => {
  it('round-trips through encrypt/reveal', () => {
    const { raw, encrypted } = generateSiteKey();
    const revealed = revealSiteKey(encrypted);
    expect(revealed).toBe(raw);
  });

  it('returns null for garbage input', () => {
    expect(revealSiteKey('not-encrypted')).toBeNull();
  });
});

describe('isSiteKeyFormat', () => {
  it('accepts valid format', () => {
    const { raw } = generateSiteKey();
    expect(isSiteKeyFormat(raw)).toBe(true);
  });

  it('rejects wrong prefix', () => {
    expect(isSiteKeyFormat('wa_live_' + 'a'.repeat(32))).toBe(false);
  });

  it('rejects too short', () => {
    expect(isSiteKeyFormat('ws_site_abc')).toBe(false);
  });

  it('rejects with uppercase hex', () => {
    expect(isSiteKeyFormat('ws_site_' + 'A'.repeat(32))).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSiteKeyFormat('')).toBe(false);
  });
});

describe('generateVerificationToken', () => {
  it('raw token is 48 hex chars', () => {
    const { raw } = generateVerificationToken();
    expect(raw).toMatch(/^[0-9a-f]{48}$/);
  });

  it('generates unique tokens', () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a.raw).not.toBe(b.raw);
  });

  it('hash is deterministic', () => {
    const { raw } = generateVerificationToken();
    expect(hashVerificationToken(raw)).toBe(hashVerificationToken(raw));
  });

  it('round-trips through encrypt/reveal', () => {
    const { raw, encrypted } = generateVerificationToken();
    expect(revealVerificationToken(encrypted)).toBe(raw);
  });

  it('revealVerificationToken returns null for garbage', () => {
    expect(revealVerificationToken('garbage')).toBeNull();
  });
});
