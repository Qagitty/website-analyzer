import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { detectSqlInjectionInRequest, getClientIp } from '@/lib/rate-limit/web';

const PROTECTED_ROUTES = ['/dashboard', '/analyze', '/reports', '/settings', '/monitors', '/compliance', '/remediation', '/leads', '/compare'];
const AUTH_ROUTES = ['/login', '/signup'];

// ── Supabase host for CSP connect-src ────────────────────────────────────────
// Computed once at cold-start from the public env var.
const SUPABASE_HOST = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : '*.supabase.co';
  } catch {
    return '*.supabase.co';
  }
})();

// ── IP blocklist ─────────────────────────────────────────────────────────────
// Populate BLOCKED_IPS env var as a comma-separated list of IPs.
// In production prefer Cloudflare IP Access Rules — they block at the edge
// before the request ever reaches this middleware.
const BLOCKED_IPS: Set<string> = new Set(
  (process.env.BLOCKED_IPS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
);

// ── Content Security Policy ───────────────────────────────────────────────────
// NOTE: A nonce-based / 'strict-dynamic' CSP was attempted but is incompatible
// with Next.js 14's hydration model — in CSP3-capable browsers 'strict-dynamic'
// silently overrides 'unsafe-inline', blocking all of Next.js's own inline
// hydration scripts and freezing every client component in its skeleton state.
//
// Until Next.js provides first-class nonce support (stamping every hydration
// <script> automatically), we use 'unsafe-inline' without a nonce.  This is
// still a meaningful CSP: it blocks scripts from arbitrary external origins,
// enforces frame-ancestors 'none' (clickjacking), restricts form-action, and
// eliminates object-src / base-uri attacks.
function buildCsp(): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' https://js.stripe.com https://va.vercel-scripts.com`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://*.supabase.co`,
    `connect-src 'self' https://${SUPABASE_HOST} https://api.stripe.com wss://${SUPABASE_HOST} https://vitals.vercel-insights.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io`,
    `frame-src https://js.stripe.com https://hooks.stripe.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `report-uri /api/csp-report`,
  ].join('; ');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── IP blocklist ─────────────────────────────────────────────────────────
  const clientIp = getClientIp(request);
  if (BLOCKED_IPS.has(clientIp)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // ── URL length guard ─────────────────────────────────────────────────────
  if (request.url.length > 2048) {
    return new NextResponse('URI Too Long', { status: 414 });
  }

  // ── Header count guard ───────────────────────────────────────────────────
  let headerCount = 0;
  request.headers.forEach(() => { headerCount++; });
  if (headerCount > 100) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  // ── SQL injection detection on API query params ──────────────────────────
  if (pathname.startsWith('/api/')) {
    const url = new URL(request.url);
    const offending = detectSqlInjectionInRequest(url);
    if (offending) {
      console.warn('[security] SQL injection pattern detected', {
        ip: clientIp,
        path: pathname,
        pattern: offending.slice(0, 100),
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
    }

    // Enforce Content-Type on mutating requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const ct = request.headers.get('content-type') ?? '';
      if (ct && !ct.startsWith('application/json') &&
          !ct.startsWith('multipart/form-data') &&
          !ct.startsWith('text/plain') &&
          !ct.startsWith('application/csp-report')) {
        return NextResponse.json({ error: 'Unsupported Content-Type.' }, { status: 415 });
      }
    }
  }

  // Build request headers (pathname forwarded to server components)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // ── Supabase auth ────────────────────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute  = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ── Set CSP on the final response ────────────────────────────────────────
  response.headers.set('Content-Security-Policy', buildCsp());

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
