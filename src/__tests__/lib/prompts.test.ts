import { describe, it, expect } from 'vitest';
import { AI_PROMPTS } from '@/lib/ai/prompts';

const mockLighthouseData = {
  performance: 72,
  accessibility: 88,
  bestPractices: 90,
  seo: 95,
  lcp: 3200,
  fid: 55,
  cls: 0.12,
  ttfb: 420,
  networkSummary: {
    totalRequests: 48,
    totalBytes: 2_400_000,
    failedRequests: 2,
    slowRequests: 1,
  },
};

const mockAccessibilityIssues = [
  {
    id: 'color-contrast',
    impact: 'serious',
    description: 'Elements must have sufficient color contrast',
    nodes: ['button.cta', 'a.nav-link'],
    wcagCriteria: ['wcag2aa', 'wcag143'],
  },
];

const mockConsoleErrors = [
  { message: 'Uncaught TypeError: Cannot read property', type: 'error', source: 'app.js', line: 42, timestamp: Date.now() },
  { message: 'Failed to load resource', type: 'error', source: 'image.png', timestamp: Date.now() },
];

// ── screenshotAnalysis ────────────────────────────────────────────────────────
describe('AI_PROMPTS.screenshotAnalysis()', () => {
  it('returns a non-empty string', () => {
    const prompt = AI_PROMPTS.screenshotAnalysis();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('instructs Claude to return JSON', () => {
    expect(AI_PROMPTS.screenshotAnalysis()).toContain('JSON');
  });

  it('requests overallUXScore in the output schema', () => {
    expect(AI_PROMPTS.screenshotAnalysis()).toContain('overallUXScore');
  });

  it('requests issues array in the output schema', () => {
    expect(AI_PROMPTS.screenshotAnalysis()).toContain('"issues"');
  });

  it('requests quickWins in the output schema', () => {
    expect(AI_PROMPTS.screenshotAnalysis()).toContain('quickWins');
  });

  it('requests codeExample field for each issue (AI fix suggestions feature)', () => {
    expect(AI_PROMPTS.screenshotAnalysis()).toContain('codeExample');
  });
});

// ── performanceAnalysis ───────────────────────────────────────────────────────
describe('AI_PROMPTS.performanceAnalysis()', () => {
  it('returns a non-empty string', () => {
    const prompt = AI_PROMPTS.performanceAnalysis(mockLighthouseData);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('embeds the performance score', () => {
    expect(AI_PROMPTS.performanceAnalysis(mockLighthouseData)).toContain('72');
  });

  it('embeds LCP value', () => {
    expect(AI_PROMPTS.performanceAnalysis(mockLighthouseData)).toContain('3200');
  });

  it('embeds total network requests', () => {
    expect(AI_PROMPTS.performanceAnalysis(mockLighthouseData)).toContain('48');
  });

  it('embeds page weight in KB', () => {
    // 2_400_000 / 1024 ≈ 2344 KB
    expect(AI_PROMPTS.performanceAnalysis(mockLighthouseData)).toContain('2344');
  });

  it('requests criticalIssues in the output schema', () => {
    expect(AI_PROMPTS.performanceAnalysis(mockLighthouseData)).toContain('criticalIssues');
  });

  it('requests estimatedScoreAfterFixes', () => {
    expect(AI_PROMPTS.performanceAnalysis(mockLighthouseData)).toContain('estimatedScoreAfterFixes');
  });

  it('requests codeExample for each critical issue (AI fix suggestions feature)', () => {
    expect(AI_PROMPTS.performanceAnalysis(mockLighthouseData)).toContain('codeExample');
  });
});

// ── accessibilityAnalysis ─────────────────────────────────────────────────────
describe('AI_PROMPTS.accessibilityAnalysis()', () => {
  it('returns a non-empty string', () => {
    const prompt = AI_PROMPTS.accessibilityAnalysis(mockAccessibilityIssues);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('embeds issue id in the prompt', () => {
    expect(AI_PROMPTS.accessibilityAnalysis(mockAccessibilityIssues)).toContain('color-contrast');
  });

  it('requests plainEnglish field in response schema', () => {
    expect(AI_PROMPTS.accessibilityAnalysis(mockAccessibilityIssues)).toContain('plainEnglish');
  });

  it('requests codeExample field in response schema (renamed from fixExample)', () => {
    expect(AI_PROMPTS.accessibilityAnalysis(mockAccessibilityIssues)).toContain('codeExample');
  });

  it('handles empty issues array without throwing', () => {
    const prompt = AI_PROMPTS.accessibilityAnalysis([]);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });
});

// ── consoleErrorsAnalysis ─────────────────────────────────────────────────────
describe('AI_PROMPTS.consoleErrorsAnalysis()', () => {
  it('returns a non-empty string', () => {
    const prompt = AI_PROMPTS.consoleErrorsAnalysis(mockConsoleErrors);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('embeds error messages in the prompt', () => {
    expect(AI_PROMPTS.consoleErrorsAnalysis(mockConsoleErrors)).toContain('Uncaught TypeError');
  });

  it('requests hasBlockingErrors in response schema', () => {
    expect(AI_PROMPTS.consoleErrorsAnalysis(mockConsoleErrors)).toContain('hasBlockingErrors');
  });

  it('requests errorGroups in response schema', () => {
    expect(AI_PROMPTS.consoleErrorsAnalysis(mockConsoleErrors)).toContain('errorGroups');
  });
});

// ── finalSummary ──────────────────────────────────────────────────────────────
describe('AI_PROMPTS.finalSummary()', () => {
  const data = {
    url: 'https://example.com',
    performanceScore: 72,
    accessibilityScore: 88,
    seoScore: 95,
    errorCount: 3,
    accessibilityIssueCount: 1,
  };

  it('returns a non-empty string', () => {
    expect(AI_PROMPTS.finalSummary(data).length).toBeGreaterThan(20);
  });

  it('embeds the URL', () => {
    expect(AI_PROMPTS.finalSummary(data)).toContain('https://example.com');
  });

  it('embeds the performance score', () => {
    expect(AI_PROMPTS.finalSummary(data)).toContain('72');
  });

  it('instructs Claude to write plain text (not JSON)', () => {
    expect(AI_PROMPTS.finalSummary(data)).toMatch(/no JSON|just plain text/i);
  });
});

// ── designComparison (NEW) ────────────────────────────────────────────────────
describe('AI_PROMPTS.designComparison()', () => {
  it('returns a non-empty string', () => {
    const prompt = AI_PROMPTS.designComparison();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('instructs Claude to return JSON', () => {
    expect(AI_PROMPTS.designComparison()).toContain('JSON');
  });

  it('requests fidelityScore (0–100) in the output schema', () => {
    expect(AI_PROMPTS.designComparison()).toContain('fidelityScore');
  });

  it('requests mismatches array in the output schema', () => {
    expect(AI_PROMPTS.designComparison()).toContain('mismatches');
  });

  it('requests matchingAreas in the output schema', () => {
    expect(AI_PROMPTS.designComparison()).toContain('matchingAreas');
  });

  it('requests severity levels for mismatches', () => {
    const prompt = AI_PROMPTS.designComparison();
    expect(prompt).toContain('critical');
    expect(prompt).toContain('major');
    expect(prompt).toContain('minor');
  });

  it('requests designExpected and liveSite fields per mismatch', () => {
    const prompt = AI_PROMPTS.designComparison();
    expect(prompt).toContain('designExpected');
    expect(prompt).toContain('liveSite');
  });

  it('requests a suggestion field for how to fix each mismatch', () => {
    expect(AI_PROMPTS.designComparison()).toContain('suggestion');
  });

  it('requests a summary field', () => {
    expect(AI_PROMPTS.designComparison()).toContain('summary');
  });

  it('mentions CSS in the fix suggestions guidance', () => {
    expect(AI_PROMPTS.designComparison()).toMatch(/css/i);
  });
});
