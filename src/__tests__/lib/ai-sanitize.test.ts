import { describe, it, expect } from 'vitest';
import {
  sanitizeUrl,
  redactSecrets,
  sanitizeSelector,
  sanitizeEvidence,
  sanitizeEvidenceItems,
  wrapUntrustedContent,
  sanitizeAxeIssues,
  sanitizeDescription,
  sanitizeTitle,
  INJECTION_RESISTANCE_SYSTEM_PROMPT,
  EVIDENCE_MAX_CHARS,
  MAX_EVIDENCE_PER_FINDING,
  DESCRIPTION_MAX_CHARS,
  TITLE_MAX_CHARS,
} from '@/lib/ai/sanitize';

// ─── sanitizeUrl ─────────────────────────────────────────────────────────────

describe('sanitizeUrl', () => {
  it('strips query params', () => {
    expect(sanitizeUrl('https://example.com/page?token=secret&foo=bar')).toBe(
      'https://example.com/page',
    );
  });

  it('strips fragment', () => {
    expect(sanitizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('strips both query and fragment', () => {
    expect(sanitizeUrl('https://example.com/page?q=test#top')).toBe(
      'https://example.com/page',
    );
  });

  it('preserves origin and path when no params', () => {
    expect(sanitizeUrl('https://example.com/about')).toBe('https://example.com/about');
  });

  it('handles bare origin (URL API appends trailing slash to pathname)', () => {
    // new URL('https://example.com').pathname === '/' — trailing slash is correct
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
  });

  it('handles invalid URL gracefully', () => {
    const result = sanitizeUrl('not-a-url?secret=abc');
    expect(result).toBe('not-a-url');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeUrl('')).toBe('');
  });
});

// ─── redactSecrets ────────────────────────────────────────────────────────────

describe('redactSecrets', () => {
  it('redacts Bearer tokens', () => {
    const input = 'Authorization: Bearer eyABC123tokenValue==';
    const result = redactSecrets(input);
    expect(result).not.toContain('eyABC123tokenValue');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts JWTs', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const result = redactSecrets(`token=${jwt}`);
    expect(result).not.toContain('eyJhbGci');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts Anthropic API keys', () => {
    const result = redactSecrets('key=sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(result).not.toContain('sk-ant-');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts OpenAI keys', () => {
    const result = redactSecrets('OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz1234');
    expect(result).not.toContain('sk-abcdefghijklmnopqrstuvwxyz1234');
  });

  it('redacts wa_live_ keys', () => {
    const result = redactSecrets('apiKey=wa_live_abcdefghijklmnopqrstuvwxyz');
    expect(result).not.toContain('wa_live_');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts GitHub tokens', () => {
    const result = redactSecrets('token=ghp_ABCdefghijklmnopqrstuvwxyz1234567890abcde');
    expect(result).not.toContain('ghp_');
  });

  it('redacts Stripe keys', () => {
    // Split across concatenation so push-protection scanners don't flag the test fixture
    const result = redactSecrets('sk_live_' + 'abcdefghijklmnopqrstuvwxyz12345678');
    expect(result).not.toContain('sk_live_');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts secret query params', () => {
    const result = redactSecrets('https://example.com/page?token=super-secret&foo=bar');
    expect(result).not.toContain('super-secret');
    expect(result).toContain('[REDACTED]');
    expect(result).toContain('foo=bar'); // non-secret preserved
  });

  it('does not alter clean text', () => {
    const clean = 'The quick brown fox jumps over the lazy dog.';
    expect(redactSecrets(clean)).toBe(clean);
  });

  it('handles empty input', () => {
    expect(redactSecrets('')).toBe('');
  });

  it('redacts AWS keys', () => {
    const result = redactSecrets('AKIAIOSFODNN7EXAMPLE');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts generic api_key=secret patterns', () => {
    const result = redactSecrets('api_key=SomeSuperSecretValue123');
    expect(result).not.toContain('SomeSuperSecretValue123');
  });
});

// ─── sanitizeSelector ─────────────────────────────────────────────────────────

describe('sanitizeSelector', () => {
  it('strips attribute values', () => {
    expect(sanitizeSelector('input[value="user@example.com"]')).toBe('input[value]');
  });

  it('strips single-quoted attribute values', () => {
    expect(sanitizeSelector("input[type='email']")).toBe('input[type]');
  });

  it('keeps attribute existence checks unchanged', () => {
    expect(sanitizeSelector('input[required]')).toBe('input[required]');
  });

  it('handles multiple attributes', () => {
    expect(sanitizeSelector('form[action="/submit"][data-user="admin"]')).toBe(
      'form[action][data-user]',
    );
  });

  it('handles plain tag selectors', () => {
    expect(sanitizeSelector('button.primary')).toBe('button.primary');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeSelector('')).toBe('');
  });
});

// ─── sanitizeEvidence ─────────────────────────────────────────────────────────

describe('sanitizeEvidence', () => {
  it('redacts secrets in evidence text', () => {
    const result = sanitizeEvidence(
      'Found token: sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ in page',
    );
    expect(result).not.toContain('sk-ant-');
    expect(result).toContain('[REDACTED]');
  });

  it('truncates to EVIDENCE_MAX_CHARS', () => {
    const longText = 'a'.repeat(EVIDENCE_MAX_CHARS + 100);
    const result = sanitizeEvidence(longText);
    expect(result.length).toBeLessThanOrEqual(EVIDENCE_MAX_CHARS + 1); // +1 for ellipsis
    expect(result.endsWith('…')).toBe(true);
  });

  it('accepts custom max chars', () => {
    // Use non-hex chars so the hex-pattern redaction doesn't consume the string first
    const text = 'G'.repeat(50);
    const result = sanitizeEvidence(text, 20);
    expect(result.length).toBeLessThanOrEqual(21);
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not truncate short clean text', () => {
    const text = 'Short clean evidence.';
    expect(sanitizeEvidence(text)).toBe(text);
  });

  it('handles empty input', () => {
    expect(sanitizeEvidence('')).toBe('');
  });
});

// ─── sanitizeEvidenceItems ────────────────────────────────────────────────────

describe('sanitizeEvidenceItems', () => {
  it('caps items at MAX_EVIDENCE_PER_FINDING', () => {
    const items = Array.from({ length: MAX_EVIDENCE_PER_FINDING + 5 }, (_, i) => ({
      type: 'node',
      content: `item-${i}`,
    }));
    const result = sanitizeEvidenceItems(items);
    expect(result).toHaveLength(MAX_EVIDENCE_PER_FINDING);
  });

  it('sanitizes content in each item', () => {
    const items = [
      { type: 'node', content: 'Bearer eyJfaketoken' },
      { type: 'selector', content: 'input[value="secret"]' },
    ];
    const result = sanitizeEvidenceItems(items);
    expect(result[0].content).not.toContain('eyJfaketoken');
    expect(result[1].content).toBe('input[value]');
  });

  it('sanitizes optional context field', () => {
    const items = [
      {
        type: 'url',
        content: 'https://example.com/page',
        context: 'api_key=secret123abc',
      },
    ];
    const result = sanitizeEvidenceItems(items);
    expect(result[0].context).not.toContain('secret123abc');
  });

  it('returns empty array for empty input', () => {
    expect(sanitizeEvidenceItems([])).toEqual([]);
  });
});

// ─── wrapUntrustedContent ─────────────────────────────────────────────────────

describe('wrapUntrustedContent', () => {
  it('wraps content in UNTRUSTED_WEBSITE_EVIDENCE tags', () => {
    const wrapped = wrapUntrustedContent('some website content');
    expect(wrapped).toContain('<UNTRUSTED_WEBSITE_EVIDENCE>');
    expect(wrapped).toContain('</UNTRUSTED_WEBSITE_EVIDENCE>');
    expect(wrapped).toContain('some website content');
  });

  it('opening tag comes before content', () => {
    const wrapped = wrapUntrustedContent('content');
    expect(wrapped.indexOf('<UNTRUSTED_WEBSITE_EVIDENCE>')).toBeLessThan(
      wrapped.indexOf('content'),
    );
  });

  it('closing tag comes after content', () => {
    const wrapped = wrapUntrustedContent('content');
    expect(wrapped.indexOf('content')).toBeLessThan(
      wrapped.indexOf('</UNTRUSTED_WEBSITE_EVIDENCE>'),
    );
  });
});

// ─── INJECTION_RESISTANCE_SYSTEM_PROMPT ──────────────────────────────────────

describe('INJECTION_RESISTANCE_SYSTEM_PROMPT', () => {
  it('instructs Claude to treat website content as untrusted', () => {
    expect(INJECTION_RESISTANCE_SYSTEM_PROMPT).toContain('UNTRUSTED');
  });

  it('mentions UNTRUSTED_WEBSITE_EVIDENCE tag name', () => {
    expect(INJECTION_RESISTANCE_SYSTEM_PROMPT).toContain('UNTRUSTED_WEBSITE_EVIDENCE');
  });

  it('is a non-empty string', () => {
    expect(INJECTION_RESISTANCE_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });
});

// ─── sanitizeAxeIssues ────────────────────────────────────────────────────────

describe('sanitizeAxeIssues', () => {
  it('strips attribute values from node selectors', () => {
    const issues = [
      { id: 'label', nodes: ['input[value="my-email@test.com"]', 'select[name="country"]'] },
    ];
    const result = sanitizeAxeIssues(issues);
    expect(result[0].nodes![0]).toBe('input[value]');
    expect(result[0].nodes![1]).toBe('select[name]');
  });

  it('redacts secrets in node selectors', () => {
    const issues = [
      { id: 'button-name', nodes: ['button[data-token="sk-ant-secret123"]'] },
    ];
    const result = sanitizeAxeIssues(issues);
    expect(result[0].nodes![0]).not.toContain('sk-ant-');
  });

  it('preserves non-node fields', () => {
    const issues = [
      { id: 'color-contrast', impact: 'serious', nodes: ['p.text'] },
    ];
    const result = sanitizeAxeIssues(issues);
    expect(result[0].id).toBe('color-contrast');
    expect(result[0].impact).toBe('serious');
  });

  it('handles issues with no nodes', () => {
    const issues = [{ id: 'html-has-lang' }];
    const result = sanitizeAxeIssues(issues as any);
    expect(result[0].nodes).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(sanitizeAxeIssues([])).toEqual([]);
  });
});

// ─── sanitizeDescription and sanitizeTitle ────────────────────────────────────

describe('sanitizeDescription', () => {
  it('truncates to DESCRIPTION_MAX_CHARS', () => {
    const long = 'x'.repeat(DESCRIPTION_MAX_CHARS + 50);
    const result = sanitizeDescription(long);
    expect(result.length).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS + 1);
  });

  it('redacts secrets', () => {
    // Split across concatenation so push-protection scanners don't flag the test fixture
    const result = sanitizeDescription('sk_live_' + 'abcdefghijklmnopqrstuvwxyz1234');
    expect(result).not.toContain('sk_live_');
  });
});

describe('sanitizeTitle', () => {
  it('truncates to TITLE_MAX_CHARS', () => {
    const long = 'T'.repeat(TITLE_MAX_CHARS + 50);
    const result = sanitizeTitle(long);
    expect(result.length).toBeLessThanOrEqual(TITLE_MAX_CHARS + 1);
  });
});
