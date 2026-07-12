const SENSITIVE_PARAM_KEYS = new Set([
  'token', 'code', 'key', 'secret', 'auth', 'session', 'password', 'email',
  'signature', 'jwt', 'access_token', 'refresh_token', 'api_key', 'apikey',
  'passwd', 'pwd',
]);

export function sanitizeUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u    = new URL(raw);
    const keep: Array<[string, string]> = [];
    u.searchParams.forEach((v, k) => {
      if (!SENSITIVE_PARAM_KEYS.has(k.toLowerCase())) keep.push([k, v]);
    });
    const clean = new URL(u.origin + u.pathname);
    keep.forEach(([k, v]) => clean.searchParams.set(k, v));
    return clean.toString().slice(0, 2048);
  } catch {
    return undefined;
  }
}

export function scrubContext(ctx: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (typeof ctx === 'string') return ctx.slice(0, 2048);
  if (typeof ctx !== 'object' || ctx === null) return ctx;
  if (Array.isArray(ctx))
    return ctx.slice(0, 20).map((v) => scrubContext(v, depth + 1));

  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of Object.entries(ctx as Record<string, unknown>)) {
    if (count++ > 50) {
      out['__truncated'] = true;
      break;
    }
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const lk = k.toLowerCase();
    if (SENSITIVE_PARAM_KEYS.has(lk)) {
      out[k] = '[scrubbed]';
      continue;
    }
    out[k] = scrubContext(v, depth + 1);
  }
  return out;
}

export function truncateStackFrames(frames: unknown[]): unknown[] {
  return frames.slice(0, 100);
}

export function truncateBreadcrumbs(crumbs: unknown[], max: number): unknown[] {
  return crumbs.slice(-max);
}
