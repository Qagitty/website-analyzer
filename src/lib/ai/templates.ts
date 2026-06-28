/**
 * Deterministic recommendation templates for common, well-understood findings.
 * §17 — prefer templates over Claude for known patterns.
 *
 * For findings covered by a template, the template provides:
 * - stable title and explanation
 * - concrete implementation steps
 * - concrete verification steps
 * - rollout risk and safe-to-apply status
 * - effort estimate
 *
 * Claude may refine explanation, group issues, and tailor context,
 * but must not contradict the template's rollout risk or safety status.
 */

import type { RecommendationTemplate } from './ai-types';

// ─── Template registry ─────────────────────────────────────────────────────────

export const RECOMMENDATION_TEMPLATES: Record<string, RecommendationTemplate> = {
  // ── Accessibility ───────────────────────────────────────────────────────────
  'button-name': {
    ruleId: 'button-name',
    titleTemplate: 'Add accessible names to buttons',
    explanationTemplate:
      'Button elements without accessible names cannot be identified by screen readers or voice control software. Users relying on assistive technology cannot activate these controls.',
    implementationSteps: [
      'Add aria-label to icon-only buttons: <button aria-label="Close dialog"><svg aria-hidden="true">…</svg></button>',
      'Ensure visible button text is not hidden from the accessibility tree with aria-hidden="true"',
      'For image buttons, add meaningful alt text to the child image',
    ],
    verificationSteps: [
      'Open browser DevTools → Accessibility tab and confirm each button has an accessible name',
      'Rerun axe-core and confirm button-name violations are resolved',
      'Navigate to each button with Tab and confirm a screen reader announces its name',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'quick-win',
    categories: ['accessibility'],
  },

  'image-alt': {
    ruleId: 'image-alt',
    titleTemplate: 'Add alternative text to images',
    explanationTemplate:
      'Images without alt attributes are inaccessible to screen reader users. Decorative images should use alt="" to be skipped; informative images require descriptive alt text.',
    implementationSteps: [
      'Add descriptive alt text to informative images: <img src="hero.jpg" alt="Team working together in an open office">',
      'Add empty alt="" to purely decorative images so assistive technology skips them',
      'Do not begin alt text with "image of" or "photo of"',
    ],
    verificationSteps: [
      'Rerun axe-core and confirm image-alt violations are resolved',
      'Inspect each image in the accessibility tree to verify alt text is present and meaningful',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'small',
    categories: ['accessibility'],
  },

  'html-has-lang': {
    ruleId: 'html-has-lang',
    titleTemplate: 'Set the page language on the HTML element',
    explanationTemplate:
      'Without a lang attribute on the <html> element, screen readers may use the wrong language engine to pronounce content, degrading the experience for all assistive-technology users.',
    implementationSteps: [
      'Add the lang attribute: <html lang="en"> (use the appropriate BCP 47 language tag)',
      'In Next.js, set the lang attribute in the root layout: <html lang="en">',
    ],
    verificationSteps: [
      'View page source and confirm <html lang="…"> is present',
      'Rerun axe-core and confirm html-has-lang is resolved',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'quick-win',
    categories: ['accessibility'],
  },

  'label': {
    ruleId: 'label',
    titleTemplate: 'Associate labels with form controls',
    explanationTemplate:
      'Form controls without associated labels cannot be identified by screen readers. Users relying on assistive technology cannot determine what information a field expects.',
    implementationSteps: [
      'Use a <label> element with a for attribute matching the control id: <label for="email">Email address</label><input id="email" type="email">',
      'Alternatively, wrap the control inside the label: <label>Email address <input type="email"></label>',
      'Do not rely solely on placeholder text — it disappears when the user types',
    ],
    verificationSteps: [
      'Click each label and confirm the associated input receives focus',
      'Rerun axe-core and confirm label violations are resolved',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'small',
    categories: ['accessibility'],
  },

  'color-contrast': {
    ruleId: 'color-contrast',
    titleTemplate: 'Increase text color contrast to meet WCAG AA',
    explanationTemplate:
      'Text with insufficient color contrast is difficult to read for users with low vision or in bright environments. WCAG 2.1 AA requires a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text.',
    implementationSteps: [
      'Use a contrast-checking tool (WebAIM Contrast Checker or browser DevTools) to verify and fix foreground/background color pairs',
      'Update CSS color values to meet the minimum ratio — for body text: 4.5:1 against its background',
      'Do not use color alone to convey information',
    ],
    verificationSteps: [
      'Rerun axe-core and confirm color-contrast violations are resolved',
      'Verify with browser DevTools accessibility panel that computed contrast ratios meet WCAG AA thresholds',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'small',
    categories: ['accessibility'],
  },

  'iframe-title': {
    ruleId: 'iframe-title',
    titleTemplate: 'Add title attributes to iframes',
    explanationTemplate:
      'Iframes without title attributes provide no context to screen reader users about their purpose. The frame is announced but cannot be described.',
    implementationSteps: [
      'Add a descriptive title attribute: <iframe title="Payment form powered by Stripe" src="…">',
      'Use specific, unique titles rather than generic ones like "frame" or "iframe"',
    ],
    verificationSteps: [
      'Inspect each iframe in the accessibility tree and confirm the title is present',
      'Rerun axe-core and confirm iframe-title violations are resolved',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'quick-win',
    categories: ['accessibility'],
  },

  // ── SEO ─────────────────────────────────────────────────────────────────────
  'missing-canonical': {
    ruleId: 'missing-canonical',
    titleTemplate: 'Add a canonical URL tag to prevent duplicate content',
    explanationTemplate:
      'Without a canonical tag, search engines may index multiple URL variants of the same page (with/without trailing slash, with/without www, with query parameters). This dilutes search ranking signals.',
    implementationSteps: [
      'Add to the <head> of each page: <link rel="canonical" href="https://example.com/page/">',
      'Use the preferred URL format consistently (with or without trailing slash)',
      'In Next.js App Router, set alternates.canonical in your page metadata exports',
    ],
    verificationSteps: [
      'Fetch the page HTML and confirm the canonical link tag is present in <head>',
      'Validate using Google Search Console → URL Inspection',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'quick-win',
    categories: ['seo'],
  },

  'missing-meta-description': {
    ruleId: 'missing-meta-description',
    titleTemplate: 'Add meta descriptions to improve search snippet quality',
    explanationTemplate:
      'Meta descriptions appear in search result snippets and directly influence click-through rates. Without them, search engines generate their own excerpts, which often misrepresent the page.',
    implementationSteps: [
      'Add to the <head>: <meta name="description" content="Your 120-160 character description here">',
      'Write unique, relevant descriptions for each page — avoid duplicates across the site',
      'In Next.js App Router, export a metadata object with the description property in each page.tsx',
    ],
    verificationSteps: [
      'View page source and confirm <meta name="description"> is present in <head>',
      'Confirm description length is between 120 and 160 characters',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'small',
    categories: ['seo'],
  },

  // ── Best Practices / Security headers ────────────────────────────────────────
  'missing-nosniff': {
    ruleId: 'missing-nosniff',
    titleTemplate: 'Add X-Content-Type-Options: nosniff header',
    explanationTemplate:
      'Without this header, some browsers may MIME-sniff responses and interpret files as a different content type than declared, enabling certain injection attacks.',
    implementationSteps: [
      'Add to all HTTP responses: X-Content-Type-Options: nosniff',
      'In Next.js, add to the headers array in next.config.js',
      'In Nginx: add_header X-Content-Type-Options "nosniff" always;',
    ],
    verificationSteps: [
      'Fetch the page and inspect response headers in DevTools → Network tab',
      'Confirm X-Content-Type-Options: nosniff is present on HTML, CSS, and JS responses',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'quick-win',
    categories: ['best-practices', 'security'],
  },

  'missing-x-frame-options': {
    ruleId: 'missing-x-frame-options',
    titleTemplate: 'Add X-Frame-Options or frame-ancestors CSP directive',
    explanationTemplate:
      'Without framing protection, the page may be embedded in a malicious iframe and used in clickjacking attacks.',
    implementationSteps: [
      'Add X-Frame-Options: SAMEORIGIN if the page does not need to be embedded in third-party iframes',
      'Alternatively, use the more flexible Content-Security-Policy frame-ancestors directive',
      'Only use DENY if the page should never be embedded anywhere, including same-origin iframes',
    ],
    verificationSteps: [
      'Fetch the page and confirm the header is present in the response',
      'Test that the page cannot be loaded in an iframe from a different origin (browser will block with an error)',
    ],
    rolloutRisk: 'medium',
    safeToApplyDirectly: false,
    effort: 'quick-win',
    categories: ['best-practices', 'security'],
  },

  // ── LLM Readiness ─────────────────────────────────────────────────────────
  'missing-structured-data': {
    ruleId: 'missing-structured-data',
    titleTemplate: 'Add JSON-LD structured data to improve machine readability',
    explanationTemplate:
      'Structured data helps search engines and AI systems understand the entities, relationships, and content of the page. Without it, automated systems rely entirely on unstructured text.',
    implementationSteps: [
      'Add a <script type="application/ld+json"> block to the <head> or <body>',
      'Use the most specific schema.org type for the page content (e.g. Article, Product, Organization, FAQPage)',
      'Ensure schema content matches visible page content — do not add schema for content that is not present',
      'Validate using Google Rich Results Test or Schema.org validator',
    ],
    verificationSteps: [
      'View page source and confirm a <script type="application/ld+json"> block is present',
      'Validate with Google Rich Results Test',
      'Confirm schema @type matches the actual page content',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'medium',
    categories: ['seo', 'llm-readiness'],
  },

  // ── Performance ──────────────────────────────────────────────────────────────
  'missing-image-dimensions': {
    ruleId: 'missing-image-dimensions',
    titleTemplate: 'Add width and height attributes to images to prevent layout shifts',
    explanationTemplate:
      'Without explicit width and height attributes, browsers cannot reserve space for images before they load, causing layout shifts (CLS) that degrade user experience and Core Web Vitals scores.',
    implementationSteps: [
      'Add width and height attributes matching the intrinsic image dimensions: <img src="hero.jpg" width="1200" height="800" alt="…">',
      'In Next.js, use the <Image> component which automatically handles dimensions',
      'If dimensions vary, use CSS aspect-ratio as a fallback: img { aspect-ratio: 16/9; }',
    ],
    verificationSteps: [
      'Inspect images in DevTools and confirm width and height attributes are present',
      'Use Lighthouse to measure CLS before and after the change',
    ],
    rolloutRisk: 'low',
    safeToApplyDirectly: true,
    effort: 'small',
    categories: ['performance'],
  },
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getTemplate(ruleId: string): RecommendationTemplate | undefined {
  return RECOMMENDATION_TEMPLATES[ruleId];
}

export function hasTemplate(ruleId: string): boolean {
  return ruleId in RECOMMENDATION_TEMPLATES;
}

export function getAllTemplateRuleIds(): string[] {
  return Object.keys(RECOMMENDATION_TEMPLATES);
}

/**
 * Build a deterministic recommendation from a template and a finding.
 * Returns undefined if no template exists for the ruleId.
 */
export function buildTemplateRecommendation(
  ruleId: string,
  findingId: string,
  priority: 'critical' | 'high' | 'medium' | 'low',
  index: number,
): import('./ai-types').AiRecommendation | undefined {
  const template = getTemplate(ruleId);
  if (!template) return undefined;

  return {
    recommendationId: `${ruleId}-${String(index).padStart(3, '0')}`,
    findingIds: [findingId],
    title: template.titleTemplate,
    priority,
    explanation: template.explanationTemplate,
    impact: 'Addresses a confirmed finding from the deterministic audit engine.',
    implementationSteps: template.implementationSteps,
    verificationSteps: template.verificationSteps,
    codeExample: undefined,
    rolloutRisk: template.rolloutRisk,
    safeToApplyDirectly: template.safeToApplyDirectly,
    assumptions: [],
    limitations: ['Generated from a deterministic template — AI-enhanced explanation unavailable for this finding.'],
    effort: template.effort,
    categories: template.categories,
  };
}
