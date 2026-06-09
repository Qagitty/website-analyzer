import { describe, it, expect } from 'vitest';
import { generateWidgetKey, isValidWidgetKeyFormat } from '@/lib/widget/key';

describe('generateWidgetKey', () => {
  it('generates a key with the wk_live_ prefix', () => {
    const key = generateWidgetKey();
    expect(key).toMatch(/^wk_live_/);
  });

  it('generates a key with 32 lowercase hex chars after the prefix', () => {
    const key = generateWidgetKey();
    const hex = key.replace('wk_live_', '');
    expect(hex).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique keys on each call', () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateWidgetKey()));
    expect(keys.size).toBe(20);
  });

  it('total length is wk_live_ (8) + 32 = 40 chars', () => {
    const key = generateWidgetKey();
    expect(key.length).toBe(40);
  });
});

describe('isValidWidgetKeyFormat', () => {
  it('accepts a freshly generated key', () => {
    const key = generateWidgetKey();
    expect(isValidWidgetKeyFormat(key)).toBe(true);
  });

  it('accepts a hardcoded valid key', () => {
    expect(isValidWidgetKeyFormat('wk_live_0123456789abcdef0123456789abcdef')).toBe(true);
  });

  it('rejects a key with uppercase hex chars', () => {
    expect(isValidWidgetKeyFormat('wk_live_0123456789ABCDEF0123456789ABCDEF')).toBe(false);
  });

  it('rejects a key that is too short', () => {
    expect(isValidWidgetKeyFormat('wk_live_abc123')).toBe(false);
  });

  it('rejects a key that is too long', () => {
    expect(isValidWidgetKeyFormat('wk_live_0123456789abcdef0123456789abcdef00')).toBe(false);
  });

  it('rejects a key with wrong prefix (wa_live_)', () => {
    expect(isValidWidgetKeyFormat('wa_live_0123456789abcdef0123456789abcdef')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidWidgetKeyFormat('')).toBe(false);
  });

  it('rejects a plain UUID', () => {
    expect(isValidWidgetKeyFormat('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('rejects non-hex characters in the key body', () => {
    expect(isValidWidgetKeyFormat('wk_live_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false);
  });
});
