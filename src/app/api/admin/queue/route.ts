/**
 * Admin: queue stats and DLQ inspection.
 *
 * Protected by ADMIN_API_SECRET — not accessible to regular users.
 * Returns safe metadata only; no job payloads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats, getDlqEntries } from '@/lib/queue/service';

export const runtime = 'nodejs';

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) return false; // no secret configured → deny all
  return req.headers.get('Authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const view = url.searchParams.get('view') ?? 'stats';

  if (view === 'dlq') {
    const limit   = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
    const entries = await getDlqEntries(limit);
    return NextResponse.json({ dlq: entries, count: entries.length });
  }

  const stats = await getQueueStats();
  return NextResponse.json(stats);
}
