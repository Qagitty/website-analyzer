// Best Practices Audit Engine — v1 (fetch-only / static mode)
// Sections 5–31 of the Best Practices Audit spec.
//
// All checks run from HTML source + HTTP response headers.
// Browser-only checks (console errors, rendered DOM, network tab) are
// marked 'unavailable' and do NOT reduce the score — coverage is reduced instead.

import type {
  BestPracticesAuditResult,
  BestPracticesPageResult,
  BestPracticeFinding,
  BestPracticeScoreBreakdown,
  BestPracticeCoverage,
  SecurityHeaderDetail,
  BestPracticeEvidence,
  BestPracticeSeverity,
  BestPracticeCategory,
  BestPracticeSource,
} from '../../types/best-practices';

// ── Scoring weights (sum = 1.0) ───────────────────────────────────────────────
// Runtime quality (browser console / network) is intentionally absent from
// weights — it is unavailable in fetch-only mode and must not affect the score.
const CATEGORY_WEIGHTS: Record<string, number> = {
  'security-headers':   0.28,
  'https':              0.18,
  'mixed-content':      0.12,
  'third-party':        0.10,
  'external-links':     0.07,
  'deprecated-api':     0.07,
  'resource-integrity': 0.06,
  'cookies':            0.05,
  'iframes':            0.04,
  'pwa':                0.03,
};

// Severity weights for score deduction calculations
const SEVERITY_WEIGHT: Record<BestPracticeSeverity, number> = {
  critical: 4,
  high:     2,
  medium:   1,
  low:      0.5,
  info:     0,
};

const SCORE_VERSION = 'bp-v1';

// ── Helpers ───────────────────────────────────────────────────────────────────

let _findingCounter = 0;
function newId(): string {
  return `bp-${Date.now()}-${++_findingCounter}`;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function isSameOrigin(urlA: string, urlB: string): boolean {
  try {
    return new URL(urlA).origin === new URL(urlB).origin;
  } catch {
    return false;
  }
}

function getOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}

function snippet(s: string, max = 120): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ── Security Headers ──────────────────────────────────────────────────────────

interface HeaderSpec {
  header: string;
  ruleId: string;
  severity: BestPracticeSeverity;
  rolloutRisk: 'low' | 'medium' | 'high';
  safeToApply: boolean;
}

const HEADER_SPECS: HeaderSpec[] = [
  { header: 'content-security-policy',     ruleId: 'hdr-csp',         severity: 'high',   rolloutRisk: 'high',   safeToApply: false },
  { header: 'strict-transport-security',    ruleId: 'hdr-hsts',        severity: 'high',   rolloutRisk: 'medium', safeToApply: false },
  { header: 'x-content-type-options',       ruleId: 'hdr-xcto',        severity: 'medium', rolloutRisk: 'low',    safeToApply: true  },
  { header: 'referrer-policy',              ruleId: 'hdr-rp',          severity: 'medium', rolloutRisk: 'low',    safeToApply: true  },
  { header: 'permissions-policy',           ruleId: 'hdr-pp',          severity: 'low',    rolloutRisk: 'medium', safeToApply: false },
  { header: 'x-frame-options',              ruleId: 'hdr-xfo',         severity: 'medium', rolloutRisk: 'low',    safeToApply: true  },
  { header: 'cross-origin-opener-policy',   ruleId: 'hdr-coop',        severity: 'low',    rolloutRisk: 'high',   safeToApply: false },
];

// Referrer-Policy value classification
function classifyReferrerPolicy(value: string): 'privacy-preserving' | 'balanced' | 'permissive' | 'potentially-risky' | 'malformed' {
  const v = value.toLowerCase().trim();
  if (v === 'no-referrer' || v === 'same-origin' || v === 'strict-origin') return 'privacy-preserving';
  if (v === 'strict-origin-when-cross-origin' || v === 'origin-when-cross-origin' || v === 'origin') return 'balanced';
  if (v === 'no-referrer-when-downgrade') return 'permissive';
  if (v === 'unsafe-url') return 'potentially-risky';
  if (v === '') return 'malformed';
  return 'balanced';
}

function classifyCSP(value: string | null): 'strong' | 'moderate' | 'weak' | 'absent' | 'report-only' {
  if (!value) return 'absent';
  const lower = value.toLowerCase();
  if (lower.includes("'unsafe-eval'") && lower.includes("'unsafe-inline'")) return 'weak';
  if (lower.includes("'unsafe-inline'") || lower.includes("'unsafe-eval'")) return 'moderate';
  if (lower.includes('default-src') || lower.includes('script-src')) return 'strong';
  return 'moderate';
}

function assessHSTS(value: string | null): { maxAge: number | null; includesSubDomains: boolean; hasPreload: boolean; weak: boolean } {
  if (!value) return { maxAge: null, includesSubDomains: false, hasPreload: false, weak: true };
  const maxAgeMatch = /max-age\s*=\s*(\d+)/i.exec(value);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : null;
  const includesSubDomains = /includesubdomains/i.test(value);
  const hasPreload = /preload/i.test(value);
  const weak = maxAge === null || maxAge < 86400;
  return { maxAge, includesSubDomains, hasPreload, weak };
}

function checkCSPFrameAncestors(cspValue: string | null): boolean {
  if (!cspValue) return false;
  return /frame-ancestors\s+\S/i.test(cspValue);
}

function analyzeSecurityHeaderDetails(response: Response): SecurityHeaderDetail[] {
  const cspValue = response.headers.get('content-security-policy');
  const csproValue = response.headers.get('content-security-policy-report-only');
  const hstsValue = response.headers.get('strict-transport-security');
  const xctoValue = response.headers.get('x-content-type-options');
  const rpValue = response.headers.get('referrer-policy');
  const ppValue = response.headers.get('permissions-policy');
  const xfoValue = response.headers.get('x-frame-options');
  const coopValue = response.headers.get('cross-origin-opener-policy');
  const isHttps = response.url.startsWith('https://');

  const details: SecurityHeaderDetail[] = [];

  // CSP
  const cspClass = classifyCSP(cspValue);
  details.push({
    header: 'Content-Security-Policy',
    present: !!cspValue,
    value: cspValue,
    status: cspValue
      ? (cspClass === 'weak' ? 'present-weak' : 'present-strong')
      : csproValue ? 'present-weak'
      : 'absent',
    strength: cspValue ? (cspClass === 'strong' ? 'strong' : cspClass === 'moderate' ? 'moderate' : 'weak') : 'absent',
    recommendation: cspValue
      ? (cspClass === 'weak'
          ? 'CSP is present but uses unsafe-inline or unsafe-eval. Inventory your scripts and styles, then tighten the policy.'
          : 'CSP is present. Review periodically as your third-party dependencies change.')
      : csproValue
        ? 'Content-Security-Policy-Report-Only is active. Collect and review violations, then enforce the policy.'
        : 'Introduce CSP in Report-Only mode first. A production policy must be tailored to the site\'s actual scripts, styles, images, frames, fonts, and API origins. Set report-uri to collect violations before enforcing.',
    rolloutRisk: 'high',
    safeToApplyDirectly: false,
    notes: csproValue ? 'Content-Security-Policy-Report-Only is also present.' : undefined,
  });

  // HSTS
  const hsts = assessHSTS(hstsValue);
  details.push({
    header: 'Strict-Transport-Security',
    present: !!hstsValue,
    value: hstsValue,
    status: !isHttps ? 'not-applicable'
      : hstsValue ? (hsts.weak ? 'present-weak' : 'present-strong')
      : 'absent',
    strength: !isHttps ? 'unknown'
      : hstsValue ? (hsts.weak ? 'weak' : hsts.maxAge! >= 31536000 ? 'strong' : 'moderate')
      : 'absent',
    recommendation: !hstsValue
      ? 'Start with Strict-Transport-Security: max-age=300 in staging. Increase max-age gradually (300 → 86400 → 604800 → 31536000). Only add includeSubDomains after verifying all subdomains support HTTPS. Submit to the HSTS preload list only when ready to make the commitment permanent.'
      : hsts.weak
        ? `Current max-age is ${hsts.maxAge ?? 'missing'}. Increase to at least 86400 (1 day) after staging validation.`
        : 'HSTS is present and reasonably configured.',
    rolloutRisk: 'medium',
    safeToApplyDirectly: false,
    notes: hsts.hasPreload
      ? 'Preload flag is set. Ensure the site is ready — HSTS preloading is difficult to reverse.'
      : undefined,
  });

  // X-Content-Type-Options
  const xctoLower = xctoValue?.toLowerCase().trim() ?? '';
  details.push({
    header: 'X-Content-Type-Options',
    present: !!xctoValue,
    value: xctoValue,
    status: xctoValue
      ? (xctoLower === 'nosniff' ? 'present-strong' : 'present-weak')
      : 'absent',
    strength: xctoValue ? (xctoLower === 'nosniff' ? 'strong' : 'weak') : 'absent',
    recommendation: xctoValue
      ? (xctoLower !== 'nosniff' ? 'Value should be exactly "nosniff".' : 'Correct value set.')
      : 'Add: X-Content-Type-Options: nosniff — safe to add directly in most configurations.',
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
  });

  // Referrer-Policy
  const rpClass = rpValue ? classifyReferrerPolicy(rpValue) : null;
  details.push({
    header: 'Referrer-Policy',
    present: !!rpValue,
    value: rpValue,
    status: rpValue
      ? (rpClass === 'potentially-risky' || rpClass === 'malformed' ? 'present-weak' : 'present-strong')
      : 'absent',
    strength: rpValue
      ? (rpClass === 'privacy-preserving' || rpClass === 'balanced' ? 'strong' : rpClass === 'permissive' ? 'moderate' : 'weak')
      : 'absent',
    recommendation: !rpValue
      ? 'Add: Referrer-Policy: strict-origin-when-cross-origin — balances analytics tracking with privacy.'
      : rpClass === 'potentially-risky'
        ? 'unsafe-url sends the full URL including query strings to all third-party origins. Change to strict-origin-when-cross-origin unless cross-origin referrer data is explicitly required.'
        : rpClass === 'malformed'
          ? 'Value appears malformed. Verify the header syntax.'
          : `Current policy "${rpValue}" is ${rpClass}.`,
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
  });

  // Permissions-Policy
  details.push({
    header: 'Permissions-Policy',
    present: !!ppValue,
    value: ppValue,
    status: ppValue ? 'present-strong' : 'absent',
    strength: ppValue ? 'moderate' : 'absent',
    recommendation: ppValue
      ? 'Permissions-Policy is present. Review whether all listed capabilities are required for this page.'
      : 'Review whether the site needs camera, microphone, geolocation, payment, or fullscreen. Explicitly disable unused features. Do not restrict capabilities the site genuinely uses. Test in staging.',
    rolloutRisk: 'medium',
    safeToApplyDirectly: false,
    notes: 'Manual review required — this tool cannot detect which browser APIs the site uses at runtime.',
  });

  // X-Frame-Options / frame-ancestors
  const hasFrameAncestors = checkCSPFrameAncestors(cspValue);
  details.push({
    header: 'X-Frame-Options',
    present: !!xfoValue || hasFrameAncestors,
    value: xfoValue,
    status: hasFrameAncestors
      ? 'present-strong'
      : xfoValue
        ? (/^(deny|sameorigin)$/i.test(xfoValue.trim()) ? 'present-strong' : 'present-weak')
        : 'absent',
    strength: hasFrameAncestors || (xfoValue && /^(deny|sameorigin)$/i.test(xfoValue.trim())) ? 'strong' : xfoValue ? 'weak' : 'absent',
    recommendation: hasFrameAncestors
      ? 'CSP frame-ancestors provides equivalent framing protection. X-Frame-Options is optional for modern browsers.'
      : xfoValue
        ? (/^(deny|sameorigin)$/i.test(xfoValue.trim())
            ? 'X-Frame-Options is correctly set.'
            : `Value "${xfoValue}" may not be recognised by all browsers. Use DENY or SAMEORIGIN.`)
        : 'Add: X-Frame-Options: SAMEORIGIN — or use CSP frame-ancestors. Safe to add if the site does not intentionally support embedding in third-party iframes.',
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    notes: hasFrameAncestors ? 'Protected via CSP frame-ancestors directive.' : undefined,
  });

  // COOP
  details.push({
    header: 'Cross-Origin-Opener-Policy',
    present: !!coopValue,
    value: coopValue,
    status: coopValue ? 'present-strong' : 'absent',
    strength: coopValue ? 'moderate' : 'absent',
    recommendation: coopValue
      ? 'COOP is present.'
      : 'Consider Cross-Origin-Opener-Policy: same-origin to isolate your browsing context from cross-origin windows. Test in staging — COOP can break OAuth pop-ups and third-party payment flows.',
    rolloutRisk: 'high',
    safeToApplyDirectly: false,
  });

  return details;
}

// ── Security header findings ──────────────────────────────────────────────────

function checkSecurityHeaders(
  response: Response,
  headerDetails: SecurityHeaderDetail[],
  findings: BestPracticeFinding[],
  url: string,
): void {
  const cspValue = response.headers.get('content-security-policy');
  const csproValue = response.headers.get('content-security-policy-report-only');

  for (const detail of headerDetails) {
    const headerLower = detail.header.toLowerCase();
    const spec = HEADER_SPECS.find(s => s.header === headerLower);
    if (!spec) continue;

    // X-Frame-Options: skip failed finding if frame-ancestors covers it
    if (headerLower === 'x-frame-options') {
      const hasFrameAncestors = checkCSPFrameAncestors(cspValue);
      if (!detail.present && !hasFrameAncestors) {
        findings.push({
          id: newId(), ruleId: 'hdr-xfo-missing',
          category: 'security-headers', title: 'No framing protection',
          description: 'Neither X-Frame-Options nor CSP frame-ancestors is set. This page can be embedded in cross-origin iframes, enabling clickjacking attacks.',
          status: 'failed', severity: 'medium', confidence: 'high', source: 'http-header',
          affectedPages: [url],
          evidence: [{ headerName: 'X-Frame-Options', expected: 'DENY or SAMEORIGIN', actual: 'absent', source: 'http-header' }],
          recommendation: 'Add X-Frame-Options: SAMEORIGIN or include frame-ancestors in your CSP. Safe to add directly if the site does not intentionally support third-party iframe embedding.',
          safeToApplyDirectly: true,
          verificationSteps: ['Verify the header appears in browser DevTools → Network → Headers for the HTML response.', 'Test that the page cannot be embedded in a cross-origin iframe.'],
        });
      } else if (detail.present || hasFrameAncestors) {
        findings.push({
          id: newId(), ruleId: 'hdr-xfo-present',
          category: 'security-headers', title: 'Framing protection active',
          description: hasFrameAncestors ? 'CSP frame-ancestors directive provides framing protection.' : `X-Frame-Options: ${detail.value} is set.`,
          status: 'passed', severity: 'info', confidence: 'high', source: 'http-header',
          affectedPages: [url], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
        });
      }
      continue;
    }

    // CSP
    if (headerLower === 'content-security-policy') {
      if (!cspValue && !csproValue) {
        findings.push({
          id: newId(), ruleId: 'hdr-csp-missing',
          category: 'security-headers', title: 'No Content Security Policy',
          description: 'No Content-Security-Policy or Content-Security-Policy-Report-Only header was detected. Without CSP the page has no declarative XSS mitigation.',
          status: 'failed', severity: 'high', confidence: 'high', source: 'http-header',
          affectedPages: [url],
          evidence: [{ headerName: 'Content-Security-Policy', expected: 'A policy directive', actual: 'absent', source: 'http-header' }],
          recommendation: 'Introduce CSP in Report-Only mode first. Inventory all resource origins, then craft a policy tailored to this site. Do not copy a generic policy — it will break analytics, payment providers, and other third-party services.',
          safeToApplyDirectly: false,
          verificationSteps: ['Add Content-Security-Policy-Report-Only: default-src \'self\' to the staging server.', 'Collect violation reports for one full traffic cycle.', 'Review violations and adjust the policy before enforcing.'],
        });
      } else if (csproValue && !cspValue) {
        findings.push({
          id: newId(), ruleId: 'hdr-csp-report-only',
          category: 'security-headers', title: 'CSP in Report-Only mode',
          description: 'Content-Security-Policy-Report-Only is active. This is a valid staged rollout approach — violations are reported but not blocked.',
          status: 'warning', severity: 'medium', confidence: 'high', source: 'http-header',
          affectedPages: [url],
          evidence: [{ headerName: 'Content-Security-Policy-Report-Only', actual: snippet(csproValue), source: 'http-header' }],
          recommendation: 'Continue collecting violation reports. Once violations are resolved, graduate to the enforcing Content-Security-Policy header.',
          safeToApplyDirectly: false,
          verificationSteps: ['Verify violation reports are being received at your report-uri endpoint.', 'Review all violation types before enforcing.'],
        });
      } else if (cspValue) {
        const cspClass = classifyCSP(cspValue);
        if (cspClass === 'weak') {
          findings.push({
            id: newId(), ruleId: 'hdr-csp-weak',
            category: 'security-headers', title: 'CSP uses unsafe directives',
            description: "Content-Security-Policy is present but uses 'unsafe-inline' and/or 'unsafe-eval', which significantly weaken XSS protection.",
            status: 'warning', severity: 'medium', confidence: 'high', source: 'http-header',
            affectedPages: [url],
            evidence: [{ headerName: 'Content-Security-Policy', actual: snippet(cspValue), source: 'http-header' }],
            recommendation: "Audit scripts and styles to remove reliance on unsafe-inline. Use nonces or hashes for inline scripts instead of 'unsafe-inline'. Never remove these directives without thorough staging testing.",
            safeToApplyDirectly: false,
            verificationSteps: ['Identify inline scripts and styles.', 'Replace unsafe-inline with nonces or hashes for each.', 'Use CSP evaluator tools to assess the updated policy.'],
          });
        } else {
          findings.push({
            id: newId(), ruleId: 'hdr-csp-present',
            category: 'security-headers', title: 'Content Security Policy active',
            description: `CSP is present (${cspClass} strength).`,
            status: 'passed', severity: 'info', confidence: 'high', source: 'http-header',
            affectedPages: [url], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
          });
        }
      }
      continue;
    }

    // HSTS
    if (headerLower === 'strict-transport-security') {
      const isHttps = response.url.startsWith('https://');
      if (!isHttps) {
        findings.push({
          id: newId(), ruleId: 'hdr-hsts-not-https',
          category: 'https', title: 'HSTS cannot be set over HTTP',
          description: 'Strict-Transport-Security headers are ignored by browsers when the page is served over HTTP.',
          status: 'not-applicable', severity: 'info', confidence: 'high', source: 'http-header',
          affectedPages: [url], evidence: [], recommendation: 'Migrate to HTTPS first, then add HSTS.', safeToApplyDirectly: false, verificationSteps: [],
        });
      } else if (!detail.present) {
        findings.push({
          id: newId(), ruleId: 'hdr-hsts-missing',
          category: 'security-headers', title: 'No Strict-Transport-Security (HSTS)',
          description: 'HSTS is not set. Browsers will not automatically upgrade HTTP requests to HTTPS on subsequent visits, leaving users vulnerable to SSL-stripping attacks.',
          status: 'failed', severity: 'high', confidence: 'high', source: 'http-header',
          affectedPages: [url],
          evidence: [{ headerName: 'Strict-Transport-Security', expected: 'max-age=31536000', actual: 'absent', source: 'http-header' }],
          recommendation: 'Start with a short max-age (e.g., 300) in staging. Increase gradually (300 → 86400 → 604800 → 31536000). Add includeSubDomains only after verifying all subdomains support HTTPS.',
          safeToApplyDirectly: false,
          verificationSteps: ['Verify the site and all subdomains are fully HTTPS.', 'Add a short max-age to staging first.', 'Monitor for issues over at least one week before increasing max-age.'],
        });
      } else {
        const hsts = assessHSTS(detail.value);
        if (hsts.weak) {
          findings.push({
            id: newId(), ruleId: 'hdr-hsts-weak',
            category: 'security-headers', title: 'HSTS max-age is too short',
            description: `HSTS is present but max-age=${hsts.maxAge ?? 'missing'} is below the recommended minimum of 86400 seconds (1 day).`,
            status: 'warning', severity: 'low', confidence: 'high', source: 'http-header',
            affectedPages: [url],
            evidence: [{ headerName: 'Strict-Transport-Security', actual: detail.value ?? '', source: 'http-header' }],
            recommendation: 'Increase max-age gradually after staging validation. Target 31536000 (1 year).',
            safeToApplyDirectly: false,
            verificationSteps: ['Confirm all site assets load over HTTPS.', 'Increase max-age in steps.'],
          });
        } else {
          findings.push({
            id: newId(), ruleId: 'hdr-hsts-present',
            category: 'security-headers', title: 'HSTS configured',
            description: `HSTS is present with max-age=${hsts.maxAge}.`,
            status: 'passed', severity: 'info', confidence: 'high', source: 'http-header',
            affectedPages: [url], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
          });
        }
      }
      continue;
    }

    // X-Content-Type-Options
    if (headerLower === 'x-content-type-options') {
      if (!detail.present) {
        findings.push({
          id: newId(), ruleId: 'hdr-xcto-missing',
          category: 'security-headers', title: 'X-Content-Type-Options not set',
          description: 'Without X-Content-Type-Options: nosniff, browsers may interpret files with incorrect MIME types, creating potential XSS vectors.',
          status: 'failed', severity: 'medium', confidence: 'high', source: 'http-header',
          affectedPages: [url],
          evidence: [{ headerName: 'X-Content-Type-Options', expected: 'nosniff', actual: 'absent', source: 'http-header' }],
          recommendation: 'Add: X-Content-Type-Options: nosniff — safe to add directly in most server configurations.',
          safeToApplyDirectly: true,
          verificationSteps: ['Add the header and verify with curl -I or browser DevTools.'],
        });
      } else {
        const correct = (detail.value ?? '').toLowerCase().trim() === 'nosniff';
        findings.push({
          id: newId(), ruleId: correct ? 'hdr-xcto-present' : 'hdr-xcto-wrong',
          category: 'security-headers', title: correct ? 'X-Content-Type-Options: nosniff set' : 'X-Content-Type-Options has unexpected value',
          description: correct ? 'Correct.' : `Expected "nosniff", got "${detail.value}".`,
          status: correct ? 'passed' : 'warning', severity: correct ? 'info' : 'low', confidence: 'high', source: 'http-header',
          affectedPages: [url], evidence: correct ? [] : [{ headerName: 'X-Content-Type-Options', expected: 'nosniff', actual: detail.value ?? '', source: 'http-header' }],
          recommendation: correct ? '' : 'Change value to exactly "nosniff".',
          safeToApplyDirectly: true, verificationSteps: [],
        });
      }
      continue;
    }

    // Referrer-Policy
    if (headerLower === 'referrer-policy') {
      if (!detail.present) {
        findings.push({
          id: newId(), ruleId: 'hdr-rp-missing',
          category: 'security-headers', title: 'Referrer-Policy not set',
          description: 'Without Referrer-Policy the browser defaults to no-referrer-when-downgrade, which may expose full URLs to cross-origin destinations.',
          status: 'warning', severity: 'low', confidence: 'high', source: 'http-header',
          affectedPages: [url],
          evidence: [{ headerName: 'Referrer-Policy', expected: 'strict-origin-when-cross-origin', actual: 'absent', source: 'http-header' }],
          recommendation: 'Add: Referrer-Policy: strict-origin-when-cross-origin — a reasonable default that balances analytics and privacy.',
          safeToApplyDirectly: true,
          verificationSteps: ['Add the header to your server configuration.', 'Verify analytics and A/B testing still receive the data they require.'],
        });
      } else {
        const cls = classifyReferrerPolicy(detail.value ?? '');
        const isRisky = cls === 'potentially-risky' || cls === 'malformed';
        findings.push({
          id: newId(), ruleId: isRisky ? 'hdr-rp-risky' : 'hdr-rp-present',
          category: 'security-headers', title: isRisky ? `Referrer-Policy: ${detail.value} (${cls})` : `Referrer-Policy: ${detail.value}`,
          description: isRisky
            ? `"${detail.value}" exposes full URLs including query strings to all third parties.`
            : `Policy is "${detail.value}" (${cls}).`,
          status: isRisky ? 'warning' : 'passed',
          severity: isRisky ? 'medium' : 'info', confidence: 'high', source: 'http-header',
          affectedPages: [url],
          evidence: isRisky ? [{ headerName: 'Referrer-Policy', actual: detail.value ?? '', source: 'http-header' }] : [],
          recommendation: isRisky ? 'Change to strict-origin-when-cross-origin or stricter.' : '',
          safeToApplyDirectly: true, verificationSteps: [],
        });
      }
      continue;
    }

    // Permissions-Policy
    if (headerLower === 'permissions-policy') {
      if (!detail.present) {
        findings.push({
          id: newId(), ruleId: 'hdr-pp-missing',
          category: 'security-headers', title: 'No Permissions-Policy header',
          description: 'Browser capabilities are not explicitly scoped. Without this header, embedded iframes and third-party scripts may have broader access than intended.',
          status: 'manual-review', severity: 'low', confidence: 'low', source: 'http-header',
          affectedPages: [url],
          evidence: [{ headerName: 'Permissions-Policy', actual: 'absent', source: 'http-header' }],
          recommendation: 'Review which browser APIs (camera, microphone, geolocation, payment, fullscreen) the site requires. Explicitly disable unused features. Do not restrict capabilities the site genuinely uses — this requires manual review.',
          safeToApplyDirectly: false,
          verificationSteps: ['List all embedded iframes and their required capabilities.', 'Define the policy in staging.', 'Test that required features still work.'],
        });
      } else {
        findings.push({
          id: newId(), ruleId: 'hdr-pp-present',
          category: 'security-headers', title: 'Permissions-Policy configured',
          description: `Permissions-Policy is present.`,
          status: 'passed', severity: 'info', confidence: 'high', source: 'http-header',
          affectedPages: [url], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
        });
      }
      continue;
    }

    // COOP
    if (headerLower === 'cross-origin-opener-policy') {
      if (!detail.present) {
        findings.push({
          id: newId(), ruleId: 'hdr-coop-missing',
          category: 'security-headers', title: 'No Cross-Origin-Opener-Policy',
          description: 'Without COOP the browsing context can be manipulated by cross-origin windows via window.opener.',
          status: 'manual-review', severity: 'low', confidence: 'low', source: 'http-header',
          affectedPages: [url],
          evidence: [{ headerName: 'Cross-Origin-Opener-Policy', actual: 'absent', source: 'http-header' }],
          recommendation: 'Consider COOP: same-origin if cross-origin window interaction is not required. Test in staging — COOP breaks OAuth pop-ups and some third-party payment flows.',
          safeToApplyDirectly: false,
          verificationSteps: ['Test all OAuth and payment flows in staging before enabling.'],
        });
      } else {
        findings.push({
          id: newId(), ruleId: 'hdr-coop-present',
          category: 'security-headers', title: 'Cross-Origin-Opener-Policy set',
          description: `COOP: ${detail.value}`,
          status: 'passed', severity: 'info', confidence: 'high', source: 'http-header',
          affectedPages: [url], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
        });
      }
    }
  }
}

// ── HTTPS & Transport ─────────────────────────────────────────────────────────

function checkHttps(response: Response, html: string, findings: BestPracticeFinding[], requestedUrl: string): boolean {
  const finalUrl = response.url;
  const isHttps = finalUrl.startsWith('https://');
  const wasHttp = requestedUrl.startsWith('http://') && !requestedUrl.startsWith('https://');
  const redirectedToHttps = wasHttp && isHttps && response.redirected;

  if (!isHttps) {
    findings.push({
      id: newId(), ruleId: 'https-not-used',
      category: 'https', title: 'Page served over HTTP',
      description: 'The final response was served over HTTP. HTTP connections are unencrypted and susceptible to eavesdropping and tampering.',
      status: 'failed', severity: 'critical', confidence: 'high', source: 'http-header',
      affectedPages: [finalUrl],
      evidence: [{ url: finalUrl, actual: 'http://', expected: 'https://', source: 'http-header' }],
      recommendation: 'Migrate to HTTPS. Free certificates are available via Let\'s Encrypt. Configure your server to redirect all HTTP traffic to HTTPS and add HSTS after migration.',
      safeToApplyDirectly: false,
      verificationSteps: ['Obtain a TLS certificate (e.g., via certbot).', 'Configure 301 redirect from HTTP to HTTPS.', 'Verify all pages and resources load over HTTPS.'],
    });
  } else if (redirectedToHttps) {
    findings.push({
      id: newId(), ruleId: 'https-redirect-ok',
      category: 'https', title: 'HTTP redirects to HTTPS',
      description: 'The HTTP entry point correctly redirected to HTTPS.',
      status: 'passed', severity: 'info', confidence: 'high', source: 'http-header',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
  } else {
    findings.push({
      id: newId(), ruleId: 'https-ok',
      category: 'https', title: 'Page served over HTTPS',
      description: 'Connection is encrypted.',
      status: 'passed', severity: 'info', confidence: 'high', source: 'http-header',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
  }

  // Check for HTTP canonical
  const canonicalMatch = /rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)
    || /href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(html);
  if (canonicalMatch && canonicalMatch[1].startsWith('http://')) {
    findings.push({
      id: newId(), ruleId: 'https-canonical-http',
      category: 'https', title: 'Canonical URL uses HTTP',
      description: `The canonical tag points to an HTTP URL: ${snippet(canonicalMatch[1], 80)}. This may cause duplicate-content issues and weaken HTTPS signals.`,
      status: 'failed', severity: 'medium', confidence: 'high', source: 'html',
      affectedPages: [finalUrl],
      evidence: [{ html: `<link rel="canonical" href="${snippet(canonicalMatch[1], 80)}">`, source: 'html' }],
      recommendation: 'Update the canonical URL to use https://.',
      safeToApplyDirectly: true,
      verificationSteps: ['Verify the https:// version is the canonical after the change.'],
    });
  }

  // Insecure form actions
  const formActionMatches = html.matchAll(/action=["'](http:\/\/[^"']+)["']/gi);
  const insecureForms: string[] = [];
  for (const m of formActionMatches) insecureForms.push(m[1]);
  if (insecureForms.length > 0) {
    findings.push({
      id: newId(), ruleId: 'https-form-http',
      category: 'https', title: `Form${insecureForms.length > 1 ? 's' : ''} submit to HTTP`,
      description: `${insecureForms.length} form action${insecureForms.length > 1 ? 's' : ''} use HTTP. Submitted data is not encrypted.`,
      status: 'failed', severity: 'high', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl],
      evidence: insecureForms.slice(0, 3).map(u => ({ html: `action="${u}"`, source: 'html' as BestPracticeSource })),
      recommendation: 'Update all form action URLs to use https://.',
      safeToApplyDirectly: true,
      verificationSteps: ['Test form submissions over HTTPS after the change.'],
    });
  }

  return isHttps;
}

// ── Mixed Content ─────────────────────────────────────────────────────────────

function checkMixedContent(html: string, finalUrl: string, isHttps: boolean, findings: BestPracticeFinding[]): void {
  if (!isHttps) return; // Mixed content only relevant on HTTPS pages

  // Active mixed content: script, link, iframe
  const activeTags: Array<{ tag: string; url: string }> = [];
  for (const m of html.matchAll(/<script[^>]+src=["'](http:\/\/[^"']+)["']/gi)) activeTags.push({ tag: 'script', url: m[1] });
  for (const m of html.matchAll(/<link[^>]+href=["'](http:\/\/[^"']+)["']/gi)) activeTags.push({ tag: 'link', url: m[1] });
  for (const m of html.matchAll(/<iframe[^>]+src=["'](http:\/\/[^"']+)["']/gi)) activeTags.push({ tag: 'iframe', url: m[1] });

  if (activeTags.length > 0) {
    findings.push({
      id: newId(), ruleId: 'mixed-content-active',
      category: 'mixed-content', title: `Active mixed content detected (${activeTags.length} resource${activeTags.length > 1 ? 's' : ''})`,
      description: 'Active mixed content (scripts, stylesheets, iframes) loaded over HTTP on an HTTPS page. Modern browsers block these requests, breaking functionality.',
      status: 'failed', severity: 'critical', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl],
      evidence: activeTags.slice(0, 5).map(r => ({ resourceUrl: snippet(r.url, 100), html: `<${r.tag} src="${snippet(r.url, 80)}">`, source: 'html' as BestPracticeSource })),
      recommendation: 'Update all HTTP resource URLs to https:// or use protocol-relative URLs (//). Start with scripts and stylesheets — these are blocked and break the page.',
      safeToApplyDirectly: true,
      verificationSteps: ['Open browser DevTools → Console to confirm no mixed-content errors after the change.'],
    });
  } else {
    findings.push({
      id: newId(), ruleId: 'mixed-content-active-none',
      category: 'mixed-content', title: 'No active mixed content detected',
      description: 'No HTTP scripts, stylesheets, or iframes found on this HTTPS page.',
      status: 'passed', severity: 'info', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
  }

  // Passive mixed content: images
  const passiveImgs: string[] = [];
  for (const m of html.matchAll(/<img[^>]+src=["'](http:\/\/[^"']+)["']/gi)) passiveImgs.push(m[1]);
  if (passiveImgs.length > 0) {
    findings.push({
      id: newId(), ruleId: 'mixed-content-passive',
      category: 'mixed-content', title: `Passive mixed content: ${passiveImgs.length} HTTP image${passiveImgs.length > 1 ? 's' : ''}`,
      description: 'Images loaded over HTTP on an HTTPS page. Browsers display a security warning and may block them in future.',
      status: 'warning', severity: 'medium', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl],
      evidence: passiveImgs.slice(0, 3).map(u => ({ resourceUrl: snippet(u, 100), source: 'html' as BestPracticeSource })),
      recommendation: 'Update image URLs to use https:// or protocol-relative URLs (//).',
      safeToApplyDirectly: true,
      verificationSteps: ['Verify images load correctly after updating to HTTPS.'],
    });
  }
}

// ── External Links ────────────────────────────────────────────────────────────

function checkExternalLinks(html: string, finalUrl: string, findings: BestPracticeFinding[]): void {
  const origin = getOrigin(finalUrl);

  // target="_blank" without noopener
  const blankLinks: string[] = [];
  const unsafeBlankLinks: string[] = [];
  for (const m of html.matchAll(/<a\s[^>]*target=["']_blank["'][^>]*>/gi)) {
    const tag = m[0];
    const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    // Only external links
    try {
      const u = new URL(href, finalUrl);
      if (u.origin === origin) continue; // same-origin blank targets are lower risk
    } catch { continue; }
    blankLinks.push(href);
    const relMatch = /rel=["']([^"']*)["']/i.exec(tag);
    const rel = relMatch ? relMatch[1].toLowerCase() : '';
    if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
      unsafeBlankLinks.push(href);
    }
  }

  if (unsafeBlankLinks.length > 0) {
    findings.push({
      id: newId(), ruleId: 'ext-link-opener',
      category: 'external-links', title: `${unsafeBlankLinks.length} external link${unsafeBlankLinks.length > 1 ? 's' : ''} without noopener`,
      description: 'Links with target="_blank" that lack rel="noopener" give the opened page access to window.opener, allowing it to redirect or manipulate your page.',
      status: 'warning', severity: 'medium', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl],
      evidence: unsafeBlankLinks.slice(0, 5).map(u => ({ html: `<a href="${snippet(u, 80)}" target="_blank">`, source: 'html' as BestPracticeSource })),
      recommendation: 'Add rel="noopener noreferrer" to all external target="_blank" links. Modern Chromium browsers set noopener implicitly, but explicit declaration improves compatibility.',
      safeToApplyDirectly: true,
      verificationSteps: ['Search for target="_blank" in your templates and add rel="noopener noreferrer" where missing.'],
    });
  } else if (blankLinks.length > 0) {
    findings.push({
      id: newId(), ruleId: 'ext-link-opener-ok',
      category: 'external-links', title: 'External blank-target links have noopener',
      description: 'All detected external target="_blank" links include rel="noopener" or rel="noreferrer".',
      status: 'passed', severity: 'info', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
  }

  // javascript: protocol in href
  const jsLinks: string[] = [];
  for (const m of html.matchAll(/href=["'](javascript:[^"']+)["']/gi)) jsLinks.push(m[1]);
  if (jsLinks.length > 0) {
    findings.push({
      id: newId(), ruleId: 'ext-link-js-protocol',
      category: 'external-links', title: `javascript: protocol in ${jsLinks.length} link${jsLinks.length > 1 ? 's' : ''}`,
      description: 'Using javascript: in href attributes is a legacy pattern that bypasses CSP and complicates testing. It can be exploited if any of the href values are user-controlled.',
      status: 'warning', severity: 'medium', confidence: 'high', source: 'html',
      affectedPages: [finalUrl],
      evidence: jsLinks.slice(0, 3).map(u => ({ html: `href="${snippet(u, 80)}"`, source: 'html' as BestPracticeSource })),
      recommendation: 'Replace javascript: hrefs with button elements and event listeners, or use href="#" with event.preventDefault().',
      safeToApplyDirectly: true,
      verificationSteps: ['Replace all javascript: links and verify click handlers still work.'],
    });
  }
}

// ── Deprecated / Risky APIs ───────────────────────────────────────────────────

function checkDeprecatedApis(html: string, finalUrl: string, findings: BestPracticeFinding[]): void {
  // Inline event handlers
  const inlineHandlerMatches: string[] = [];
  for (const m of html.matchAll(/\bon(click|load|error|submit|change|focus|blur|keydown|keyup|mousedown|mouseup)=["'][^"']{0,120}["']/gi)) {
    inlineHandlerMatches.push(m[0]);
  }
  if (inlineHandlerMatches.length > 0) {
    const capped = inlineHandlerMatches.slice(0, 50);
    findings.push({
      id: newId(), ruleId: 'dep-inline-handlers',
      category: 'deprecated-api', title: `Inline event handlers detected (${capped.length}${inlineHandlerMatches.length > 50 ? '+' : ''})`,
      description: 'Inline event handlers (onclick=, onload=, etc.) are a legacy pattern. They conflict with Content Security Policy and make code harder to maintain.',
      status: 'warning', severity: 'medium', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl],
      evidence: capped.slice(0, 3).map(h => ({ html: snippet(h, 100), source: 'html' as BestPracticeSource })),
      recommendation: 'Move event handling to external JavaScript files and use addEventListener(). This is a prerequisite for a strict CSP.',
      safeToApplyDirectly: false,
      verificationSteps: ['Refactor inline handlers to addEventListener in external scripts.', 'Verify the CSP script-src policy no longer needs unsafe-inline after this change.'],
    });
  } else {
    findings.push({
      id: newId(), ruleId: 'dep-inline-handlers-none',
      category: 'deprecated-api', title: 'No inline event handlers detected',
      description: 'No onclick, onload, or similar inline handlers found in HTML.',
      status: 'passed', severity: 'info', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
  }

  // document.write
  const docWriteCount = (html.match(/document\.write\s*\(/g) ?? []).length;
  if (docWriteCount > 0) {
    findings.push({
      id: newId(), ruleId: 'dep-document-write',
      category: 'deprecated-api', title: `document.write() detected (${docWriteCount} occurrence${docWriteCount > 1 ? 's' : ''})`,
      description: 'document.write() blocks the HTML parser and is deprecated. It is incompatible with async script loading and can cause performance regressions.',
      status: 'warning', severity: 'medium', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl],
      evidence: [{ html: 'document.write(…)', source: 'html' }],
      recommendation: 'Replace with DOM manipulation (createElement, appendChild) or modern template rendering.',
      safeToApplyDirectly: false,
      verificationSteps: ['Search scripts for document.write and refactor each use.'],
    });
  }

  // Synchronous XHR
  const syncXhrCount = (html.match(/\.open\s*\([^)]*,\s*[^)]*,\s*false\s*\)/g) ?? []).length;
  if (syncXhrCount > 0) {
    findings.push({
      id: newId(), ruleId: 'dep-sync-xhr',
      category: 'deprecated-api', title: 'Synchronous XMLHttpRequest pattern detected',
      description: 'Synchronous XHR blocks the main thread and is deprecated. It triggers browser warnings and will be removed from the web platform.',
      status: 'warning', severity: 'low', confidence: 'low', source: 'html',
      affectedPages: [finalUrl],
      evidence: [{ html: 'xhr.open(…, false)', source: 'html' }],
      recommendation: 'Replace with fetch() or async/await XHR patterns.',
      safeToApplyDirectly: false,
      verificationSteps: ['Search for .open( with false as the third argument.', 'Refactor to async patterns.'],
    });
  }
}

// ── Third-Party Safety ────────────────────────────────────────────────────────

function checkThirdParty(html: string, finalUrl: string, findings: BestPracticeFinding[]): void {
  const origin = getOrigin(finalUrl);
  const thirdPartyScripts: string[] = [];
  for (const m of html.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)["']/gi)) {
    try {
      const u = new URL(m[1]);
      if (u.origin !== origin) thirdPartyScripts.push(m[1]);
    } catch { /* ignore malformed */ }
  }

  if (thirdPartyScripts.length === 0) {
    findings.push({
      id: newId(), ruleId: 'tp-no-scripts',
      category: 'third-party', title: 'No external third-party scripts detected',
      description: 'No external script sources found in HTML.',
      status: 'passed', severity: 'info', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
    return;
  }

  // Group by domain
  const domainCounts: Map<string, number> = new Map();
  for (const s of thirdPartyScripts) {
    try {
      const host = new URL(s).hostname;
      domainCounts.set(host, (domainCounts.get(host) ?? 0) + 1);
    } catch { /* ignore */ }
  }

  const domainList = [...domainCounts.entries()].sort((a, b) => b[1] - a[1]);
  findings.push({
    id: newId(), ruleId: 'tp-scripts-detected',
    category: 'third-party',
    title: `${thirdPartyScripts.length} external script${thirdPartyScripts.length > 1 ? 's' : ''} from ${domainList.length} origin${domainList.length > 1 ? 's' : ''}`,
    description: `Third-party scripts add tracking, analytics, and functionality but also introduce supply-chain risk and may impact performance. Origins: ${domainList.slice(0, 5).map(([d]) => d).join(', ')}${domainList.length > 5 ? ` (+${domainList.length - 5} more)` : ''}.`,
    status: domainList.length > 5 ? 'warning' : 'manual-review',
    severity: 'low', confidence: 'medium', source: 'html',
    affectedPages: [finalUrl],
    evidence: thirdPartyScripts.slice(0, 5).map(u => ({ resourceUrl: snippet(u, 100), source: 'html' as BestPracticeSource })),
    recommendation: 'Confirm each third-party script is required on this page. Load analytics and non-critical scripts after consent where applicable. Defer non-essential scripts until after critical content. Consider Subresource Integrity for stable external assets.',
    safeToApplyDirectly: false,
    verificationSteps: ['Audit each third-party domain against your data-processing agreements.', 'Load non-critical scripts with defer or after user consent.'],
  });
}

// ── Resource Integrity ────────────────────────────────────────────────────────

function checkResourceIntegrity(html: string, finalUrl: string, findings: BestPracticeFinding[]): void {
  const origin = getOrigin(finalUrl);

  // External scripts without integrity attribute
  const extScriptsNoSRI: string[] = [];
  for (const m of html.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi)) {
    try {
      if (new URL(m[1]).origin === origin) continue;
    } catch { continue; }
    if (!/integrity=/i.test(m[0])) extScriptsNoSRI.push(m[1]);
  }

  // External stylesheets without integrity
  const extStylesNoSRI: string[] = [];
  for (const m of html.matchAll(/<link[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi)) {
    try {
      if (new URL(m[1]).origin === origin) continue;
    } catch { continue; }
    if (!/rel=["']stylesheet["']/i.test(m[0])) continue;
    if (!/integrity=/i.test(m[0])) extStylesNoSRI.push(m[1]);
  }

  const totalNoSRI = extScriptsNoSRI.length + extStylesNoSRI.length;
  if (totalNoSRI > 0) {
    findings.push({
      id: newId(), ruleId: 'sri-missing',
      category: 'resource-integrity', title: `${totalNoSRI} external resource${totalNoSRI > 1 ? 's' : ''} without Subresource Integrity`,
      description: `${extScriptsNoSRI.length} script${extScriptsNoSRI.length !== 1 ? 's' : ''} and ${extStylesNoSRI.length} stylesheet${extStylesNoSRI.length !== 1 ? 's' : ''} loaded from external origins without an integrity attribute. If those CDN servers are compromised, malicious code runs in your users' browsers.`,
      status: 'manual-review', severity: 'low', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl],
      evidence: [...extScriptsNoSRI, ...extStylesNoSRI].slice(0, 5).map(u => ({ resourceUrl: snippet(u, 100), source: 'html' as BestPracticeSource })),
      recommendation: 'Add integrity and crossorigin attributes to stable external scripts and stylesheets. SRI is not appropriate for frequently-changing resources, tag managers, or dynamically generated scripts.',
      safeToApplyDirectly: false,
      verificationSteps: ['Generate SRI hashes using srihash.org or openssl dgst -sha384.', 'Test the page after adding integrity — cached CDN files may differ from the expected hash.'],
    });
  } else {
    findings.push({
      id: newId(), ruleId: 'sri-ok',
      category: 'resource-integrity', title: 'No external resources without SRI detected',
      description: 'All detected external scripts and stylesheets either have integrity attributes or are same-origin.',
      status: 'passed', severity: 'info', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
  }
}

// ── Cookies ───────────────────────────────────────────────────────────────────

function checkCookies(response: Response, finalUrl: string, isHttps: boolean, findings: BestPracticeFinding[]): void {
  // Set-Cookie headers
  const setCookies: string[] = [];
  response.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') setCookies.push(v);
  });

  if (setCookies.length === 0) {
    findings.push({
      id: newId(), ruleId: 'cookie-none',
      category: 'cookies', title: 'No Set-Cookie headers on this response',
      description: 'No cookies were set by this page response.',
      status: 'not-applicable', severity: 'info', confidence: 'high', source: 'http-header',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
    return;
  }

  const insecureCookies: string[] = [];
  const noSameSite: string[] = [];
  const noHttpOnly: string[] = [];

  for (const cookieStr of setCookies) {
    const namePart = cookieStr.split(';')[0];
    const name = namePart.split('=')[0].trim();
    const lower = cookieStr.toLowerCase();
    const isSession = /session|token|auth|user|login|jwt/i.test(name);

    if (isHttps && !lower.includes('secure')) {
      insecureCookies.push(name);
    }
    if (!lower.includes('samesite=')) {
      noSameSite.push(name);
    }
    if (isSession && !lower.includes('httponly')) {
      noHttpOnly.push(name);
    }
  }

  if (insecureCookies.length > 0) {
    findings.push({
      id: newId(), ruleId: 'cookie-no-secure',
      category: 'cookies', title: `${insecureCookies.length} cookie${insecureCookies.length > 1 ? 's' : ''} missing Secure flag`,
      description: `Cookies without the Secure attribute can be sent over unencrypted HTTP connections. Names: ${insecureCookies.slice(0, 5).join(', ')}.`,
      status: 'failed', severity: 'high', confidence: 'high', source: 'http-header',
      affectedPages: [finalUrl],
      evidence: insecureCookies.slice(0, 3).map(n => ({ headerName: 'Set-Cookie', actual: `${n}=…; (no Secure)`, source: 'http-header' as BestPracticeSource })),
      recommendation: 'Add the Secure attribute to all cookies served over HTTPS.',
      safeToApplyDirectly: true,
      verificationSteps: ['Set Secure flag in your server cookie configuration.', 'Verify cookies are no longer sent over HTTP.'],
    });
  }

  if (noSameSite.length > 0) {
    findings.push({
      id: newId(), ruleId: 'cookie-no-samesite',
      category: 'cookies', title: `${noSameSite.length} cookie${noSameSite.length > 1 ? 's' : ''} without SameSite attribute`,
      description: `Cookies without SameSite default to Lax in modern browsers, but explicit declaration is preferred. Names: ${noSameSite.slice(0, 5).join(', ')}.`,
      status: 'warning', severity: 'low', confidence: 'high', source: 'http-header',
      affectedPages: [finalUrl],
      evidence: noSameSite.slice(0, 3).map(n => ({ headerName: 'Set-Cookie', actual: `${n}=…; (no SameSite)`, source: 'http-header' as BestPracticeSource })),
      recommendation: 'Add SameSite=Lax for most cookies, SameSite=Strict for session tokens, SameSite=None; Secure for legitimate cross-site cookies (e.g. embedded widgets).',
      safeToApplyDirectly: false,
      verificationSteps: ['Verify that cross-site functionality still works after adding SameSite.'],
    });
  }

  if (noHttpOnly.length > 0) {
    findings.push({
      id: newId(), ruleId: 'cookie-no-httponly',
      category: 'cookies', title: `Session-like cookie${noHttpOnly.length > 1 ? 's' : ''} without HttpOnly`,
      description: `${noHttpOnly.length} authentication-related cookie${noHttpOnly.length > 1 ? 's' : ''} appear${noHttpOnly.length === 1 ? 's' : ''} to lack HttpOnly. Without HttpOnly, JavaScript can read these cookies — increasing XSS risk. Names: ${noHttpOnly.slice(0, 5).join(', ')}.`,
      status: 'warning', severity: 'high', confidence: 'low', source: 'http-header',
      affectedPages: [finalUrl],
      evidence: noHttpOnly.slice(0, 3).map(n => ({ headerName: 'Set-Cookie', actual: `${n}=…; (no HttpOnly)`, source: 'http-header' as BestPracticeSource })),
      recommendation: 'Add the HttpOnly attribute to server-side session and authentication cookies. Do not add HttpOnly to preference or UI-state cookies that JavaScript legitimately reads.',
      safeToApplyDirectly: false,
      verificationSteps: ['Confirm the application does not read the session cookie from JavaScript before adding HttpOnly.'],
    });
  }

  if (insecureCookies.length === 0 && noSameSite.length === 0 && noHttpOnly.length === 0) {
    findings.push({
      id: newId(), ruleId: 'cookie-ok',
      category: 'cookies', title: `${setCookies.length} cookie${setCookies.length > 1 ? 's' : ''} — no obvious attribute issues`,
      description: 'Detected cookies appear to have Secure, SameSite, and HttpOnly set correctly (where applicable).',
      status: 'passed', severity: 'info', confidence: 'medium', source: 'http-header',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
  }
}

// ── Iframes ───────────────────────────────────────────────────────────────────

function checkIframes(html: string, finalUrl: string, findings: BestPracticeFinding[]): void {
  const iframeMatches = [...html.matchAll(/<iframe([^>]*)>/gi)];
  if (iframeMatches.length === 0) {
    findings.push({
      id: newId(), ruleId: 'iframe-none',
      category: 'iframes', title: 'No iframes detected',
      description: 'No <iframe> elements found in HTML.',
      status: 'not-applicable', severity: 'info', confidence: 'high', source: 'html',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
    return;
  }

  const origin = getOrigin(finalUrl);
  const noTitle: string[] = [];
  const crossOriginNoSandboxHint: string[] = [];

  for (const m of iframeMatches) {
    const attrs = m[1];
    const srcMatch = /src=["']([^"']+)["']/i.exec(attrs);
    const src = srcMatch ? srcMatch[1] : '';

    if (!/title=/i.test(attrs)) noTitle.push(src || '(no src)');

    if (src) {
      try {
        const iframeOrigin = new URL(src, finalUrl).origin;
        if (iframeOrigin !== origin && !/sandbox=/i.test(attrs)) {
          crossOriginNoSandboxHint.push(src);
        }
      } catch { /* ignore */ }
    }
  }

  if (noTitle.length > 0) {
    findings.push({
      id: newId(), ruleId: 'iframe-no-title',
      category: 'iframes', title: `${noTitle.length} iframe${noTitle.length > 1 ? 's' : ''} without title attribute`,
      description: 'Screen readers announce iframes by their title. Iframes without a title are inaccessible to assistive technology users.',
      status: 'failed', severity: 'medium', confidence: 'high', source: 'html',
      affectedPages: [finalUrl],
      evidence: noTitle.slice(0, 3).map(s => ({ html: `<iframe src="${snippet(s, 80)}">`, source: 'html' as BestPracticeSource })),
      recommendation: 'Add a descriptive title attribute to every iframe: <iframe title="Payment form" src="…">.',
      safeToApplyDirectly: true,
      verificationSteps: ['Add title attributes and verify with a screen reader or accessibility audit.'],
    });
  }

  if (crossOriginNoSandboxHint.length > 0) {
    findings.push({
      id: newId(), ruleId: 'iframe-cross-origin-no-sandbox',
      category: 'iframes', title: `${crossOriginNoSandboxHint.length} cross-origin iframe${crossOriginNoSandboxHint.length > 1 ? 's' : ''} without sandbox`,
      description: 'Cross-origin iframes without a sandbox attribute have full browser capability access. A sandbox can restrict capabilities — but applying it incorrectly may break payment, authentication, or media embeds.',
      status: 'manual-review', severity: 'low', confidence: 'low', source: 'html',
      affectedPages: [finalUrl],
      evidence: crossOriginNoSandboxHint.slice(0, 3).map(u => ({ resourceUrl: snippet(u, 100), source: 'html' as BestPracticeSource })),
      recommendation: 'Review whether each cross-origin iframe can use a restrictive sandbox. Test required capabilities (allow-scripts, allow-forms, allow-same-origin) before adding sandbox. Do not sandbox payment providers, authentication flows, or video players without verifying the embed still functions.',
      safeToApplyDirectly: false,
      verificationSteps: ['Test each iframe embed with the intended sandbox attributes in staging.'],
    });
  }

  if (noTitle.length === 0 && crossOriginNoSandboxHint.length === 0) {
    findings.push({
      id: newId(), ruleId: 'iframe-ok',
      category: 'iframes', title: `${iframeMatches.length} iframe${iframeMatches.length > 1 ? 's' : ''} — no issues detected`,
      description: 'All detected iframes have title attributes and cross-origin iframes have sandbox considerations noted.',
      status: 'passed', severity: 'info', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
  }
}

// ── PWA / Manifest ────────────────────────────────────────────────────────────

function checkPWA(html: string, finalUrl: string, findings: BestPracticeFinding[]): void {
  const hasManifest = /rel=["']manifest["']/i.test(html);
  const hasSW = /serviceworker/i.test(html) || /\.register\s*\([^)]*\.js/i.test(html);

  if (!hasManifest && !hasSW) {
    findings.push({
      id: newId(), ruleId: 'pwa-none',
      category: 'pwa', title: 'No web app manifest or service worker detected',
      description: 'This page does not appear to register a service worker or link a web app manifest. This is normal for non-installable web sites.',
      status: 'not-applicable', severity: 'info', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl], evidence: [], recommendation: '', safeToApplyDirectly: true, verificationSteps: [],
    });
    return;
  }

  if (hasManifest) {
    findings.push({
      id: newId(), ruleId: 'pwa-manifest-detected',
      category: 'pwa', title: 'Web app manifest linked',
      description: 'A web app manifest was detected. Validate it at web.dev/measure to check required fields.',
      status: 'passed', severity: 'info', confidence: 'medium', source: 'html',
      affectedPages: [finalUrl], evidence: [], recommendation: 'Verify the manifest has name, short_name, start_url, display, icons (with appropriate sizes), theme_color, and background_color.', safeToApplyDirectly: true, verificationSteps: [],
    });
  }

  if (hasSW) {
    findings.push({
      id: newId(), ruleId: 'pwa-sw-detected',
      category: 'pwa', title: 'Service Worker registration detected',
      description: 'A service worker registration appears in the page HTML or inline scripts.',
      status: 'manual-review', severity: 'info', confidence: 'low', source: 'html',
      affectedPages: [finalUrl],
      evidence: [],
      recommendation: 'Verify the service worker registers successfully and handles fetch errors gracefully. Test offline behavior.',
      safeToApplyDirectly: true, verificationSteps: ['Open DevTools → Application → Service Workers to verify registration state.'],
    });
  }
}

// ── Browser runtime — unavailable ────────────────────────────────────────────

function addRuntimeUnavailableFindings(findings: BestPracticeFinding[], url: string): void {
  findings.push({
    id: newId(), ruleId: 'runtime-console-unavailable',
    category: 'runtime', title: 'Browser console diagnostics unavailable',
    description: 'Console errors, unhandled promise rejections, failed resource loads, and CSP violations require a real browser to collect. This audit runs in static/fetch-only mode.',
    status: 'unavailable', severity: 'info', confidence: 'high', source: 'browser-console',
    affectedPages: [url], evidence: [],
    recommendation: 'Use browser DevTools → Console or a real Lighthouse run to check for runtime errors.',
    safeToApplyDirectly: true,
    verificationSteps: ['Open the page in Chrome DevTools and check the Console tab for errors.'],
  });
}

// ── Score calculation ─────────────────────────────────────────────────────────

function computeScore(findings: BestPracticeFinding[]): { score: number; categoryScores: BestPracticeScoreBreakdown[] } {
  const categoryResults: Map<string, { passed: number; failed: number; warnings: number; total: number; totalWeight: number; failWeight: number }> = new Map();

  for (const cat of Object.keys(CATEGORY_WEIGHTS)) {
    categoryResults.set(cat, { passed: 0, failed: 0, warnings: 0, total: 0, totalWeight: 0, failWeight: 0 });
  }

  for (const f of findings) {
    if (!CATEGORY_WEIGHTS[f.category]) continue;
    const entry = categoryResults.get(f.category)!;
    const severityW = SEVERITY_WEIGHT[f.severity] ?? 0;

    if (f.status === 'unavailable' || f.status === 'not-applicable' || f.status === 'manual-review') continue;

    entry.total += 1;
    entry.totalWeight += severityW;

    if (f.status === 'passed') {
      entry.passed += 1;
    } else if (f.status === 'failed') {
      entry.failed += 1;
      entry.failWeight += severityW;
    } else if (f.status === 'warning') {
      entry.warnings += 1;
      entry.failWeight += severityW * 0.5;
    }
  }

  const categoryScores: BestPracticeScoreBreakdown[] = [];
  let weightedTotal = 0;
  let totalUsedWeight = 0;

  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const r = categoryResults.get(cat)!;

    if (r.total === 0) {
      categoryScores.push({
        category: cat, weight, score: null, weightedContribution: null,
        passedChecks: 0, failedChecks: 0, unavailableChecks: 0,
        reason: 'No applicable checks in this category',
      });
      continue;
    }

    const catScore = r.totalWeight === 0 ? 100
      : clamp(100 - Math.round((r.failWeight / r.totalWeight) * 100));

    const contribution = catScore * weight;
    weightedTotal += contribution;
    totalUsedWeight += weight;

    categoryScores.push({
      category: cat, weight, score: catScore,
      weightedContribution: Math.round(contribution * 10) / 10,
      passedChecks: r.passed, failedChecks: r.failed, unavailableChecks: 0,
      reason: r.failed > 0
        ? `${r.failed} failed check${r.failed > 1 ? 's' : ''}, ${r.warnings} warning${r.warnings !== 1 ? 's' : ''}`
        : r.warnings > 0 ? `${r.warnings} warning${r.warnings !== 1 ? 's' : ''}`
        : 'All checks passed',
    });
  }

  const score = totalUsedWeight === 0 ? null : clamp(Math.round(weightedTotal / totalUsedWeight));
  return { score: score ?? 0, categoryScores };
}

// ── Coverage ──────────────────────────────────────────────────────────────────

function computeCoverage(findings: BestPracticeFinding[]): BestPracticeCoverage {
  const executed = findings.filter(f => f.status !== 'unavailable').length;
  const unavailable = findings.filter(f => f.status === 'unavailable').length;
  const passed = findings.filter(f => f.status === 'passed').length;
  const failed = findings.filter(f => f.status === 'failed').length;
  const warnings = findings.filter(f => f.status === 'warning').length;
  const manual = findings.filter(f => f.status === 'manual-review').length;
  const total = findings.length;

  return {
    supportedChecks: total,
    executedChecks: executed,
    passedChecks: passed,
    failedChecks: failed,
    warningChecks: warnings,
    unavailableChecks: unavailable,
    manualReviewChecks: manual,
    percentage: total === 0 ? 0 : clamp(Math.round((executed / total) * 100)),
    limitations: [
      'Audit runs in static/fetch-only mode — no real browser is used.',
      'Browser console errors, unhandled rejections, and runtime failures are unavailable.',
      'Mixed content detection is based on static HTML parsing — dynamically injected resources are not detected.',
      'Third-party script analysis covers HTML src attributes only — scripts loaded by tag managers are not detected.',
      'Cookie analysis covers response Set-Cookie headers only — existing browser cookies are not inspected.',
      'Inline script content is not executed — runtime deprecated-API usage is estimated from source patterns only.',
    ],
  };
}

// ── Summary ───────────────────────────────────────────────────────────────────

function computeSummary(findings: BestPracticeFinding[]) {
  return {
    critical:     findings.filter(f => f.severity === 'critical' && f.status === 'failed').length,
    high:         findings.filter(f => f.severity === 'high'     && f.status === 'failed').length,
    medium:       findings.filter(f => f.severity === 'medium'   && f.status === 'failed').length,
    low:          findings.filter(f => f.severity === 'low'      && f.status === 'failed').length,
    warnings:     findings.filter(f => f.status === 'warning').length,
    passed:       findings.filter(f => f.status === 'passed').length,
    manualReview: findings.filter(f => f.status === 'manual-review').length,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function checkBestPractices(
  html: string,
  response: Response,
  requestedUrl: string,
): BestPracticesAuditResult {
  _findingCounter = 0;
  const finalUrl = response.url || requestedUrl;
  const findings: BestPracticeFinding[] = [];

  const headerDetails = analyzeSecurityHeaderDetails(response);

  checkSecurityHeaders(response, headerDetails, findings, finalUrl);
  const isHttps = checkHttps(response, html, findings, requestedUrl);
  checkMixedContent(html, finalUrl, isHttps, findings);
  checkExternalLinks(html, finalUrl, findings);
  checkDeprecatedApis(html, finalUrl, findings);
  checkThirdParty(html, finalUrl, findings);
  checkResourceIntegrity(html, finalUrl, findings);
  checkCookies(response, finalUrl, isHttps, findings);
  checkIframes(html, finalUrl, findings);
  checkPWA(html, finalUrl, findings);
  addRuntimeUnavailableFindings(findings, finalUrl);

  const { score, categoryScores } = computeScore(findings);
  const coverage = computeCoverage(findings);
  const summary = computeSummary(findings);

  return {
    version: 'bp-v1',
    score,
    scoreVersion: SCORE_VERSION,
    auditMode: 'static',
    testedUrl: requestedUrl,
    finalUrl,
    measuredAt: new Date().toISOString(),
    findings,
    summary,
    categoryScores,
    coverage,
    securityHeaders: headerDetails,
    isHttps,
    redirectChain: response.redirected ? [requestedUrl, finalUrl] : [finalUrl],
    warnings: [],
    errors: [],
  };
}

export function checkBestPracticesLightweight(
  html: string,
  response: Response,
  requestedUrl: string,
): BestPracticesPageResult {
  const finalUrl = response.url || requestedUrl;
  const isHttps = finalUrl.startsWith('https://');
  const headerDetails = analyzeSecurityHeaderDetails(response);

  const presentHeaders = headerDetails.filter(h => h.present).length;

  // Quick binary checks for a lightweight score
  const checks = [
    isHttps,
    !!response.headers.get('content-security-policy'),
    !!response.headers.get('strict-transport-security') || !isHttps,
    !!response.headers.get('x-content-type-options'),
    !!response.headers.get('referrer-policy'),
    !/<script[^>]+src=["']http:\/\//i.test(html),     // no active mixed content
    !/ on(click|load|error|submit)=/i.test(html),       // no inline handlers
  ];
  const rawScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const criticalFindings = (!isHttps ? 1 : 0)
    + (isHttps && /<script[^>]+src=["']http:\/\//i.test(html) ? 1 : 0);
  const highFindings = (!response.headers.get('strict-transport-security') && isHttps ? 1 : 0)
    + (!response.headers.get('content-security-policy') ? 1 : 0);

  return {
    requestedUrl,
    finalUrl,
    httpStatus: response.status,
    isHttps,
    score: rawScore,
    coverage: 60,
    auditLabel: 'Lightweight BP scan',
    securityHeadersPresent: presentHeaders,
    securityHeadersTotal: headerDetails.length,
    criticalFindings,
    highFindings,
  };
}
