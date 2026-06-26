// Security Headers Analysis Engine — security-headers-v2
// Spec constraints:
//  - Never represent a failed network request as missing headers
//  - Do not follow redirects to private or prohibited networks
//  - Do not log cookies, auth headers, or sensitive query parameters
//  - Do not blindly recommend HSTS preload, includeSubDomains, or generic CSP

import type {
  SecurityHeadersAuditResult,
  SecurityHeaderAnalysisResult,
  SecurityHeaderFinding,
  SecurityHeaderScoreBreakdown,
  SecurityHeadersCoverage,
  SecurityHeaderStatus,
  SecurityHeaderSeverity,
  SecurityHeaderApplicability,
  SecurityHeaderRolloutRisk,
  RedirectHop,
  ParsedCSP,
} from '../../types/security-headers';

// ── SSRF protection ───────────────────────────────────────────────────────────

function isSafeRedirectTarget(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return false;
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return false;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return false;
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return false;
  return true;
}

// ── Redirect chain capture ────────────────────────────────────────────────────

async function fetchRedirectChain(
  url: string,
  maxHops = 8,
  timeoutMs = 6000,
): Promise<{ chain: RedirectHop[]; error?: string }> {
  const chain: RedirectHop[] = [];
  const seen = new Set<string>();
  let current = url;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    for (let hop = 0; hop < maxHops; hop++) {
      if (seen.has(current)) return { chain, error: 'REDIRECT_LOOP' };
      if (!isSafeRedirectTarget(current)) return { chain, error: 'BLOCKED' };
      seen.add(current);

      let r: Response;
      try {
        r = await fetch(current, {
          method: 'GET',
          redirect: 'manual',
          signal: ctrl.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0; +https://websiteanalyzer.dev)',
            Accept: 'text/html,application/xhtml+xml',
          },
        });
        if (r.body) await r.body.cancel();
      } catch (e) {
        const msg = e instanceof Error ? e.message.toLowerCase() : '';
        return { chain, error: msg.includes('abort') ? 'TIMEOUT' : 'NETWORK_ERROR' };
      }

      const hopHeaders: Record<string, string[]> = {};
      r.headers.forEach((value, name) => {
        const norm = name.toLowerCase();
        if (!['cookie', 'set-cookie', 'authorization', 'proxy-authorization'].includes(norm)) {
          if (!hopHeaders[norm]) hopHeaders[norm] = [];
          hopHeaders[norm].push(value);
        }
      });

      chain.push({
        url: current,
        status: r.status,
        location: r.headers.get('location') ?? undefined,
        headers: hopHeaders,
      });

      if (r.status < 300 || r.status >= 400) break;

      const loc = r.headers.get('location');
      if (!loc) break;

      try {
        current = new URL(loc, current).href;
      } catch {
        break;
      }
    }

    if (chain.length >= maxHops && chain[chain.length - 1]?.status >= 300) {
      return { chain, error: 'TOO_MANY_REDIRECTS' };
    }
  } finally {
    clearTimeout(timer);
  }

  return { chain };
}

// ── CSP Parsing ───────────────────────────────────────────────────────────────

export function parseCSPValue(value: string): ParsedCSP {
  const directives: Record<string, string[]> = {};
  const parseErrors: string[] = [];

  for (const part of value.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/);
    const name = (tokens[0] ?? '').toLowerCase();
    if (!name) continue;
    if (directives[name]) {
      parseErrors.push(`Duplicate directive: ${name}`);
    }
    directives[name] = tokens.slice(1);
  }

  return { directives, parseErrors };
}

function extractMetaCSP(html: string): string[] {
  const results: string[] = [];
  const patterns = [
    /<meta\s[^>]*http-equiv=["']content-security-policy["'][^>]*content=["']([^"']+)["'][^>]*/gi,
    /<meta\s[^>]*content=["']([^"']+)["'][^>]*http-equiv=["']content-security-policy["'][^>]*/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) results.push(m[1]);
  }
  return results;
}

// ── CSP Quality Classification ────────────────────────────────────────────────

interface CSPQuality {
  status: SecurityHeaderStatus;
  earnedPoints: number;
  weaknesses: string[];
  hasFrameAncestors: boolean;
}

export function classifyCSPQuality(
  enforcedValues: string[],
  reportOnlyValues: string[],
  isHttps: boolean,
): CSPQuality {
  const MAX = 30;

  if (enforcedValues.length === 0 && reportOnlyValues.length === 0) {
    return { status: 'missing', earnedPoints: 0, weaknesses: [], hasFrameAncestors: false };
  }

  if (enforcedValues.length === 0) {
    return {
      status: 'present',
      earnedPoints: Math.round(MAX * 0.30),
      weaknesses: ['Only Content-Security-Policy-Report-Only is present — policy is not enforced'],
      hasFrameAncestors: false,
    };
  }

  const combined = enforcedValues.join('; ');
  const parsed = parseCSPValue(combined);
  const { directives } = parsed;
  const hasFrameAncestors = 'frame-ancestors' in directives;
  const weaknesses: string[] = [];

  const defaultSrc = directives['default-src'] ?? [];
  const scriptSrc = directives['script-src'] ?? defaultSrc;
  const objectSrc = directives['object-src'] ?? defaultSrc;

  if (!directives['default-src']) weaknesses.push('Missing default-src fallback');

  if (!directives['object-src'] && !defaultSrc.includes("'none'")) {
    weaknesses.push('No object-src restriction (plugins and Flash allowed by default-src)');
  }

  const hasUnsafeInline = scriptSrc.includes("'unsafe-inline'");
  const hasNonce = scriptSrc.some(s => s.startsWith("'nonce-"));
  const hasHash = scriptSrc.some(s => /^'sha(256|384|512)-/i.test(s));
  const hasStrictDynamic = scriptSrc.includes("'strict-dynamic'");
  const hasWildcard = scriptSrc.includes('*') || scriptSrc.some(s => s.startsWith('*.') || s === 'http:' || s === 'https:');
  const hasUnsafeEval = scriptSrc.includes("'unsafe-eval'");
  const hasHttpSource = isHttps && scriptSrc.some(s => s.startsWith('http://'));

  if (hasUnsafeInline && !hasNonce && !hasHash && !hasStrictDynamic) {
    weaknesses.push("'unsafe-inline' in script-src without nonce or hash neutralises CSP XSS protection");
  }
  if (hasUnsafeEval) weaknesses.push("'unsafe-eval' allows dynamic code execution from strings");
  if (hasWildcard) weaknesses.push('Wildcard or scheme-only script sources allow loading from any origin');
  if (hasHttpSource) weaknesses.push('HTTP script sources on an HTTPS page (protocol downgrade)');
  if (!hasFrameAncestors) weaknesses.push('No frame-ancestors directive — framing not restricted by CSP');

  if (weaknesses.length === 0) return { status: 'strong', earnedPoints: MAX, weaknesses, hasFrameAncestors };

  const hasCriticalWeakness = hasWildcard || (hasUnsafeInline && !hasNonce && !hasHash && !hasStrictDynamic);
  return {
    status: hasCriticalWeakness ? 'weak' : 'present',
    earnedPoints: hasCriticalWeakness ? Math.round(MAX * 0.4) : Math.round(MAX * 0.75),
    weaknesses,
    hasFrameAncestors,
  };
}

// ── HSTS Classification ───────────────────────────────────────────────────────

interface ParsedHSTS {
  maxAge: number | null;
  includeSubDomains: boolean;
  preload: boolean;
  parseError?: string;
}

export function parseHSTS(value: string): ParsedHSTS {
  const result: ParsedHSTS = { maxAge: null, includeSubDomains: false, preload: false };

  for (const part of value.split(';').map(p => p.trim().toLowerCase())) {
    if (part.startsWith('max-age=')) {
      const raw = part.slice(8).trim();
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n >= 0) result.maxAge = n;
      else result.parseError = `Invalid max-age value: "${raw}"`;
    } else if (part === 'includesubdomains') {
      result.includeSubDomains = true;
    } else if (part === 'preload') {
      result.preload = true;
    }
  }

  if (result.maxAge === null && !result.parseError) {
    result.parseError = 'max-age directive is required but missing';
  }

  return result;
}

interface HSTSQuality {
  status: SecurityHeaderStatus;
  earnedPoints: number;
  reason: string;
  warnings: string[];
}

export function classifyHSTS(values: string[], isHttps: boolean): HSTSQuality {
  const MAX = 25;

  if (!isHttps) {
    return { status: 'not-applicable', earnedPoints: 0, reason: 'HTTP connection — HSTS does not apply', warnings: [] };
  }

  if (values.length === 0) {
    return { status: 'missing', earnedPoints: 0, reason: 'Strict-Transport-Security header is not present', warnings: [] };
  }

  const parsed = parseHSTS(values[values.length - 1]);
  const warnings: string[] = [];

  if (parsed.parseError) {
    return { status: 'malformed', earnedPoints: Math.round(MAX * 0.1), reason: `HSTS parse error: ${parsed.parseError}`, warnings };
  }

  if (parsed.maxAge === 0) {
    return { status: 'weak', earnedPoints: 0, reason: 'max-age=0 opts out of HSTS — HTTPS is not enforced', warnings };
  }

  if (parsed.preload && !parsed.includeSubDomains) {
    warnings.push('preload flag requires includeSubDomains — this HSTS configuration will be rejected by preload lists');
  }
  if (parsed.preload) {
    warnings.push('Preload flag is set — HSTS preloading is extremely difficult to reverse. Verify all subdomains serve HTTPS before submitting to the preload list.');
  }

  const age = parsed.maxAge!;

  if (age >= 31536000) return { status: 'strong', earnedPoints: MAX, reason: `max-age=${age} (≥1 year)`, warnings };
  if (age >= 86400) return { status: 'present', earnedPoints: Math.round(MAX * 0.8), reason: `max-age=${age} (${Math.round(age / 86400)} day(s))`, warnings };
  if (age >= 300) return { status: 'weak', earnedPoints: Math.round(MAX * 0.4), reason: `max-age=${age} (${Math.round(age / 60)} minutes) — too short for production`, warnings };
  return { status: 'weak', earnedPoints: Math.round(MAX * 0.1), reason: `max-age=${age} is extremely short`, warnings };
}

// ── X-Content-Type-Options ────────────────────────────────────────────────────

interface XCTOQuality {
  status: SecurityHeaderStatus;
  earnedPoints: number;
  reason: string;
}

export function classifyXCTO(values: string[]): XCTOQuality {
  const MAX = 15;
  if (values.length === 0) return { status: 'missing', earnedPoints: 0, reason: 'X-Content-Type-Options is not present' };
  const val = values[values.length - 1].trim().toLowerCase();
  if (val === 'nosniff') return { status: 'strong', earnedPoints: MAX, reason: 'Correct value: nosniff' };
  return { status: 'malformed', earnedPoints: Math.round(MAX * 0.1), reason: `Invalid value "${values[values.length - 1]}" — must be exactly "nosniff"` };
}

// ── X-Frame-Options / frame-ancestors ────────────────────────────────────────

interface XFOQuality {
  status: SecurityHeaderStatus;
  earnedPoints: number;
  reason: string;
  safeToApplyDirectly: boolean;
}

export function classifyXFO(xfoValues: string[], cspParsed: ParsedCSP | null): XFOQuality {
  const MAX = 20;
  const hasFrameAncestors = !!(cspParsed && 'frame-ancestors' in cspParsed.directives);
  const hasXFO = xfoValues.length > 0;

  if (hasFrameAncestors && !hasXFO) {
    return {
      status: 'strong',
      earnedPoints: MAX,
      reason: 'Protected via CSP frame-ancestors (modern approach — preferred over X-Frame-Options)',
      safeToApplyDirectly: false,
    };
  }

  if (!hasFrameAncestors && !hasXFO) {
    return { status: 'missing', earnedPoints: 0, reason: 'No X-Frame-Options or CSP frame-ancestors directive', safeToApplyDirectly: true };
  }

  const xfoVal = (xfoValues[xfoValues.length - 1] ?? '').trim().toUpperCase();

  if (hasFrameAncestors && hasXFO) {
    // Both present — CSP takes precedence in modern browsers, report as present with note
    return {
      status: 'present',
      earnedPoints: Math.round(MAX * 0.9),
      reason: `Both X-Frame-Options (${xfoVal}) and CSP frame-ancestors are set. CSP takes precedence in modern browsers; XFO provides legacy coverage.`,
      safeToApplyDirectly: false,
    };
  }

  // Only XFO
  if (xfoVal === 'DENY' || xfoVal === 'SAMEORIGIN') {
    return { status: 'present', earnedPoints: Math.round(MAX * 0.9), reason: `X-Frame-Options: ${xfoVal}`, safeToApplyDirectly: true };
  }

  if (xfoVal.startsWith('ALLOW-FROM')) {
    return {
      status: 'weak',
      earnedPoints: Math.round(MAX * 0.25),
      reason: 'ALLOW-FROM is deprecated and not supported in Chrome, Firefox, or Safari',
      safeToApplyDirectly: false,
    };
  }

  return {
    status: 'malformed',
    earnedPoints: Math.round(MAX * 0.05),
    reason: `Unrecognized X-Frame-Options value: "${xfoValues[xfoValues.length - 1]}"`,
    safeToApplyDirectly: false,
  };
}

// ── Referrer-Policy ───────────────────────────────────────────────────────────

interface RPQuality {
  status: SecurityHeaderStatus;
  earnedPoints: number;
  reason: string;
}

const RP_STRONG = new Set(['no-referrer', 'strict-origin', 'same-origin', 'strict-origin-when-cross-origin']);
const RP_MODERATE = new Set(['no-referrer-when-downgrade', 'origin-when-cross-origin', 'origin']);
const RP_VALID = new Set([...RP_STRONG, ...RP_MODERATE, 'unsafe-url', '']);

export function classifyReferrerPolicy(values: string[]): RPQuality {
  const MAX = 10;
  if (values.length === 0) return { status: 'missing', earnedPoints: 0, reason: 'Referrer-Policy is not present' };

  const all = values.flatMap(v => v.split(',').map(p => p.trim().toLowerCase())).filter(p => RP_VALID.has(p));
  if (all.length === 0) return { status: 'malformed', earnedPoints: Math.round(MAX * 0.1), reason: `No valid Referrer-Policy value found in: "${values.join(', ')}"` };

  const effective = all[all.length - 1] || 'no-referrer-when-downgrade';

  if (RP_STRONG.has(effective)) return { status: 'strong', earnedPoints: MAX, reason: `"${effective}" — privacy-preserving` };
  if (RP_MODERATE.has(effective)) return { status: 'present', earnedPoints: Math.round(MAX * 0.7), reason: `"${effective}" — moderate privacy` };
  return { status: 'weak', earnedPoints: Math.round(MAX * 0.1), reason: '"unsafe-url" sends full URL including query parameters to all third-party origins' };
}

// ── Permissions-Policy (informational) ───────────────────────────────────────

export function classifyPermissionsPolicy(values: string[]): { status: SecurityHeaderStatus; reason: string } {
  if (values.length === 0) {
    return { status: 'missing', reason: 'Permissions-Policy is not present — manual review needed to determine whether any capabilities need restriction' };
  }
  return { status: 'present', reason: 'Permissions-Policy is present — verify the listed capabilities match the site\'s actual requirements' };
}

// ── Cross-Origin headers (informational) ─────────────────────────────────────

export function classifyCOOP(values: string[]): { status: SecurityHeaderStatus; reason: string; isApplicable: boolean } {
  if (values.length === 0) {
    return { status: 'missing', reason: 'Cross-Origin-Opener-Policy is not set — most sites do not require this unless using SharedArrayBuffer or high-resolution timers', isApplicable: false };
  }
  const val = values[values.length - 1].trim().toLowerCase();
  const valid = ['unsafe-none', 'same-origin-allow-popups', 'same-origin'];
  if (!valid.includes(val)) return { status: 'malformed', reason: `Unrecognized COOP value: "${values[values.length - 1]}"`, isApplicable: true };
  if (val === 'same-origin') return { status: 'strong', reason: 'COOP: same-origin — strict cross-origin isolation', isApplicable: true };
  if (val === 'same-origin-allow-popups') return { status: 'present', reason: 'COOP: same-origin-allow-popups — allows OAuth and payment pop-ups', isApplicable: true };
  return { status: 'weak', reason: 'COOP: unsafe-none — no cross-origin isolation', isApplicable: true };
}

export function classifyCOEP(values: string[]): { status: SecurityHeaderStatus; reason: string; isApplicable: boolean } {
  if (values.length === 0) {
    return { status: 'missing', reason: 'Cross-Origin-Embedder-Policy is not set — required only when using SharedArrayBuffer or high-resolution timers', isApplicable: false };
  }
  const val = values[values.length - 1].trim().toLowerCase();
  if (val === 'require-corp') return { status: 'strong', reason: 'COEP: require-corp', isApplicable: true };
  if (val === 'credentialless') return { status: 'present', reason: 'COEP: credentialless', isApplicable: true };
  if (val === 'unsafe-none') return { status: 'weak', reason: 'COEP: unsafe-none — no embedding restriction', isApplicable: true };
  return { status: 'malformed', reason: `Unrecognized COEP value: "${values[values.length - 1]}"`, isApplicable: true };
}

// ── Legacy headers detection ──────────────────────────────────────────────────

interface LegacyHeaderInfo {
  headerName: string;
  displayName: string;
  values: string[];
  warning: string;
  severity: SecurityHeaderSeverity;
}

function detectLegacyHeaders(rawHeaders: Record<string, string[]>): LegacyHeaderInfo[] {
  const legacy: LegacyHeaderInfo[] = [];

  const xxp = rawHeaders['x-xss-protection'] ?? [];
  if (xxp.length > 0) {
    legacy.push({
      headerName: 'x-xss-protection',
      displayName: 'X-XSS-Protection',
      values: xxp,
      warning: 'X-XSS-Protection is deprecated and removed from Chrome 78+. It does not substitute for CSP and may introduce security issues in some configurations. Remove this header.',
      severity: 'info',
    });
  }

  const hpkp = rawHeaders['public-key-pins'] ?? [];
  if (hpkp.length > 0) {
    legacy.push({
      headerName: 'public-key-pins',
      displayName: 'Public-Key-Pins (HPKP)',
      values: hpkp,
      warning: 'HPKP is deprecated and dangerous — a misconfiguration can make a domain permanently inaccessible. It was removed from all major browsers. Remove this header immediately.',
      severity: 'high',
    });
  }

  const hpkpro = rawHeaders['public-key-pins-report-only'] ?? [];
  if (hpkpro.length > 0) {
    legacy.push({
      headerName: 'public-key-pins-report-only',
      displayName: 'Public-Key-Pins-Report-Only (HPKP)',
      values: hpkpro,
      warning: 'HPKP Report-Only is deprecated. HPKP was removed from all major browsers. Remove this header.',
      severity: 'medium',
    });
  }

  const fp = rawHeaders['feature-policy'] ?? [];
  if (fp.length > 0) {
    legacy.push({
      headerName: 'feature-policy',
      displayName: 'Feature-Policy',
      values: fp,
      warning: 'Feature-Policy is deprecated and replaced by Permissions-Policy. Migrate to Permissions-Policy and remove Feature-Policy.',
      severity: 'info',
    });
  }

  const ect = rawHeaders['expect-ct'] ?? [];
  if (ect.length > 0) {
    legacy.push({
      headerName: 'expect-ct',
      displayName: 'Expect-CT',
      values: ect,
      warning: 'Expect-CT is deprecated (since May 2021). Certificate Transparency is now mandatory in all major browsers. This header has no effect and can be removed.',
      severity: 'info',
    });
  }

  return legacy;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function computeScore(headers: Record<string, SecurityHeaderAnalysisResult>): number | null {
  let totalWeight = 0;
  let earned = 0;

  for (const h of Object.values(headers)) {
    if (h.weight === 0) continue;
    if (h.applicability === 'not-applicable' || h.applicability === 'optional') continue;
    if (h.status === 'unavailable') continue;
    totalWeight += h.weight;
    earned += h.earnedPoints;
  }

  return totalWeight === 0 ? null : Math.round((earned / totalWeight) * 100);
}

function computeCoverage(
  headers: Record<string, SecurityHeaderAnalysisResult>,
  extra: string[],
): SecurityHeadersCoverage {
  const all = Object.values(headers);
  const supportedChecks = all.length;
  const unavailable = all.filter(h => h.status === 'unavailable').length;
  const notApplicable = all.filter(h => h.applicability === 'not-applicable').length;
  const executed = supportedChecks - unavailable;
  const percentage = supportedChecks > 0 ? Math.round((executed / supportedChecks) * 100) : 0;

  const limitations = [...extra];
  if (unavailable > 0) limitations.push(`${unavailable} check(s) could not be completed due to network issues`);

  return {
    supportedChecks,
    executedChecks: executed,
    unavailableChecks: unavailable,
    notApplicableChecks: notApplicable,
    percentage,
    limitations,
  };
}

// ── Verification step generator ───────────────────────────────────────────────

function buildVerificationSteps(h: SecurityHeaderAnalysisResult): string[] {
  const steps: string[] = [
    `Verify in browser DevTools → Network tab → select the document request → check Response Headers for "${h.displayName}"`,
  ];

  if (h.rolloutRisk !== 'low') {
    steps.push('Test the change in a staging environment before deploying to production');
  }

  if (h.headerName === 'content-security-policy') {
    steps.push('Deploy in Content-Security-Policy-Report-Only mode first');
    steps.push('Monitor violation reports for at least one release cycle before switching to enforcement');
    steps.push('Review every third-party script, stylesheet, font, and API origin before tightening sources');
  }

  if (h.headerName === 'strict-transport-security') {
    steps.push('Verify all pages and resources load over HTTPS before increasing max-age');
    steps.push('Verify all subdomains serve valid HTTPS certificates before adding includeSubDomains');
    steps.push('Only add the preload directive after reading https://hstspreload.org and confirming readiness');
  }

  if (h.headerName === 'permissions-policy') {
    steps.push('Audit the site for use of camera, microphone, geolocation, payment, and fullscreen APIs before restricting them');
  }

  if (h.headerName === 'cross-origin-opener-policy') {
    steps.push('Test OAuth pop-ups and third-party payment flows after adding COOP — some patterns require same-origin-allow-popups');
  }

  return steps;
}

// ── Finding builder ───────────────────────────────────────────────────────────

const SEVERITY_SORT: Record<SecurityHeaderSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

function buildFindings(
  headers: Record<string, SecurityHeaderAnalysisResult>,
  origin: string,
  requestedUrl: string,
): SecurityHeaderFinding[] {
  const findings: SecurityHeaderFinding[] = [];

  const PROBLEM_STATUSES: Set<SecurityHeaderStatus> = new Set([
    'missing', 'weak', 'malformed', 'conflicting',
  ]);

  for (const h of Object.values(headers)) {
    const isProblem = PROBLEM_STATUSES.has(h.status);
    const isDangerousLegacy =
      h.headerName === 'public-key-pins' || h.headerName === 'public-key-pins-report-only';
    const isLegacyPresent =
      ['x-xss-protection', 'feature-policy', 'expect-ct'].includes(h.headerName) && h.rawValues.length > 0;

    const shouldReport =
      (isProblem && (h.applicability === 'required' || isDangerousLegacy)) ||
      isDangerousLegacy ||
      isLegacyPresent;

    if (!shouldReport) continue;

    const title = isDangerousLegacy
      ? `${h.displayName} is a dangerous deprecated header — remove immediately`
      : isLegacyPresent
        ? `${h.displayName} is a deprecated header`
        : h.status === 'missing'
          ? `${h.displayName} is not set`
          : h.status === 'weak'
            ? `${h.displayName} is configured weakly`
            : h.status === 'malformed'
              ? `${h.displayName} has an invalid value`
              : `${h.displayName} has conflicting configuration`;

    findings.push({
      id: `sh-${h.headerName}-${h.status}`,
      ruleId: `security-header/${h.headerName}`,
      headerName: h.headerName,
      title,
      description: h.reason,
      status: h.status,
      severity: h.severity,
      confidence: 'high',
      affectedOrigins: [origin],
      affectedPages: [requestedUrl],
      recommendation: h.recommendation,
      rolloutRisk: h.rolloutRisk,
      safeToApplyDirectly: h.safeToApplyDirectly,
      verificationSteps: buildVerificationSteps(h),
      detectedValues: h.rawValues,
      weaknesses: (h.parsedDetails as any)?.weaknesses,
    });
  }

  findings.sort((a, b) => (SEVERITY_SORT[a.severity] ?? 5) - (SEVERITY_SORT[b.severity] ?? 5));
  return findings;
}

// ── Main exported function ────────────────────────────────────────────────────

export async function analyzeSecurityHeadersAsync(
  requestedUrl: string,
  finalResponse: Response,
  html: string,
): Promise<SecurityHeadersAuditResult> {
  const measuredAt = new Date().toISOString();
  const finalUrl = finalResponse.url || requestedUrl;
  const isHttps = finalUrl.startsWith('https://') || requestedUrl.startsWith('https://');
  const warnings: string[] = [];
  const errors: string[] = [];

  // Capture redirect chain with a separate lightweight fetch sequence
  let redirectChain: RedirectHop[] = [];
  try {
    const chainResult = await fetchRedirectChain(requestedUrl);
    redirectChain = chainResult.chain;
    if (chainResult.error) {
      warnings.push(`Redirect chain capture: ${chainResult.error}`);
    }
  } catch {
    warnings.push('Redirect chain capture failed — redirect evidence unavailable');
  }

  // Extract raw header values from final response (the authoritative source)
  const rawHeaders: Record<string, string[]> = {};
  try {
    finalResponse.headers.forEach((value, name) => {
      const norm = name.toLowerCase();
      // Never log security-sensitive headers in plaintext
      if (['cookie', 'set-cookie', 'authorization', 'proxy-authorization'].includes(norm)) return;
      if (!rawHeaders[norm]) rawHeaders[norm] = [];
      rawHeaders[norm].push(value);
    });
  } catch {
    errors.push('Failed to read response headers — header analysis is unavailable');
    const unavailableStatus: SecurityHeaderStatus = 'unavailable';
    return buildUnavailableResult(requestedUrl, finalUrl, measuredAt, isHttps, redirectChain, errors);
  }

  // meta http-equiv CSP detection (informational — not a scored substitute for the header)
  const metaCSPValues = extractMetaCSP(html);
  if (metaCSPValues.length > 0) {
    warnings.push(
      'CSP found in <meta http-equiv="Content-Security-Policy"> — note: meta CSP cannot enforce frame-ancestors, sandbox, or report-uri directives',
    );
  }

  // Collect per-header raw values
  const cspValues = rawHeaders['content-security-policy'] ?? [];
  const cspROValues = rawHeaders['content-security-policy-report-only'] ?? [];
  const hstsValues = rawHeaders['strict-transport-security'] ?? [];
  const xctoValues = rawHeaders['x-content-type-options'] ?? [];
  const xfoValues = rawHeaders['x-frame-options'] ?? [];
  const rpValues = rawHeaders['referrer-policy'] ?? [];
  const ppValues = rawHeaders['permissions-policy'] ?? [];
  const coopValues = rawHeaders['cross-origin-opener-policy'] ?? [];
  const coepValues = rawHeaders['cross-origin-embedder-policy'] ?? [];

  // Parse enforced CSP so XFO analysis can see frame-ancestors
  const enforcedCSPParsed = cspValues.length > 0 ? parseCSPValue(cspValues.join('; ')) : null;

  // Classify each required header
  const cspQ = classifyCSPQuality(cspValues, cspROValues, isHttps);
  const hstsQ = classifyHSTS(hstsValues, isHttps);
  const xctoQ = classifyXCTO(xctoValues);
  const xfoQ = classifyXFO(xfoValues, enforcedCSPParsed);
  const rpQ = classifyReferrerPolicy(rpValues);
  const ppQ = classifyPermissionsPolicy(ppValues);
  const coopQ = classifyCOOP(coopValues);
  const coepQ = classifyCOEP(coepValues);
  const legacyHeaders = detectLegacyHeaders(rawHeaders);

  // Propagate HSTS warnings
  for (const w of hstsQ.warnings) warnings.push(w);

  // Build headers map
  const headers: Record<string, SecurityHeaderAnalysisResult> = {
    'content-security-policy': {
      headerName: 'content-security-policy',
      displayName: 'Content-Security-Policy',
      status: cspQ.status,
      severity: 'critical',
      applicability: 'required',
      weight: 30,
      earnedPoints: cspQ.earnedPoints,
      rawValues: [...cspValues, ...cspROValues.map(v => `(report-only) ${v}`)],
      normalizedValue: cspValues.length > 0 ? cspValues[cspValues.length - 1] : null,
      parsedDetails: enforcedCSPParsed
        ? { directives: enforcedCSPParsed.directives, weaknesses: cspQ.weaknesses, hasReportOnly: cspROValues.length > 0, parseErrors: enforcedCSPParsed.parseErrors }
        : cspROValues.length > 0
          ? { weaknesses: cspQ.weaknesses, hasReportOnly: true }
          : undefined,
      source: 'final-response',
      rolloutRisk: 'very-high',
      safeToApplyDirectly: false,
      reason: cspQ.weaknesses.length > 0
        ? cspQ.weaknesses[0]
        : cspValues.length > 0
          ? 'Content-Security-Policy is present and well-configured'
          : 'Content-Security-Policy is not present',
      recommendation: cspValues.length > 0
        ? cspQ.weaknesses.length > 0
          ? "Inventory all script and style sources, then tighten the policy. Never use 'unsafe-inline' without nonces. Deploy changes in Report-Only mode first."
          : 'CSP is present. Review periodically as third-party dependencies change.'
        : "Introduce Content-Security-Policy-Report-Only first. A production policy must be tailored to this site's actual scripts, styles, images, fonts, and API origins — a generic policy will break analytics, payments, and third-party services.",
    },

    'strict-transport-security': {
      headerName: 'strict-transport-security',
      displayName: 'Strict-Transport-Security',
      status: hstsQ.status,
      severity: 'high',
      applicability: isHttps ? 'required' : 'not-applicable',
      weight: isHttps ? 25 : 0,
      earnedPoints: hstsQ.earnedPoints,
      rawValues: hstsValues,
      normalizedValue: hstsValues.length > 0 ? hstsValues[hstsValues.length - 1] : null,
      source: 'final-response',
      rolloutRisk: 'medium',
      safeToApplyDirectly: false,
      reason: hstsQ.reason,
      recommendation: hstsValues.length === 0
        ? 'Start with Strict-Transport-Security: max-age=300 in staging. Increase gradually (300 → 86400 → 604800 → 31536000). Do not jump to a long max-age or add preload without extensive validation.'
        : hstsQ.status === 'strong'
          ? 'HSTS is well-configured. Monitor for preload list inclusion if preload flag is set.'
          : 'Increase max-age gradually after validating in staging. Ensure all subdomains serve HTTPS before adding includeSubDomains.',
    },

    'x-content-type-options': {
      headerName: 'x-content-type-options',
      displayName: 'X-Content-Type-Options',
      status: xctoQ.status,
      severity: 'medium',
      applicability: 'required',
      weight: 15,
      earnedPoints: xctoQ.earnedPoints,
      rawValues: xctoValues,
      normalizedValue: xctoValues.length > 0 ? xctoValues[xctoValues.length - 1] : null,
      source: 'final-response',
      rolloutRisk: 'low',
      safeToApplyDirectly: true,
      reason: xctoQ.reason,
      recommendation: xctoValues.length === 0
        ? 'Add X-Content-Type-Options: nosniff — safe to deploy directly in most configurations.'
        : xctoQ.status !== 'strong'
          ? 'The value must be exactly "nosniff" (case-insensitive).'
          : 'Correctly configured.',
    },

    'x-frame-options': {
      headerName: 'x-frame-options',
      displayName: 'X-Frame-Options / frame-ancestors',
      status: xfoQ.status,
      severity: 'medium',
      applicability: 'required',
      weight: 20,
      earnedPoints: xfoQ.earnedPoints,
      rawValues: xfoValues,
      normalizedValue: xfoValues.length > 0 ? xfoValues[xfoValues.length - 1] : null,
      source: 'final-response',
      rolloutRisk: xfoQ.safeToApplyDirectly ? 'low' : 'medium',
      safeToApplyDirectly: xfoQ.safeToApplyDirectly,
      reason: xfoQ.reason,
      recommendation: xfoQ.status === 'missing'
        ? 'Add X-Frame-Options: SAMEORIGIN — or add frame-ancestors to your CSP. Safe to add if the site does not intentionally allow embedding in third-party iframes.'
        : xfoQ.status === 'strong' || xfoQ.status === 'present'
          ? xfoQ.reason
          : xfoQ.reason,
    },

    'referrer-policy': {
      headerName: 'referrer-policy',
      displayName: 'Referrer-Policy',
      status: rpQ.status,
      severity: 'medium',
      applicability: 'required',
      weight: 10,
      earnedPoints: rpQ.earnedPoints,
      rawValues: rpValues,
      normalizedValue: rpValues.length > 0 ? rpValues[rpValues.length - 1] : null,
      source: 'final-response',
      rolloutRisk: 'low',
      safeToApplyDirectly: true,
      reason: rpQ.reason,
      recommendation: rpValues.length === 0
        ? 'Add Referrer-Policy: strict-origin-when-cross-origin — balances analytics tracking with privacy protection.'
        : rpQ.status === 'weak'
          ? 'Change to strict-origin-when-cross-origin unless cross-origin referrer information is explicitly required by integrations.'
          : 'Referrer-Policy is configured appropriately.',
    },

    'permissions-policy': {
      headerName: 'permissions-policy',
      displayName: 'Permissions-Policy',
      status: ppQ.status,
      severity: 'low',
      applicability: 'recommended',
      weight: 0,
      earnedPoints: 0,
      rawValues: ppValues,
      normalizedValue: ppValues.length > 0 ? ppValues[ppValues.length - 1] : null,
      source: 'final-response',
      rolloutRisk: 'medium',
      safeToApplyDirectly: false,
      reason: ppQ.reason,
      recommendation: 'Audit which browser capabilities (camera, microphone, geolocation, payment, fullscreen) this site requires. Explicitly disable unused features. Do not restrict capabilities the site genuinely uses. Test in staging.',
    },

    'cross-origin-opener-policy': {
      headerName: 'cross-origin-opener-policy',
      displayName: 'Cross-Origin-Opener-Policy',
      status: coopQ.status,
      severity: 'low',
      applicability: coopQ.isApplicable ? 'optional' : 'not-applicable',
      weight: 0,
      earnedPoints: 0,
      rawValues: coopValues,
      normalizedValue: coopValues.length > 0 ? coopValues[coopValues.length - 1] : null,
      source: 'final-response',
      rolloutRisk: 'high',
      safeToApplyDirectly: false,
      reason: coopQ.reason,
      recommendation: 'Add COOP only if this site uses SharedArrayBuffer or high-resolution timers. Test all OAuth pop-ups and payment flows in staging — COOP can break them.',
    },

    'cross-origin-embedder-policy': {
      headerName: 'cross-origin-embedder-policy',
      displayName: 'Cross-Origin-Embedder-Policy',
      status: coepQ.status,
      severity: 'info',
      applicability: coepQ.isApplicable ? 'optional' : 'not-applicable',
      weight: 0,
      earnedPoints: 0,
      rawValues: coepValues,
      normalizedValue: coepValues.length > 0 ? coepValues[coepValues.length - 1] : null,
      source: 'final-response',
      rolloutRisk: 'high',
      safeToApplyDirectly: false,
      reason: coepQ.reason,
      recommendation: 'COEP is required only when using SharedArrayBuffer or high-resolution timers alongside COOP. It will block third-party resources that do not set CORP. Test extensively in staging.',
    },
  };

  // Add detected legacy headers as informational entries
  for (const legacy of legacyHeaders) {
    headers[legacy.headerName] = {
      headerName: legacy.headerName,
      displayName: legacy.displayName,
      status: legacy.severity === 'high' ? 'weak' : 'present',
      severity: legacy.severity,
      applicability: 'optional',
      weight: 0,
      earnedPoints: 0,
      rawValues: legacy.values,
      normalizedValue: legacy.values[0] ?? null,
      source: 'final-response',
      rolloutRisk: 'low',
      safeToApplyDirectly: false,
      reason: legacy.warning,
      recommendation: legacy.warning,
    };
  }

  const score = computeScore(headers);

  // Summary counts
  const summary = {
    strong: 0, present: 0, weak: 0, malformed: 0, conflicting: 0, missing: 0, unavailable: 0, notApplicable: 0,
  };
  for (const h of Object.values(headers)) {
    if (h.status === 'strong') summary.strong++;
    else if (h.status === 'present') summary.present++;
    else if (h.status === 'weak') summary.weak++;
    else if (h.status === 'malformed') summary.malformed++;
    else if (h.status === 'conflicting') summary.conflicting++;
    else if (h.status === 'missing') summary.missing++;
    else if (h.status === 'unavailable') summary.unavailable++;
    else if (h.status === 'not-applicable') summary.notApplicable++;
  }

  const scoreBreakdown: SecurityHeaderScoreBreakdown[] = Object.values(headers)
    .filter(h => h.weight > 0 || h.applicability === 'required')
    .map(h => ({
      headerName: h.headerName,
      displayName: h.displayName,
      applicability: h.applicability,
      weight: h.weight,
      earnedPoints: h.earnedPoints,
      status: h.status,
      reason: h.reason,
    }));

  let origin = finalUrl;
  try { origin = new URL(finalUrl).origin; } catch {}

  const findings = buildFindings(headers, origin, requestedUrl);
  const coverage = computeCoverage(headers, warnings);

  return {
    score,
    scoreVersion: 'security-headers-v2',
    testedUrl: requestedUrl,
    finalUrl,
    measuredAt,
    isHttps,
    redirectChain,
    headers,
    findings,
    scoreBreakdown,
    coverage,
    summary,
    warnings,
    errors,
  };
}

function buildUnavailableResult(
  requestedUrl: string,
  finalUrl: string,
  measuredAt: string,
  isHttps: boolean,
  redirectChain: RedirectHop[],
  errors: string[],
): SecurityHeadersAuditResult {
  return {
    score: null,
    scoreVersion: 'security-headers-v2',
    testedUrl: requestedUrl,
    finalUrl,
    measuredAt,
    isHttps,
    redirectChain,
    headers: {},
    findings: [],
    scoreBreakdown: [],
    coverage: { supportedChecks: 0, executedChecks: 0, unavailableChecks: 0, notApplicableChecks: 0, percentage: 0, limitations: errors },
    summary: { strong: 0, present: 0, weak: 0, malformed: 0, conflicting: 0, missing: 0, unavailable: 0, notApplicable: 0 },
    warnings: [],
    errors,
    error: { code: 'HEADER_ACCESS_ERROR', message: errors[0] ?? 'Header analysis unavailable', retryable: true },
  };
}
