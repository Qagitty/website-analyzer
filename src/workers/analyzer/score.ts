import type { Scores, ScoreBreakdown } from './types';

export function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function analyzeHTML(html: string, response: Response, bytes: number, ttfb: number): Scores {
  const lower = html.toLowerCase();

  // --- Performance ---
  const estimatedLcp = ttfb + Math.round(bytes / 5000) * 100;
  const lcpScore = estimatedLcp < 2500 ? 95 : estimatedLcp < 4000 ? 65 : 30;
  const ttfbScore = ttfb < 800 ? 95 : ttfb < 1800 ? 65 : 30;
  const sizeScore = bytes < 100_000 ? 95 : bytes < 300_000 ? 75 : bytes < 500_000 ? 50 : 25;
  const performance = Math.round((lcpScore * 0.4) + (ttfbScore * 0.35) + (sizeScore * 0.25));

  // --- SEO ---
  const hasTitle = /<title[^>]*>[^<]{3,}<\/title>/i.test(html);
  const hasMetaDesc = /meta[^>]+name=["']description["'][^>]*content=["'][^"']{10,}/i.test(html)
    || /meta[^>]+content=["'][^"']{10,}["'][^>]*name=["']description["']/i.test(html);
  const hasH1 = /<h1[\s>]/i.test(html);
  const hasViewport = /meta[^>]+name=["']viewport["']/i.test(html);
  const hasCanonical = /rel=["']canonical["']/i.test(html);
  const hasLang = /html[^>]+lang=["'][a-z]/i.test(html);
  const isHttps = response.url.startsWith('https://');
  const seoChecks = [hasTitle, hasMetaDesc, hasH1, hasViewport, hasCanonical, hasLang, isHttps];
  const seo = Math.round((seoChecks.filter(Boolean).length / seoChecks.length) * 100);

  // --- Best Practices ---
  const hasXFrameOptions = response.headers.get('x-frame-options') !== null;
  const hasCSP = response.headers.get('content-security-policy') !== null;
  const hasHSTS = response.headers.get('strict-transport-security') !== null;
  const hasXContentType = response.headers.get('x-content-type-options') !== null;
  const noMixedContent = !lower.includes('src="http://') && !lower.includes("src='http://");
  const noInlineHandlers = !/ on(click|load|error|submit)=/i.test(html);
  const bpChecks = [isHttps, hasXFrameOptions, hasCSP, hasHSTS, hasXContentType, noMixedContent, noInlineHandlers];
  const bestPractices = Math.round((bpChecks.filter(Boolean).length / bpChecks.length) * 100);

  // --- Accessibility (score) ---
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const imgsWithoutAlt = imgMatches.filter(img => !/alt=/i.test(img)).length;
  const inputMatches = html.match(/<input[^>]*>/gi) || [];
  const inputsWithoutLabel = inputMatches.filter(
    input => !/type=["'](hidden|submit|button|reset|image)["']/i.test(input) &&
             !/aria-label/i.test(input) && !/aria-labelledby/i.test(input) && !/id=["'][^"']/i.test(input)
  ).length;
  const totalImgs = imgMatches.length;
  const totalInputs = inputMatches.filter(i => !/type=["'](hidden|submit|button|reset|image)["']/i.test(i)).length;
  const altRatio = totalImgs === 0 ? 1 : (totalImgs - imgsWithoutAlt) / totalImgs;
  const labelRatio = totalInputs === 0 ? 1 : (totalInputs - inputsWithoutLabel) / totalInputs;
  const hasSkipLink = /skip.*nav|skip.*content|main-content/i.test(html);
  const hasMain = /<main[\s>]/i.test(html) || /role=["']main["']/i.test(html);
  const hasNav = /<nav[\s>]/i.test(html) || /role=["']navigation["']/i.test(html);
  const noOutlineNone = !/outline\s*:\s*(?:none|0)\b/i.test(html);
  const noPositiveTabindex = !/tabindex=["'][1-9]/i.test(html);
  const noViewportBlock = !/user-scalable\s*=\s*no/i.test(html);
  const accessibility = Math.round(
    (altRatio * 25) +
    (labelRatio * 20) +
    (hasSkipLink ? 8 : 0) +
    (hasMain ? 10 : 0) +
    (hasNav ? 5 : 0) +
    (hasLang ? 12 : 0) +
    (noOutlineNone ? 8 : 0) +
    (noPositiveTabindex ? 6 : 0) +
    (noViewportBlock ? 6 : 0)
  );

  const scoreBreakdown: ScoreBreakdown = {
    performance: [
      {
        label: 'Time to First Byte (TTFB)',
        passed: ttfb < 800,
        details: ttfb < 800
          ? `${ttfb}ms — good`
          : `${ttfb}ms — target <800ms. Use a CDN, enable caching headers, or optimize server response time`,
      },
      {
        label: 'Estimated Largest Contentful Paint',
        passed: estimatedLcp < 2500,
        details: estimatedLcp < 2500
          ? `~${(estimatedLcp/1000).toFixed(1)}s — good`
          : `~${(estimatedLcp/1000).toFixed(1)}s — target <2.5s. Reduce server response time and page weight`,
      },
      {
        label: 'Page weight',
        passed: bytes < 300_000,
        details: bytes < 300_000
          ? `${Math.round(bytes/1024)}KB — good`
          : `${Math.round(bytes/1024)}KB HTML — reduce inline scripts/styles and avoid large embedded SVGs`,
      },
    ],
    bestPractices: [
      {
        label: 'HTTPS',
        passed: isHttps,
        details: isHttps ? 'Site served over HTTPS' : "Site is served over HTTP — migrate to HTTPS immediately (free via Let's Encrypt)",
      },
      {
        label: 'X-Frame-Options header',
        passed: hasXFrameOptions,
        details: hasXFrameOptions ? 'Present' : 'Missing — add response header: X-Frame-Options: SAMEORIGIN to prevent clickjacking attacks',
      },
      {
        label: 'Content Security Policy header',
        passed: hasCSP,
        details: hasCSP ? 'Present' : 'Missing — add Content-Security-Policy header to restrict which resources can load on the page',
      },
      {
        label: 'Strict-Transport-Security (HSTS)',
        passed: hasHSTS,
        details: hasHSTS ? 'Present' : 'Missing — add Strict-Transport-Security: max-age=31536000 to enforce HTTPS connections',
      },
      {
        label: 'X-Content-Type-Options header',
        passed: hasXContentType,
        details: hasXContentType ? 'Present' : 'Missing — add X-Content-Type-Options: nosniff to prevent MIME-type sniffing attacks',
      },
      {
        label: 'No mixed content',
        passed: noMixedContent,
        details: noMixedContent
          ? 'No HTTP resources detected on HTTPS page'
          : 'HTTP resources found on HTTPS page — update all src/href attributes to use https:// or protocol-relative URLs (//)',
      },
      {
        label: 'No inline event handlers',
        passed: noInlineHandlers,
        details: noInlineHandlers
          ? 'No inline onclick/onload handlers found'
          : 'Inline event handlers (onclick=, onload=, onsubmit=, etc.) detected — move to external JS files and use addEventListener()',
      },
    ],
    seo: [
      {
        label: '<title> tag',
        passed: hasTitle,
        details: hasTitle ? 'Present' : 'Missing — add a unique, descriptive <title> tag to every page (50–60 characters recommended)',
      },
      {
        label: 'Meta description',
        passed: hasMetaDesc,
        details: hasMetaDesc ? 'Present' : 'Missing — add <meta name="description" content="..."> with 150–160 characters summarising the page',
      },
      {
        label: '<h1> heading',
        passed: hasH1,
        details: hasH1 ? 'Present' : 'Missing — add exactly one <h1> element as the primary page heading',
      },
      {
        label: 'Viewport meta tag',
        passed: hasViewport,
        details: hasViewport ? 'Present' : 'Missing — add <meta name="viewport" content="width=device-width, initial-scale=1">',
      },
      {
        label: 'Canonical URL',
        passed: hasCanonical,
        details: hasCanonical ? 'Present' : 'Missing — add <link rel="canonical" href="https://yoursite.com/page"> to prevent duplicate content penalties',
      },
      {
        label: 'lang attribute on <html>',
        passed: hasLang,
        details: hasLang ? 'Present' : 'Missing — add lang="en" (or appropriate language code) to the <html> element',
      },
      {
        label: 'HTTPS',
        passed: isHttps,
        details: isHttps
          ? 'Site served over HTTPS — positive SEO ranking signal'
          : 'Site served over HTTP — Google penalises non-HTTPS sites in search rankings',
      },
    ],
    accessibility: [
      {
        label: 'Images have alt text',
        passed: altRatio === 1,
        details: altRatio === 1
          ? 'All images have alt attributes'
          : `${Math.round((1 - altRatio) * 100)}% of images missing alt text — screen readers cannot describe these images to blind users. Add descriptive alt attributes to all <img> elements`,
      },
      {
        label: 'Form inputs have labels',
        passed: labelRatio === 1,
        details: labelRatio === 1
          ? 'All inputs appear to have label associations'
          : `${Math.round((1 - labelRatio) * 100)}% of inputs may lack labels — screen reader users cannot identify form fields. Use <label for="id"> or aria-label on every input`,
      },
      {
        label: 'Skip navigation link',
        passed: hasSkipLink,
        details: hasSkipLink
          ? 'Skip link found'
          : 'No skip-to-content link — keyboard users must tab through all navigation on every page load. Add <a href="#main">Skip to main content</a> as the first element',
      },
      {
        label: '<main> landmark',
        passed: hasMain,
        details: hasMain
          ? '<main> landmark present'
          : 'No <main> element — screen reader users cannot jump directly to main content. Wrap page content in <main> or add role="main"',
      },
      {
        label: '<nav> landmark',
        passed: hasNav,
        details: hasNav
          ? '<nav> landmark present'
          : 'No <nav> element — navigation is not identifiable by assistive technologies. Wrap navigation links in <nav>',
      },
      {
        label: 'Language declared',
        passed: hasLang,
        details: hasLang
          ? 'lang attribute present on <html>'
          : 'Missing lang attribute on <html> — screen readers cannot select the correct pronunciation rules for the page language',
      },
      {
        label: 'Focus outline not removed',
        passed: noOutlineNone,
        details: noOutlineNone
          ? 'No outline:none detected'
          : 'outline:none or outline:0 found in page styles — keyboard users lose the visible focus indicator. Replace with a custom focus style instead of removing it',
      },
      {
        label: 'No positive tabindex values',
        passed: noPositiveTabindex,
        details: noPositiveTabindex
          ? 'No positive tabindex values found'
          : 'Positive tabindex values (e.g. tabindex="3") disrupt the natural keyboard navigation order — use tabindex="0" or remove tabindex entirely',
      },
      {
        label: 'Viewport allows user zoom',
        passed: noViewportBlock,
        details: noViewportBlock
          ? 'Zoom not blocked'
          : 'user-scalable=no in viewport meta prevents low-vision users from zooming — remove this restriction',
      },
    ],
  };

  return {
    performance: clamp(performance),
    accessibility: clamp(accessibility),
    bestPractices: clamp(bestPractices),
    seo: clamp(seo),
    estimatedLcp,
    scoreBreakdown,
  };
}
