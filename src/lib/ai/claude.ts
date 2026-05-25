import Anthropic from '@anthropic-ai/sdk';
import { AI_PROMPTS } from './prompts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface AnalysisInput {
  screenshotBase64: string | null;
  lighthouseScores: any;
  consoleErrors: any[];
  accessibilityIssues: any[];
  networkSummary?: any;
  resourceAudit?: any;
}

export async function analyzeWithAI(input: AnalysisInput) {
  const baseNetwork = input.networkSummary ?? { totalRequests: 0, totalBytes: 0, failedRequests: 0, slowRequests: 0 };
  const resourceAudit = input.resourceAudit;
  const enrichedNetwork = {
    ...baseNetwork,
    ...(resourceAudit != null && {
      renderBlockingCount: resourceAudit.renderBlocking?.length ?? 0,
      imageIssuesCount: resourceAudit.imageIssues?.length ?? 0,
      thirdPartyCount: resourceAudit.thirdParty?.length ?? 0,
    }),
  };
  const perfData = input.lighthouseScores
    ? { ...input.lighthouseScores, networkSummary: enrichedNetwork }
    : null;

  const [screenshotAnalysis, performanceAnalysis, accessibilityAnalysis, errorsAnalysis] =
    await Promise.all([
      analyzeScreenshot(input.screenshotBase64),
      analyzePerformance(perfData),
      analyzeAccessibility(input.accessibilityIssues),
      analyzeErrors(input.consoleErrors),
    ]);

  // Normalise screenshot issues → top-level insights (PDF + web AIInsightsSection both read this)
  const rawIssues: any[] = screenshotAnalysis?.issues ?? [];
  const screenshotInsights = rawIssues.map((issue: any) => ({
    category: issue.category ?? 'ux',
    priority: issue.priority ?? issue.severity ?? 'low',
    title: issue.title ?? '',
    description: issue.description ?? '',
    recommendation: issue.recommendation ?? '',
    codeExample: issue.codeExample ?? issue.afterCode ?? null,
    beforeCode: issue.beforeCode ?? null,
    afterCode: issue.afterCode ?? issue.codeExample ?? null,
    effortLevel: issue.effortLevel ?? null,
    impactScore: issue.impactScore ?? null,
    frameworkNotes: issue.frameworkNotes ?? null,
    estimatedImpact: issue.estimatedImpact ?? '',
  }));

  // When screenshot is unavailable fall back to accessibility findings as insights
  const accessibilityInsights = (accessibilityAnalysis?.interpretedIssues ?? []).map((issue: any) => ({
    category: 'accessibility' as const,
    priority: issue.wcagLevel === 'A' ? 'high' : 'medium',
    title: (issue.originalId ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    description: issue.plainEnglish ?? '',
    recommendation: issue.affectedUsers ?? '',
    codeExample: issue.afterCode ?? issue.codeExample ?? null,
    beforeCode: issue.beforeCode ?? null,
    afterCode: issue.afterCode ?? null,
    effortLevel: issue.effortLevel ?? null,
    impactScore: issue.impactScore ?? null,
    wcagReference: issue.wcagReference ?? null,
    frameworkNotes: issue.frameworkNotes ?? null,
    estimatedImpact: issue.estimatedFixTime ? `Fix time: ${issue.estimatedFixTime}` : '',
  }));

  const insights = screenshotInsights.length > 0 ? screenshotInsights : accessibilityInsights;

  const screenshotQuickWins: string[] = [
    ...(screenshotAnalysis?.quickWins ?? []),
    ...(performanceAnalysis?.recommendations?.slice(0, 2) ?? []),
  ];

  // Fall back to accessibility prioritised fixes when there are no visual quick wins
  const quickWins = screenshotQuickWins.length > 0
    ? screenshotQuickWins
    : (accessibilityAnalysis?.prioritizedFixes ?? []).slice(0, 3);

  return {
    screenshot: screenshotAnalysis,
    performance: performanceAnalysis,
    accessibility: accessibilityAnalysis,
    errors: errorsAnalysis,
    insights,
    summary: performanceAnalysis?.summary ?? screenshotAnalysis?.summary ?? null,
    quickWins,
  };
}

export async function compareWithDesign(
  designBase64: string,
  designMimeType: string,
  liveScreenshotBase64: string
) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: designMimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
              data: designBase64,
            },
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: liveScreenshotBase64,
            },
          },
          { type: 'text', text: AI_PROMPTS.designComparison() },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return parseJSON(text);
}

function parseJSON(text: string): any {
  // Strip markdown code fences that models sometimes add despite instructions
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  const tryParse = (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  };

  const result = tryParse(stripped);
  if (result !== null) return result;

  // Extract first {...} block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return {};

  const direct = tryParse(match[0]);
  if (direct !== null) return direct;

  // Escape unescaped control characters (e.g. literal newlines inside string values)
  const sanitized = match[0].replace(/[\x00-\x1F\x7F]/g, (c) => {
    if (c === '\n') return '\\n';
    if (c === '\r') return '\\r';
    if (c === '\t') return '\\t';
    return '';
  });

  return tryParse(sanitized) ?? {};
}

async function analyzeScreenshot(screenshotBase64: string | null) {
  if (!screenshotBase64) return null;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 },
          },
          { type: 'text', text: AI_PROMPTS.screenshotAnalysis() },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return parseJSON(text);
}

async function analyzePerformance(scores: any) {
  if (!scores) return null;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: AI_PROMPTS.performanceAnalysis(scores) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return parseJSON(text);
}

function sanitizeAxeNodes(issues: any[]): any[] {
  return issues.map((issue) => ({
    ...issue,
    // Strip axe-core accessible-name notation: a('name') → a, ('name') → removed
    nodes: (issue.nodes ?? []).map((selector: string) =>
      selector.replace(/\('[^']*'\)/g, '').trim()
    ),
  }));
}

async function analyzeAccessibility(issues: any[]) {
  if (!issues?.length) return { overallAccessibilityLevel: 'AA', criticalCount: 0, interpretedIssues: [] };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: AI_PROMPTS.accessibilityAnalysis(sanitizeAxeNodes(issues)) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return parseJSON(text);
}

async function analyzeErrors(errors: any[]) {
  if (!errors?.length) return { totalErrors: 0, criticalErrors: 0, errorGroups: [], hasBlockingErrors: false };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: AI_PROMPTS.consoleErrorsAnalysis(errors) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  return parseJSON(text);
}
