/**
 * Generates structured, evidence-based performance opportunities from
 * fetch-only analysis data. Every opportunity is grounded in something
 * actually observed — no invented metrics.
 */

export interface PerformanceOpportunity {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  source: string;
  description: string;
  evidence: string[];
  affectedResources: string[];
  estimatedSavingsMs?: number;
  estimatedSavingsBytes?: number;
  recommendation: string;
}

interface OpportunityInputs {
  html: string;
  response: Response;
  htmlBytes: number;
  ttfb: number;
  ttfbSamples?: number[];
  renderBlockingScripts: string[];
  renderBlockingStylesheets: string[];
  imageIssues: { src: string; issues: string[] }[];
  totalImages: number;
  lazyImages: number;
  inlineScriptCount: number;
  thirdPartyDomains: { domain: string; count: number; types: string[] }[];
  totalScripts: number;
  asyncScripts: number;
  deferScripts: number;
}

export function generateOpportunities(inputs: OpportunityInputs): PerformanceOpportunity[] {
  const opps: PerformanceOpportunity[] = [];
  const {
    html,
    response,
    htmlBytes,
    ttfb,
    ttfbSamples,
    renderBlockingScripts,
    renderBlockingStylesheets,
    imageIssues,
    totalImages,
    lazyImages,
    inlineScriptCount,
    thirdPartyDomains,
    totalScripts,
    asyncScripts,
    deferScripts,
  } = inputs;

  // ── Slow TTFB ────────────────────────────────────────────────────────────────
  if (ttfb > 800) {
    const severity = ttfb > 1800 ? 'critical' : 'high';
    const sampleNote = ttfbSamples && ttfbSamples.length === 3
      ? `Measured across 3 requests: ${ttfbSamples[0]}ms / ${ttfbSamples[1]}ms / ${ttfbSamples[2]}ms.`
      : `Measured via HTTP fetch from a Cloudflare edge node.`;
    opps.push({
      id: 'slow-ttfb',
      title: 'Slow server response time (TTFB)',
      severity,
      confidence: 'high',
      source: 'HTTP timing measurement',
      description:
        `Time to First Byte is ${ttfb}ms — target is under 800ms. ` +
        `Every additional millisecond of TTFB directly delays page load start for all users.`,
      evidence: [
        `TTFB: ${ttfb}ms (target ≤800ms, good <800ms, poor >1800ms).`,
        sampleNote,
      ],
      affectedResources: [response.url],
      estimatedSavingsMs: ttfb - 800,
      recommendation:
        `Investigate server processing time. Common causes: slow database queries, ` +
        `lack of HTTP caching, unoptimised server-side rendering, or a distant origin server. ` +
        `Enable a CDN for static assets. Add Cache-Control headers for cacheable responses. ` +
        `Consider edge functions or static generation for content that does not change per request. ` +
        `Test changes in a staging environment before deploying.`,
    });
  }

  // ── Large HTML document ──────────────────────────────────────────────────────
  const htmlKb = Math.round(htmlBytes / 1024);
  if (htmlBytes > 100_000) {
    const severity = htmlBytes > 300_000 ? 'high' : 'medium';
    opps.push({
      id: 'large-html-document',
      title: 'Large HTML document',
      severity,
      confidence: 'high',
      source: 'HTTP response body measurement',
      description:
        `The HTML document is ${htmlKb}KB — target is under 100KB for fast initial parse. ` +
        `Large HTML increases parsing time and delays the browser from discovering sub-resources.`,
      evidence: [
        `HTML transferred size: ${htmlKb}KB (target <100KB).`,
        response.headers.get('content-encoding')
          ? `Compression: ${response.headers.get('content-encoding')} (active).`
          : 'Compression: none detected — enabling gzip or Brotli would reduce transfer size.',
      ],
      affectedResources: [response.url],
      estimatedSavingsBytes: htmlBytes - 50_000,
      recommendation:
        `Reduce inline styles and scripts — move them to external cached files. ` +
        `Remove unused HTML comments and whitespace with a minifier. ` +
        `Consider server-side rendering only the above-the-fold content and deferring the rest. ` +
        `If compression is not enabled, add Content-Encoding: gzip or br — this typically reduces ` +
        `HTML size by 60–80%.`,
    });
  }

  // ── Missing compression ──────────────────────────────────────────────────────
  const encoding = response.headers.get('content-encoding');
  const hasCompression = encoding && /gzip|br|deflate|zstd/i.test(encoding);
  if (!hasCompression && htmlBytes > 1_000) {
    opps.push({
      id: 'missing-compression',
      title: 'HTML served without compression',
      severity: 'high',
      confidence: 'high',
      source: 'HTTP response header (Content-Encoding)',
      description:
        `The server returned the HTML document without HTTP compression. ` +
        `Enabling Brotli or gzip typically reduces text payload size by 60–80%.`,
      evidence: [
        `Content-Encoding header: not present.`,
        `HTML size: ${htmlKb}KB — compression would reduce this to roughly ${Math.round(htmlKb * 0.3)}–${Math.round(htmlKb * 0.4)}KB.`,
      ],
      affectedResources: [response.url],
      estimatedSavingsBytes: Math.round(htmlBytes * 0.65),
      recommendation:
        `Enable Brotli (preferred) or gzip on your server or CDN. ` +
        `In Nginx: add "gzip on; gzip_types text/html text/css application/javascript;" to your config. ` +
        `In Apache: enable mod_deflate. Vercel, Netlify, and Cloudflare enable Brotli automatically. ` +
        `After enabling, verify by checking the Content-Encoding response header.`,
    });
  }

  // ── Poor cache headers on HTML ───────────────────────────────────────────────
  const cacheControl = response.headers.get('cache-control');
  const hasGoodCache =
    cacheControl &&
    (cacheControl.includes('max-age=') || cacheControl.includes('s-maxage=')) &&
    !/no-store|no-cache/i.test(cacheControl);
  if (!hasGoodCache) {
    opps.push({
      id: 'poor-cache-headers',
      title: 'HTML document not cached by CDN',
      severity: 'low',
      confidence: 'high',
      source: 'HTTP response header (Cache-Control)',
      description:
        `The HTML response lacks effective Cache-Control directives. ` +
        `CDNs and browsers cannot cache the page, increasing origin server load and TTFB for repeat visitors.`,
      evidence: [
        cacheControl
          ? `Cache-Control: ${cacheControl}`
          : 'Cache-Control header: not present.',
      ],
      affectedResources: [response.url],
      recommendation:
        `For pages that change infrequently, add Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400 ` +
        `to let CDNs cache the response for 1 hour while serving stale content during revalidation. ` +
        `For user-specific pages, use Cache-Control: private, no-store. ` +
        `Separate cacheable static pages from dynamic ones to maximise cache hit rates.`,
    });
  }

  // ── Render-blocking scripts ──────────────────────────────────────────────────
  if (renderBlockingScripts.length > 0) {
    const urls = renderBlockingScripts.slice(0, 5);
    opps.push({
      id: 'render-blocking-scripts',
      title: `${renderBlockingScripts.length} render-blocking script${renderBlockingScripts.length > 1 ? 's' : ''} in <head>`,
      severity: 'high',
      confidence: 'high',
      source: 'HTML <head> parsing',
      description:
        `${renderBlockingScripts.length} <script> tag${renderBlockingScripts.length > 1 ? 's' : ''} in <head> ` +
        `without async or defer block HTML parsing until the script downloads, parses, and executes. ` +
        `This directly delays first paint and LCP.`,
      evidence: urls.map(u => `Blocking script: ${u}`),
      affectedResources: urls,
      recommendation:
        `Add defer to scripts that do not need to run before the DOM is ready: ` +
        `<script src="..." defer>. ` +
        `Add async to independent scripts (analytics, chat widgets) that can execute in any order. ` +
        `Move scripts that must be synchronous to the end of <body> instead of <head>. ` +
        `Do not add defer/async to scripts that other scripts depend on synchronously.`,
    });
  }

  // ── Render-blocking stylesheets ──────────────────────────────────────────────
  if (renderBlockingStylesheets.length > 0) {
    const urls = renderBlockingStylesheets.slice(0, 5);
    opps.push({
      id: 'render-blocking-stylesheets',
      title: `${renderBlockingStylesheets.length} render-blocking stylesheet${renderBlockingStylesheets.length > 1 ? 's' : ''} in <head>`,
      severity: 'medium',
      confidence: 'high',
      source: 'HTML <head> parsing',
      description:
        `${renderBlockingStylesheets.length} <link rel="stylesheet"> in <head> block rendering ` +
        `until they fully download. Stylesheets are render-blocking by design, but non-critical ` +
        `CSS can be deferred to reduce the blocking time.`,
      evidence: urls.map(u => `Blocking stylesheet: ${u}`),
      affectedResources: urls,
      recommendation:
        `Identify and inline the minimal CSS needed for above-the-fold content (critical CSS). ` +
        `Defer non-critical stylesheets: <link rel="stylesheet" href="..." media="print" ` +
        `onload="this.media='all'">. ` +
        `Use a tool like PurgeCSS to remove unused rules before serving. ` +
        `Note: the main stylesheet is usually necessary — only defer confirmed non-critical files.`,
    });
  }

  // ── Images missing dimensions (CLS risk) ─────────────────────────────────────
  const missingDimensionImages = imageIssues.filter(img =>
    img.issues.some(i => i.includes('width') || i.includes('height') || i.includes('CLS'))
  );
  if (missingDimensionImages.length > 0) {
    const srcs = missingDimensionImages.slice(0, 5).map(img => img.src);
    opps.push({
      id: 'images-missing-dimensions',
      title: `${missingDimensionImages.length} image${missingDimensionImages.length > 1 ? 's' : ''} without explicit width and height`,
      severity: 'high',
      confidence: 'high',
      source: 'HTML <img> attribute analysis',
      description:
        `${missingDimensionImages.length} <img> element${missingDimensionImages.length > 1 ? 's' : ''} ` +
        `lack explicit width and height attributes. Without these, the browser cannot reserve space ` +
        `before images load, causing layout shifts (CLS) that degrade user experience and Core Web Vitals.`,
      evidence: srcs.map(s => `Image without dimensions: ${s}`),
      affectedResources: srcs,
      recommendation:
        `Add matching width and height attributes to every <img>: ` +
        `<img src="hero.jpg" width="1200" height="630" alt="...">. ` +
        `Use the natural dimensions of the image. In CSS, set "img { max-width: 100%; height: auto; }" ` +
        `to keep images responsive. For unknown sizes, use the CSS aspect-ratio property instead.`,
    });
  }

  // ── Images missing lazy loading ──────────────────────────────────────────────
  const missingLazyImages = imageIssues.filter(img =>
    img.issues.some(i => i.toLowerCase().includes('lazy'))
  );
  if (missingLazyImages.length > 0) {
    const belowFoldCount = Math.max(0, missingLazyImages.length - 1); // heuristic: first image is likely above fold
    if (belowFoldCount > 0) {
      const srcs = missingLazyImages.slice(1, 6).map(img => img.src);
      opps.push({
        id: 'images-missing-lazy-loading',
        title: `${belowFoldCount} image${belowFoldCount > 1 ? 's' : ''} likely missing lazy loading`,
        severity: 'medium',
        confidence: 'medium',
        source: 'HTML <img> attribute analysis',
        description:
          `${belowFoldCount} image${belowFoldCount > 1 ? 's are' : ' is'} below the first detected image ` +
          `and ${belowFoldCount > 1 ? 'do' : 'does'} not use loading="lazy". ` +
          `Below-the-fold images loaded eagerly consume bandwidth before they are visible, ` +
          `delaying more critical resources.`,
        evidence: [
          `${missingLazyImages.length} images lack loading="lazy"; first image excluded as likely above fold.`,
          ...srcs.map(s => `No lazy loading: ${s}`),
        ],
        affectedResources: srcs,
        recommendation:
          `Add loading="lazy" to images that are not visible in the initial viewport: ` +
          `<img src="photo.jpg" loading="lazy" alt="...">. ` +
          `Do NOT add loading="lazy" to the above-the-fold hero image — this would delay LCP. ` +
          `The first <img> on the page is typically above the fold; leave it eager-loading. ` +
          `Check your actual page layout to confirm which images are truly below the fold.`,
      });
    }
  }

  // ── Above-fold image incorrectly lazy ────────────────────────────────────────
  const firstImgMatch = html.match(/<img[^>]+>/i);
  if (firstImgMatch && /loading=["']lazy["']/i.test(firstImgMatch[0])) {
    const srcMatch = firstImgMatch[0].match(/src=["']([^"']{1,80})["']/i);
    opps.push({
      id: 'above-fold-lazy-image',
      title: 'First image is incorrectly lazy-loaded (potential LCP delay)',
      severity: 'high',
      confidence: 'medium',
      source: 'HTML <img> attribute analysis',
      description:
        `The first <img> element in the HTML has loading="lazy". ` +
        `If this image is above the fold, lazy loading prevents the browser from discovering ` +
        `and fetching it early, which can significantly delay LCP.`,
      evidence: [
        srcMatch ? `First image: ${srcMatch[1]}` : 'First <img> in the document.',
        'loading="lazy" attribute present on first detected image.',
      ],
      affectedResources: srcMatch ? [srcMatch[1]] : [],
      recommendation:
        `Remove loading="lazy" from the hero or above-the-fold image. ` +
        `If this image is the Largest Contentful Paint element, consider adding a preload hint: ` +
        `<link rel="preload" as="image" href="hero.jpg">. ` +
        `Keep loading="lazy" only on images that are genuinely below the initial viewport.`,
    });
  }

  // ── Images without modern format ─────────────────────────────────────────────
  const legacyFormatImages = imageIssues.filter(img =>
    img.issues.some(i => i.toLowerCase().includes('webp') || i.toLowerCase().includes('avif'))
  );
  if (legacyFormatImages.length > 0) {
    const srcs = legacyFormatImages.slice(0, 5).map(img => img.src);
    opps.push({
      id: 'images-legacy-format',
      title: `${legacyFormatImages.length} image${legacyFormatImages.length > 1 ? 's' : ''} in legacy format (JPEG/PNG)`,
      severity: 'medium',
      confidence: 'high',
      source: 'HTML <img> src extension analysis',
      description:
        `${legacyFormatImages.length} image${legacyFormatImages.length > 1 ? 's use' : ' uses'} JPEG or PNG. ` +
        `Modern formats (WebP, AVIF) offer 25–50% smaller file sizes at equivalent visual quality, ` +
        `reducing bandwidth and improving load times.`,
      evidence: srcs.map(s => `Legacy format image: ${s}`),
      affectedResources: srcs,
      recommendation:
        `Generate WebP and AVIF variants of each image and serve them with <picture> or srcset: ` +
        `<picture><source srcset="image.avif" type="image/avif"><source srcset="image.webp" ` +
        `type="image/webp"><img src="image.jpg" alt="..."></picture>. ` +
        `Use Sharp, Squoosh, or your CDN's image transformation API for automated conversion. ` +
        `Verify that the optimised images maintain acceptable visual quality before deploying.`,
    });
  }

  // ── Images without responsive srcset ─────────────────────────────────────────
  const noSrcsetImages = imageIssues.filter(img =>
    img.issues.some(i => i.toLowerCase().includes('srcset') || i.toLowerCase().includes('responsive'))
  );
  if (noSrcsetImages.length > 0) {
    const srcs = noSrcsetImages.slice(0, 5).map(img => img.src);
    opps.push({
      id: 'images-missing-srcset',
      title: `${noSrcsetImages.length} image${noSrcsetImages.length > 1 ? 's' : ''} without responsive srcset`,
      severity: 'low',
      confidence: 'high',
      source: 'HTML <img> attribute analysis',
      description:
        `${noSrcsetImages.length} <img> element${noSrcsetImages.length > 1 ? 's are' : ' is'} missing ` +
        `the srcset attribute. Without srcset, mobile devices download the same full-resolution ` +
        `image as desktop devices, wasting bandwidth.`,
      evidence: srcs.map(s => `No srcset: ${s}`),
      affectedResources: srcs,
      recommendation:
        `Add srcset with multiple sizes for content images: ` +
        `<img src="photo-800.jpg" srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1200.jpg 1200w" ` +
        `sizes="(max-width: 600px) 100vw, 800px" alt="...">. ` +
        `For Next.js, use the <Image> component which handles this automatically.`,
    });
  }

  // ── Excessive third-party domains ────────────────────────────────────────────
  if (thirdPartyDomains.length > 4) {
    const domains = thirdPartyDomains.slice(0, 6).map(d => `${d.domain} (${d.count} resource${d.count > 1 ? 's' : ''})`);
    opps.push({
      id: 'excessive-third-party-scripts',
      title: `${thirdPartyDomains.length} third-party resource domains`,
      severity: thirdPartyDomains.length > 8 ? 'high' : 'medium',
      confidence: 'high',
      source: 'HTML resource URL analysis',
      description:
        `The page loads resources from ${thirdPartyDomains.length} distinct third-party domains. ` +
        `Each domain requires a separate DNS lookup, TCP connection, and TLS handshake, ` +
        `adding latency before those resources can load.`,
      evidence: domains,
      affectedResources: thirdPartyDomains.slice(0, 6).map(d => d.domain),
      recommendation:
        `Audit third-party scripts and remove those that are not providing measurable business value. ` +
        `For essential third-party origins, add <link rel="preconnect" href="https://domain.com"> ` +
        `to the <head> to establish connections early. ` +
        `Self-host fonts and analytics scripts where possible. ` +
        `Do not remove payment processors or consent management tools without business approval.`,
    });
  }

  // ── Missing preconnect for third-party origins ────────────────────────────────
  const preconnectHints = new Set<string>();
  const preconnectRe = /<link[^>]+rel=["']preconnect["'][^>]+href=["']([^"']+)["']/gi;
  let pcMatch: RegExpExecArray | null;
  while ((pcMatch = preconnectRe.exec(html)) !== null) {
    try { preconnectHints.add(new URL(pcMatch[1]).hostname); } catch {}
  }

  const missingPreconnect = thirdPartyDomains
    .filter(d => !preconnectHints.has(d.domain) && d.count >= 2)
    .slice(0, 4);

  if (missingPreconnect.length > 0) {
    opps.push({
      id: 'missing-preconnect',
      title: `${missingPreconnect.length} critical third-party origin${missingPreconnect.length > 1 ? 's' : ''} without preconnect`,
      severity: 'low',
      confidence: 'medium',
      source: 'HTML <link rel="preconnect"> analysis',
      description:
        `${missingPreconnect.length} third-party domain${missingPreconnect.length > 1 ? 's that each serve' : ' that serves'} ` +
        `multiple resources ${missingPreconnect.length > 1 ? 'have' : 'has'} no preconnect hint. ` +
        `Adding preconnect eliminates the DNS+TCP+TLS setup time from the critical path.`,
      evidence: missingPreconnect.map(d => `${d.domain}: ${d.count} resources, no preconnect hint`),
      affectedResources: missingPreconnect.map(d => `https://${d.domain}`),
      recommendation:
        `Add to <head> for each critical domain: ` +
        missingPreconnect.slice(0, 2).map(d => `<link rel="preconnect" href="https://${d.domain}" crossorigin>`).join(' ') +
        `. Limit preconnect hints to 3–5 origins — too many hints cancel the benefit by competing for network bandwidth.`,
    });
  }

  // ── Large inline scripts ─────────────────────────────────────────────────────
  if (inlineScriptCount > 0) {
    opps.push({
      id: 'large-inline-scripts',
      title: `${inlineScriptCount} large inline script${inlineScriptCount > 1 ? 's' : ''} detected`,
      severity: 'low',
      confidence: 'medium',
      source: 'HTML <script> analysis (scripts >200 bytes without src attribute)',
      description:
        `${inlineScriptCount} inline <script> block${inlineScriptCount > 1 ? 's exceed' : ' exceeds'} 200 bytes. ` +
        `Inline scripts block HTML parsing and cannot be cached independently by the browser.`,
      evidence: [`${inlineScriptCount} sizeable inline script block${inlineScriptCount > 1 ? 's' : ''} detected.`],
      affectedResources: [],
      recommendation:
        `Move large inline scripts to external files with appropriate cache headers. ` +
        `Add defer or async to the external script tag. ` +
        `Small configuration objects (JSON data, analytics IDs) are acceptable inline — ` +
        `extract only business logic and library code.`,
    });
  }

  // ── Synchronous scripts vs async/defer ratio ─────────────────────────────────
  const externalScripts = totalScripts - inlineScriptCount;
  const nonDeferredExternal = Math.max(0, externalScripts - asyncScripts - deferScripts);
  if (nonDeferredExternal > 2 && renderBlockingScripts.length === 0) {
    // Some may be in body (not blocking) — flag as low severity without double-counting render-blocking
    opps.push({
      id: 'synchronous-scripts',
      title: `${nonDeferredExternal} external script${nonDeferredExternal > 1 ? 's' : ''} without async or defer`,
      severity: 'low',
      confidence: 'low',
      source: 'HTML <script> attribute analysis',
      description:
        `${nonDeferredExternal} <script src="..."> tag${nonDeferredExternal > 1 ? 's' : ''} lack ` +
        `async or defer. Scripts in <body> are less critical, but async or defer still allows ` +
        `parallel downloading and faster overall page load.`,
      evidence: [`${nonDeferredExternal} external scripts without async/defer (excluding confirmed blocking scripts).`],
      affectedResources: [],
      recommendation:
        `Review each script to determine the appropriate loading strategy: ` +
        `defer for scripts that need the DOM, async for independent scripts like analytics. ` +
        `Confirm scripts do not depend on each other's execution order before adding async.`,
    });
  }

  // ── Missing font preload ─────────────────────────────────────────────────────
  const hasFontLinks = /<link[^>]+\.(woff2?|ttf|otf|eot)["']/i.test(html) ||
    /@font-face/i.test(html);
  const hasPreloadFont = /<link[^>]+rel=["']preload["'][^>]+as=["']font["']/i.test(html);
  if (hasFontLinks && !hasPreloadFont) {
    opps.push({
      id: 'missing-font-preload',
      title: 'Web fonts detected without preload hints',
      severity: 'low',
      confidence: 'medium',
      source: 'HTML font reference and <link rel="preload"> analysis',
      description:
        `The page uses web fonts but has no <link rel="preload" as="font"> hints. ` +
        `Without preloading, fonts are discovered late — after CSS is downloaded and parsed — ` +
        `causing a flash of invisible or unstyled text (FOIT/FOUT).`,
      evidence: [
        '@font-face or external font file references detected.',
        'No <link rel="preload" as="font"> found in <head>.',
      ],
      affectedResources: [],
      recommendation:
        `Identify the most critical font file (typically the regular weight of your primary typeface) ` +
        `and add a preload hint: <link rel="preload" href="/fonts/main.woff2" as="font" ` +
        `type="font/woff2" crossorigin>. ` +
        `Ensure @font-face includes font-display: swap; to show text immediately while the font loads. ` +
        `Preload at most 2–3 font files to avoid delaying other resources.`,
    });
  }

  // ── Missing font-display ─────────────────────────────────────────────────────
  const hasFontFace = /@font-face/i.test(html);
  const hasFontDisplay = /font-display\s*:/i.test(html);
  if (hasFontFace && !hasFontDisplay) {
    opps.push({
      id: 'missing-font-display',
      title: 'Web fonts defined without font-display strategy',
      severity: 'low',
      confidence: 'medium',
      source: '@font-face CSS analysis',
      description:
        `One or more @font-face rules are present but none include font-display. ` +
        `Without font-display, browsers use "auto" behaviour — typically blocking text rendering ` +
        `for up to 3 seconds while the font loads.`,
      evidence: ['@font-face found in inline styles.', 'No font-display property detected.'],
      affectedResources: [],
      recommendation:
        `Add font-display: swap to all @font-face rules to show fallback text immediately ` +
        `and swap to the web font once loaded. ` +
        `For fonts that match closely to system fonts, font-display: optional prevents ` +
        `layout shifts by not swapping if the font loads after 100ms.`,
    });
  }

  // ── Redirect chain ───────────────────────────────────────────────────────────
  if (response.redirected) {
    opps.push({
      id: 'redirect-detected',
      title: 'HTTP redirect detected before final page',
      severity: 'low',
      confidence: 'high',
      source: 'HTTP response redirect flag',
      description:
        `The requested URL was redirected before serving the final page. ` +
        `Each redirect adds at least one round-trip of latency (typically 50–300ms).`,
      evidence: [`Response.redirected = true. Final URL: ${response.url}`],
      affectedResources: [response.url],
      recommendation:
        `Update internal links, sitemaps, and canonical tags to point directly to the final URL. ` +
        `If the redirect is a www → non-www or HTTP → HTTPS redirect, it is expected — ` +
        `but ensure it is a single 301 redirect, not a chain of multiple hops.`,
    });
  }

  // Sort: critical first, then by confidence (high first within severity)
  const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const CONFIDENCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  opps.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
  });

  return opps;
}
