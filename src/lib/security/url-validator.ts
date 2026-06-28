/**
 * Centralized URL validator for SSRF prevention.
 *
 * §3  – one authoritative module used by analysis submission, crawled links,
 *        redirects, sitemaps, robots, screenshots, webhooks, PDF resources, monitors.
 * §4  – protocol allowlist (http/https); credentials in URL rejected.
 * §5  – private network blocking: IPv4 loopback, RFC 1918, link-local, CGNAT,
 *        multicast, reserved ranges, broadcast; IPv6 loopback, ULA, link-local.
 * §6  – alternate-IP notation bypasses: decimal (2130706433), hex (0x7f000001),
 *        octal (0177.0.0.1), shortened (127.1), IPv4-mapped IPv6 (::ffff:7f00:1).
 * §9  – port allowlist: only 80 and 443 permitted for outbound requests.
 * §10 – cloud metadata endpoint blocking (AWS, GCP, Azure, Alibaba hostnames).
 */

export type UrlRejectionCode =
  | 'invalid-url'
  | 'unsupported-protocol'
  | 'credentials-in-url'
  | 'loopback-ip'
  | 'private-ip'
  | 'link-local'
  | 'cloud-metadata'
  | 'multicast'
  | 'reserved-ip'
  | 'ipv6-private'
  | 'blocked-hostname'
  | 'prohibited-port';

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  protocol?: string;
  hostname?: string;
  port?: number;
  rejectionCode?: UrlRejectionCode;
  rejectionReason?: string;
}

export interface UrlValidationOptions {
  /** Allow http: in addition to https:. Default: false. */
  allowHttp?: boolean;
  /** Allow ports other than 80 and 443. Default: false. */
  allowNonStandardPorts?: boolean;
}

// ─── Blocked hostnames (§5, §10) ──────────────────────────────────────────────

const BLOCKED_HOSTNAMES = new Set([
  // Loopback aliases
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'broadcasthost',
  // Cloud metadata (§10)
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',            // OpenStack / some cloud providers
]);

// ─── Port restrictions (§9) ───────────────────────────────────────────────────

// Ports that indicate non-web protocols and must always be blocked.
const BLOCKED_PORTS = new Set([
  22, 23,                               // SSH, Telnet
  25, 110, 143, 465, 587, 993, 995,    // Mail (SMTP, POP3, IMAP)
  1433, 1521,                           // MSSQL, Oracle
  2375, 2376, 2377,                     // Docker daemon
  2379, 2380,                           // etcd
  3306, 5432,                           // MySQL, PostgreSQL
  3389,                                 // RDP
  5672, 5671,                           // AMQP (RabbitMQ)
  6379, 6380,                           // Redis
  6443, 8001,                           // Kubernetes API
  8009,                                 // AJP (Tomcat)
  8500, 8600,                           // Consul
  9000, 9090, 9091, 9092,              // Admin / Prometheus / Kafka
  9200, 9300,                           // Elasticsearch
  11211,                                // Memcached
  27017, 27018, 27019,                  // MongoDB
]);

// Only these ports are permitted for outbound web analysis/webhook requests.
const ALLOWED_WEB_PORTS = new Set([80, 443]);

// ─── IPv4 parsing (§5, §6) ────────────────────────────────────────────────────

/**
 * Parse a standard dotted-decimal IPv4 hostname (a.b.c.d).
 * The WHATWG URL parser (used by Node.js 18+) normalizes most alternate
 * notations to this form before we see the hostname — see §6.
 * Returns [a, b, c, d] or null if not a standard dotted-decimal IPv4.
 */
function parseIPv4Standard(hostname: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return null;
  const parts: [number, number, number, number] = [+m[1], +m[2], +m[3], +m[4]];
  if (parts.some((p) => p > 255 || p < 0)) return null;
  return parts;
}

/**
 * Safety-net parser for alternate IPv4 notations that WHATWG may not normalize
 * in all environments (decimal integer, hex, octal, shortened forms).
 * Only called when the hostname is composed entirely of digits, dots, and hex chars
 * — not a risk of false-positives for real domain names.
 */
function parseIPv4AnyNotation(hostname: string): [number, number, number, number] | null {
  // Only attempt if the hostname looks like it could be an alternate IP notation.
  // Real hostnames will contain letters outside 0-9, a-f/A-F (e.g. 'com', 'org').
  if (!/^[0-9a-fxA-FX.]+$/.test(hostname)) return null;

  const parsePart = (s: string): number | null => {
    if (!s) return null;
    if (/^0[xX][0-9a-fA-F]+$/.test(s)) return parseInt(s, 16);
    if (s.startsWith('0') && s.length > 1) return parseInt(s, 8);
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    return null;
  };

  const rawParts = hostname.split('.');
  if (rawParts.length === 0 || rawParts.length > 4) return null;

  const vals = rawParts.map(parsePart);
  if (vals.some((v) => v === null || v < 0)) return null;
  const nums = vals as number[];

  switch (nums.length) {
    case 1: {
      // Decimal/hex integer: 2130706433 → 127.0.0.1
      if (nums[0] > 0xffffffff) return null;
      const n = nums[0] >>> 0;
      return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    }
    case 2: {
      // a.b: first octet + 24-bit last portion: 127.1 → 127.0.0.1
      if (nums[0] > 0xff || nums[1] > 0xffffff) return null;
      const last = nums[1];
      return [nums[0], (last >>> 16) & 0xff, (last >>> 8) & 0xff, last & 0xff];
    }
    case 3: {
      // a.b.c: first two octets + 16-bit last portion
      if (nums[0] > 0xff || nums[1] > 0xff || nums[2] > 0xffff) return null;
      return [nums[0], nums[1], (nums[2] >>> 8) & 0xff, nums[2] & 0xff];
    }
    case 4: {
      // Standard with possible hex/octal parts: 0177.0.0.1 → 127.0.0.1
      if (nums.some((v) => v > 0xff)) return null;
      return [nums[0], nums[1], nums[2], nums[3]];
    }
    default:
      return null;
  }
}

// ─── IPv4 classification (§5) ────────────────────────────────────────────────

function classifyIPv4(a: number, b: number, c: number, d: number): UrlRejectionCode | null {
  if (a === 127) return 'loopback-ip';                           // 127.0.0.0/8
  if (a === 0) return 'reserved-ip';                             // 0.0.0.0/8 — "this" network
  if (a === 10) return 'private-ip';                             // 10.0.0.0/8 RFC 1918
  if (a === 172 && b >= 16 && b <= 31) return 'private-ip';     // 172.16.0.0/12 RFC 1918
  if (a === 192 && b === 168) return 'private-ip';               // 192.168.0.0/16 RFC 1918
  if (a === 169 && b === 254) return 'link-local';               // 169.254.0.0/16 (AWS, Azure metadata)
  // Alibaba Cloud metadata (§10) — must precede CGNAT range check below
  if (a === 100 && b === 100 && c === 100 && d === 200) return 'cloud-metadata';
  if (a === 100 && b >= 64 && b <= 127) return 'private-ip';    // 100.64.0.0/10 CGNAT
  if (a >= 224 && a <= 239) return 'multicast';                  // 224.0.0.0/4
  if (a >= 240) return 'reserved-ip';                            // 240.0.0.0/4 + broadcast
  if (a === 192 && b === 0 && c === 2) return 'reserved-ip';    // 192.0.2.0/24 TEST-NET-1
  if (a === 198 && b === 51 && c === 100) return 'reserved-ip'; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return 'reserved-ip';  // 203.0.113.0/24 TEST-NET-3
  if (a === 198 && (b === 18 || b === 19)) return 'reserved-ip'; // 198.18.0.0/15 benchmarking
  return null; // public, routable
}

// ─── IPv6 classification (§5, §6) ────────────────────────────────────────────

/**
 * Classify an IPv6 hostname as returned by URL.hostname (includes brackets).
 * Handles: loopback, ULA, link-local, multicast, IPv4-mapped.
 */
function classifyIPv6(hostname: string): UrlRejectionCode | null {
  const addr = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (addr === '::1') return 'loopback-ip';
  if (addr === '::') return 'reserved-ip';

  const firstGroup = addr.split(':')[0] || '0';
  const g0 = parseInt(firstGroup || '0', 16);

  // ULA — fc00::/7 (includes fd00::)
  if (!isNaN(g0) && (g0 & 0xfe00) === 0xfc00) return 'ipv6-private';
  // Link-local — fe80::/10
  if (!isNaN(g0) && (g0 & 0xffc0) === 0xfe80) return 'link-local';
  // Multicast — ff00::/8
  if (!isNaN(g0) && (g0 & 0xff00) === 0xff00) return 'multicast';

  // IPv4-mapped IPv6 (§6): ::ffff:a.b.c.d or ::ffff:HHHH:HHHH
  // WHATWG normalizes these to hex groups: ::ffff:7f00:1 = 127.0.0.1
  if (addr.startsWith('::ffff:')) {
    const rest = addr.slice(7);
    const hexGroups = rest.split(':');
    if (hexGroups.length === 2) {
      const hi = parseInt(hexGroups[0], 16);
      const lo = parseInt(hexGroups[1], 16);
      if (!isNaN(hi) && !isNaN(lo) && hi >= 0 && lo >= 0) {
        return classifyIPv4(
          (hi >>> 8) & 0xff, hi & 0xff,
          (lo >>> 8) & 0xff, lo & 0xff,
        );
      }
    }
    // Dotted form: ::ffff:127.0.0.1 (if present before WHATWG normalization)
    const octets = parseIPv4Standard(rest);
    if (octets) return classifyIPv4(...octets);
  }

  return null; // public IPv6
}

// ─── Main validator ───────────────────────────────────────────────────────────

export function validateUrl(
  input: string,
  options: UrlValidationOptions = {},
): UrlValidationResult {
  const { allowHttp = false, allowNonStandardPorts = false } = options;

  // ── Parse using the WHATWG-compliant URL parser ───────────────────────────
  // This normalizes most alternate-IP notations (§6) to standard dotted decimal.
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return {
      valid: false,
      rejectionCode: 'invalid-url',
      rejectionReason: 'Not a valid URL.',
    };
  }

  // ── Protocol allowlist (§4) ───────────────────────────────────────────────
  const allowed = allowHttp ? ['http:', 'https:'] : ['https:'];
  if (!allowed.includes(parsed.protocol)) {
    return {
      valid: false,
      rejectionCode: 'unsupported-protocol',
      rejectionReason: `Protocol "${parsed.protocol}" is not allowed. Use ${allowed.join(' or ')}.`,
    };
  }

  // ── Credentials in URL (§4) ───────────────────────────────────────────────
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      rejectionCode: 'credentials-in-url',
      rejectionReason: 'Credentials (username:password@) in URLs are not allowed.',
    };
  }

  // ── Port check (§9) ───────────────────────────────────────────────────────
  if (parsed.port) {
    const port = parseInt(parsed.port, 10);
    if (BLOCKED_PORTS.has(port)) {
      return {
        valid: false,
        rejectionCode: 'prohibited-port',
        rejectionReason: `Port ${port} is not permitted for outbound requests.`,
      };
    }
    if (!allowNonStandardPorts && !ALLOWED_WEB_PORTS.has(port)) {
      return {
        valid: false,
        rejectionCode: 'prohibited-port',
        rejectionReason: `Port ${port} is not allowed. Only ports 80 and 443 are permitted.`,
      };
    }
  }

  // ── Empty hostname ────────────────────────────────────────────────────────
  // new URL('https:///path') parses with hostname='', which is invalid.
  if (!parsed.hostname) {
    return {
      valid: false,
      rejectionCode: 'invalid-url',
      rejectionReason: 'URL has no hostname.',
    };
  }

  // ── Hostname checks ───────────────────────────────────────────────────────
  // URL.hostname for IPv6 includes brackets: [::1]
  const rawHostname = parsed.hostname;
  const hostname = rawHostname.toLowerCase().replace(/\.$/, ''); // strip trailing dot

  // Blocked exact hostnames (§5, §10)
  const bareHostname = hostname.replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.has(bareHostname)) {
    return {
      valid: false,
      rejectionCode: 'blocked-hostname',
      rejectionReason: `The hostname "${bareHostname}" is not allowed.`,
    };
  }

  // Internal TLD patterns (§10) — catches *.internal, *.local, *.localhost
  if (
    bareHostname.endsWith('.internal') ||
    bareHostname.endsWith('.local') ||
    bareHostname.endsWith('.localhost') ||
    bareHostname === 'internal'
  ) {
    return {
      valid: false,
      rejectionCode: 'blocked-hostname',
      rejectionReason: `Hostname "${bareHostname}" resolves to an internal network zone.`,
    };
  }

  // ── IPv6 classification ───────────────────────────────────────────────────
  if (hostname.startsWith('[')) {
    const code = classifyIPv6(hostname);
    if (code) {
      return {
        valid: false,
        rejectionCode: code,
        rejectionReason: `IPv6 address "${bareHostname}" is in a non-public range.`,
      };
    }
    // Valid public IPv6 — return early (don't try IPv4 parsing on bracket notation)
    return {
      valid: true,
      normalizedUrl: parsed.href,
      protocol: parsed.protocol,
      hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : undefined,
    };
  }

  // ── IPv4 classification (standard dotted decimal after WHATWG normalization) ──
  const standardOctets = parseIPv4Standard(hostname);
  if (standardOctets) {
    const code = classifyIPv4(...standardOctets);
    if (code) {
      return {
        valid: false,
        rejectionCode: code,
        rejectionReason: `IP address "${hostname}" is in a non-public range.`,
      };
    }
    return {
      valid: true,
      normalizedUrl: parsed.href,
      protocol: parsed.protocol,
      hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : undefined,
    };
  }

  // ── Alternate-notation safety net (§6) ───────────────────────────────────
  // Catches forms that WHATWG did not normalize: rare in modern Node.js but
  // present in older runtimes and useful as defense-in-depth.
  const altOctets = parseIPv4AnyNotation(hostname);
  if (altOctets) {
    const code = classifyIPv4(...altOctets) ?? 'private-ip';
    return {
      valid: false,
      rejectionCode: code,
      rejectionReason: `IP address in alternate notation "${hostname}" is not allowed.`,
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.href,
    protocol: parsed.protocol,
    hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : undefined,
  };
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

/** For analysis submission: http and https both accepted. */
export function validateAnalysisUrl(url: string): UrlValidationResult {
  return validateUrl(url, { allowHttp: true });
}

/** For redirect hops during crawling/reachability checks (§8). */
export function validateRedirectTarget(url: string): UrlValidationResult {
  return validateUrl(url, { allowHttp: true });
}

/** For webhook destinations: https-only, standard ports only. */
export function validateWebhookUrl(url: string): UrlValidationResult {
  return validateUrl(url, { allowHttp: false });
}
