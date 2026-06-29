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

  const isProd = process.env.NODE_ENV === 'production';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    // F3 — in production, a missing APP_URL means CSRF is completely bypassed.
    // Fail with 500 so misconfiguration is visible rather than silently allowing all origins.
    if (isProd) {
      console.error('[csrf] NEXT_PUBLIC_APP_URL not set in production — blocking request');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    return null; // dev: fail open
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(appUrl).origin;
  } catch {
    if (isProd) {
      console.error('[csrf] NEXT_PUBLIC_APP_URL is malformed in production:', appUrl);
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    return null; // dev: fail open
  }

  if (origin !== expectedOrigin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
