export const AI_PROMPTS = {
  screenshotAnalysis: () => `
You are an expert UX and web design analyst. Analyze the provided website screenshot and identify issues.

SCORING RULES — READ BEFORE RESPONDING:
- Do NOT produce a numeric score. Performance, accessibility, SEO, and best-practices scores
  are computed deterministically by the analysis engine and are NOT available to you.
- Do NOT choose score weights, adjust severities based on score targets, or add hidden deductions.
- Do NOT claim any score is "good" or "bad" by assigning a number — describe observations only.
- Your role is to identify visible UX/design issues; score computation is outside your scope.

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
      "codeExample": "<complete ready-to-paste snippet combining before + after into a single diff-style block, or null>",
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
    scoreVersion?: string;
    measurementMode?: string;
    ttfb: number;
    estimatedLcp?: number;
    htmlBytes?: number;
    renderBlockingCount?: number;
    imageIssueCount?: number;
    thirdPartyCount?: number;
    opportunities?: Array<{
      id: string;
      title: string;
      severity: string;
      confidence: string;
      evidence: string[];
      estimatedSavingsMs?: number;
      estimatedSavingsBytes?: number;
    }>;
  }) => `
You are a web performance expert. Analyze these website performance measurements and provide actionable, realistic recommendations.

MEASUREMENT MODE: ${data.measurementMode ?? 'fetch-only'} — analysis is performed by fetching the HTML document, NOT by running a real browser.

IMPORTANT RULES:
- Only comment on metrics that were actually measured or structurally detected
- Do not claim CLS, FID, INP, or TBT values — they are not available
- LCP is an estimate (not a measurement) — always label it as such
- Do not promise guaranteed score improvements
- Reference specific affected resources when evidence is available
- Distinguish quick wins (low effort, high impact) from architectural improvements
- Do not recommend removing payment processors, consent tools, or essential analytics without qualification
- Recommend testing changes in a staging environment before deploying

LAB DATA (this session):
- TTFB: ${data.ttfb}ms (real measurement — median of 3 HTTP fetches from Cloudflare edge)
- HTML size: ${data.htmlBytes != null ? `${Math.round(data.htmlBytes / 1024)}KB` : 'unknown'}
- Estimated LCP: ${data.estimatedLcp != null ? `~${(data.estimatedLcp / 1000).toFixed(1)}s (static estimate, not a browser measurement)` : 'unknown'}

FIELD DATA: Unavailable — no CrUX or RUM data integrated. Do not claim these are real-user numbers.

NOT MEASURED (requires real browser — do not fabricate):
- CLS, FID, INP, TBT, FCP — not available

RESOURCE SIGNALS (from HTML parsing):
- Render-blocking resources in <head>: ${data.renderBlockingCount ?? 0}
- Images with optimization issues: ${data.imageIssueCount ?? 0}
- Third-party resource domains: ${data.thirdPartyCount ?? 0}

Score: ${data.performance}/100 (v${data.scoreVersion ?? '2'})

${data.opportunities && data.opportunities.length > 0 ? `
DETECTED OPPORTUNITIES (evidence-based, already computed — use these as the basis for your recommendations, do not duplicate them under different headings):
${data.opportunities.map(o =>
  `- [${o.severity.toUpperCase()}] ${o.title} (confidence: ${o.confidence})
   Evidence: ${o.evidence.slice(0, 2).join(' | ')}${o.estimatedSavingsMs ? ` | Potential saving: ~${o.estimatedSavingsMs}ms` : ''}${o.estimatedSavingsBytes ? ` / ~${Math.round(o.estimatedSavingsBytes / 1024)}KB` : ''}`
).join('\n')}
` : ''}

Return ONLY valid JSON:
{
  "summary": "<2-3 sentences. State TTFB plainly (fast/slow with value), note that LCP is estimated, state field data is unavailable. Do not use jargon.>",
  "criticalIssues": [
    {
      "metric": "TTFB" | "estimated-LCP" | "render-blocking" | "images" | "third-party" | "html-size" | "compression" | "cache",
      "currentValue": "<measured or detected value with unit>",
      "targetValue": "<target>",
      "fix": "<specific technical fix referencing real evidence above — not generic advice>",
      "effortLevel": "low" | "medium" | "high",
      "impactScore": <1-10>,
      "beforeCode": "<problematic pattern>",
      "afterCode": "<fixed pattern>",
      "codeExample": "<complete diff-style snippet>",
      "expectedImprovement": "<realistic impact — say 'may reduce' not 'will reduce'; never promise exact LCP gains>"
    }
  ],
  "quickWins": ["<max 3 quick wins — low effort, high confidence, reference specific evidence>"],
  "architecturalImprovements": ["<max 3 larger changes — server-side, infrastructure, or code-splitting>"],
  "estimatedScoreAfterFixes": <0-100>
}
`,

  accessibilityAnalysis: (issues: Array<{
    id: string;
    impact: string;
    description: string;
    nodes: string[];
    wcagCriteria: string[];
    // v2 fields (may be present)
    status?: string;
    severity?: string;
    what?: string;
    why?: string;
    who?: string;
    wcag?: string;
    howToFix?: string;
    count?: number;
  }>) => `
You are a senior accessibility engineer with deep WCAG 2.1 expertise. Your task is to interpret these accessibility findings for a frontend developer and produce specific, actionable fixes.

IMPORTANT RULES:
- Do NOT invent accessibility violations that are not in the input list.
- Do NOT claim WCAG legal compliance — this is heuristic static analysis, not a legal audit.
- Use the "status" field (confirmed/likely/manual-review) to calibrate your language — say "likely" or "may" for status=likely findings.
- Use the structured fields (what/why/who/howToFix) when present — they are pre-computed from the analysis engine.

Findings (${issues.length} total):
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
      "codeExample": "<single ready-to-paste snippet showing the fix in context>",
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
    bestPracticesScore: number;
    seoScore: number;
    errorCount: number;
    accessibilityIssueCount: number;
    seoAuditSummary?: {
      criticalCount: number;
      highCount: number;
      isIndexable: boolean;
      hasCanonical: boolean;
      hasStructuredData: boolean;
      titleStatus: string;
      descriptionStatus: string;
    } | null;
  }) => `
You are a web quality expert. Write an executive summary for a website analysis report aimed at a non-technical business owner.

Site: ${data.url}
- Performance: ${data.performanceScore}/100
- Accessibility: ${data.accessibilityScore}/100
- Best Practices: ${data.bestPracticesScore}/100
- SEO: ${data.seoScore}/100
- Console errors: ${data.errorCount}
- Accessibility issues: ${data.accessibilityIssueCount}
${data.seoAuditSummary ? `
SEO audit facts (use ONLY these — do not invent SEO findings):
- Indexable: ${data.seoAuditSummary.isIndexable}
- Critical SEO issues: ${data.seoAuditSummary.criticalCount}
- High SEO issues: ${data.seoAuditSummary.highCount}
- Has canonical tag: ${data.seoAuditSummary.hasCanonical}
- Has structured data: ${data.seoAuditSummary.hasStructuredData}
- Title status: ${data.seoAuditSummary.titleStatus}
- Description status: ${data.seoAuditSummary.descriptionStatus}
` : ''}
Return ONLY valid JSON in this exact format:
{
  "summary": "<3-4 sentences in plain English, no jargon. State the overall health, the most critical issue to fix first, and an encouraging note about improvement potential. Write for a non-technical business owner. Only mention SEO findings that are factually supported by the audit data above.>",
  "overallGrade": "A" | "B" | "C" | "D" | "F",
  "topPriority": "<Single most important action the business owner should take first, in one plain sentence>",
  "estimatedFixTime": "<e.g. 'Most critical issues fixable in 2–3 hours'>",
  "highlights": [
    "<something the site does well — 1 sentence>"
  ]
}
`,
  /**
   * Interprets Best Practices audit data and provides actionable, prioritised recommendations.
   *
   * SAFETY CONSTRAINTS — these must be respected in every response:
   * - NEVER output a ready-to-enforce CSP value. Always recommend starting with Report-Only mode.
   * - NEVER recommend HSTS with includeSubDomains; preload without explicit validation steps.
   * - NEVER suggest copy-paste values for Permissions-Policy without noting that capabilities must be reviewed first.
   * - Any security header recommendation that can break the site must include a staged rollout note.
   * - Runtime findings (console errors, unhandled promises, failed resource loads) are UNAVAILABLE in this
   *   audit — do NOT invent or guess about them. If the issue comes from a runtime source, mark it as
   *   "requires browser verification".
   * - Do NOT inflate severity. Only mark something "critical" if it is: HTTP (not HTTPS), active mixed
   *   content blocking scripts/iframes, or a missing HSTS on an HTTPS site.
   */
  bestPracticesAnalysis: (data: {
    url: string;
    score: number | null;
    isHttps: boolean;
    summary: { critical: number; high: number; medium: number; warnings: number; passed: number };
    topFindings: Array<{ title: string; severity: string; status: string; category: string; recommendation: string; safeToApplyDirectly: boolean }>;
    securityHeadersSummary: { present: number; total: number; absentHeaders: string[] };
    auditMode: string;
    coveragePercentage: number;
  }) => `
You are a web security and best-practices expert. Interpret this automated Best Practices audit and produce prioritised, actionable recommendations for a development team.

Audit data:
- URL: ${data.url}
- Score: ${data.score !== null ? `${data.score}/100` : 'unavailable'}
- HTTPS: ${data.isHttps ? 'yes' : 'NO — page is served over HTTP'}
- Critical findings: ${data.summary.critical}
- High findings: ${data.summary.high}
- Warnings: ${data.summary.warnings}
- Passed checks: ${data.summary.passed}
- Security headers present: ${data.securityHeadersSummary.present}/${data.securityHeadersSummary.total}
- Absent headers: ${data.securityHeadersSummary.absentHeaders.join(', ') || 'none'}
- Audit mode: ${data.auditMode} (coverage: ${data.coveragePercentage}%)

Top findings:
${data.topFindings.map((f, i) => `${i + 1}. [${f.severity}] ${f.title} (${f.status}, ${f.category}) — ${f.safeToApplyDirectly ? 'safe to apply directly' : 'staged rollout required'}`).join('\n')}

IMPORTANT SAFETY RULES for your response:
1. Do NOT include an enforcement-ready Content-Security-Policy value. Always say: introduce in Report-Only mode first, collect violation reports, then enforce.
2. Do NOT recommend adding HSTS with includeSubDomains or preload without verification steps. Start with max-age=300.
3. For Permissions-Policy: note that the policy must be tailored to what the site actually uses. Do not provide a generic deny-all value.
4. Mark any security header recommendation as "staged rollout required" if applying it incorrectly could break the site.
5. Do NOT mention console errors, unhandled promise rejections, or runtime failures — these are unavailable in static mode.
6. Only flag something as critical if it genuinely is (HTTP page, active mixed content, missing HSTS on HTTPS).

Return ONLY valid JSON:
{
  "summary": "<3-4 sentences: overall security posture, most critical item, one actionable quick win. Plain English, no jargon, suitable for a technical lead.>",
  "prioritisedActions": [
    {
      "rank": 1,
      "title": "<concise action title>",
      "why": "<1-2 sentences on the security or quality impact>",
      "how": "<specific implementation guidance — for security headers, always include staged rollout note where applicable>",
      "effort": "low" | "medium" | "high",
      "impact": "low" | "medium" | "high",
      "safeToApplyDirectly": true | false,
      "stagedRolloutRequired": true | false
    }
  ],
  "quickWins": ["<action that takes < 30 min and is safe to apply directly>"],
  "requiresBrowserVerification": ["<item that needs a real browser check to confirm>"]
}
`,

  llmReadinessAnalysis: (data: {
    url: string;
    score: number | null;
    scoreVersion: string;
    auditMode: string;
    coverage: number;
    pageType: string;
    failedFindings: Array<{ ruleId: string; title: string; severity: string; category: string; recommendation: string; source: string; experimental: boolean }>;
    warningFindings: Array<{ ruleId: string; title: string; severity: string; category: string; recommendation: string; source: string; experimental: boolean }>;
    detectedSignals: {
      hasJsonLd: boolean;
      schemaTypes: string[];
      hasOrganizationSchema: boolean;
      hasAuthorSignal: boolean;
      hasDateSignal: boolean;
      rawTextLength: number;
      h1Count: number;
      hasMetaDescription: boolean;
      hasCanonical: boolean;
      hasOpenGraph: boolean;
      isHttps: boolean;
      llmsTxtStatus: string;
      robotsTxtFetched: boolean;
    };
    blockedCrawlers: Array<{ crawlerName: string; category: string; matchedRule: string | null }>;
  }) => `You are an expert in web content strategy, technical SEO, and AI/LLM accessibility. Analyze the following LLM Readiness audit results for ${data.url} and provide prioritized, evidence-based recommendations.

AUDIT SUMMARY:
- Score: ${data.score !== null ? `${data.score}/100` : 'unavailable'} (${data.scoreVersion})
- Audit mode: ${data.auditMode} — rendered-DOM checks were NOT performed
- Coverage: ${data.coverage}%
- Page type: ${data.pageType}

DETECTED SIGNALS:
- HTTPS: ${data.detectedSignals.isHttps ? 'Yes' : 'No'}
- Raw text length: ${data.detectedSignals.rawTextLength} characters
- H1 headings: ${data.detectedSignals.h1Count}
- Structured data: ${data.detectedSignals.hasJsonLd ? `Yes (${data.detectedSignals.schemaTypes.join(', ') || 'no @type'})` : 'None'}
- Organization schema: ${data.detectedSignals.hasOrganizationSchema ? 'Yes' : 'No'}
- Author signal: ${data.detectedSignals.hasAuthorSignal ? 'Detected' : 'None'}
- Date signal: ${data.detectedSignals.hasDateSignal ? 'Detected' : 'None'}
- Meta description: ${data.detectedSignals.hasMetaDescription ? 'Present' : 'Missing'}
- Canonical URL: ${data.detectedSignals.hasCanonical ? 'Present' : 'Missing'}
- Open Graph: ${data.detectedSignals.hasOpenGraph ? 'Present' : 'Missing'}
- llms.txt: ${data.detectedSignals.llmsTxtStatus}
- robots.txt fetched: ${data.detectedSignals.robotsTxtFetched ? 'Yes' : 'No'}

FAILED SIGNALS (${data.failedFindings.length}):
${data.failedFindings.map(f => `- [${f.severity.toUpperCase()}] ${f.title} (${f.category}${f.experimental ? ', experimental' : ''})`).join('\n') || 'None'}

WARNING SIGNALS (${data.warningFindings.length}):
${data.warningFindings.map(f => `- ${f.title} (${f.category}${f.experimental ? ', experimental' : ''})`).join('\n') || 'None'}

BLOCKED AI CRAWLERS (${data.blockedCrawlers.length}):
${data.blockedCrawlers.map(c => `- ${c.crawlerName} (${c.category}): ${c.matchedRule ?? 'unknown rule'}`).join('\n') || 'None'}

STRICT SAFETY RULES — you MUST follow all of these:
1. NEVER claim this page will be indexed, ranked, cited, or used by any AI system.
2. NEVER make provider-specific claims (do not mention ChatGPT, Claude, Perplexity, Gemini, or any other AI product by name).
3. NEVER invent signals, findings, or data that are not in the input above.
4. Treat llms.txt as OPTIONAL and EXPERIMENTAL — never classify its absence as a critical issue.
5. Blocked training crawlers are NOT automatically a problem — a publisher may intentionally block training while allowing search retrieval.
6. NEVER recommend keyword stuffing, mass-produced AI content, hidden text, duplicate FAQ blocks, or schema that does not match visible content.
7. Distinguish deterministic findings (from structured data above) from heuristic observations.
8. Acknowledge fetch-only limitations — do not speculate about JavaScript-rendered content you cannot see.
9. Provide verification steps the user can actually perform.
10. Prioritize crawlability, server-rendered content, entity clarity, structured data, and citation readiness over experimental signals.

Return ONLY valid JSON in this exact format:
{
  "summary": "<2-3 sentences describing the overall LLM readiness posture based only on the data above>",
  "prioritisedActions": [
    {
      "priority": 1,
      "category": "<category from findings>",
      "action": "<specific, actionable fix>",
      "why": "<why this may help machine systems understand or access the content>",
      "verificationSteps": "<how to verify the fix worked>",
      "experimental": false
    }
  ],
  "quickWins": ["<action completable in < 30 min with no risk>"],
  "limitations": ["<what this fetch-only audit could not assess>"]
}
`,

  securityHeadersAnalysis: (data: {
    url: string;
    score: number | null;
    scoreVersion: string;
    isHttps: boolean;
    finalUrl: string;
    redirectCount: number;
    findings: Array<{
      headerName: string;
      title: string;
      status: string;
      severity: string;
      reason: string;
      rolloutRisk: string;
      safeToApplyDirectly: boolean;
      weaknesses?: string[];
    }>;
    scoreBreakdown: Array<{
      headerName: string;
      displayName: string;
      status: string;
      weight: number;
      earnedPoints: number;
      reason: string;
    }>;
    coverage: number;
    warnings: string[];
  }) => `
You are a web security expert reviewing HTTP security header findings for ${data.url}.

AUDIT SUMMARY:
- Score: ${data.score !== null ? `${data.score}/100` : 'unavailable'} (${data.scoreVersion})
- Final URL: ${data.finalUrl}
- Protocol: ${data.isHttps ? 'HTTPS' : 'HTTP'}
- Redirect hops: ${data.redirectCount}
- Coverage: ${data.coverage}%

SCORE BREAKDOWN:
${data.scoreBreakdown.map(b => `- ${b.displayName}: ${b.earnedPoints}/${b.weight} pts (${b.status}) — ${b.reason}`).join('\n')}

FINDINGS (${data.findings.length}):
${data.findings.map(f => `- [${f.severity.toUpperCase()}] ${f.title} (rollout risk: ${f.rolloutRisk}${f.safeToApplyDirectly ? ', safe to apply' : ''})
  Status: ${f.status} | Reason: ${f.reason}${f.weaknesses?.length ? `\n  Weaknesses: ${f.weaknesses.join('; ')}` : ''}`).join('\n') || 'None'}

${data.warnings.length > 0 ? `WARNINGS:\n${data.warnings.map(w => `- ${w}`).join('\n')}` : ''}

STRICT SAFETY CONSTRAINTS — you MUST follow all of these:
1. NEVER invent missing headers — only comment on headers in the findings above.
2. NEVER claim the site is protected from XSS, clickjacking, or any attack solely because a header is present.
3. NEVER claim this audit is a penetration test or a complete security assessment.
4. NEVER recommend a generic production-ready Content-Security-Policy — CSP must be tailored to the site.
5. NEVER recommend HSTS preload without explicitly warning it is extremely difficult to reverse.
6. NEVER recommend includeSubDomains without warning that all subdomains must serve HTTPS.
7. NEVER recommend restrictive Permissions-Policy without acknowledging that runtime capabilities are unknown from a static fetch.
8. NEVER recommend COOP or COEP universally — only if use of SharedArrayBuffer or high-resolution timers is known.
9. NEVER recommend X-Frame-Options: DENY if the site may legitimately embed content in iframes.
10. NEVER recommend removing or adding HPKP — it is dangerous and deprecated.
11. Clearly distinguish low-risk changes (safe to apply) from high-risk changes (require staging).
12. Require staging validation for all high-rollout-risk headers before production deployment.
13. DO NOT alter the deterministic scores or statuses — you may add context but not contradict them.
14. Preserve exact observed header values — do not paraphrase or normalise them.

Return ONLY valid JSON in this exact format:
{
  "summary": "<2-3 sentences describing the overall security header posture — do not claim the site is secure or insecure overall>",
  "prioritisedActions": [
    {
      "priority": 1,
      "headerName": "<exact header name>",
      "action": "<specific, actionable change>",
      "rationale": "<why this header matters in this specific context>",
      "stagingRequired": true,
      "verificationSteps": "<how to verify the change worked without breaking the site>"
    }
  ],
  "quickWins": ["<only include changes that are genuinely safe to apply directly — do not include CSP, HSTS with long max-age, COOP, or COEP here>"],
  "limitations": ["<what this HTTP header audit could not assess — e.g. sub-resource headers, authenticated pages, API endpoints>"]
}
`,
};
