import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { uploadDesignScreenshot } from '@/lib/supabase/storage';
import { checkWebRateLimit } from '@/lib/rate-limit/web';
import { HTTP_ERROR_STATUSES, PAGE_ERROR_PATTERNS } from '@/lib/url-validation-patterns';
import { checkCsrfOrigin } from '@/lib/csrf';
import { z } from 'zod';
import { SCHEMA_VERSIONS } from '@/lib/contracts/schemas';
import { generateIdempotencyKey } from '@/lib/contracts/callback-auth';
import { createHash } from 'crypto';
import { validateAnalysisUrl, validateRedirectTarget } from '@/lib/security/url-validator';

/** One-way hash of user ID — never send raw UUIDs to external services. */
function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const schema = z.object({
  url: z
    .string()
    .trim()
    .transform(normalizeUrl)
    .pipe(
      z.string()
        .url('Invalid URL')
        // §3 — delegate all security checks to the centralized URL validator
        .superRefine((u, ctx) => {
          const result = validateAnalysisUrl(u);
          if (!result.valid) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: result.rejectionReason ?? 'URL is not allowed.',
            });
          }
        })
    ),
  designScreenshotBase64: z.string().optional(),
  designMimeType: z
    .string()
    .optional()
    .refine(
      (v) => !v || ACCEPTED_MIME.includes(v),
      'Unsupported image type'
    ),
});

// DNS status codes per RFC 1035
const DNS_NXDOMAIN = 3;   // Domain does not exist
const DNS_NOERROR  = 0;   // Name found

// Check domain existence via DNS-over-HTTPS (DoH).
//
// WHY DoH and not Node's dns/Resolver:
//   Vercel/AWS VPCs intercept outbound UDP port 53 and route it through
//   their own resolver, so setServers(['8.8.8.8']) still hits the VPC
//   resolver which can resolve names that appear as NXDOMAIN everywhere else.
//   DoH is a plain HTTPS request (port 443) that bypasses this entirely.
//
// Strategy: query Google DoH and Cloudflare DoH in parallel.
//   - NXDOMAIN from either  → domain is confirmed dead → block.
//   - NOERROR + Answer from either → domain is alive → allow.
//   - Both APIs unreachable  → fail open (never block real sites due to
//     transient DoH outage).
async function domainExistsViaDoh(hostname: string): Promise<boolean> {
  type DoHResult = 'exists' | 'nxdomain' | 'unavailable';

  const query = async (baseUrl: string, type: 'A' | 'AAAA'): Promise<DoHResult> => {
    try {
      const res = await fetch(
        `${baseUrl}?name=${encodeURIComponent(hostname)}&type=${type}`,
        { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(5_000) }
      );
      if (!res.ok) return 'unavailable';
      const data: { Status: number; Answer?: unknown[] } = await res.json();
      if (data.Status === DNS_NXDOMAIN) return 'nxdomain';
      if (data.Status === DNS_NOERROR && Array.isArray(data.Answer) && data.Answer.length > 0) return 'exists';
      return 'unavailable'; // NOERROR but no records for this type — try AAAA next
    } catch {
      return 'unavailable';
    }
  };

  const resolvers = [
    'https://dns.google/resolve',
    'https://1.1.1.1/dns-query',  // Cloudflare DoH fallback
  ];

  for (const type of ['A', 'AAAA'] as const) {
    // Query both resolvers in parallel for this record type
    const results = await Promise.all(resolvers.map((r) => query(r, type)));

    if (results.some((r) => r === 'nxdomain')) return false; // At least one confirmed dead
    if (results.some((r) => r === 'exists'))   return true;  // At least one confirmed alive
    // Both unavailable for this type → try AAAA
  }

  // Couldn't get a definitive answer from either resolver → fail open
  return true;
}


// Verify the URL is reachable AND serves real content before consuming a credit.
//
// Strategy (three layers):
//   1. DoH DNS check   — fast, catches definitive NXDOMAIN.
//   2. HTTP GET        — catches domains whose DNS is hijacked to a parking/CDN
//                        error page; reads the body to validate actual content.
//   3. Content check   — rejects CDN error pages (Cloudflare 1016), parking
//                        pages ("domain for sale"), and near-empty responses.
//
// §8 — Each redirect hop is validated with validateRedirectTarget() before
//       following, preventing redirect-based SSRF to internal services.
//
// NOTE: "any 4xx/5xx = host is up" is intentionally NOT used here because
// Cloudflare Workers (where the real analysis runs) return a 200 OK with an
// error-page body for NXDOMAIN domains — defeating a status-only check.

const MAX_REDIRECT_HOPS = 5;

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

/**
 * Fetch a URL manually following redirects, validating each redirect target
 * against the centralized SSRF validator before following (§8).
 */
async function fetchWithSafeRedirects(
  startUrl: string,
  signal: AbortSignal,
): Promise<Response> {
  let currentUrl = startUrl;
  const seen = new Set<string>();

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (seen.has(currentUrl)) {
      throw new Error('Redirect loop detected.');
    }
    seen.add(currentUrl);

    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: FETCH_HEADERS,
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    // Follow the redirect — but validate the target first
    const location = response.headers.get('location');
    if (!location) return response;

    let nextUrl: string;
    try {
      nextUrl = new URL(location, currentUrl).href;
    } catch {
      throw new Error(`Invalid redirect location: ${location}`);
    }

    const validation = validateRedirectTarget(nextUrl);
    if (!validation.valid) {
      throw new Error(`Redirect blocked: ${validation.rejectionReason}`);
    }

    currentUrl = nextUrl;
  }

  throw new Error(`Too many redirects (max ${MAX_REDIRECT_HOPS}).`);
}

async function checkUrlReachable(url: string): Promise<{ ok: boolean; error?: string }> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { ok: false, error: 'Invalid URL.' };
  }

  // ── Layer 1: DoH DNS check ──────────────────────────────────────────────
  const exists = await domainExistsViaDoh(hostname);
  if (!exists) {
    return {
      ok: false,
      error: 'This domain does not exist. Please check the URL for typos.',
    };
  }

  // ── Layer 2: HTTP GET with body, safe redirect following ────────────────
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);

  let response: Response;
  try {
    response = await fetchWithSafeRedirects(url, ctrl.signal);
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        error: 'The URL timed out during reachability check. The site may be down or very slow.',
      };
    }
    if (err?.message?.startsWith('Redirect blocked:')) {
      return {
        ok: false,
        error: 'The URL redirects to an internal or disallowed address.',
      };
    }
    return {
      ok: false,
      error: 'The URL could not be reached. Please check that the domain exists and the site is online.',
    };
  } finally {
    clearTimeout(timer);
  }

  // HTTP error statuses
  if (HTTP_ERROR_STATUSES.has(response.status)) {
    return {
      ok: false,
      error: `The URL returned HTTP ${response.status}. Please check the link is correct.`,
    };
  }

  // ── Layer 3: Content check ──────────────────────────────────────────────
  let html: string;
  try {
    html = await response.text();
  } catch {
    // Can't read body — assume reachable (e.g. binary/non-text content-type)
    return { ok: true };
  }

  const visibleText = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  // Check for CDN/parking error pages (only when content is thin)
  const bodyLower = html.toLowerCase();
  const matchedPattern = PAGE_ERROR_PATTERNS.find(p => bodyLower.includes(p));
  if (matchedPattern && visibleText.length < 400) {
    return {
      ok: false,
      error: 'The URL appears to point to an error or parking page. Please verify the link.',
    };
  }

  // Near-empty page
  if (html.length < 500 || visibleText.length < 50) {
    return {
      ok: false,
      error: 'The URL returns an empty or near-empty page. Please verify the link.',
    };
  }

  return { ok: true };
}

export async function POST(req: NextRequest) {
  const csrfError = checkCsrfOrigin(req);
  if (csrfError) return csrfError;

  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 10 analysis submissions per minute per user
  const limited = await checkWebRateLimit(req, 'analyze-submit', 10, 60, user.id);
  if (limited) return limited;

  // Reject oversized bodies — 6 MB covers a base64-encoded design screenshot (~4 MB image)
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 6 * 1024 * 1024) {
    return NextResponse.json({ error: 'Request body too large (max 6 MB).' }, { status: 413 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { url, designScreenshotBase64, designMimeType } = parsed.data;

  // Pre-check: verify the URL resolves before spending a credit
  const reachable = await checkUrlReachable(url);
  if (!reachable.ok) {
    return NextResponse.json({ error: reachable.error }, { status: 422 });
  }

  const { data: hasCredit, error: creditError } = await supabase.rpc('use_credit', {
    p_user_id: user.id,
  });

  if (creditError || !hasCredit) {
    return NextResponse.json(
      { error: 'Insufficient credits. Please upgrade your plan.' },
      { status: 402 }
    );
  }

  const { data: analysis, error: insertError } = await supabase
    .from('analyses')
    .insert({ user_id: user.id, url, status: 'pending' })
    .select('id')
    .single();

  if (insertError || !analysis) {
    await supabase.rpc('refund_credit', { p_user_id: user.id });
    return NextResponse.json({ error: 'Failed to create analysis' }, { status: 500 });
  }

  // Upload design screenshot if provided
  let designScreenshotUrl: string | null = null;
  if (designScreenshotBase64 && designMimeType) {
    try {
      const buffer = Buffer.from(designScreenshotBase64, 'base64');
      const serviceSupabase = createServiceRoleClient();
      designScreenshotUrl = await uploadDesignScreenshot(serviceSupabase, analysis.id, buffer, designMimeType);
      await supabase
        .from('analyses')
        .update({ design_screenshot_url: designScreenshotUrl })
        .eq('id', analysis.id);
    } catch (uploadErr) {
      console.error('[analyze] design screenshot upload failed (non-fatal):', uploadErr);
    }
  }

  // Count analyses ahead in queue (pending/queued, created before this one)
  const { count: queuePosition } = await supabase
    .from('analyses')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'queued', 'running'])
    .neq('id', analysis.id);

  await supabase
    .from('analyses')
    .update({ status: 'queued', queue_position: (queuePosition ?? 0) + 1 })
    .eq('id', analysis.id);

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/analyze/callback`;
  const workerUrl = `${process.env.CLOUDFLARE_WORKER_URL}/analyze`;

  // §7 — Versioned Worker job request. authToken is intentionally NOT in the body;
  //       it lives only in the Authorization header sent to the Worker.
  //       The Worker authenticates back to the callback using its own environment
  //       secret passed via the callback URL's signatureVersion hint.
  const idempotencyKey = generateIdempotencyKey();
  const workerJobPayload = {
    // §7 — schema version so the Worker can validate and future-proof
    schemaVersion: SCHEMA_VERSIONS.WORKER_JOB,
    analysisId: analysis.id,
    rootUrl: url,
    // §7 — requestedBy uses a hashed user ID, never the raw UUID
    requestedBy: { userIdHash: hashUserId(user.id), plan: 'free' },
    config: {
      crawlStrategy: 'internal-links',
      maxPages: 10,
      maxDepth: 2,
      auditLevels: {},
      deviceProfile: 'desktop',
    },
    callback: {
      url: callbackUrl,
      signatureVersion: 'v1',
    },
    idempotencyKey,
    createdAt: new Date().toISOString(),
    // §29 — Legacy fields kept for Worker versions that have not upgraded yet
    url,
    callbackUrl,
    authToken: process.env.WORKER_CALLBACK_SECRET,
  };

  console.log('[analyze] dispatching to worker:', { analysisId: analysis.id, workerUrl, callbackUrl, schemaVersion: SCHEMA_VERSIONS.WORKER_JOB });

  fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_AUTH_TOKEN}`,
    },
    body: JSON.stringify(workerJobPayload),
  }).then(async (res) => {
    const text = await res.text().catch(() => '');
    console.log('[analyze] worker response:', res.status, text);
  }).catch((err) => {
    console.error('[analyze] worker fetch failed:', err);
  });

  return NextResponse.json(
    { analysisId: analysis.id, status: 'queued', queuePosition: (queuePosition ?? 0) + 1 },
    { status: 202 }
  );
}
