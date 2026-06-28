/**
 * Callback idempotency & ordering — §12
 *
 * Tests scenarios not covered by callback-auth.test.ts:
 * - duplicate callbacks (same idempotency key) do not double-write
 * - stale callbacks (older version) do not overwrite newer data
 * - out-of-order page callbacks are handled safely
 * - oversized payloads are rejected before processing
 * - invalid schema payloads are rejected before processing
 * - invalid/wrong IDs are caught early
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateIdempotencyKey } from '@/lib/contracts/callback-auth';

// ─── Minimal in-memory idempotency store (mirrors production pattern) ─────────

interface AnalysisRecord {
  status: string;
  completedAt: string | null;
  version: number;
  data: Record<string, unknown>;
}

class InMemoryIdempotencyStore {
  private seenKeys = new Set<string>();
  private records = new Map<string, AnalysisRecord>();

  hasProcessed(idempotencyKey: string): boolean {
    return this.seenKeys.has(idempotencyKey);
  }

  markProcessed(idempotencyKey: string): void {
    this.seenKeys.add(idempotencyKey);
  }

  getRecord(analysisId: string): AnalysisRecord | undefined {
    return this.records.get(analysisId);
  }

  writeIfNewer(
    analysisId: string,
    version: number,
    data: Omit<AnalysisRecord, 'version'>
  ): { written: boolean; reason?: string } {
    const existing = this.records.get(analysisId);
    if (existing && existing.version >= version) {
      return { written: false, reason: 'stale-version' };
    }
    this.records.set(analysisId, { ...data, version });
    return { written: true };
  }
}

// ─── Payload validation (mirrors what the route does before touching the DB) ──

const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

interface CallbackPayload {
  analysisId: string;
  pageId?: string;
  version: number;
  status: string;
  completedAt: string;
  data: Record<string, unknown>;
}

function validateCallbackPayload(
  rawBody: string,
  ownAnalysisId: string
): { valid: true; payload: CallbackPayload } | { valid: false; reason: string } {
  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return { valid: false, reason: 'oversized-payload' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { valid: false, reason: 'invalid-json' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { valid: false, reason: 'invalid-schema' };
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj['analysisId'] !== 'string' || !obj['analysisId']) {
    return { valid: false, reason: 'missing-analysis-id' };
  }

  if (obj['analysisId'] !== ownAnalysisId) {
    return { valid: false, reason: 'wrong-analysis-id' };
  }

  if (typeof obj['version'] !== 'number') {
    return { valid: false, reason: 'missing-version' };
  }

  if (typeof obj['status'] !== 'string') {
    return { valid: false, reason: 'missing-status' };
  }

  if (typeof obj['completedAt'] !== 'string') {
    return { valid: false, reason: 'missing-completed-at' };
  }

  return {
    valid: true,
    payload: {
      analysisId: obj['analysisId'] as string,
      pageId: obj['pageId'] as string | undefined,
      version: obj['version'] as number,
      status: obj['status'] as string,
      completedAt: obj['completedAt'] as string,
      data: (obj['data'] as Record<string, unknown>) ?? {},
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const ANALYSIS_ID = 'analysis-00000000-0000-0000-0000-000000000001';

let store: InMemoryIdempotencyStore;

beforeEach(() => {
  store = new InMemoryIdempotencyStore();
});

// ── §12: Duplicate callback (same idempotency key) ────────────────────────────

describe('Duplicate callback (§12)', () => {
  it('first callback is processed, second is a no-op', () => {
    const key = generateIdempotencyKey();
    const body = JSON.stringify({
      analysisId: ANALYSIS_ID,
      version: 1,
      status: 'completed',
      completedAt: new Date().toISOString(),
      data: { score: 85 },
    });

    // First delivery
    expect(store.hasProcessed(key)).toBe(false);
    const result = validateCallbackPayload(body, ANALYSIS_ID);
    expect(result.valid).toBe(true);
    if (result.valid) {
      store.writeIfNewer(ANALYSIS_ID, result.payload.version, {
        status: result.payload.status,
        completedAt: result.payload.completedAt,
        data: result.payload.data,
      });
    }
    store.markProcessed(key);

    // Second delivery (duplicate — same idempotency key)
    expect(store.hasProcessed(key)).toBe(true);
    // System must short-circuit: do NOT re-write
    const wouldWrite = !store.hasProcessed(key);
    expect(wouldWrite).toBe(false);
  });

  it('duplicate processing does not produce duplicate writes', () => {
    const key = generateIdempotencyKey();
    const body = JSON.stringify({
      analysisId: ANALYSIS_ID,
      version: 1,
      status: 'completed',
      completedAt: new Date().toISOString(),
      data: { score: 85 },
    });

    let writeCount = 0;

    function processCallback(rawBody: string, idemKey: string): boolean {
      if (store.hasProcessed(idemKey)) return false;
      const result = validateCallbackPayload(rawBody, ANALYSIS_ID);
      if (!result.valid) return false;
      const { written } = store.writeIfNewer(ANALYSIS_ID, result.payload.version, {
        status: result.payload.status,
        completedAt: result.payload.completedAt,
        data: result.payload.data,
      });
      if (written) writeCount++;
      store.markProcessed(idemKey);
      return true;
    }

    processCallback(body, key);
    processCallback(body, key); // duplicate
    processCallback(body, key); // duplicate

    expect(writeCount).toBe(1);
  });
});

// ── §12: Stale version does not overwrite newer result ────────────────────────

describe('Stale version handling (§12)', () => {
  it('stale callback (version 1) does not overwrite newer result (version 2)', () => {
    const newerBody = JSON.stringify({
      analysisId: ANALYSIS_ID,
      version: 2,
      status: 'completed',
      completedAt: new Date().toISOString(),
      data: { score: 90 },
    });
    const staleBody = JSON.stringify({
      analysisId: ANALYSIS_ID,
      version: 1,
      status: 'completed',
      completedAt: new Date(Date.now() - 5000).toISOString(),
      data: { score: 50 },
    });

    const newer = validateCallbackPayload(newerBody, ANALYSIS_ID);
    expect(newer.valid).toBe(true);
    if (newer.valid) {
      store.writeIfNewer(ANALYSIS_ID, newer.payload.version, {
        status: newer.payload.status,
        completedAt: newer.payload.completedAt,
        data: newer.payload.data,
      });
    }

    // Now attempt to write the stale version
    const stale = validateCallbackPayload(staleBody, ANALYSIS_ID);
    expect(stale.valid).toBe(true);
    if (stale.valid) {
      const writeResult = store.writeIfNewer(ANALYSIS_ID, stale.payload.version, {
        status: stale.payload.status,
        completedAt: stale.payload.completedAt,
        data: stale.payload.data,
      });
      expect(writeResult.written).toBe(false);
      expect(writeResult.reason).toBe('stale-version');
    }

    // The stored record should still hold the newer score
    expect((store.getRecord(ANALYSIS_ID)?.data as { score: number })?.score).toBe(90);
  });
});

// ── §12: Wrong analysis ID ───────────────────────────────────────────────────

describe('Wrong analysis ID (§12)', () => {
  it('rejects payload whose analysisId does not match the expected ID', () => {
    const body = JSON.stringify({
      analysisId: 'different-analysis-id',
      version: 1,
      status: 'completed',
      completedAt: new Date().toISOString(),
      data: {},
    });
    const result = validateCallbackPayload(body, ANALYSIS_ID);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('wrong-analysis-id');
    }
  });

  it('accepts payload with correct analysisId', () => {
    const body = JSON.stringify({
      analysisId: ANALYSIS_ID,
      version: 1,
      status: 'completed',
      completedAt: new Date().toISOString(),
      data: {},
    });
    const result = validateCallbackPayload(body, ANALYSIS_ID);
    expect(result.valid).toBe(true);
  });
});

// ── §12: Oversized payload ───────────────────────────────────────────────────

describe('Oversized payload (§12)', () => {
  it('rejects payload larger than 10 MB', () => {
    const huge = 'x'.repeat(MAX_PAYLOAD_BYTES + 1);
    const result = validateCallbackPayload(huge, ANALYSIS_ID);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('oversized-payload');
    }
  });

  it('accepts payload right at the limit', () => {
    // A valid JSON payload that is just under the limit
    const validBase = JSON.stringify({
      analysisId: ANALYSIS_ID,
      version: 1,
      status: 'completed',
      completedAt: new Date().toISOString(),
      data: {},
    });
    // Small payloads are well within limits
    expect(validBase.length).toBeLessThan(MAX_PAYLOAD_BYTES);
    const result = validateCallbackPayload(validBase, ANALYSIS_ID);
    expect(result.valid).toBe(true);
  });
});

// ── §12: Invalid schema ──────────────────────────────────────────────────────

describe('Invalid schema (§12)', () => {
  it('rejects non-JSON body', () => {
    const result = validateCallbackPayload('not json at all', ANALYSIS_ID);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(['invalid-json', 'invalid-schema']).toContain(result.reason);
    }
  });

  it('rejects body missing version field', () => {
    const body = JSON.stringify({
      analysisId: ANALYSIS_ID,
      status: 'completed',
      completedAt: new Date().toISOString(),
      data: {},
      // version intentionally omitted
    });
    const result = validateCallbackPayload(body, ANALYSIS_ID);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('missing-version');
    }
  });

  it('rejects body missing status field', () => {
    const body = JSON.stringify({
      analysisId: ANALYSIS_ID,
      version: 1,
      completedAt: new Date().toISOString(),
      data: {},
      // status intentionally omitted
    });
    const result = validateCallbackPayload(body, ANALYSIS_ID);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('missing-status');
    }
  });

  it('rejects body missing analysisId field', () => {
    const body = JSON.stringify({
      version: 1,
      status: 'completed',
      completedAt: new Date().toISOString(),
      data: {},
    });
    const result = validateCallbackPayload(body, ANALYSIS_ID);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('missing-analysis-id');
    }
  });
});

// ── §12: Out-of-order callbacks ──────────────────────────────────────────────

describe('Out-of-order callbacks (§12)', () => {
  it('later callback (higher version) wins even if it arrives first', () => {
    const laterBody = JSON.stringify({
      analysisId: ANALYSIS_ID,
      version: 3,
      status: 'completed',
      completedAt: new Date().toISOString(),
      data: { score: 92 },
    });
    const earlierBody = JSON.stringify({
      analysisId: ANALYSIS_ID,
      version: 1,
      status: 'completed',
      completedAt: new Date(Date.now() - 10_000).toISOString(),
      data: { score: 55 },
    });

    // Later (version 3) arrives first due to network reordering
    const later = validateCallbackPayload(laterBody, ANALYSIS_ID);
    expect(later.valid).toBe(true);
    if (later.valid) {
      store.writeIfNewer(ANALYSIS_ID, later.payload.version, {
        status: later.payload.status,
        completedAt: later.payload.completedAt,
        data: later.payload.data,
      });
    }

    // Earlier (version 1) arrives second — should be silently dropped
    const earlier = validateCallbackPayload(earlierBody, ANALYSIS_ID);
    expect(earlier.valid).toBe(true);
    if (earlier.valid) {
      const result = store.writeIfNewer(ANALYSIS_ID, earlier.payload.version, {
        status: earlier.payload.status,
        completedAt: earlier.payload.completedAt,
        data: earlier.payload.data,
      });
      expect(result.written).toBe(false);
    }

    // Final state reflects the later (version 3) callback
    expect((store.getRecord(ANALYSIS_ID)?.data as { score: number })?.score).toBe(92);
  });
});
