/**
 * Structured JSON logger with correlation ID support — §51, §52
 *
 * Rules:
 * - Every log entry is valid JSON on a single line.
 * - Secrets, tokens, cookies, full HTML, full prompts, and personal data
 *   must NEVER appear in log output (§51).
 * - A correlationId threads through all log calls for a single request
 *   (user request → dispatch → Worker → callback → AI → PDF → notify).
 *
 * Usage:
 *   const logger = createLogger({ correlationId: req.headers.get('x-correlation-id') });
 *   logger.info('analyze.start', { url: 'https://...', userId: 'uuid' });
 *   logger.error('analyze.failed', { errorCode: 'WORKER_TIMEOUT' });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  // Identity / scope
  correlationId?: string;
  analysisId?: string;
  pageId?: string;
  monitorId?: string;
  runId?: string;
  userId?: string;

  // Operation context
  category?: string;
  operation?: string;
  status?: 'started' | 'completed' | 'failed' | 'skipped';
  duration?: number;   // milliseconds
  errorCode?: string;
  errorMessage?: string;

  // Arbitrary additional fields (will be merged into the log entry)
  [key: string]: unknown;
}

interface LogEntry extends LogFields {
  ts: string;
  level: LogLevel;
  event: string;
  env: string;
  appVersion: string;
}

// ─── Forbidden field names that should never appear in logs ──────────────────
const FORBIDDEN_FIELDS = new Set([
  'password', 'secret', 'token', 'apiKey', 'api_key', 'authToken', 'auth_token',
  'cookie', 'sessionId', 'session_id', 'accessToken', 'access_token',
  'privateKey', 'private_key', 'credential', 'credentials',
  'stripeSecretKey', 'supabaseServiceRoleKey', 'anthropicApiKey',
  'workerAuthToken', 'workerCallbackSecret', 'webhookSecret',
  'authorization', 'x-api-key', 'x-callback-signature',
]);

function stripForbidden(fields: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      safe[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 2000) {
      // Prevent full HTML / full prompts from reaching the log
      safe[key] = value.slice(0, 200) + `…[truncated ${value.length - 200} chars]`;
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

// ─── Logger class ────────────────────────────────────────────────────────────

export class Logger {
  private baseFields: LogFields;

  constructor(fields: LogFields = {}) {
    this.baseFields = fields;
  }

  private write(level: LogLevel, event: string, fields: LogFields = {}): void {
    const merged = { ...this.baseFields, ...fields };
    const safeFields = stripForbidden(merged as Record<string, unknown>);

    const entry: LogEntry = {
      ts:         new Date().toISOString(),
      level,
      event,
      env:        process.env['NODE_ENV'] ?? 'unknown',
      appVersion: process.env['APP_VERSION'] ?? 'unknown',
      ...safeFields,
    };

    const line = JSON.stringify(entry);

    if (level === 'error' || level === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  debug(event: string, fields?: LogFields): void { this.write('debug', event, fields); }
  info (event: string, fields?: LogFields): void { this.write('info',  event, fields); }
  warn (event: string, fields?: LogFields): void { this.write('warn',  event, fields); }
  error(event: string, fields?: LogFields): void { this.write('error', event, fields); }

  /** Return a child logger with additional base fields (e.g. correlationId, analysisId). */
  child(fields: LogFields): Logger {
    return new Logger({ ...this.baseFields, ...fields });
  }

  /** Start a timer; call the returned function to log the duration automatically. */
  startTimer(event: string, fields?: LogFields): () => void {
    const start = Date.now();
    this.info(`${event}.started`, { ...fields, status: 'started' });
    return () => {
      this.info(`${event}.completed`, {
        ...fields,
        status: 'completed',
        duration: Date.now() - start,
      });
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createLogger(fields: LogFields = {}): Logger {
  return new Logger(fields);
}

/** Default app-level logger (no request context). */
export const logger = createLogger({
  env:        process.env['NODE_ENV'] ?? 'unknown',
  appVersion: process.env['APP_VERSION'] ?? 'unknown',
});
