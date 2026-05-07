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
      "codeExample": "<ready-to-use HTML/CSS/JS snippet that implements the fix, or null if not applicable>",
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
- Slow requests (>3s): ${data.networkSummary.slowRequests}

Return ONLY valid JSON:
{
  "summary": "<2-3 sentence performance overview>",
  "criticalIssues": [
    {
      "metric": "LCP" | "FID" | "CLS" | "TTFB" | "weight" | "requests",
      "currentValue": "<current>",
      "targetValue": "<target>",
      "fix": "<specific technical recommendation>",
      "codeExample": "<ready-to-use code snippet, config change, or CLI command that implements the fix, or null>",
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
You are an accessibility expert. Interpret these WCAG violations for a developer who may not know accessibility rules well.

Issues found:
${JSON.stringify(issues, null, 2)}

Return ONLY valid JSON:
{
  "overallAccessibilityLevel": "A" | "AA" | "AAA" | "non-compliant",
  "criticalCount": <number>,
  "interpretedIssues": [
    {
      "originalId": "<axe rule id>",
      "plainEnglish": "<explanation without jargon>",
      "affectedUsers": "<who this impacts>",
      "codeExample": "<complete before/after HTML/CSS snippet showing the exact fix>",
      "wcagLevel": "A" | "AA" | "AAA",
      "estimatedFixTime": "<e.g., 5 minutes, 1 hour>"
    }
  ],
  "prioritizedFixes": ["<ordered list: fix these first>"]
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
