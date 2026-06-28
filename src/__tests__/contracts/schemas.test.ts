/**
 * §35 — Contract tests for shared schemas.
 * §4  — Every top-level payload carries schemaVersion.
 * §11 — Centralized status types.
 * §12 — Null / unavailable / zero semantics.
 */

import { describe, it, expect } from 'vitest';
import {
  AnalysisStatusSchema,
  PageAnalysisStatusSchema,
  CategoryAnalysisStatusSchema,
  NumericAuditValueSchema,
  AnalysisErrorSchema,
  AnalysisLimitationSchema,
  NormalizedFindingSchema,
  WorkerJobRequestSchema,
  WorkerCallbackEnvelopeSchema,
  LegacyWorkerCallbackSchema,
  StoredScoreResultSchema,
  TruncationMetaSchema,
  SCHEMA_VERSIONS,
  SUPPORTED_READ_VERSIONS,
  CURRENT_WRITE_VERSION,
  makeApiResponse,
  PaginatedResponseSchema,
} from '@/lib/contracts/schemas';
import { z } from 'zod';

// ─── Schema version constants ──────────────────────────────────────────────────

describe('SCHEMA_VERSIONS', () => {
  it('all version strings are non-empty', () => {
    for (const [key, val] of Object.entries(SCHEMA_VERSIONS)) {
      expect(typeof val, key).toBe('string');
      expect(val.length, key).toBeGreaterThan(0);
    }
  });

  it('CURRENT_WRITE_VERSION is in SUPPORTED_READ_VERSIONS', () => {
    expect(SUPPORTED_READ_VERSIONS.has(CURRENT_WRITE_VERSION)).toBe(true);
  });

  it('v1-legacy is also in SUPPORTED_READ_VERSIONS', () => {
    expect(SUPPORTED_READ_VERSIONS.has('analysis-result-v1')).toBe(true);
  });
});

// ─── AnalysisStatus (§11) ─────────────────────────────────────────────────────

describe('AnalysisStatusSchema', () => {
  it.each(['pending', 'created', 'queued', 'running', 'partial', 'completed', 'failed', 'cancelled'])(
    'accepts "%s"', (status) => {
      expect(AnalysisStatusSchema.safeParse(status).success).toBe(true);
    }
  );

  it('rejects unknown status', () => {
    expect(AnalysisStatusSchema.safeParse('processing').success).toBe(false);
  });

  it('contains legacy "pending" alias', () => {
    expect(AnalysisStatusSchema.safeParse('pending').success).toBe(true);
  });
});

// ─── PageAnalysisStatus (§11) ─────────────────────────────────────────────────

describe('PageAnalysisStatusSchema', () => {
  it.each(['discovered', 'queued', 'fetching', 'analyzing', 'completed', 'partial', 'failed', 'skipped', 'deduplicated', 'cancelled'])(
    'accepts "%s"', (status) => {
      expect(PageAnalysisStatusSchema.safeParse(status).success).toBe(true);
    }
  );

  it('rejects unknown page status', () => {
    expect(PageAnalysisStatusSchema.safeParse('done').success).toBe(false);
  });
});

// ─── CategoryAnalysisStatus (§11) ────────────────────────────────────────────

describe('CategoryAnalysisStatusSchema', () => {
  it.each(['completed', 'partial', 'failed', 'unavailable', 'not-applicable', 'not-executed'])(
    'accepts "%s"', (status) => {
      expect(CategoryAnalysisStatusSchema.safeParse(status).success).toBe(true);
    }
  );

  it('rejects unknown category status', () => {
    expect(CategoryAnalysisStatusSchema.safeParse('skipped').success).toBe(false);
  });
});

// ─── NumericAuditValue (§12) ──────────────────────────────────────────────────

describe('NumericAuditValueSchema', () => {
  it('accepts a scored value', () => {
    const result = NumericAuditValueSchema.safeParse({
      value: 85,
      status: 'available',
    });
    expect(result.success).toBe(true);
  });

  it('accepts unavailable with null value', () => {
    const result = NumericAuditValueSchema.safeParse({
      value: null,
      status: 'unavailable',
      reason: 'browser not available',
    });
    expect(result.success).toBe(true);
  });

  it('accepts not-applicable with null value', () => {
    const result = NumericAuditValueSchema.safeParse({
      value: null,
      status: 'not-applicable',
    });
    expect(result.success).toBe(true);
  });

  it('accepts not-executed with null value', () => {
    const result = NumericAuditValueSchema.safeParse({
      value: null,
      status: 'not-executed',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown status', () => {
    const result = NumericAuditValueSchema.safeParse({
      value: null,
      status: 'missing',
    });
    expect(result.success).toBe(false);
  });

  it('real zero is distinct from unavailable', () => {
    const zero = NumericAuditValueSchema.parse({ value: 0, status: 'available' });
    const unavail = NumericAuditValueSchema.parse({ value: null, status: 'unavailable' });
    expect(zero.value).toBe(0);
    expect(zero.status).toBe('available');
    expect(unavail.value).toBeNull();
    expect(unavail.status).toBe('unavailable');
  });
});

// ─── AnalysisError (§18) ─────────────────────────────────────────────────────

describe('AnalysisErrorSchema', () => {
  it('accepts a valid error', () => {
    const result = AnalysisErrorSchema.safeParse({
      errorId: 'err-001',
      scope: 'callback',
      code: 'SIGNATURE_INVALID',
      message: 'HMAC verification failed',
      retryable: false,
      occurredAt: '2026-06-27T10:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown scope', () => {
    const result = AnalysisErrorSchema.safeParse({
      errorId: 'err-001',
      scope: 'network',
      code: 'NET_ERR',
      message: 'x',
      retryable: true,
      occurredAt: '2026-06-27T10:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid scopes', () => {
    for (const scope of ['analysis', 'page', 'category', 'callback', 'ai', 'pdf'] as const) {
      const r = AnalysisErrorSchema.safeParse({
        errorId: 'e',
        scope,
        code: 'C',
        message: 'm',
        retryable: false,
        occurredAt: '2026-06-27T10:00:00Z',
      });
      expect(r.success, `scope=${scope}`).toBe(true);
    }
  });
});

// ─── AnalysisLimitation (§19) ─────────────────────────────────────────────────

describe('AnalysisLimitationSchema', () => {
  it('accepts a valid limitation', () => {
    const result = AnalysisLimitationSchema.safeParse({
      limitationId: 'lim-001',
      scope: 'analysis',
      code: 'LIMITED_CRAWL',
      message: 'Only 3 of 50 pages were analyzed.',
      severity: 'warning',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown severity', () => {
    const result = AnalysisLimitationSchema.safeParse({
      limitationId: 'lim-001',
      scope: 'analysis',
      code: 'X',
      message: 'x',
      severity: 'error',
    });
    expect(result.success).toBe(false);
  });
});

// ─── NormalizedFinding (§13) ──────────────────────────────────────────────────

describe('NormalizedFindingSchema', () => {
  it('accepts a valid finding', () => {
    const result = NormalizedFindingSchema.safeParse({
      findingId: 'f-001',
      ruleId: 'img-alt',
      category: 'accessibility',
      title: 'Image missing alt text',
      description: 'The img element does not have an alt attribute.',
      status: 'failed',
      severity: 'critical',
      confidence: 'high',
      source: 'axe-core',
      scope: 'page',
      affectedPageIds: ['page-001'],
      evidence: [],
      experimental: false,
      createdAt: '2026-06-27T10:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown severity', () => {
    const base = {
      findingId: 'f-001', ruleId: 'x', category: 'seo', title: 't', description: 'd',
      status: 'failed', severity: 'blocker', confidence: 'high', source: 'x',
      scope: 'page', affectedPageIds: [], evidence: [], experimental: false,
      createdAt: '2026-06-27T10:00:00Z',
    };
    expect(NormalizedFindingSchema.safeParse(base).success).toBe(false);
  });
});

// ─── WorkerJobRequest (§7) ────────────────────────────────────────────────────

describe('WorkerJobRequestSchema', () => {
  const validPayload = {
    schemaVersion: SCHEMA_VERSIONS.WORKER_JOB,
    analysisId: '00000000-0000-0000-0000-000000000001',
    rootUrl: 'https://example.com',
    requestedBy: { userIdHash: 'abc123', plan: 'pro' },
    config: {
      crawlStrategy: 'internal-links',
      maxPages: 10,
      maxDepth: 2,
      auditLevels: {},
      deviceProfile: 'desktop',
    },
    callback: { url: 'https://app.example.com/api/analyze/callback', signatureVersion: 'v1' },
    idempotencyKey: 'key-001',
    createdAt: '2026-06-27T10:00:00Z',
  };

  it('accepts a valid v2 job request', () => {
    expect(WorkerJobRequestSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects wrong schemaVersion', () => {
    const bad = { ...validPayload, schemaVersion: 'worker-job-v1' };
    expect(WorkerJobRequestSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects invalid analysisId (non-UUID)', () => {
    const bad = { ...validPayload, analysisId: 'not-a-uuid' };
    expect(WorkerJobRequestSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects invalid rootUrl', () => {
    const bad = { ...validPayload, rootUrl: 'not-a-url' };
    expect(WorkerJobRequestSchema.safeParse(bad).success).toBe(false);
  });

  it('does not contain authToken field in schema', () => {
    // §7 — authToken must NOT be in the job body
    const shape = WorkerJobRequestSchema.shape as Record<string, unknown>;
    expect(shape['authToken']).toBeUndefined();
  });
});

// ─── WorkerCallbackEnvelope (§8) ──────────────────────────────────────────────

describe('WorkerCallbackEnvelopeSchema', () => {
  const validEnvelope = {
    schemaVersion: SCHEMA_VERSIONS.WORKER_CALLBACK,
    analysisId: '00000000-0000-0000-0000-000000000001',
    resultType: 'analysis-completed',
    resultVersion: '1',
    idempotencyKey: 'idem-001',
    producedAt: '2026-06-27T10:00:00Z',
    payload: { screenshotBase64: null, lighthouseScores: null },
  };

  it('accepts a valid v2 callback envelope', () => {
    expect(WorkerCallbackEnvelopeSchema.safeParse(validEnvelope).success).toBe(true);
  });

  it('rejects wrong schemaVersion', () => {
    const bad = { ...validEnvelope, schemaVersion: 'worker-callback-v1' };
    expect(WorkerCallbackEnvelopeSchema.safeParse(bad).success).toBe(false);
  });

  it.each(['analysis-started', 'page-discovered', 'page-result', 'sitewide-result', 'analysis-progress', 'analysis-completed', 'analysis-failed'])(
    'accepts resultType "%s"', (resultType) => {
      const r = WorkerCallbackEnvelopeSchema.safeParse({ ...validEnvelope, resultType });
      expect(r.success).toBe(true);
    }
  );

  it('rejects unknown resultType', () => {
    const bad = { ...validEnvelope, resultType: 'unknown-type' };
    expect(WorkerCallbackEnvelopeSchema.safeParse(bad).success).toBe(false);
  });
});

// ─── LegacyWorkerCallback ─────────────────────────────────────────────────────

describe('LegacyWorkerCallbackSchema', () => {
  it('accepts a minimal legacy payload', () => {
    const result = LegacyWorkerCallbackSchema.safeParse({
      analysisId: 'analysis-123',
      lighthouseScores: { performance: 85, accessibility: 72, seo: 90, bestPractices: 88, ttfb: 300 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a failure payload', () => {
    const result = LegacyWorkerCallbackSchema.safeParse({
      analysisId: 'analysis-123',
      error: 'Navigation timeout',
    });
    expect(result.success).toBe(true);
  });

  it('passes through unknown extra fields (forward compat §29)', () => {
    const result = LegacyWorkerCallbackSchema.safeParse({
      analysisId: 'analysis-123',
      futureField: 'some-new-value',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).futureField).toBe('some-new-value');
    }
  });

  it('rejects missing analysisId', () => {
    const result = LegacyWorkerCallbackSchema.safeParse({ lighthouseScores: {} });
    expect(result.success).toBe(false);
  });
});

// ─── TruncationMeta (§32) ────────────────────────────────────────────────────

describe('TruncationMetaSchema', () => {
  it('accepts valid truncation metadata', () => {
    const result = TruncationMetaSchema.safeParse({
      truncated: true,
      originalCount: 1000,
      includedCount: 100,
    });
    expect(result.success).toBe(true);
  });

  it('accepts non-truncated metadata', () => {
    const result = TruncationMetaSchema.safeParse({
      truncated: false,
      originalCount: 50,
      includedCount: 50,
    });
    expect(result.success).toBe(true);
  });
});

// ─── PaginatedResponse (§33) ─────────────────────────────────────────────────

describe('PaginatedResponseSchema', () => {
  const ItemSchema = z.object({ id: z.string() });
  const PagedSchema = PaginatedResponseSchema(ItemSchema);

  it('accepts a valid paginated response', () => {
    const result = PagedSchema.safeParse({
      items: [{ id: 'a' }, { id: 'b' }],
      nextCursor: 'cursor-123',
      total: 100,
    });
    expect(result.success).toBe(true);
  });

  it('accepts response without optional cursor/total', () => {
    const result = PagedSchema.safeParse({ items: [{ id: 'a' }] });
    expect(result.success).toBe(true);
  });

  it('rejects items that do not match the item schema', () => {
    const result = PagedSchema.safeParse({ items: [{ wrong: 'field' }] });
    expect(result.success).toBe(false);
  });
});

// ─── makeApiResponse (§21) ───────────────────────────────────────────────────

describe('makeApiResponse', () => {
  it('wraps data with schemaVersion', () => {
    const result = makeApiResponse({ foo: 'bar' });
    expect(result.schemaVersion).toBe(SCHEMA_VERSIONS.REPORT_API);
    expect(result.data).toEqual({ foo: 'bar' });
  });

  it('allows a custom version override', () => {
    const result = makeApiResponse({ x: 1 }, 'custom-v3');
    expect(result.schemaVersion).toBe('custom-v3');
  });
});
