import { describe, it, expect } from 'vitest';
import { cn, getScoreColor, getScoreBgColor, formatBytes } from '@/lib/utils';

describe('cn()', () => {
  it('merges simple class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('deduplicates conflicting tailwind classes (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles conditional falsy values', () => {
    expect(cn('base', false && 'skip', undefined, null, 'end')).toBe('base end');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles object syntax', () => {
    expect(cn({ 'font-bold': true, italic: false })).toBe('font-bold');
  });
});

describe('getScoreColor()', () => {
  it('returns green for score >= 90', () => {
    expect(getScoreColor(90)).toBe('text-green-600');
    expect(getScoreColor(100)).toBe('text-green-600');
    expect(getScoreColor(95)).toBe('text-green-600');
  });

  it('returns yellow for score 50–89', () => {
    expect(getScoreColor(50)).toBe('text-yellow-600');
    expect(getScoreColor(75)).toBe('text-yellow-600');
    expect(getScoreColor(89)).toBe('text-yellow-600');
  });

  it('returns red for score below 50', () => {
    expect(getScoreColor(0)).toBe('text-red-600');
    expect(getScoreColor(49)).toBe('text-red-600');
  });

  it('handles boundary value 90 as green', () => {
    expect(getScoreColor(90)).toBe('text-green-600');
  });

  it('handles boundary value 50 as yellow', () => {
    expect(getScoreColor(50)).toBe('text-yellow-600');
  });
});

describe('getScoreBgColor()', () => {
  it('returns green bg for score >= 90', () => {
    expect(getScoreBgColor(90)).toBe('bg-green-100 text-green-800');
    expect(getScoreBgColor(100)).toBe('bg-green-100 text-green-800');
  });

  it('returns yellow bg for score 50–89', () => {
    expect(getScoreBgColor(50)).toBe('bg-yellow-100 text-yellow-800');
    expect(getScoreBgColor(89)).toBe('bg-yellow-100 text-yellow-800');
  });

  it('returns red bg for score below 50', () => {
    expect(getScoreBgColor(0)).toBe('bg-red-100 text-red-800');
    expect(getScoreBgColor(49)).toBe('bg-red-100 text-red-800');
  });
});

describe('formatBytes()', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats bytes in the KB range', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10240)).toBe('10.0 KB');
  });

  it('formats bytes in the MB range', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  it('boundary: exactly 1 KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
  });

  it('boundary: exactly 1 MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });
});
