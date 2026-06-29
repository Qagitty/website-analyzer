import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CompetitorComparisonSection,
  type ComparisonAnalysis,
} from '@/components/reports/CompetitorComparisonSection';

const SCORES_A = { performance: 85, accessibility: 90, seo: 88, bestPractices: 92, lcp: 2100, cls: 0.05, ttfb: 300 };
const SCORES_B = { performance: 62, accessibility: 72, seo: 75, bestPractices: 78, lcp: 3500, cls: 0.18, ttfb: 750 };

const PRIMARY: ComparisonAnalysis = {
  id:               'aaa-111',
  url:              'https://mysite.com',
  label:            'mysite.com',
  status:           'completed',
  lighthouse_scores: SCORES_A,
  ai_insights:      null,
  screenshot_url:   null,
  error_message:    null,
};

const COMPETITOR: ComparisonAnalysis = {
  id:               'bbb-222',
  url:              'https://competitor.com',
  label:            'competitor.com',
  status:           'completed',
  lighthouse_scores: SCORES_B,
  ai_insights:      null,
  screenshot_url:   null,
  error_message:    null,
};

describe('CompetitorComparisonSection', () => {
  it('renders section heading', () => {
    render(
      <CompetitorComparisonSection
        analyses={[PRIMARY, COMPETITOR]}
        allDone={true}
        anyFailed={false}
      />,
    );
    expect(screen.getByText('Competitor Comparison')).toBeDefined();
  });

  it('shows column card for each site', () => {
    render(
      <CompetitorComparisonSection
        analyses={[PRIMARY, COMPETITOR]}
        allDone={true}
        anyFailed={false}
      />,
    );
    // label appears in both the card heading and the comparison table header
    expect(screen.getAllByText('mysite.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('competitor.com').length).toBeGreaterThanOrEqual(1);
  });

  it('labels primary site as "Your site"', () => {
    render(
      <CompetitorComparisonSection
        analyses={[PRIMARY, COMPETITOR]}
        allDone={true}
        anyFailed={false}
      />,
    );
    expect(screen.getByText('Your site')).toBeDefined();
  });

  it('shows Score Breakdown table when both complete', () => {
    render(
      <CompetitorComparisonSection
        analyses={[PRIMARY, COMPETITOR]}
        allDone={true}
        anyFailed={false}
      />,
    );
    expect(screen.getByText('Score Breakdown')).toBeDefined();
    // Performance label appears in both summary cards and the Score Breakdown table row
    expect(screen.getAllByText('Performance').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state when nothing is complete yet', () => {
    const pending: ComparisonAnalysis = { ...PRIMARY, status: 'queued', lighthouse_scores: null };
    const pending2: ComparisonAnalysis = { ...COMPETITOR, status: 'running', lighthouse_scores: null };
    render(
      <CompetitorComparisonSection
        analyses={[pending, pending2]}
        allDone={false}
        anyFailed={false}
      />,
    );
    expect(screen.getByText('Analyzing all sites…')).toBeDefined();
  });

  it('shows failed callout for failed analyses', () => {
    const failed: ComparisonAnalysis = {
      ...COMPETITOR,
      status: 'failed',
      lighthouse_scores: null,
      error_message: 'Connection timed out',
    };
    render(
      <CompetitorComparisonSection
        analyses={[PRIMARY, failed]}
        allDone={true}
        anyFailed={true}
      />,
    );
    // "Some analyses failed" appears in both the badge and the callout heading
    expect(screen.getAllByText('Some analyses failed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Connection timed out/)).toBeDefined();
  });

  it('shows "All sites analyzed" badge when done with no failures', () => {
    render(
      <CompetitorComparisonSection
        analyses={[PRIMARY, COMPETITOR]}
        allDone={true}
        anyFailed={false}
      />,
    );
    expect(screen.getByText('All sites analyzed')).toBeDefined();
  });

  it('shows progress badge while polling', () => {
    const running: ComparisonAnalysis = { ...COMPETITOR, status: 'running', lighthouse_scores: null };
    render(
      <CompetitorComparisonSection
        analyses={[PRIMARY, running]}
        allDone={false}
        anyFailed={false}
      />,
    );
    // Should show "1/2 complete"
    expect(screen.getByText('1/2 complete')).toBeDefined();
  });
});
