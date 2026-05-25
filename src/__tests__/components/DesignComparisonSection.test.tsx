import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignComparisonSection } from '@/components/reports/DesignComparisonSection';

const mockComparison = {
  fidelityScore: 85,
  summary: 'The live site closely matches the design with minor spacing differences.',
  matchingAreas: ['Navigation bar', 'Hero section', 'Footer'],
  mismatches: [
    {
      area: 'Hero section',
      severity: 'minor' as const,
      designExpects: 'Blue CTA button with 16px padding',
      liveSiteShows: 'Gray button with 12px padding',
      cssFix: '.hero-cta { background: #3B82F6; padding: 16px 24px; }',
    },
  ],
};

const mockComparisonNoMismatches = {
  fidelityScore: 95,
  summary: 'Excellent match between design and live site.',
  matchingAreas: ['All sections'],
  mismatches: [],
};

describe('DesignComparisonSection', () => {
  it('returns null when designComparison is undefined', () => {
    const { container } = render(
      <DesignComparisonSection
        designComparison={undefined}
        designScreenshotUrl={undefined}
        screenshotUrl={undefined}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when designScreenshotUrl is missing', () => {
    const { container } = render(
      <DesignComparisonSection
        designComparison={mockComparison}
        designScreenshotUrl={undefined}
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders fidelity score', () => {
    render(
      <DesignComparisonSection
        designComparison={mockComparison}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('shows "High fidelity" for score >= 80', () => {
    render(
      <DesignComparisonSection
        designComparison={mockComparison}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText(/High fidelity/i)).toBeInTheDocument();
  });

  it('shows "Moderate fidelity" for score 60-79', () => {
    const moderateComparison = { ...mockComparison, fidelityScore: 70 };
    render(
      <DesignComparisonSection
        designComparison={moderateComparison}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText(/Moderate fidelity/i)).toBeInTheDocument();
  });

  it('shows "Low fidelity" for score < 60', () => {
    const lowComparison = { ...mockComparison, fidelityScore: 45 };
    render(
      <DesignComparisonSection
        designComparison={lowComparison}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText(/Low fidelity/i)).toBeInTheDocument();
  });

  it('renders summary paragraph', () => {
    render(
      <DesignComparisonSection
        designComparison={mockComparison}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText(mockComparison.summary)).toBeInTheDocument();
  });

  it('renders matching areas', () => {
    render(
      <DesignComparisonSection
        designComparison={mockComparison}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText('Navigation bar')).toBeInTheDocument();
    expect(screen.getByText('Hero section')).toBeInTheDocument();
  });

  it('renders mismatch cards with "Design expects" and "Live site shows"', () => {
    render(
      <DesignComparisonSection
        designComparison={mockComparison}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText(/Design expects/i)).toBeInTheDocument();
    expect(screen.getByText(/Live site shows/i)).toBeInTheDocument();
    expect(screen.getByText('Blue CTA button with 16px padding')).toBeInTheDocument();
  });

  it('shows mismatch severity badge', () => {
    render(
      <DesignComparisonSection
        designComparison={mockComparison}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText(/minor/i)).toBeInTheDocument();
  });

  it('shows CSS fix code block', () => {
    render(
      <DesignComparisonSection
        designComparison={mockComparison}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText(/\.hero-cta/)).toBeInTheDocument();
  });

  it('shows "No significant mismatches detected" when mismatches is empty', () => {
    render(
      <DesignComparisonSection
        designComparison={mockComparisonNoMismatches}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText(/No significant mismatches/i)).toBeInTheDocument();
  });

  it('labels thumbnails "Your Design" and "Live Site"', () => {
    render(
      <DesignComparisonSection
        designComparison={mockComparison}
        designScreenshotUrl="https://example.com/design.png"
        screenshotUrl="https://example.com/screenshot.png"
      />
    );
    expect(screen.getByText('Your Design')).toBeInTheDocument();
    expect(screen.getByText('Live Site')).toBeInTheDocument();
  });
});
