/**
 * Static fixture data for the public /sample-report page.
 * Represents a realistic SMB website audit (a fictional garden centre).
 * No auth required — used for marketing / product demos.
 */

import type {
  Analysis,
  AIInsights,
  AccessibilityIssue,
  ConsoleError,
  LighthouseScores,
  NetworkSummary,
  ResourceAudit,
} from '@/types/analysis';
import type { PerformanceAuditResult, PerformanceOpportunity, DetectedResource } from '@/types/performance';

/* ------------------------------------------------------------------ */
/*  Scores                                                              */
/* ------------------------------------------------------------------ */
const performanceAudit: PerformanceAuditResult = {
  score: 68,
  scoreVersion: 'performance-v2',
  measurementMode: 'fetch-only',
  measuredAt: '2026-06-25T08:00:00.000Z',
  testedUrl: 'https://greenleaf-garden.example.com',
  finalUrl: 'https://greenleaf-garden.example.com/',
  metrics: {
    ttfb: {
      name: 'Time to First Byte',
      value: 780,
      unit: 'ms',
      status: 'good',
      threshold: { good: 800, poor: 1800, unit: 'ms' },
      source: 'fetch-timing',
      confidence: 'high',
      isMeasured: true,
      description: 'Median of 3 HTTP fetches from Cloudflare edge: 765ms, 780ms, 798ms. Measures origin server response speed.',
    },
    lcp: {
      name: 'Largest Contentful Paint',
      value: 3800,
      unit: 'ms',
      status: 'needs-improvement',
      threshold: { good: 2500, poor: 4000, unit: 'ms' },
      source: 'estimated',
      confidence: 'low',
      isMeasured: false,
      description: 'Estimated from TTFB + HTML size (formula: TTFB + ⌈HTML_bytes / 5000⌉ × 100ms). Run Chrome Lighthouse for the real value.',
    },
    cls: {
      name: 'Cumulative Layout Shift',
      value: null,
      unit: 'score',
      status: 'unavailable',
      threshold: { good: 0.1, poor: 0.25, unit: 'score' },
      source: 'not-measured',
      confidence: 'none',
      isMeasured: false,
      description: 'CLS requires browser rendering to observe layout shifts. Not available in fetch-only mode.',
    },
    tbt: {
      name: 'Total Blocking Time',
      value: null,
      unit: 'ms',
      status: 'unavailable',
      threshold: { good: 200, poor: 600, unit: 'ms' },
      source: 'not-measured',
      confidence: 'none',
      isMeasured: false,
      description: 'TBT measures main-thread blocking during page load. Requires browser script execution — not available in fetch-only mode.',
    },
    fcp: {
      name: 'First Contentful Paint',
      value: null,
      unit: 'ms',
      status: 'unavailable',
      threshold: { good: 1800, poor: 3000, unit: 'ms' },
      source: 'not-measured',
      confidence: 'none',
      isMeasured: false,
      description: 'FCP requires browser rendering. Not available in fetch-only mode.',
    },
    inp: {
      name: 'Interaction to Next Paint',
      value: null,
      unit: 'ms',
      status: 'unavailable',
      threshold: { good: 200, poor: 500, unit: 'ms' },
      source: 'not-measured',
      confidence: 'none',
      isMeasured: false,
      description: 'INP is a field metric requiring real user interactions in a browser session. Not measurable in lab or fetch-only mode.',
    },
  },
  scoreBreakdown: [
    {
      category: 'Time to First Byte (real measurement)',
      weight: 0.30,
      normalizedScore: 95,
      weightedContribution: 28.5,
      reason: '780ms — good (target ≤800ms)',
    },
    {
      category: 'Estimated LCP (heuristic)',
      weight: 0.20,
      normalizedScore: 65,
      weightedContribution: 13,
      reason: '~3.8s estimated (TTFB + HTML size formula, low confidence) — target ≤2.5s',
    },
    {
      category: 'HTML document size',
      weight: 0.15,
      normalizedScore: 75,
      weightedContribution: 11.3,
      reason: '238KB HTML — reduce inline scripts/styles, avoid large embedded SVGs',
    },
    {
      category: 'Render-blocking resources',
      weight: 0.20,
      normalizedScore: 50,
      weightedContribution: 10,
      reason: '3 render-blocking resource(s); add async/defer to <script>, use media="print" for non-critical CSS',
    },
    {
      category: 'Image optimization',
      weight: 0.10,
      normalizedScore: 25,
      weightedContribution: 2.5,
      reason: '8/12 image(s) have issues (missing width/height → CLS, no loading="lazy", legacy format)',
    },
    {
      category: 'Third-party resource domains',
      weight: 0.05,
      normalizedScore: 80,
      weightedContribution: 4,
      reason: '5 third-party domains; each adds a DNS lookup round-trip; audit and defer non-essential scripts',
    },
  ],
  resources: {
    requestCount: 1,
    transferredBytes: 243_712,
    jsBytes: null,
    cssBytes: null,
    imageBytes: null,
    fontBytes: null,
    thirdPartyBytes: null,
  },
  warnings: [
    'LCP is estimated, not measured. For accurate Core Web Vitals run Lighthouse in Chrome DevTools or use WebPageTest.',
    'CLS, TBT, FCP and INP require browser execution and are not available in fetch-only mode.',
  ],
};

const lighthouse: LighthouseScores = {
  performance: 68,
  accessibility: 54,
  bestPractices: 74,
  seo: 82,
  lcp: 3800,
  estimatedLcp: 3800,
  measurementMode: 'fetch-only',
  scoreVersion: 'performance-v2',
  ttfbSamples: [765, 780, 798],
  performanceVariance: 33,
  performanceAudit,
  ttfb: 780,
  llmReadiness: 58,
  llmChecks: {
    hasStructuredData: false,
    hasMetaDescription: true,
    hasSitemap: false,
    hasRobotsFile: true,
    hasOpenGraph: false,
    hasReadableText: true,
    hasCleanHeadings: false,
    hasAltText: false,
  },
  llmSignals: [
    'Missing structured data (JSON-LD) — AI crawlers cannot parse key business info',
    'No Open Graph tags — link previews look broken in social/AI chat apps',
    'Heading hierarchy is broken (multiple H1s) — context signals are lost',
    'Images missing alt text — visual content invisible to LLM indexers',
  ],
  securityHeaders: [
    {
      header: 'Content-Security-Policy',
      present: false,
      value: null,
      severity: 'critical',
      description: 'No Content Security Policy header found.',
      recommendation: 'Add a strict CSP header to prevent XSS attacks.',
    },
    {
      header: 'X-Frame-Options',
      present: true,
      value: 'SAMEORIGIN',
      severity: 'low',
      description: 'Clickjacking protection is in place.',
      recommendation: 'Already correctly set.',
    },
    {
      header: 'Strict-Transport-Security',
      present: false,
      value: null,
      severity: 'high',
      description: 'HSTS header is missing — HTTPS downgrade attacks possible.',
      recommendation: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains',
    },
    {
      header: 'X-Content-Type-Options',
      present: true,
      value: 'nosniff',
      severity: 'low',
      description: 'MIME sniffing protection present.',
      recommendation: 'Already correctly set.',
    },
    {
      header: 'Referrer-Policy',
      present: false,
      value: null,
      severity: 'medium',
      description: 'No Referrer-Policy header — full URLs may leak to third parties.',
      recommendation: 'Add Referrer-Policy: strict-origin-when-cross-origin',
    },
    {
      header: 'Permissions-Policy',
      present: false,
      value: null,
      severity: 'medium',
      description: 'No Permissions-Policy — browser APIs are unrestricted.',
      recommendation: 'Add Permissions-Policy: geolocation=(), microphone=(), camera=()',
    },
  ],
  opportunities: [
    {
      id: 'render-blocking-scripts',
      title: 'Remove render-blocking scripts',
      severity: 'critical',
      confidence: 'high',
      source: 'HTML head analysis',
      description: '1 synchronous <script> in <head> blocks rendering until the script downloads and executes.',
      evidence: ['jquery.min.js loaded synchronously in <head>'],
      affectedResources: ['https://greenleaf-garden.example.com/wp-includes/js/jquery/jquery.min.js'],
      estimatedSavingsMs: 400,
      recommendation: 'Add defer attribute to non-critical scripts: <script defer src="jquery.min.js">. For scripts that must run early, use async if order-independence is safe.',
    },
    {
      id: 'render-blocking-stylesheets',
      title: 'Eliminate render-blocking stylesheets',
      severity: 'high',
      confidence: 'high',
      source: 'HTML head analysis',
      description: '2 stylesheets in <head> block first paint. Google Fonts is particularly expensive — it requires a cross-origin DNS lookup before the font CSS can be fetched.',
      evidence: ['bloom/style.css (1st-party, synchronous)', 'fonts.googleapis.com (3rd-party, synchronous)'],
      affectedResources: [
        'https://greenleaf-garden.example.com/wp-content/themes/bloom/style.css',
        'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap',
      ],
      estimatedSavingsMs: 300,
      recommendation: 'For Google Fonts: add rel="preconnect" to fonts.googleapis.com and fonts.gstatic.com, and load the font CSS asynchronously. For theme CSS: split critical (above-fold) styles inline and defer the rest.',
    },
    {
      id: 'images-missing-dimensions',
      title: 'Images missing explicit width/height',
      severity: 'high',
      confidence: 'high',
      source: 'HTML img tag analysis',
      description: 'Images without explicit width and height attributes cause Cumulative Layout Shift (CLS) — content jumps as images load and push other elements down.',
      evidence: ['hero-banner.jpg: no width or height', '2 additional images missing both dimensions'],
      affectedResources: ['https://greenleaf-garden.example.com/hero-banner.jpg'],
      recommendation: 'Add width and height to every <img>: <img src="hero-banner.jpg" width="1440" height="600" alt="...">. Use aspect-ratio in CSS to maintain responsive scaling.',
    },
    {
      id: 'images-missing-lazy-loading',
      title: 'Below-fold images missing lazy loading',
      severity: 'medium',
      confidence: 'high',
      source: 'HTML img tag analysis',
      description: '4 images detected without loading="lazy". Below-fold images load eagerly by default, competing with critical resources for bandwidth.',
      evidence: ['rose-bush.jpg: no loading attribute', 'owner-photo.jpg: no loading attribute'],
      affectedResources: ['https://greenleaf-garden.example.com/products/rose-bush.jpg'],
      recommendation: 'Add loading="lazy" to images that are not visible in the initial viewport: <img loading="lazy" src="rose-bush.jpg" alt="...">. The hero image should remain eager.',
    },
    {
      id: 'images-legacy-format',
      title: 'Images served in legacy format (JPEG/PNG)',
      severity: 'medium',
      confidence: 'medium',
      source: 'HTML img tag analysis',
      description: '3 images are detected as likely JPEG or PNG based on URL extension. WebP provides 25–35% smaller file sizes at equivalent quality.',
      evidence: ['hero-banner.jpg (.jpg extension)', 'garden-1.jpg (.jpg extension)'],
      affectedResources: ['https://greenleaf-garden.example.com/hero-banner.jpg'],
      recommendation: 'Serve WebP with a JPEG/PNG fallback using <picture>. In WordPress, install a WebP conversion plugin (e.g. ShortPixel) or configure your CDN to auto-convert.',
    },
    {
      id: 'excessive-third-party-scripts',
      title: 'Multiple third-party script domains',
      severity: 'medium',
      confidence: 'high',
      source: 'HTML script src analysis',
      description: '4 third-party domains detected serving scripts. Each domain requires a separate DNS lookup, TCP handshake, and TLS negotiation before the first byte arrives.',
      evidence: ['www.googletagmanager.com (4 scripts)', 'cdn.jsdelivr.net (1 script)', 'www.facebook.com (1 script)'],
      affectedResources: ['https://www.googletagmanager.com/gtag/js', 'https://www.facebook.com/en_US/fbevents.js'],
      recommendation: 'Add <link rel="preconnect"> for all third-party domains used in <head>. Consider loading non-essential analytics scripts with async and moving them to end of <body>.',
    },
    {
      id: 'missing-font-display',
      title: 'Web font may cause invisible text flash (FOIT)',
      severity: 'low',
      confidence: 'medium',
      source: 'Google Fonts URL analysis',
      description: 'Google Fonts CSS is loaded without font-display:swap, which can cause a flash of invisible text while the font downloads.',
      evidence: ['fonts.googleapis.com/css2?family=Lato — no display=swap parameter in URL'],
      affectedResources: ['https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap'],
      recommendation: "Add &display=swap to the Google Fonts URL: ?family=Lato:wght@300;400;700&display=swap. This forces browsers to show fallback text immediately and swap to Lato when it loads.",
    },
  ] as PerformanceOpportunity[],
  scoreBreakdown: {
    performance: [
      { label: 'First Contentful Paint < 1.8s', passed: false, details: 'FCP: 3.1s' },
      { label: 'Largest Contentful Paint < 2.5s', passed: false, details: 'LCP: 3.8s' },
      { label: 'Cumulative Layout Shift < 0.1', passed: false, details: 'CLS: 0.22' },
      { label: 'Time to First Byte < 600ms', passed: false, details: 'TTFB: 780ms' },
      { label: 'Total Blocking Time < 200ms', passed: true, details: 'TBT: 120ms' },
      { label: 'Speed Index < 3.4s', passed: false, details: 'SI: 4.2s' },
    ],
    bestPractices: [
      { label: 'Uses HTTPS', passed: true },
      { label: 'No mixed content', passed: true },
      { label: 'No browser errors in console', passed: false, details: '3 errors found' },
      { label: 'Deprecated APIs not used', passed: true },
      { label: 'Valid source maps', passed: false, details: 'Source maps missing' },
    ],
    seo: [
      { label: 'Has meta description', passed: true },
      { label: 'Has canonical URL', passed: true },
      { label: 'Images have alt text', passed: false, details: '11 images missing alt' },
      { label: 'Valid robots.txt', passed: true },
      { label: 'Structured data present', passed: false },
      { label: 'Mobile-friendly viewport', passed: true },
    ],
    accessibility: [
      { label: 'Sufficient color contrast (AA)', passed: false, details: '6 failures' },
      { label: 'All images have alt text', passed: false, details: '11 images' },
      { label: 'Form inputs have labels', passed: false, details: '3 unlabelled inputs' },
      { label: 'Keyboard navigation works', passed: true },
      { label: 'Logical heading hierarchy', passed: false, details: 'Multiple H1s detected' },
      { label: 'Skip navigation link', passed: false },
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Network                                                             */
/* ------------------------------------------------------------------ */
const resourceAudit: ResourceAudit = {
  renderBlocking: [
    { url: 'https://greenleaf-garden.example.com/wp-content/themes/bloom/style.css', type: 'stylesheet' },
    { url: 'https://greenleaf-garden.example.com/wp-includes/js/jquery/jquery.min.js', type: 'script' },
    { url: 'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap', type: 'stylesheet' },
  ],
  imageIssues: [
    { src: '/hero-banner.jpg', issues: ['No alt text', 'Not served as WebP', 'No lazy loading'] },
    { src: '/products/rose-bush.jpg', issues: ['No alt text', 'Oversized — 1.8MB, 4000px wide'] },
    { src: '/team/owner-photo.jpg', issues: ['No alt text'] },
    { src: '/gallery/garden-1.jpg', issues: ['No alt text', 'Not served as WebP'] },
  ],
  thirdParty: [
    { domain: 'www.googletagmanager.com', count: 4, types: ['script'] },
    { domain: 'fonts.googleapis.com', count: 2, types: ['stylesheet', 'font'] },
    { domain: 'cdn.jsdelivr.net', count: 1, types: ['script'] },
    { domain: 'www.facebook.com', count: 1, types: ['script'] },
  ],
  mixedContent: [],
  totalScripts: 18,
  asyncScripts: 5,
  deferScripts: 2,
  totalStylesheets: 7,
  totalImages: 23,
  lazyImages: 4,
  inlineScriptCount: 6,
  detectedResources: [
    { url: 'https://greenleaf-garden.example.com/wp-content/themes/bloom/style.css', type: 'stylesheet', isRenderBlocking: true, isThirdParty: false, initiator: 'head', transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://greenleaf-garden.example.com/wp-includes/js/jquery/jquery.min.js', type: 'script', isRenderBlocking: true, isThirdParty: false, initiator: 'head', transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap', type: 'stylesheet', isRenderBlocking: true, isThirdParty: true, initiator: 'head', transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://greenleaf-garden.example.com/wp-content/plugins/woocommerce/assets/js/frontend/add-to-cart.js', type: 'script', isRenderBlocking: false, isThirdParty: false, initiator: 'body', transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://www.googletagmanager.com/gtag/js', type: 'script', isRenderBlocking: false, isThirdParty: true, initiator: 'head', transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://greenleaf-garden.example.com/hero-banner.jpg', type: 'image', isRenderBlocking: false, isThirdParty: false, initiator: 'body', hasWidth: false, hasHeight: false, hasLazy: false, hasModernFormat: false, hasSrcset: false, transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://greenleaf-garden.example.com/products/rose-bush.jpg', type: 'image', isRenderBlocking: false, isThirdParty: false, initiator: 'body', hasWidth: true, hasHeight: true, hasLazy: false, hasModernFormat: false, hasSrcset: false, transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://greenleaf-garden.example.com/wp-content/themes/bloom/fonts/lato-v24-latin-regular.woff2', type: 'font', isRenderBlocking: false, isThirdParty: false, initiator: 'head', transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://cdn.jsdelivr.net/npm/swiper@10/swiper-bundle.min.js', type: 'script', isRenderBlocking: false, isThirdParty: true, initiator: 'body', transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://www.facebook.com/en_US/fbevents.js', type: 'script', isRenderBlocking: false, isThirdParty: true, initiator: 'head', transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://greenleaf-garden.example.com/gallery/garden-1.jpg', type: 'image', isRenderBlocking: false, isThirdParty: false, initiator: 'body', hasWidth: false, hasHeight: false, hasLazy: true, hasModernFormat: false, hasSrcset: false, transferredBytes: null, decodedBytes: null, durationMs: null },
    { url: 'https://greenleaf-garden.example.com/gallery/garden-2.jpg', type: 'image', isRenderBlocking: false, isThirdParty: false, initiator: 'body', hasWidth: false, hasHeight: false, hasLazy: true, hasModernFormat: true, hasSrcset: true, transferredBytes: null, decodedBytes: null, durationMs: null },
  ] as DetectedResource[],
};

const network: NetworkSummary = {
  totalRequests: 52,
  totalBytes: 3_420_000,
  failedRequests: 2,
  slowRequests: 4,
  resourceAudit,
};

/* ------------------------------------------------------------------ */
/*  Accessibility issues                                                */
/* ------------------------------------------------------------------ */
const accessibilityIssues: AccessibilityIssue[] = [
  {
    id: 'color-contrast',
    impact: 'serious',
    description: 'Elements must have sufficient color contrast',
    nodes: [
      '.cta-button',
      'nav a.active',
      '.price-tag span',
      '.footer-link',
      '.card-subtitle',
      '.breadcrumb a',
    ],
    wcagCriteria: ['wcag2aa', 'wcag143'],
  },
  {
    id: 'image-alt',
    impact: 'critical',
    description: 'Images must have alternative text',
    nodes: ['img.hero-banner', 'img.product-thumb', 'img.team-photo', '.gallery img'],
    wcagCriteria: ['wcag2a', 'wcag111'],
  },
  {
    id: 'label',
    impact: 'critical',
    description: 'Form elements must have labels',
    nodes: ['input[type="email"]', 'input[name="phone"]', 'input[type="search"]'],
    wcagCriteria: ['wcag2a', 'wcag412'],
  },
  {
    id: 'heading-order',
    impact: 'moderate',
    description: 'Heading levels should only increase by one',
    nodes: ['h3.section-subtitle (follows h1)', 'h4.card-title (follows h2, skips h3)'],
    wcagCriteria: ['wcag2a', 'wcag131'],
  },
  {
    id: 'duplicate-id',
    impact: 'serious',
    description: 'IDs used in ARIA must be unique',
    nodes: ['#main-nav (appears 2×)', '#contact-form (appears 2×)'],
    wcagCriteria: ['wcag2a', 'wcag411'],
  },
  {
    id: 'link-name',
    impact: 'serious',
    description: 'Links must have discernible text',
    nodes: ['a > img (no alt)', 'a.icon-link (no text, no aria-label)'],
    wcagCriteria: ['wcag2a', 'wcag244'],
  },
  {
    id: 'bypass',
    impact: 'moderate',
    description: 'Page should contain a skip-to-content link',
    nodes: ['body'],
    wcagCriteria: ['wcag2a', 'wcag241'],
  },
  {
    id: 'landmark-one-main',
    impact: 'moderate',
    description: 'Document should have one main landmark',
    nodes: ['<main> found 0×'],
    wcagCriteria: ['best-practice'],
  },
];

/* ------------------------------------------------------------------ */
/*  Console errors                                                      */
/* ------------------------------------------------------------------ */
const consoleErrors: ConsoleError[] = [
  {
    message: "Uncaught TypeError: Cannot read properties of undefined (reading 'addEventListener')",
    type: 'error',
    source: 'https://greenleaf-garden.example.com/wp-content/plugins/contact-form-7/includes/js/index.js',
    line: 312,
    timestamp: Date.now() - 2000,
  },
  {
    message: "Failed to load resource: the server responded with a status of 404 (/favicon-32x32.png)",
    type: 'error',
    source: '/favicon-32x32.png',
    line: undefined,
    timestamp: Date.now() - 1800,
  },
  {
    message: "jQuery.Deferred exception: $ is not defined ReferenceError: $ is not defined",
    type: 'error',
    source: 'https://greenleaf-garden.example.com/wp-content/themes/bloom/js/main.js',
    line: 18,
    timestamp: Date.now() - 1600,
  },
  {
    message: "Third-party cookie will be blocked. Learn more: https://developers.google.com/privacy-sandbox",
    type: 'warning',
    source: 'https://www.facebook.com/tr/',
    line: undefined,
    timestamp: Date.now() - 1400,
  },
  {
    message: "[Deprecation] Synchronous XMLHttpRequest on the main thread is deprecated",
    type: 'warning',
    source: 'https://greenleaf-garden.example.com/wp-includes/js/wp-embed.min.js',
    line: 1,
    timestamp: Date.now() - 1200,
  },
];

/* ------------------------------------------------------------------ */
/*  AI Insights                                                         */
/* ------------------------------------------------------------------ */
const aiInsights: AIInsights = {
  summary:
    "Greenleaf Garden Centre's website has a solid foundation but is losing potential customers due to slow load times and accessibility barriers. The homepage takes nearly 4 seconds to fully load — many mobile users will leave before seeing your products. Three JavaScript errors are silently preventing your contact form from working, which may be costing you enquiries every day. The good news: the top issues are fixable in a few hours and will make a meaningful difference to both visitor experience and search rankings.",
  overallScore: 70,
  quickWins: [
    'Convert hero banner to WebP format — saves ~1.4MB, speeds up LCP by ~0.8s',
    'Add alt text to 11 images — fixes critical accessibility + improves SEO in under 30 minutes',
    'Add labels to 3 form inputs — fixes critical WCAG violation, prevents screen reader failures',
    'Fix jQuery load order (move $ script above plugins) — resolves all 3 console JS errors',
    'Add <meta name="description"> tags to inner pages — 7 pages are currently missing them',
  ],
  insights: [
    {
      category: 'performance',
      priority: 'critical',
      title: 'Hero image is 1.8 MB — the single biggest cause of slow load',
      description:
        'The homepage hero banner is a 4000×2000px JPEG weighing 1.8 MB. It is the Largest Contentful Paint element, so this single file is directly responsible for the 3.8s LCP score.',
      recommendation:
        'Resize to max 1440px wide, convert to WebP, and add width/height attributes to eliminate layout shift.',
      effortLevel: 'low',
      impactScore: 9,
      estimatedImpact: 'LCP improves by ~1.2s, CLS drops below 0.1',
      beforeCode: `<!-- Current: unoptimised JPEG, no dimensions -->
<img src="/hero-banner.jpg" class="hero-banner">`,
      afterCode: `<!-- Fixed: WebP, correct size, dimensions set -->
<picture>
  <source srcset="/hero-banner.webp" type="image/webp">
  <img
    src="/hero-banner.jpg"
    alt="Greenleaf Garden Centre — premium plants & accessories"
    width="1440" height="720"
    fetchpriority="high"
  >
</picture>`,
      frameworkNotes: {
        nextjs: `// In Next.js, use the built-in Image component:
import Image from 'next/image';

<Image
  src="/hero-banner.jpg"
  alt="Greenleaf Garden Centre — premium plants & accessories"
  width={1440}
  height={720}
  priority   // same as fetchpriority="high"
/>`,
      },
    },
    {
      category: 'accessibility',
      priority: 'critical',
      title: 'Contact form is completely inaccessible — missing input labels',
      description:
        '3 form inputs (email, phone, search) have no associated <label> elements. Screen readers announce them as "edit text" with no context. The contact form is one of your most important conversion points.',
      recommendation:
        'Add <label for="..."> elements (or aria-label attributes) to every form input.',
      effortLevel: 'low',
      impactScore: 9,
      estimatedImpact: 'Fixes critical WCAG 2.1 Level A violation, makes form usable for ~7% of users',
      wcagReference: 'WCAG 1.3.1, 4.1.2',
      beforeCode: `<!-- Missing label: screen reader says "edit text" -->
<input type="email" name="email" placeholder="Your email">`,
      afterCode: `<!-- Fixed: explicit label associated via for/id -->
<label for="contact-email">Email address</label>
<input
  type="email"
  id="contact-email"
  name="email"
  placeholder="you@example.com"
  autocomplete="email"
>`,
    },
    {
      category: 'accessibility',
      priority: 'critical',
      title: '11 images have no alt text — invisible to screen readers',
      description:
        'All product images, the hero banner, and team photos are missing alt text. Screen readers will say "image" with no context. Search engines also use alt text to understand image content.',
      recommendation:
        'Add meaningful alt text to every <img> tag. For decorative images, use alt="".',
      effortLevel: 'low',
      impactScore: 8,
      estimatedImpact: 'Fixes WCAG Level A violation, SEO image ranking improves',
      wcagReference: 'WCAG 1.1.1',
      beforeCode: `<img src="/products/rose-bush.jpg" class="product-thumb">`,
      afterCode: `<img
  src="/products/rose-bush.jpg"
  alt="Red climbing rose bush — ideal for garden fences and trellises"
  width="400"
  height="400"
  loading="lazy"
>`,
    },
    {
      category: 'performance',
      priority: 'high',
      title: 'Render-blocking scripts delay page display by ~1.1s',
      description:
        'jQuery and 2 other scripts are loaded in <head> without async or defer. The browser stops rendering until all are downloaded and executed — adding over a second to Time to Interactive.',
      recommendation:
        'Move non-critical scripts to the bottom of <body> or add defer attribute. jQuery is often replaceable with vanilla JS for simple interactions.',
      effortLevel: 'medium',
      impactScore: 8,
      estimatedImpact: 'TBT reduced by ~60%, page feels noticeably faster',
      beforeCode: `<head>
  <script src="/wp-includes/js/jquery/jquery.min.js"></script>
  <script src="/wp-content/themes/bloom/js/main.js"></script>
</head>`,
      afterCode: `<head>
  <!-- Scripts now deferred — browser can paint immediately -->
  <script src="/wp-includes/js/jquery/jquery.min.js" defer></script>
  <script src="/wp-content/themes/bloom/js/main.js" defer></script>
</head>`,
    },
    {
      category: 'seo',
      priority: 'high',
      title: 'No structured data — product info hidden from Google & AI assistants',
      description:
        'Without JSON-LD schema markup, Google cannot display rich results (star ratings, prices, availability) and AI assistants like ChatGPT cannot reliably extract your business details.',
      recommendation:
        'Add LocalBusiness and Product schema markup to relevant pages.',
      effortLevel: 'medium',
      impactScore: 7,
      estimatedImpact: 'Enables rich snippets in search, improves CTR by ~15–30%',
      afterCode: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Greenleaf Garden Centre",
  "description": "Premium plants, tools & garden accessories",
  "url": "https://greenleaf-garden.example.com",
  "telephone": "+44 1234 567890",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Garden Lane",
    "addressLocality": "Springfield",
    "postalCode": "SP1 1AA",
    "addressCountry": "GB"
  },
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "09:00", "closes": "17:30" },
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "09:00", "closes": "16:00" }
  ]
}
</script>`,
    },
    {
      category: 'performance',
      priority: 'high',
      title: 'Cumulative Layout Shift (CLS) of 0.22 — page jumps while loading',
      description:
        'The page content shifts visibly as images load and fonts swap in. CLS of 0.22 is in the "needs improvement" zone — Google penalises pages with high CLS in rankings, and visitors find it frustrating.',
      recommendation:
        'Set explicit width and height on all images. Use font-display: optional to prevent font-swap CLS.',
      effortLevel: 'low',
      impactScore: 7,
      estimatedImpact: 'CLS drops below 0.1 (good threshold), Core Web Vitals pass',
      beforeCode: `/* No size hints → browser can't reserve space → layout shifts */
img { width: 100%; }
@font-face {
  font-family: 'Lato';
  font-display: swap; /* "swap" causes a flash */
}`,
      afterCode: `/* Reserve space with aspect-ratio, use optional for fonts */
img { width: 100%; aspect-ratio: attr(width) / attr(height); }
@font-face {
  font-family: 'Lato';
  font-display: optional; /* no layout shift, falls back to system font */
}`,
    },
    {
      category: 'accessibility',
      priority: 'medium',
      title: 'Low colour contrast on 6 elements — fails WCAG AA',
      description:
        'The CTA button, active nav link, price tags, footer links, card subtitles, and breadcrumb links all fail the 4.5:1 contrast ratio requirement for normal text.',
      recommendation:
        'Darken text colours or lighten backgrounds to achieve 4.5:1 ratio. Use a contrast checker tool.',
      effortLevel: 'low',
      impactScore: 6,
      estimatedImpact: 'WCAG AA compliance on contrast, better readability for all users',
      wcagReference: 'WCAG 1.4.3',
      beforeCode: `/* Current: light grey on white — contrast ratio ~2.5:1 */
.card-subtitle { color: #aaaaaa; background: #ffffff; }
.cta-button    { color: #ffffff; background: #6db56d; } /* ratio 3.1:1 */`,
      afterCode: `/* Fixed: meets 4.5:1 minimum */
.card-subtitle { color: #767676; background: #ffffff; } /* ratio 4.54:1 */
.cta-button    { color: #ffffff; background: #2d7a2d; } /* ratio 5.1:1  */`,
    },
    {
      category: 'security',
      priority: 'high',
      title: 'Missing Content Security Policy — XSS attacks possible',
      description:
        'Without a Content-Security-Policy header, an attacker who injects a script (via a plugin vulnerability, comment field, etc.) can run arbitrary code in your visitors\' browsers — stealing data or redirecting users.',
      recommendation:
        'Add a CSP header via your server config or a CDN. Start with report-only mode to identify breakage first.',
      effortLevel: 'medium',
      impactScore: 8,
      estimatedImpact: 'Blocks the most common class of website attacks, builds visitor trust',
      afterCode: `# WordPress: add to .htaccess (Apache) or nginx.conf
# Start with report-only to find breakage before enforcing
Header always set Content-Security-Policy-Report-Only \\
  "default-src 'self'; \\
   script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdn.jsdelivr.net; \\
   style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; \\
   font-src 'self' https://fonts.gstatic.com; \\
   img-src 'self' data: https:; \\
   connect-src 'self'; \\
   report-uri /csp-report"`,
    },
    {
      category: 'seo',
      priority: 'medium',
      title: 'Missing Open Graph tags — poor social media previews',
      description:
        'Sharing a page link on Facebook, Twitter, or in WhatsApp shows a blank preview with no image or description. Open Graph tags control exactly what these previews look like.',
      recommendation:
        'Add og:title, og:description, og:image, and og:url meta tags to every page.',
      effortLevel: 'low',
      impactScore: 5,
      estimatedImpact: 'Better-looking social shares, potentially ~20% higher click-through from shared links',
      afterCode: `<head>
  <meta property="og:title"       content="Greenleaf Garden Centre — Plants & Accessories">
  <meta property="og:description" content="Premium plants, garden tools and accessories. Open Mon–Sat in Springfield.">
  <meta property="og:image"       content="https://greenleaf-garden.example.com/og-image.jpg">
  <meta property="og:url"         content="https://greenleaf-garden.example.com">
  <meta property="og:type"        content="website">
  <!-- Twitter Card -->
  <meta name="twitter:card"       content="summary_large_image">
</head>`,
    },
    {
      category: 'performance',
      priority: 'medium',
      title: 'Google Fonts loaded from remote CDN adds 300ms per page',
      description:
        'Loading Lato from fonts.googleapis.com requires a DNS lookup + TLS handshake + download on every page load. Serving fonts locally eliminates this overhead.',
      recommendation:
        'Download the Lato font files and serve them from your own domain.',
      effortLevel: 'low',
      impactScore: 5,
      estimatedImpact: 'Saves 200–400ms on first load, eliminates third-party dependency',
    },
    {
      category: 'ux',
      priority: 'medium',
      title: 'No skip-to-content link — keyboard users must tab through entire navigation',
      description:
        'Keyboard and screen reader users are forced to tab through all 28 navigation items before reaching the page content on every page load. This is a significant barrier.',
      recommendation:
        'Add a visually hidden "Skip to main content" link as the first focusable element on the page.',
      effortLevel: 'low',
      impactScore: 6,
      estimatedImpact: 'WCAG 2.4.1 compliance, major improvement for keyboard users',
      wcagReference: 'WCAG 2.4.1',
      afterCode: `<!-- Add immediately after <body> -->
<a
  href="#main-content"
  class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
         focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2
         focus:text-black focus:shadow-lg focus:outline-2"
>
  Skip to main content
</a>

<!-- Then wrap your main content -->
<main id="main-content">
  ...
</main>`,
    },
    {
      category: 'seo',
      priority: 'low',
      title: 'No XML sitemap — search engines may miss your pages',
      description:
        'Without a sitemap.xml, search engines rely entirely on following links to discover your pages. A sitemap ensures all your product and category pages are crawled.',
      recommendation:
        'Generate an XML sitemap (most WordPress SEO plugins do this automatically) and submit to Google Search Console.',
      effortLevel: 'low',
      impactScore: 4,
      estimatedImpact: 'Faster indexing of new pages, ensures no pages are accidentally excluded',
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Full sample Analysis object                                         */
/* ------------------------------------------------------------------ */
export const SAMPLE_ANALYSIS: Analysis = {
  id: 'sample-demo-report-001',
  user_id: 'demo',
  url: 'https://greenleaf-garden.example.com',
  status: 'completed',
  screenshot_url: null, // no real screenshot — ScreenshotViewer handles null gracefully
  design_screenshot_url: null,
  design_comparison: null,
  lighthouse_scores: lighthouse,
  console_errors: consoleErrors,
  accessibility_issues: accessibilityIssues,
  network_requests: network,
  ai_insights: aiInsights,
  ai_summary: aiInsights.summary,
  is_public: true,
  error_message: null,
  queue_position: null,
  started_at: null,
  completed_at: new Date(Date.now() - 60_000).toISOString(),
  created_at: new Date(Date.now() - 90_000).toISOString(),
  updated_at: new Date(Date.now() - 60_000).toISOString(),
  crawl_pages: [
    {
      url: 'https://greenleaf-garden.example.com/',
      requestedUrl: 'https://greenleaf-garden.example.com/',
      finalUrl: 'https://greenleaf-garden.example.com/',
      statusCode: 200,
      ttfb: 780,
      bytes: 1_200_000,
      title: 'Greenleaf Garden Centre — Plants & Accessories',
      performance: 68,
      seo: 82,
      accessibility: 54,
      llmReadiness: 58,
      measurementMode: 'full-fetch',
      auditLabel: 'Full fetch audit',
    },
    {
      url: 'https://greenleaf-garden.example.com/products/',
      requestedUrl: 'https://greenleaf-garden.example.com/products/',
      finalUrl: 'https://greenleaf-garden.example.com/products/',
      statusCode: 200,
      ttfb: 620,
      bytes: 980_000,
      title: 'Our Plants & Garden Products | Greenleaf',
      performance: 71,
      seo: 79,
      accessibility: 60,
      llmReadiness: 55,
      measurementMode: 'lightweight-fetch',
      auditLabel: 'Lightweight fetch audit',
    },
    {
      url: 'https://greenleaf-garden.example.com/contact/',
      requestedUrl: 'https://greenleaf-garden.example.com/contact/',
      finalUrl: 'https://greenleaf-garden.example.com/contact/',
      statusCode: 200,
      ttfb: 510,
      bytes: 420_000,
      title: 'Contact Us | Greenleaf Garden Centre',
      performance: 85,
      seo: 76,
      accessibility: 48,
      llmReadiness: 62,
      measurementMode: 'lightweight-fetch',
      auditLabel: 'Lightweight fetch audit',
    },
    {
      url: 'https://greenleaf-garden.example.com/about/',
      requestedUrl: 'https://greenleaf-garden.example.com/about/',
      finalUrl: 'https://greenleaf-garden.example.com/about/',
      statusCode: 200,
      ttfb: 490,
      bytes: 350_000,
      title: 'About Greenleaf | Your Local Garden Centre Since 1997',
      performance: 88,
      seo: 85,
      accessibility: 62,
      llmReadiness: 70,
      measurementMode: 'lightweight-fetch',
      auditLabel: 'Lightweight fetch audit',
    },
  ],
};
