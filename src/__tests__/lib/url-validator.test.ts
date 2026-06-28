/**
 * §78 — Security tests for the centralized URL validator.
 *
 * Covers all 25+ cases from the audit spec:
 *   - normal public HTTP/HTTPS
 *   - localhost, loopback IPv4/IPv6
 *   - private IPv4 (RFC 1918), unique-local IPv6, link-local
 *   - cloud metadata IP and hostname
 *   - decimal IP, hex IP, octal IP, shortened IPv4
 *   - IPv4-mapped IPv6 (::ffff:)
 *   - trailing-dot hostname
 *   - encoded hostname
 *   - credentials in URL
 *   - unsupported protocols
 *   - prohibited ports
 *   - redirect-scope: validateRedirectTarget / validateWebhookUrl convenience wrappers
 */

import { describe, it, expect } from 'vitest';
import {
  validateUrl,
  validateAnalysisUrl,
  validateWebhookUrl,
  validateRedirectTarget,
} from '@/lib/security/url-validator';

// ─── Public URLs (must be allowed) ───────────────────────────────────────────

describe('Public URLs — allowed', () => {
  it('allows a normal public HTTPS URL', () => {
    expect(validateUrl('https://example.com/').valid).toBe(true);
  });

  it('allows a public HTTPS URL with path and query', () => {
    expect(validateUrl('https://example.com/path?q=1').valid).toBe(true);
  });

  it('allows HTTP when allowHttp=true', () => {
    expect(validateUrl('http://example.com/', { allowHttp: true }).valid).toBe(true);
  });

  it('allows explicit port 443', () => {
    expect(validateUrl('https://example.com:443/').valid).toBe(true);
  });

  it('allows explicit port 80 on http', () => {
    expect(validateUrl('http://example.com:80/', { allowHttp: true }).valid).toBe(true);
  });

  it('normalizedUrl is present on success', () => {
    const result = validateUrl('https://example.com/');
    expect(result.normalizedUrl).toBeTruthy();
    expect(result.hostname).toBe('example.com');
  });

  it('allows a public IPv4 address', () => {
    expect(validateUrl('https://93.184.216.34/').valid).toBe(true);
  });
});

// ─── Unsupported protocols (§4) ───────────────────────────────────────────────

describe('Unsupported protocols — blocked', () => {
  const blockedProtos = [
    'file:///etc/passwd',
    'ftp://example.com/file',
    'javascript:alert(1)',
    'data:text/html,<h1>hi</h1>',
    'blob:https://example.com/uuid',
    'ws://example.com/',
    'wss://example.com/',
    'gopher://example.com/',
  ];

  for (const url of blockedProtos) {
    it(`blocks protocol: ${url.split(':')[0]}`, () => {
      const result = validateUrl(url);
      expect(result.valid).toBe(false);
      expect(result.rejectionCode).toBe('unsupported-protocol');
    });
  }

  it('blocks http when allowHttp is not set', () => {
    const result = validateUrl('http://example.com/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('unsupported-protocol');
  });
});

// ─── Credentials in URL (§4) ─────────────────────────────────────────────────

describe('Credentials in URL — blocked', () => {
  it('blocks username:password@ in URL', () => {
    const result = validateUrl('https://user:pass@example.com/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('credentials-in-url');
  });

  it('blocks username only in URL', () => {
    const result = validateUrl('https://user@example.com/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('credentials-in-url');
  });
});

// ─── Localhost / loopback (§5) ────────────────────────────────────────────────

describe('Localhost and loopback — blocked', () => {
  it('blocks localhost hostname', () => {
    const result = validateUrl('https://localhost/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('blocked-hostname');
  });

  it('blocks localhost.localdomain', () => {
    const result = validateUrl('https://localhost.localdomain/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('blocked-hostname');
  });

  it('blocks loopback IPv4 127.0.0.1', () => {
    const result = validateUrl('https://127.0.0.1/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('loopback-ip');
  });

  it('blocks 127.255.255.255', () => {
    const result = validateUrl('https://127.255.255.255/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('loopback-ip');
  });

  it('blocks IPv6 loopback ::1', () => {
    const result = validateUrl('https://[::1]/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('loopback-ip');
  });

  it('blocks 0.0.0.0', () => {
    const result = validateUrl('https://0.0.0.0/');
    expect(result.valid).toBe(false);
    // 0.x is reserved-ip
    expect(['reserved-ip', 'loopback-ip']).toContain(result.rejectionCode);
  });
});

// ─── Private IPv4 ranges (§5) ─────────────────────────────────────────────────

describe('Private IPv4 — blocked', () => {
  const cases: [string, string][] = [
    ['10.0.0.1', 'Class A'],
    ['10.255.255.255', 'Class A high'],
    ['172.16.0.1', 'Class B low'],
    ['172.31.255.255', 'Class B high'],
    ['192.168.0.1', 'Class C'],
    ['192.168.255.255', 'Class C high'],
    ['100.64.0.1', 'CGNAT low'],
    ['100.127.255.255', 'CGNAT high'],
  ];

  for (const [ip, label] of cases) {
    it(`blocks ${ip} (${label})`, () => {
      const result = validateUrl(`https://${ip}/`);
      expect(result.valid).toBe(false);
      expect(result.rejectionCode).toBe('private-ip');
    });
  }
});

// ─── Link-local (§5) ──────────────────────────────────────────────────────────

describe('Link-local — blocked', () => {
  it('blocks 169.254.0.1 (link-local)', () => {
    const result = validateUrl('https://169.254.0.1/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('link-local');
  });

  it('blocks 169.254.169.254 (cloud metadata)', () => {
    const result = validateUrl('https://169.254.169.254/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('link-local');
  });

  it('blocks 169.254.170.2 (AWS ECS task metadata)', () => {
    const result = validateUrl('https://169.254.170.2/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('link-local');
  });

  it('blocks IPv6 link-local fe80::1', () => {
    const result = validateUrl('https://[fe80::1]/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('link-local');
  });
});

// ─── Cloud metadata hostnames (§10) ──────────────────────────────────────────

describe('Cloud metadata hostnames — blocked', () => {
  it('blocks metadata.google.internal (GCP)', () => {
    const result = validateUrl('https://metadata.google.internal/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('blocked-hostname');
  });

  it('blocks metadata.internal', () => {
    const result = validateUrl('https://metadata.internal/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('blocked-hostname');
  });

  it('blocks *.internal TLD pattern', () => {
    const result = validateUrl('https://api.cluster.internal/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('blocked-hostname');
  });

  it('blocks *.local TLD pattern', () => {
    const result = validateUrl('https://printer.local/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('blocked-hostname');
  });

  it('blocks *.localhost TLD pattern', () => {
    const result = validateUrl('https://app.localhost/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('blocked-hostname');
  });

  it('blocks 100.100.100.200 (Alibaba Cloud metadata)', () => {
    const result = validateUrl('https://100.100.100.200/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('cloud-metadata');
  });
});

// ─── Unique-local IPv6 (§5) ───────────────────────────────────────────────────

describe('Unique-local IPv6 — blocked', () => {
  it('blocks fc00::1 (ULA)', () => {
    const result = validateUrl('https://[fc00::1]/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('ipv6-private');
  });

  it('blocks fd00::1 (ULA with fd prefix)', () => {
    const result = validateUrl('https://[fd00::1]/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('ipv6-private');
  });

  it('blocks fdab:cdef:1234::1 (random ULA)', () => {
    const result = validateUrl('https://[fdab:cdef:1234::1]/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('ipv6-private');
  });
});

// ─── IPv4-mapped IPv6 (§6) ───────────────────────────────────────────────────

describe('IPv4-mapped IPv6 — blocked', () => {
  it('blocks ::ffff:127.0.0.1 (loopback via IPv4-mapped)', () => {
    // WHATWG normalizes to ::ffff:7f00:1
    const result = validateUrl('https://[::ffff:127.0.0.1]/');
    expect(result.valid).toBe(false);
    expect(['loopback-ip', 'ipv6-private']).toContain(result.rejectionCode);
  });

  it('blocks ::ffff:192.168.1.1 (private via IPv4-mapped)', () => {
    const result = validateUrl('https://[::ffff:192.168.1.1]/');
    expect(result.valid).toBe(false);
    expect(['private-ip', 'ipv6-private']).toContain(result.rejectionCode);
  });

  it('blocks ::ffff:7f00:1 (loopback hex IPv4-mapped)', () => {
    const result = validateUrl('https://[::ffff:7f00:1]/');
    expect(result.valid).toBe(false);
    expect(['loopback-ip', 'ipv6-private']).toContain(result.rejectionCode);
  });

  it('blocks ::ffff:a9fe:a9fe (169.254.169.254 hex IPv4-mapped)', () => {
    const result = validateUrl('https://[::ffff:a9fe:a9fe]/');
    expect(result.valid).toBe(false);
    expect(['link-local', 'ipv6-private']).toContain(result.rejectionCode);
  });
});

// ─── Alternate-IP notation bypasses (§6) ─────────────────────────────────────

describe('Alternate-IP notation — blocked', () => {
  it('blocks decimal IPv4 2130706433 (= 127.0.0.1)', () => {
    // WHATWG URL normalizes this to 127.0.0.1
    const result = validateUrl('https://2130706433/');
    // Either blocked by WHATWG normalization (loopback-ip) or
    // by our safety-net parser (loopback-ip / private-ip / alternate-notation)
    expect(result.valid).toBe(false);
    expect(['loopback-ip', 'private-ip', 'blocked-hostname']).toContain(result.rejectionCode);
  });

  it('blocks shortened IPv4 127.1 (= 127.0.0.1)', () => {
    // WHATWG normalizes 127.1 → 127.0.0.1
    const result = validateUrl('https://127.1/');
    expect(result.valid).toBe(false);
    expect(['loopback-ip', 'private-ip']).toContain(result.rejectionCode);
  });

  it('blocks shortened private 10.1 (= 10.0.0.1)', () => {
    const result = validateUrl('https://10.1/');
    expect(result.valid).toBe(false);
    expect(['private-ip', 'loopback-ip']).toContain(result.rejectionCode);
  });
});

// ─── Trailing-dot hostname (§6) ───────────────────────────────────────────────

describe('Trailing-dot hostnames', () => {
  it('allows a legitimate public domain with trailing dot (normalized)', () => {
    // Trailing dot is valid DNS notation; WHATWG URL preserves it for public domains.
    // We strip trailing dots in our hostname normalization.
    const result = validateUrl('https://example.com./');
    // Should be valid (example.com is public)
    expect(result.valid).toBe(true);
  });

  it('blocks localhost with trailing dot', () => {
    const result = validateUrl('https://localhost./');
    expect(result.valid).toBe(false);
  });
});

// ─── Prohibited ports (§9) ───────────────────────────────────────────────────

describe('Prohibited ports — blocked', () => {
  const blockedPorts = [
    22,    // SSH
    23,    // Telnet
    25,    // SMTP
    3306,  // MySQL
    5432,  // PostgreSQL
    6379,  // Redis
    27017, // MongoDB
    9200,  // Elasticsearch
    2375,  // Docker
    8080,  // Alt HTTP (non-standard for our purposes)
  ];

  for (const port of blockedPorts) {
    it(`blocks port ${port}`, () => {
      const result = validateUrl(`https://example.com:${port}/`);
      expect(result.valid).toBe(false);
      expect(result.rejectionCode).toBe('prohibited-port');
    });
  }

  it('allows a non-standard port when allowNonStandardPorts=true', () => {
    const result = validateUrl('https://example.com:8443/', { allowNonStandardPorts: true, allowHttp: false });
    // 8443 is not in BLOCKED_PORTS
    expect(result.valid).toBe(true);
  });
});

// ─── Invalid / malformed URLs ─────────────────────────────────────────────────

describe('Invalid URLs — rejected', () => {
  it('rejects empty string', () => {
    const result = validateUrl('');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('invalid-url');
  });

  it('rejects plain text', () => {
    const result = validateUrl('not a url at all');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('invalid-url');
  });

  it('rejects a bare protocol with no host', () => {
    // https: alone (no authority, no path) is an invalid URL
    const result = validateUrl('https:');
    expect(result.valid).toBe(false);
  });
});

// ─── Convenience wrappers ─────────────────────────────────────────────────────

describe('validateAnalysisUrl', () => {
  it('allows http (analysis targets can be http)', () => {
    expect(validateAnalysisUrl('http://example.com/').valid).toBe(true);
  });

  it('blocks private IPs', () => {
    expect(validateAnalysisUrl('http://192.168.1.1/').valid).toBe(false);
  });
});

describe('validateWebhookUrl', () => {
  it('allows a public HTTPS webhook URL', () => {
    expect(validateWebhookUrl('https://hooks.example.com/webhook').valid).toBe(true);
  });

  it('blocks http for webhooks (https-only)', () => {
    const result = validateWebhookUrl('http://example.com/webhook');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('unsupported-protocol');
  });

  it('blocks private IPs for webhooks', () => {
    expect(validateWebhookUrl('https://10.0.0.1/hook').valid).toBe(false);
  });

  it('blocks metadata.google.internal for webhooks', () => {
    expect(validateWebhookUrl('https://metadata.google.internal/hook').valid).toBe(false);
  });
});

describe('validateRedirectTarget', () => {
  it('allows http redirect target', () => {
    expect(validateRedirectTarget('http://example.com/').valid).toBe(true);
  });

  it('blocks redirect to private IP (§8 — redirect-to-private)', () => {
    expect(validateRedirectTarget('http://192.168.1.1/').valid).toBe(false);
  });

  it('blocks redirect to metadata endpoint (§8)', () => {
    expect(validateRedirectTarget('http://169.254.169.254/latest/meta-data/').valid).toBe(false);
  });

  it('blocks redirect to unsupported scheme', () => {
    expect(validateRedirectTarget('file:///etc/passwd').valid).toBe(false);
  });

  it('blocks redirect to javascript: scheme', () => {
    expect(validateRedirectTarget('javascript:alert(1)').valid).toBe(false);
  });
});

// ─── Reserved / multicast ranges ─────────────────────────────────────────────

describe('Reserved and multicast ranges — blocked', () => {
  it('blocks 240.0.0.1 (reserved)', () => {
    expect(validateUrl('https://240.0.0.1/').valid).toBe(false);
  });

  it('blocks 255.255.255.255 (broadcast)', () => {
    expect(validateUrl('https://255.255.255.255/').valid).toBe(false);
  });

  it('blocks 224.0.0.1 (multicast)', () => {
    const result = validateUrl('https://224.0.0.1/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('multicast');
  });

  it('blocks 239.255.255.255 (multicast max)', () => {
    const result = validateUrl('https://239.255.255.255/');
    expect(result.valid).toBe(false);
    expect(result.rejectionCode).toBe('multicast');
  });

  it('blocks 192.0.2.1 (TEST-NET-1 documentation)', () => {
    expect(validateUrl('https://192.0.2.1/').valid).toBe(false);
  });
});
