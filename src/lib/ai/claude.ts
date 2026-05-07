import Anthropic from '@anthropic-ai/sdk';
import { AI_PROMPTS } from './prompts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface AnalysisInput {
  screenshotBase64: string | null;
  lighthouseScores: any;
  consoleErrors: any[];
  accessibilityIssues: any[];
  networkSummary?: any;
}

export async function analyzeWithAI(input: AnalysisInput) {
  const perfData = input.lighthouseScores
    ? { ...input.lighthouseScores, networkSummary: input.networkSummary ?? { totalRequests: 0, totalBytes: 0, failedRequests: 0, slowRequests: 0 } }
    : null;

  const [screenshotAnalysis, performanceAnalysis, accessibilityAnalysis, errorsAnalysis] =
    await Promise.all([
      analyzeScreenshot(input.screenshotBase64),
      analyzePerformance(perfData),
      analyzeAccessibility(input.accessibilityIssues),
      analyzeErrors(input.consoleErrors),
    ]);

  return {
    screenshot: screenshotAnalysis,
    performance: performanceAnalysis,
    accessibility: accessibilityAnalysis,
    errors: errorsAnalysis,
    // Use the performance summary as the human-readable report headline
    summary: performanceAnalysis?.summary ?? screenshotAnalysis?.summary ?? null,
    quickWins: [
      ...(screenshotAnalysis?.quickWins ?? []),
      ...(performanceAnalysis?.recommendations?.slice(0, 2) ?? []),
    ],
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

async function analyzeAccessibility(issues: any[]) {
  if (!issues?.length) return { overallAccessibilityLevel: 'AA', criticalCount: 0, interpretedIssues: [] };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: AI_PROMPTS.accessibilityAnalysis(issues) }],
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
