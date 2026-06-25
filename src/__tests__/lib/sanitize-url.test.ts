import { describe, it, expect } from 'vitest';

// ─── Inline sanitizeResourceUrl from resources.ts ────────────────────────────
const SENSITIVE_PARAM_RE =
  /^(token|auth|key|secret|password|pass|api[_-]?key|access[_-]?token|session|sess|jwt|bearer|sig|signature|hash|nonce|csrf|state|client[_-]?secret|refresh[_-]?token)$/i;

function sanitizeResourceUrl(rawUrl: string, base: string): string {
  try {
    const u = new URL(rawUrl, base);
    for (const k of [...u.searchParams.keys()]) {
      if (SENSITIVE_PARAM_RE.test(k)) u.searchParams.set(k, '[redacted]');
    }
    const s = u.toString();
    return s.length > 180 ? s.slice(0, 177) + '…' : s;
  } catch {
    return rawUrl.slice(0, 100);
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('sanitizeResourceUrl', () => {
  const BASE = 'https://example.com';

  it('passes through clean URLs unchanged', () => {
    const url = 'https://cdn.example.com/assets/app.js?v=1.2.3';
    expect(sanitizeResourceUrl(url, BASE)).toBe(url);
  });

  it('redacts token param', () => {
    const url = 'https://api.example.com/resource?token=abc123&foo=bar';
    const result = sanitizeResourceUrl(url, BASE);
    expect(result).toContain('token=%5Bredacted%5D');
    expect(result).not.toContain('abc123');
    expect(result).toContain('foo=bar');
  });

  it('redacts auth param (case-insensitive)', () => {
    const result = sanitizeResourceUrl('https://cdn.example.com/img.jpg?AUTH=secret', BASE);
    expect(result).not.toContain('secret');
    expect(result).toContain('%5Bredacted%5D');
  });

  it('redacts key param', () => {
    const result = sanitizeResourceUrl('https://maps.api.com/embed?key=MY_API_KEY', BASE);
    expect(result).not.toContain('MY_API_KEY');
  });

  it('redacts api_key param', () => {
    const result = sanitizeResourceUrl('https://cdn.example.com/track?api_key=12345&v=2', BASE);
    expect(result).not.toContain('12345');
  });

  it('redacts api-key param (hyphen variant)', () => {
    const result = sanitizeResourceUrl('https://cdn.example.com/track?api-key=abc', BASE);
    expect(result).not.toContain('abc');
  });

  it('redacts access_token param', () => {
    const result = sanitizeResourceUrl('https://cdn.example.com/file?access_token=SECRET123', BASE);
    expect(result).not.toContain('SECRET123');
  });

  it('redacts access-token param (hyphen variant)', () => {
    const result = sanitizeResourceUrl('https://cdn.example.com/file?access-token=SECRET456', BASE);
    expect(result).not.toContain('SECRET456');
  });

  it('redacts jwt param', () => {
    const result = sanitizeResourceUrl('https://cdn.example.com/data?jwt=eyJhbGciOiJIUzI1NiJ9', BASE);
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts session param', () => {
    const result = sanitizeResourceUrl('https://cdn.example.com/img?session=sess_xyz', BASE);
    expect(result).not.toContain('sess_xyz');
  });

  it('redacts csrf param', () => {
    const result = sanitizeResourceUrl('https://cdn.example.com/action?csrf=csrf-val&lang=en', BASE);
    expect(result).not.toContain('csrf-val');
    expect(result).toContain('lang=en');
  });

  it('redacts nonce param', () => {
    const result = sanitizeResourceUrl('https://cdn.example.com/js?nonce=n123&ver=5', BASE);
    expect(result).not.toContain('n123');
  });

  it('redacts signature param', () => {
    const result = sanitizeResourceUrl('https://cdn.example.com/signed?signature=abc&file=x', BASE);
    expect(result).not.toContain('abc');
    expect(result).toContain('file=x');
  });

  it('redacts refresh_token param', () => {
    const result = sanitizeResourceUrl('https://api.example.com/token?refresh_token=rt123', BASE);
    expect(result).not.toContain('rt123');
  });

  it('redacts multiple sensitive params in one URL', () => {
    const result = sanitizeResourceUrl(
      'https://cdn.example.com/file?token=t1&key=k2&lang=en',
      BASE,
    );
    expect(result).not.toContain('t1');
    expect(result).not.toContain('k2');
    expect(result).toContain('lang=en');
  });

  it('preserves non-sensitive params alongside sensitive ones', () => {
    const result = sanitizeResourceUrl(
      'https://cdn.example.com/asset.js?version=3&token=abc&debug=true',
      BASE,
    );
    expect(result).toContain('version=3');
    expect(result).toContain('debug=true');
    expect(result).not.toContain('abc');
  });

  it('resolves relative URLs using the base', () => {
    const result = sanitizeResourceUrl('/path/to/asset.js', 'https://example.com');
    expect(result).toBe('https://example.com/path/to/asset.js');
  });

  it('truncates URLs longer than 180 characters with ellipsis', () => {
    const longParam = 'x'.repeat(200);
    const url = `https://cdn.example.com/asset.js?foo=${longParam}`;
    const result = sanitizeResourceUrl(url, BASE);
    expect(result.length).toBeLessThanOrEqual(180);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns raw URL sliced to 100 on unparseable input', () => {
    const bad = 'not a url at all $$$###';
    const result = sanitizeResourceUrl(bad, BASE);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('handles URLs with no query params', () => {
    const url = 'https://cdn.example.com/style.css';
    expect(sanitizeResourceUrl(url, BASE)).toBe(url);
  });

  it('does not redact params that merely contain sensitive words in the value', () => {
    const url = 'https://cdn.example.com/img.jpg?alt=token-image&size=large';
    const result = sanitizeResourceUrl(url, BASE);
    expect(result).toContain('token-image');
  });
});
