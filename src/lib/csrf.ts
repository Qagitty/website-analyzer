import { NextRequest, NextResponse } from 'next/server';

/**
 * Checks the Origin header on mutation requests to prevent CSRF.
 *
 * Only applies when the Origin header is present (browser-initiated requests).
 * Server-to-server calls (no Origin) pass through — they can't be cross-origin
 * browser requests and are typically authenticated by other means (API keys,
 * cron secrets, worker tokens).
 *
 * Returns a 403 NextResponse if the origin is foreign, otherwise null.
 */
export function checkCsrfOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null; // not configured — fail open in dev

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(appUrl).origin;
  } catch {
    return null;
  }

  if (origin !== expectedOrigin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
