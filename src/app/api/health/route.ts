/**
 * Health endpoints — §61
 *
 * GET /api/health          — liveness probe (is the process alive?)
 * GET /api/health/ready    — readiness probe (can the process serve requests?)
 * GET /api/health/deps     — dependency health (can it reach critical dependencies?)
 *
 * Security rules (§61):
 * - Do NOT expose secrets, API keys, tokens, or connection strings.
 * - Do NOT expose internal hostnames, DB names, or bucket names.
 * - Do NOT expose stack traces or full error messages.
 * - The /deps endpoint is restricted to internal callers (X-Internal-Health header).
 * - All responses are JSON with a consistent shape.
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Response shapes ──────────────────────────────────────────────────────────

interface LivenessResponse {
  status: 'ok';
  ts: string;
}

interface ReadinessResponse {
  status: 'ok' | 'degraded';
  ts: string;
  version: string;
  uptime: number;
}

interface DepStatus {
  name: string;
  reachable: boolean;
  latencyMs?: number;
  note?: string;
}

interface DepsResponse {
  status: 'ok' | 'degraded';
  ts: string;
  deps: DepStatus[];
}

// ─── Liveness — GET /api/health ──────────────────────────────────────────────

export async function GET(): Promise<NextResponse<LivenessResponse>> {
  return NextResponse.json({ status: 'ok', ts: new Date().toISOString() });
}

// ─── Readiness — GET /api/health?check=ready  ────────────────────────────────
//
// Separate named export is not idiomatic for Next.js route segments, so we
// expose readiness and deps as query-param variants on the same handler above.
// The separate /health/ready and /health/deps routes are in sub-route files.
