import type { ResourceAudit, ResourceAuditItem, ImageAuditItem, ThirdPartyGroup, MixedContentItem, SecurityHeaderResult } from './types';

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
    .map(s => ({ url: (s.match(/src=["']([^"']+)["']/i)?.[1] ?? '?'), type: 'script' as const }));

  // Stylesheets
  const allLinks = html.match(/<link[^>]+>/gi) ?? [];
  const totalStylesheets = allLinks.filter(l => /rel=["']stylesheet["']/i.test(l)).length;
  const headLinks = headHtml.match(/<link[^>]+>/gi) ?? [];
  const renderBlockingCSS: ResourceAuditItem[] = headLinks
    .filter(l => /rel=["']stylesheet["']/i.test(l) && !/media=["']print["']/i.test(l))
    .map(l => ({ url: (l.match(/href=["']([^"']+)["']/i)?.[1] ?? '?'), type: 'stylesheet' as const }));

  const renderBlocking = [...renderBlockingScripts, ...renderBlockingCSS].slice(0, 10);

  // Images
  const allImgs = html.match(/<img[^>]*>/gi) ?? [];
  const totalImages = allImgs.length;
  const lazyImages = allImgs.filter(img => /loading=["']lazy["']/i.test(img)).length;
  const imageIssues: ImageAuditItem[] = [];
  for (const img of allImgs.slice(0, 30)) {
    const src = (img.match(/src=["']([^"']+)["']/i)?.[1] ?? '').split('?')[0].slice(-60);
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
      while ((m = r.exec(html)) !== null) mixedContent.push({ url: m[1].slice(0, 100), tag });
    }
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
  };
}

export function analyzeSecurityHeaders(response: Response): SecurityHeaderResult[] {
  const checks = [
    {
      header: 'content-security-policy', severity: 'critical' as const,
      description: 'Prevents XSS by whitelisting trusted content sources.',
      recommendation: "Content-Security-Policy: default-src 'self'; script-src 'self'",
    },
    {
      header: 'strict-transport-security', severity: 'high' as const,
      description: 'Forces HTTPS and prevents SSL-stripping attacks.',
      recommendation: 'Strict-Transport-Security: max-age=31536000; includeSubDomains',
    },
    {
      header: 'x-frame-options', severity: 'high' as const,
      description: 'Prevents clickjacking by blocking iframe embedding.',
      recommendation: 'X-Frame-Options: SAMEORIGIN',
    },
    {
      header: 'x-content-type-options', severity: 'medium' as const,
      description: 'Stops MIME-type sniffing that can expose XSS vectors.',
      recommendation: 'X-Content-Type-Options: nosniff',
    },
    {
      header: 'referrer-policy', severity: 'medium' as const,
      description: 'Controls how much referrer info is sent with requests.',
      recommendation: 'Referrer-Policy: strict-origin-when-cross-origin',
    },
    {
      header: 'permissions-policy', severity: 'low' as const,
      description: 'Restricts browser API access (camera, microphone, geolocation).',
      recommendation: 'Permissions-Policy: camera=(), microphone=(), geolocation=()',
    },
  ];
  return checks.map(c => ({
    ...c,
    present: response.headers.get(c.header) !== null,
    value: response.headers.get(c.header),
  }));
}
