/**
 * Structured logger — §51, §52
 *
 * Verifies: JSON output format, forbidden field redaction, child loggers,
 * timer helpers, and that secrets never appear in log output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, Logger } from '@/lib/logger';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function captureLog(fn: () => void): string[] {
  const lines: string[] = [];
  const spyOut = vi.spyOn(console, 'log').mockImplementation((line) => lines.push(line));
  const spyErr = vi.spyOn(console, 'error').mockImplementation((line) => lines.push(line));
  fn();
  spyOut.mockRestore();
  spyErr.mockRestore();
  return lines;
}

function parseEntry(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

// ─── Output format (§51) ─────────────────────────────────────────────────────

describe('Logger output format (§51)', () => {
  it('emits valid JSON on a single line', () => {
    const lines = captureLog(() => {
      createLogger().info('test.event');
    });
    expect(lines).toHaveLength(1);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it('includes required fields: ts, level, event, env, appVersion', () => {
    const lines = captureLog(() => createLogger().info('some.event'));
    const entry = parseEntry(lines[0]);
    expect(typeof entry['ts']).toBe('string');
    expect(entry['level']).toBe('info');
    expect(entry['event']).toBe('some.event');
    expect(typeof entry['env']).toBe('string');
    expect(typeof entry['appVersion']).toBe('string');
  });

  it('maps debug/info to stdout and warn/error to stderr', () => {
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((l) => stdoutLines.push(l));
    vi.spyOn(console, 'error').mockImplementation((l) => stderrLines.push(l));

    const log = createLogger();
    log.debug('a');
    log.info('b');
    log.warn('c');
    log.error('d');

    vi.restoreAllMocks();

    expect(stdoutLines).toHaveLength(2);
    expect(stderrLines).toHaveLength(2);
    expect(parseEntry(stderrLines[0])['level']).toBe('warn');
    expect(parseEntry(stderrLines[1])['level']).toBe('error');
  });

  it('merges additional fields into the log entry', () => {
    const lines = captureLog(() =>
      createLogger().info('test.event', { analysisId: 'abc-123', duration: 42 })
    );
    const entry = parseEntry(lines[0]);
    expect(entry['analysisId']).toBe('abc-123');
    expect(entry['duration']).toBe(42);
  });

  it('ts is a valid ISO 8601 timestamp', () => {
    const lines = captureLog(() => createLogger().info('ts.test'));
    const entry = parseEntry(lines[0]);
    const d = new Date(entry['ts'] as string);
    expect(isNaN(d.getTime())).toBe(false);
  });
});

// ─── Forbidden field redaction (§51) ─────────────────────────────────────────

describe('Forbidden field redaction (§51)', () => {
  const FORBIDDEN_FIELDS = [
    'password', 'secret', 'token', 'apiKey', 'api_key',
    'authToken', 'auth_token', 'cookie', 'sessionId',
    'accessToken', 'access_token', 'privateKey', 'credential',
  ];

  for (const field of FORBIDDEN_FIELDS) {
    it(`redacts ${field} field to [REDACTED]`, () => {
      const lines = captureLog(() =>
        createLogger().info('test', { [field]: 'super-secret-value' })
      );
      const entry = parseEntry(lines[0]);
      expect(entry[field]).toBe('[REDACTED]');
      expect(JSON.stringify(entry)).not.toContain('super-secret-value');
    });
  }

  it('does not redact non-forbidden string fields', () => {
    const lines = captureLog(() =>
      createLogger().info('test', { analysisId: 'abc-123', url: 'https://example.com' })
    );
    const entry = parseEntry(lines[0]);
    expect(entry['analysisId']).toBe('abc-123');
    expect(entry['url']).toBe('https://example.com');
  });

  it('truncates oversized strings (>2000 chars) to prevent full HTML logging', () => {
    const bigValue = 'A'.repeat(5000);
    const lines = captureLog(() =>
      createLogger().info('test', { htmlContent: bigValue })
    );
    const entry = parseEntry(lines[0]);
    const logged = entry['htmlContent'] as string;
    expect(logged.length).toBeLessThan(bigValue.length);
    expect(logged).toContain('truncated');
  });
});

// ─── Child loggers (§52 correlation IDs) ─────────────────────────────────────

describe('Child loggers / correlation IDs (§52)', () => {
  it('child logger inherits base fields', () => {
    const parent = createLogger({ correlationId: 'corr-001' });
    const child = parent.child({ analysisId: 'an-001' });
    const lines = captureLog(() => child.info('child.event'));
    const entry = parseEntry(lines[0]);
    expect(entry['correlationId']).toBe('corr-001');
    expect(entry['analysisId']).toBe('an-001');
  });

  it('child fields override parent fields', () => {
    const parent = createLogger({ correlationId: 'parent-corr' });
    const child = parent.child({ correlationId: 'child-corr' });
    const lines = captureLog(() => child.info('override.test'));
    const entry = parseEntry(lines[0]);
    expect(entry['correlationId']).toBe('child-corr');
  });

  it('parent logger is not mutated when child is created', () => {
    const parent = createLogger({ correlationId: 'parent-only' });
    parent.child({ analysisId: 'child-field' });
    const lines = captureLog(() => parent.info('parent.event'));
    const entry = parseEntry(lines[0]);
    expect(entry['analysisId']).toBeUndefined();
    expect(entry['correlationId']).toBe('parent-only');
  });
});

// ─── startTimer helper ────────────────────────────────────────────────────────

describe('startTimer (§51)', () => {
  it('logs a started event and a completed event with duration', () => {
    const lines = captureLog(() => {
      const done = createLogger().startTimer('analyze.page', { analysisId: 'a-001' });
      done();
    });
    expect(lines).toHaveLength(2);
    const started   = parseEntry(lines[0]);
    const completed = parseEntry(lines[1]);
    expect(started['event']).toBe('analyze.page.started');
    expect(started['status']).toBe('started');
    expect(completed['event']).toBe('analyze.page.completed');
    expect(completed['status']).toBe('completed');
    expect(typeof completed['duration']).toBe('number');
    expect(completed['duration'] as number).toBeGreaterThanOrEqual(0);
  });
});
