export const AI_PROMPTS = {
  screenshotAnalysis: () => `
You are an expert UX and web design analyst. Analyze the provided website screenshot and identify issues.

Focus on:
1. Visual hierarchy and readability (font sizes, contrast ratios, spacing)
2. Layout problems (overlapping elements, broken grids, alignment issues)
3. Call-to-action visibility and placement
4. Mobile-friendliness indicators visible in the screenshot
5. Trust signals (professional appearance, clear branding)
6. Content clarity and information architecture

For beforeCode and afterCode: always write realistic, specific snippets — not pseudo-code. For accessibility issues show the specific broken element pattern and the fixed version. For frameworkNotes only include react/nextjs when the fix differs from plain HTML.

Return ONLY valid JSON in this exact format:
{
  "overallUXScore": <0-100>,
  "issues": [
    {
      "category": "readability" | "layout" | "cta" | "trust" | "content",
      "severity": "critical" | "high" | "medium" | "low",
      "title": "<short issue title>",
      "description": "<what is wrong and where>",
      "recommendation": "<specific actionable fix>",
      "effortLevel": "low" | "medium" | "high",
      "impactScore": <1-10>,
      "beforeCode": "<problematic HTML/CSS snippet (representative example), or null>",
      "afterCode": "<fixed HTML/CSS snippet, or null>",
      "frameworkNotes": {
        "react": "<React JSX version of the fix if it differs from plain HTML, otherwise omit>",
        "nextjs": "<Next.js specific fix if applicable, otherwise omit>"
      },
      "estimatedImpact": "<expected improvement if fixed>"
    }
  ],
  "positives": ["<what the site does well>"],
  "quickWins": ["<easy fix that would have significant impact>"]
}
`,

  performanceAnalysis: (data: {
    performance: number;
    lcp: number;
    fid: number;
    cls: number;
    ttfb: number;
    networkSummary: {
      totalRequests: number;
      totalBytes: number;
      failedRequests: number;
      slowRequests: number;
      renderBlockingCount?: number;
      imageIssuesCount?: number;
      thirdPartyCount?: number;
    };
  }) => `
You are a web performance expert. Analyze these Lighthouse metrics and provide actionable recommendations.

Metrics:
- Performance Score: ${data.performance}/100
- LCP (Largest Contentful Paint): ${data.lcp}ms (good: <2500ms)
- FID (First Input Delay): ${data.fid}ms (good: <100ms)
- CLS (Cumulative Layout Shift): ${data.cls} (good: <0.1)
- TTFB (Time to First Byte): ${data.ttfb}ms (good: <800ms)
- Total network requests: ${data.networkSummary.totalRequests}
- Total page weight: ${Math.round(data.networkSummary.totalBytes / 1024)}KB
- Failed requests: ${data.networkSummary.failedRequests}
- Slow requests (>3s): ${data.networkSummary.slowRequests}${data.networkSummary.renderBlockingCount != null ? `\n- Render-blocking resources: ${data.networkSummary.renderBlockingCount}` : ''}${data.networkSummary.imageIssuesCount != null ? `\n- Images with issues (missing dimensions, no lazy-load, etc.): ${data.networkSummary.imageIssuesCount}` : ''}${data.networkSummary.thirdPartyCount != null ? `\n- Third-party script domains: ${data.networkSummary.thirdPartyCount}` : ''}

Return ONLY valid JSON:
{
  "summary": "<2-3 sentence performance overview>",
  "criticalIssues": [
    {
      "metric": "LCP" | "FID" | "CLS" | "TTFB" | "weight" | "requests",
      "currentValue": "<current>",
      "targetValue": "<target>",
      "fix": "<specific technical recommendation>",
      "effortLevel": "low" | "medium" | "high",
      "impactScore": <1-10>,
      "beforeCode": "<problematic pattern, e.g. render-blocking script or unoptimised image tag>",
      "afterCode": "<fixed version with async/defer/preload/loading=lazy etc.>",
      "expectedImprovement": "<e.g., reduce LCP by ~30%>"
    }
  ],
  "recommendations": ["<prioritized list of improvements>"],
  "estimatedScoreAfterFixes": <0-100>
}
`,

  accessibilityAnalysis: (issues: Array<{
    id: string;
    impact: string;
    description: string;
    nodes: string[];
    wcagCriteria: string[];
  }>) => `
You are a senior accessibility engineer with deep WCAG 2.1 expertise. Your task is to interpret these accessibility violations for a frontend developer and produce specific, actionable fixes.

Issues found (${issues.length} total):
${JSON.stringify(issues, null, 2)}

Rules for beforeCode / afterCode:
- Reconstruct a realistic HTML snippet from the node selector and issue type — do NOT write generic examples.
- For 'image-alt' with node 'img.product-photo': beforeCode='<img class="product-photo" src="product.jpg">' afterCode='<img class="product-photo" src="product.jpg" alt="Blue leather wallet, front view">'
- For 'button-name' with node 'button.close-modal': beforeCode='<button class="close-modal"><svg>...</svg></button>' afterCode='<button class="close-modal" aria-label="Close dialog"><svg aria-hidden="true">...</svg></button>'
- For 'label' with node 'input#email': beforeCode='<input id="email" type="email" placeholder="Email">' afterCode='<label for="email">Email address</label><input id="email" type="email" placeholder="user@example.com">'
- For 'aria-hidden-focus' with node 'button.nav-toggle': beforeCode='<button class="nav-toggle" aria-hidden="true">Menu</button>' afterCode='<button class="nav-toggle">Menu</button>'
- For 'color-contrast': show an actual CSS/HTML example with the specific problematic color, then the fix with a compliant value.
- For 'focus-outline-removed': beforeCode='.btn { outline: none; }' afterCode='.btn:focus-visible { outline: 2px solid #4f46e5; outline-offset: 2px; }'
- For 'tabindex-positive': beforeCode='<button tabindex="3">Submit</button>' afterCode='<button>Submit</button> <!-- remove tabindex or set to 0 -->'

Severity tiers for impactScore:
- critical (image-alt missing, button-name, label, aria-hidden-focus, meta-viewport, video-caption): impactScore 8-10
- serious (html-has-lang, select-label, link-name-empty, aria-label-empty, tabindex-positive, focus-outline-removed, click-events-have-key-events, iframe missing title, table headers): impactScore 6-8
- moderate (skip-link, heading structure, landmark-main, color-contrast, svg-img-alt, th-no-scope): impactScore 4-6
- minor (image-alt-empty, link-new-tab, landmark-nav, label-placeholder, audio, autoplay): impactScore 2-4

Return ONLY valid JSON (no markdown, no comments):
{
  "overallAccessibilityLevel": "A" | "AA" | "AAA" | "non-compliant",
  "criticalCount": <number of critical+serious issues>,
  "interpretedIssues": [
    {
      "originalId": "<issue id from input>",
      "plainEnglish": "<1-2 sentence explanation without WCAG jargon — what is broken and why it matters>",
      "affectedUsers": "<specific user group: e.g., 'Screen reader users and voice control users who cannot see the image'>",
      "beforeCode": "<specific broken HTML/CSS snippet>",
      "afterCode": "<complete corrected snippet with all attributes>",
      "wcagReference": "WCAG 2.1 <A|AA|AAA> — <criterion number> <criterion name>",
      "wcagLevel": "A" | "AA" | "AAA",
      "effortLevel": "low" | "medium" | "high",
      "impactScore": <1-10>,
      "frameworkNotes": {
        "react": "<JSX equivalent of afterCode — use className, htmlFor, etc.>",
        "nextjs": "<Next.js specific note if relevant, e.g. using next/image which requires alt prop>"
      },
      "estimatedFixTime": "<e.g., 2 minutes per instance, 30 minutes for all instances>"
    }
  ],
  "prioritizedFixes": [
    "<Fix 1: most critical — one sentence action>",
    "<Fix 2>",
    "<Fix 3>"
  ]
}
`,

  consoleErrorsAnalysis: (errors: Array<{
    message: string;
    type: string;
    source: string;
    line?: number;
  }>) => `
You are a JavaScript debugging expert. Analyze these browser console errors and explain them.

Console output:
${JSON.stringify(errors, null, 2)}

Return ONLY valid JSON:
{
  "totalErrors": <number>,
  "criticalErrors": <number>,
  "errorGroups": [
    {
      "pattern": "<error pattern/type>",
      "count": <occurrences>,
      "severity": "critical" | "warning" | "info",
      "plainExplanation": "<what this error means in plain English>",
      "likelyRootCause": "<why this is probably happening>",
      "fixSuggestion": "<specific code or config fix>",
      "effortLevel": "low" | "medium" | "high",
      "impactScore": <1-10>,
      "beforeCode": "<problematic JS pattern if identifiable, or null>",
      "afterCode": "<fixed JS pattern, or null>",
      "affectsUsers": true | false
    }
  ],
  "hasBlockingErrors": true | false,
  "summary": "<overall assessment of console health>"
}
`,

  designComparison: () => `
You are an expert UI/UX designer and frontend developer specializing in design-to-code fidelity review.

You are given TWO images:
- Image 1: The original design (e.g. a Figma mockup or design file export)
- Image 2: The live website screenshot

Compare them carefully and identify ALL visual discrepancies.

Return ONLY valid JSON in this exact format:
{
  "fidelityScore": <0-100, where 100 = pixel-perfect match>,
  "summary": "<2-3 sentences describing overall match quality>",
  "mismatches": [
    {
      "area": "<section name, e.g. 'Hero section', 'Navigation bar', 'Footer'>",
      "severity": "critical" | "major" | "minor",
      "designExpected": "<what the design shows here>",
      "liveSite": "<what the live site shows instead>",
      "suggestion": "<specific CSS/HTML change to fix this>"
    }
  ],
  "matchingAreas": ["<list of areas that look correct, e.g. 'Logo placement', 'Color scheme'>"]
}

Severity guidelines:
- critical: Core layout broken, completely wrong section, missing major element
- major: Wrong colors, wrong fonts, significant spacing differences, missing content
- minor: Slight spacing off, subtle color differences, minor alignment issues

Be thorough and specific. Mention exact CSS properties when suggesting fixes.
`,

  finalSummary: (data: {
    url: string;
    performanceScore: number;
    accessibilityScore: number;
    seoScore: number;
    errorCount: number;
    accessibilityIssueCount: number;
  }) => `
You are a web quality expert. Write a concise executive summary for a website analysis report.

Site: ${data.url}
- Performance: ${data.performanceScore}/100
- Accessibility: ${data.accessibilityScore}/100
- SEO: ${data.seoScore}/100
- Console errors: ${data.errorCount}
- Accessibility issues: ${data.accessibilityIssueCount}

Write a 3-4 sentence executive summary for a non-technical business owner. No jargon. No JSON, just plain text.
`,
};
