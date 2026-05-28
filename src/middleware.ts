import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { detectSqlInjectionInRequest, getClientIp } from '@/lib/rate-limit/web';

const PROTECTED_ROUTES = ['/dashboard', '/analyze', '/reports', '/settings', '/monitors'];
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

// ── Nonce-based Content Security Policy ──────────────────────────────────────
// A fresh nonce is generated on every request.  'unsafe-inline' is gone from
// script-src — the nonce is the only way to execute inline or inline-equivalent
// scripts, so an injected <script> without the nonce is dead.
//
// 'strict-dynamic' lets nonce-trusted scripts (Next.js runtime) load further
// chunks via webpack dynamic imports without needing to allowlist each chunk URL.
//
// 'unsafe-inline' is still present in style-src — removing it requires
// auditing all Tailwind/shadcn inline styles and is deferred.
function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://*.supabase.co`,
    `connect-src 'self' https://${SUPABASE_HOST} https://api.stripe.com wss://${SUPABASE_HOST}`,
    `frame-src https://js.stripe.com https://hooks.stripe.com`,
    `script-src-elem 'nonce-${nonce}' https://js.stripe.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `report-uri /api/csp-report`,
  ].join('; ');
}

// ── Generate a cryptographically random nonce ────────────────────────────────
// Web Crypto API is available in the Next.js Edge Runtime (middleware).
// Output is a 16-byte base64 string (~22 chars), safe to embed in a CSP header.
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // btoa() is available in Edge Runtime; Array.from avoids spread-of-TypedArray limits
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
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
          !ct.startsWith('text/plain')) {
        return NextResponse.json({ error: 'Unsupported Content-Type.' }, { status: 415 });
      }
    }
  }

  // ── Generate per-request nonce ───────────────────────────────────────────
  const nonce = generateNonce();

  // Build modified request headers — server components read these via headers().
  // Called in two places: initial response and the Supabase cookie-refresh
  // response, so the nonce is preserved even if Supabase replaces the response.
  const buildHeaders = () =>
    new Headers({
      ...Object.fromEntries(request.headers),
      'x-pathname': pathname,
      'x-nonce': nonce,
    });

  let response = NextResponse.next({ request: { headers: buildHeaders() } });

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
          // Supabase refreshed the session — create a new response but preserve
          // the nonce and pathname so server components still receive them.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: buildHeaders() } });
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

  // ── Set nonce-based CSP on the final response ────────────────────────────
  response.headers.set('Content-Security-Policy', buildCsp(nonce));

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
