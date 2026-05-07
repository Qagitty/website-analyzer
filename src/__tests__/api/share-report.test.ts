import { describe, it, expect } from 'vitest';

// ── Share-report business logic ───────────────────────────────────────────────
// Tests the pure, framework-free logic of the share endpoint:
//   POST /api/reports/[id]/share
//
// These tests cover:
//   1. Toggle semantics  — is_public flips correctly
//   2. Status guard      — only 'completed' analyses can be shared
//   3. Share URL format  — returned URL is well-formed
//   4. AI summary guard  — "0" and short junk strings are suppressed

// ── 1. Toggle logic ───────────────────────────────────────────────────────────

function toggleShare(currentIsPublic: boolean): boolean {
  return !currentIsPublic;
}

describe('toggleShare()', () => {
  it('sets is_public=true when currently false', () => {
    expect(toggleShare(false)).toBe(true);
  });

  it('sets is_public=false when currently true (unshare)', () => {
    expect(toggleShare(true)).toBe(false);
  });

  it('is idempotent when called twice', () => {
    expect(toggleShare(toggleShare(false))).toBe(false);
  });
});

// ── 2. Status guard ───────────────────────────────────────────────────────────

type AnalysisStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';

function canBeShared(status: AnalysisStatus): boolean {
  return status === 'completed';
}

describe('canBeShared()', () => {
  it('allows sharing completed analyses', () => {
    expect(canBeShared('completed')).toBe(true);
  });

  it.each(['pending', 'queued', 'running', 'failed'] as AnalysisStatus[])(
    'blocks sharing for status "%s"',
    (status) => {
      expect(canBeShared(status)).toBe(false);
    }
  );
});

// ── 3. Share URL format ───────────────────────────────────────────────────────

function buildShareUrl(origin: string, analysisId: string): string {
  return `${origin}/share/${analysisId}`;
}

describe('buildShareUrl()', () => {
  it('produces the expected /share/{id} path', () => {
    expect(buildShareUrl('https://example.com', 'abc-123')).toBe(
      'https://example.com/share/abc-123'
    );
  });

  it('works with localhost origin', () => {
    expect(buildShareUrl('http://localhost:3000', 'test-id')).toBe(
      'http://localhost:3000/share/test-id'
    );
  });

  it('embeds the analysis id verbatim', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const url = buildShareUrl('https://app.com', id);
    expect(url).toContain(id);
  });

  it('does not double-slash when origin has no trailing slash', () => {
    const url = buildShareUrl('https://example.com', 'id-1');
    expect(url).not.toContain('//share');
  });
});

// ── 4. AI summary guard ───────────────────────────────────────────────────────
// Mirrors the `length > 5` guard used in ReportHeader and ShareReportHeader
// to suppress junk values like "0" stored in legacy DB records.

function shouldRenderSummary(aiSummary: unknown): boolean {
  return typeof aiSummary === 'string' && aiSummary.trim().length > 5;
}

describe('shouldRenderSummary()', () => {
  it('renders a real summary', () => {
    expect(shouldRenderSummary('This site has good performance but needs accessibility work.')).toBe(true);
  });

  it('suppresses "0" (legacy junk value)', () => {
    expect(shouldRenderSummary('0')).toBe(false);
  });

  it('suppresses empty string', () => {
    expect(shouldRenderSummary('')).toBe(false);
  });

  it('suppresses whitespace-only string', () => {
    expect(shouldRenderSummary('   ')).toBe(false);
  });

  it('suppresses strings of 5 chars or fewer', () => {
    expect(shouldRenderSummary('Hi!')).toBe(false);
    expect(shouldRenderSummary('short')).toBe(false);
  });

  it('renders strings of exactly 6 chars', () => {
    expect(shouldRenderSummary('123456')).toBe(true);
  });

  it('suppresses null', () => {
    expect(shouldRenderSummary(null)).toBe(false);
  });

  it('suppresses undefined', () => {
    expect(shouldRenderSummary(undefined)).toBe(false);
  });

  it('suppresses numeric 0', () => {
    expect(shouldRenderSummary(0)).toBe(false);
  });
});

// ── 5. Public report access guard ────────────────────────────────────────────
// Mirrors the logic in /share/[id]/page.tsx:
//   only serve the page when analysis.is_public === true

function canViewPublicReport(analysis: { is_public: boolean; status: AnalysisStatus } | null): boolean {
  if (!analysis) return false;
  return analysis.is_public && analysis.status === 'completed';
}

describe('canViewPublicReport()', () => {
  it('allows access to a public completed report', () => {
    expect(canViewPublicReport({ is_public: true, status: 'completed' })).toBe(true);
  });

  it('blocks access when is_public=false', () => {
    expect(canViewPublicReport({ is_public: false, status: 'completed' })).toBe(false);
  });

  it('blocks access when analysis is null (not found)', () => {
    expect(canViewPublicReport(null)).toBe(false);
  });

  it('blocks access when status is not completed (even if public)', () => {
    expect(canViewPublicReport({ is_public: true, status: 'failed' })).toBe(false);
    expect(canViewPublicReport({ is_public: true, status: 'running' })).toBe(false);
  });
});
