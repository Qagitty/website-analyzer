import type { ResourceAudit, ResourceAuditItem, ImageAuditItem, ThirdPartyGroup, MixedContentItem, SecurityHeaderResult, DetectedResource } from './types';

// ── URL sanitization ──────────────────────────────────────────────────────────

const SENSITIVE_PARAM_RE = /^(token|auth|key|secret|password|pass|api[_-]?key|access[_-]?token|session|sess|jwt|bearer|sig|signature|hash|nonce|csrf|state|client[_-]?secret|refresh[_-]?token)$/i;

export function sanitizeResourceUrl(rawUrl: string, base: string): string {
  try {
    const u = new URL(rawUrl, base);
    for (const k of [...u.searchParams.keys()]) {
      if (SENSITIVE_PARAM_RE.test(k)) u.searchParams.set(k, '[redacted]');
    }
    const s = u.toString();
    return s.length > 180 ? s.slice(0, 177) + '…' : s;
  } catch {
    return rawUrl.slice(0, 100);
  }
}

// ── Resource analysis ─────────────────────────────────────────────────────────

export function analyzeResources(html: string, response: Response, baseUrl: string): ResourceAudit {
  const base = new URL(baseUrl);
  const isHttps = response.url.startsWith('https://');
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : '';

  // Scripts
  const allScripts = html.match(/<script[^>]*>/gi) ?? [];
  const totalScripts = allScripts.length;
  const asyncScripts = allScripts.filter(s => /\basync\b/i.test(s)).length;
  const deferScripts = allScripts.filter(s => /\bdefer\b/i.test(s)).length;
  const inlineScriptCount = (html.match(/<script(?![^>]*\bsrc\b)[^>]*>[\s\S]{200,}?<\/script>/gi) ?? []).length;

  const headScripts = headHtml.match(/<script[^>]+src=["'][^"']+["'][^>]*>/gi) ?? [];
  const renderBlockingScripts: ResourceAuditItem[] = headScripts
    .filter(s => !/\basync\b/i.test(s) && !/\bdefer\b/i.test(s))
    .map(s => {
      const raw = s.match(/src=["']([^"']+)["']/i)?.[1] ?? '?';
      return { url: sanitizeResourceUrl(raw, baseUrl), type: 'script' as const };
    });

  // Stylesheets
  const allLinks = html.match(/<link[^>]+>/gi) ?? [];
  const totalStylesheets = allLinks.filter(l => /rel=["']stylesheet["']/i.test(l)).length;
  const headLinks = headHtml.match(/<link[^>]+>/gi) ?? [];
  const renderBlockingCSS: ResourceAuditItem[] = headLinks
    .filter(l => /rel=["']stylesheet["']/i.test(l) && !/media=["']print["']/i.test(l))
    .map(l => {
      const raw = l.match(/href=["']([^"']+)["']/i)?.[1] ?? '?';
      return { url: sanitizeResourceUrl(raw, baseUrl), type: 'stylesheet' as const };
    });

  const renderBlocking = [...renderBlockingScripts, ...renderBlockingCSS].slice(0, 10);

  // Images
  const allImgs = html.match(/<img[^>]*>/gi) ?? [];
  const totalImages = allImgs.length;
  const lazyImages = allImgs.filter(img => /loading=["']lazy["']/i.test(img)).length;
  const imageIssues: ImageAuditItem[] = [];
  for (const img of allImgs.slice(0, 30)) {
    const rawSrc = img.match(/src=["']([^"']+)["']/i)?.[1] ?? '';
    const src = sanitizeResourceUrl(rawSrc, baseUrl).split('?')[0].slice(-60);
    const issues: string[] = [];
    const hasW = /\bwidth=["']?\d+|width:\s*\d/i.test(img);
    const hasH = /\bheight=["']?\d+|height:\s*\d/i.test(img);
    if (!hasW || !hasH) issues.push('No width/height → causes CLS');
    if (!/loading=["']lazy["']/i.test(img)) issues.push('No lazy loading');
    if (!/srcset=/i.test(img)) issues.push('No srcset → not responsive');
    const low = src.toLowerCase();
    if ((low.endsWith('.jpg') || low.endsWith('.jpeg') || low.endsWith('.png')) && !low.includes('webp')) {
      issues.push('Use WebP/AVIF for 30–50% smaller files');
    }
    if (issues.length > 0) imageIssues.push({ src: src || '(unknown)', issues });
  }

  // Third-party resources
  const thirdPartyMap = new Map<string, { count: number; types: Set<string> }>();
  const resourceRe: [RegExp, string][] = [
    [/<script[^>]+src=["'](https?:\/\/[^"']+)["']/gi, 'script'],
    [/<link[^>]+href=["'](https?:\/\/[^"']+)["']/gi, 'link'],
    [/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi, 'image'],
    [/<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/gi, 'iframe'],
  ];
  for (const [re, type] of resourceRe) {
    const r = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(html)) !== null) {
      try {
        const u = new URL(m[1]);
        if (u.hostname === base.hostname) continue;
        const domain = u.hostname.replace(/^www\./, '');
        if (!thirdPartyMap.has(domain)) thirdPartyMap.set(domain, { count: 0, types: new Set() });
        const e = thirdPartyMap.get(domain)!;
        e.count++;
        e.types.add(type);
      } catch {}
    }
  }
  const thirdPartyDomains = new Set([...thirdPartyMap.keys()]);
  const thirdParty: ThirdPartyGroup[] = [...thirdPartyMap.entries()]
    .map(([domain, { count, types }]) => ({ domain, count, types: [...types] }))
    .sort((a, b) => b.count - a.count).slice(0, 10);

  // Mixed content
  const mixedContent: MixedContentItem[] = [];
  if (isHttps) {
    const mcRe: [RegExp, string][] = [
      [/<script[^>]+src=["'](http:\/\/[^"']+)["']/gi, 'script'],
      [/<link[^>]+href=["'](http:\/\/[^"']+)["']/gi, 'link'],
      [/<img[^>]+src=["'](http:\/\/[^"']+)["']/gi, 'image'],
      [/<iframe[^>]+src=["'](http:\/\/[^"']+)["']/gi, 'iframe'],
    ];
    for (const [re, tag] of mcRe) {
      const r = new RegExp(re.source, re.flags);
      let m: RegExpExecArray | null;
      while ((m = r.exec(html)) !== null) {
        mixedContent.push({ url: sanitizeResourceUrl(m[1], baseUrl).slice(0, 100), tag });
      }
    }
  }

  // Detected resources table (sanitized, no size data — fetch-only mode)
  const detectedResources: DetectedResource[] = [];

  const scriptRe = /<script([^>]*)>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = scriptRe.exec(html)) !== null && detectedResources.length < 25) {
    const attrs = sm[1];
    const rawSrc = attrs.match(/src=["']([^"']+)["']/i)?.[1];
    if (!rawSrc) continue;
    const url = sanitizeResourceUrl(rawSrc, baseUrl);
    let isThirdParty = false;
    try { isThirdParty = new URL(url).hostname !== base.hostname; } catch {}
    const inHead = headHtml.includes(sm[0]);
    detectedResources.push({
      url,
      type: 'script',
      isRenderBlocking: inHead && !/\basync\b/i.test(attrs) && !/\bdefer\b/i.test(attrs),
      isThirdParty,
      initiator: inHead ? 'head' : 'body',
      transferredBytes: null,
      decodedBytes: null,
      durationMs: null,
    });
  }

  const linkRe = /<link([^>]*)>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(html)) !== null && detectedResources.length < 35) {
    const attrs = lm[1];
    if (!/rel=["']stylesheet["']/i.test(attrs)) continue;
    const rawHref = attrs.match(/href=["']([^"']+)["']/i)?.[1];
    if (!rawHref) continue;
    const url = sanitizeResourceUrl(rawHref, baseUrl);
    let isThirdParty = false;
    try { isThirdParty = new URL(url).hostname !== base.hostname; } catch {}
    const inHead = headHtml.includes(lm[0]);
    detectedResources.push({
      url,
      type: 'stylesheet',
      isRenderBlocking: inHead && !/media=["']print["']/i.test(attrs),
      isThirdParty,
      initiator: inHead ? 'head' : 'body',
      transferredBytes: null,
      decodedBytes: null,
      durationMs: null,
    });
  }

  const imgCount = { n: 0 };
  const imgRe = /<img([^>]*)>/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(html)) !== null && imgCount.n < 20) {
    const attrs = im[1];
    const rawSrc = attrs.match(/src=["']([^"']+)["']/i)?.[1];
    if (!rawSrc) continue;
    const url = sanitizeResourceUrl(rawSrc, baseUrl);
    let isThirdParty = false;
    try { isThirdParty = new URL(url).hostname !== base.hostname; } catch {}
    const low = url.toLowerCase().split('?')[0];
    detectedResources.push({
      url,
      type: 'image',
      isRenderBlocking: false,
      isThirdParty,
      initiator: 'body',
      hasWidth: /\bwidth=["']?\d+|width:\s*\d/i.test(attrs),
      hasHeight: /\bheight=["']?\d+|height:\s*\d/i.test(attrs),
      hasLazy: /loading=["']lazy["']/i.test(attrs),
      hasModernFormat: low.endsWith('.webp') || low.endsWith('.avif'),
      hasSrcset: /srcset=/i.test(attrs),
      transferredBytes: null,
      decodedBytes: null,
      durationMs: null,
    });
    imgCount.n++;
  }

  return {
    renderBlocking,
    imageIssues: imageIssues.slice(0, 20),
    thirdParty,
    mixedContent: mixedContent.slice(0, 10),
    totalScripts,
    asyncScripts,
    deferScripts,
    totalStylesheets,
    totalImages,
    lazyImages,
    inlineScriptCount,
    detectedResources,
  };
}

export function analyzeSecurityHeaders(response: Response): SecurityHeaderResult[] {
  const checks = [
    {
      header: 'content-security-policy', severity: 'critical' as const,
      description: 'Declares which content sources are trusted, mitigating XSS attacks.',
      recommendation: 'Introduce in Report-Only mode first. A production CSP must be tailored to this site\'s actual scripts, styles, and origins — a generic policy will break analytics, payments, and third-party services.',
    },
    {
      header: 'strict-transport-security', severity: 'high' as const,
      description: 'Instructs browsers to always connect via HTTPS, preventing SSL-stripping.',
      recommendation: 'Start with max-age=300 in staging. Increase gradually. Add includeSubDomains only after verifying all subdomains support HTTPS.',
    },
    {
      header: 'x-frame-options', severity: 'medium' as const,
      description: 'Prevents clickjacking by controlling whether the page can be embedded in iframes.',
      recommendation: 'X-Frame-Options: SAMEORIGIN — or use CSP frame-ancestors for modern browsers.',
    },
    {
      header: 'x-content-type-options', severity: 'medium' as const,
      description: 'Prevents MIME-type sniffing, which can enable XSS via misclassified responses.',
      recommendation: 'X-Content-Type-Options: nosniff — safe to add directly.',
    },
    {
      header: 'referrer-policy', severity: 'medium' as const,
      description: 'Controls how much referrer information is sent with navigation and resource requests.',
      recommendation: 'Referrer-Policy: strict-origin-when-cross-origin — balances analytics and privacy.',
    },
    {
      header: 'permissions-policy', severity: 'low' as const,
      description: 'Scopes browser capability access (camera, microphone, geolocation) for the page and its iframes.',
      recommendation: 'Review which browser capabilities the site requires before setting. Do not disable capabilities the site genuinely uses. Test in staging.',
    },
  ];
  return checks.map(c => ({
    ...c,
    present: response.headers.get(c.header) !== null,
    value: response.headers.get(c.header),
  }));
}
