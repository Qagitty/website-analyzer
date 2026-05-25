import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIInsightsSection } from '@/components/reports/AIInsightsSection';

const mockInsights = {
  summary: 'This site has reasonable performance but several accessibility issues need attention.',
  overallScore: 72,
  insights: [
    {
      category: 'performance' as const,
      priority: 'high' as const,
      title: 'Large JavaScript bundle',
      description: 'The main JS bundle is 2.3 MB, slowing initial load.',
      recommendation: 'Code-split the bundle and lazy-load non-critical routes.',
      estimatedImpact: 'Reduce LCP by ~40%',
      codeExample: 'const Page = dynamic(() => import("./Page"), { ssr: false });',
    },
    {
      category: 'accessibility' as const,
      priority: 'critical' as const,
      title: 'Missing alt text',
      description: 'Hero image has no alt attribute.',
      recommendation: 'Add descriptive alt text to the hero image.',
      estimatedImpact: 'Fix WCAG 1.1.1 violation',
      codeExample: null,
    },
    {
      category: 'seo' as const,
      priority: 'medium' as const,
      title: 'Missing Open Graph tags',
      description: 'No og:title or og:description found.',
      recommendation: 'Add Open Graph meta tags for better social sharing.',
      estimatedImpact: 'Improved social media previews',
    },
  ],
  quickWins: ['Compress hero image', 'Add meta description'],
};

describe('AIInsightsSection', () => {
  it('returns null when insights is undefined', () => {
    const { container } = render(<AIInsightsSection insights={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders summary card', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    expect(screen.getByText(mockInsights.summary)).toBeInTheDocument();
  });

  it('renders quick wins section', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    expect(screen.getByText('Compress hero image')).toBeInTheDocument();
    expect(screen.getByText('Add meta description')).toBeInTheDocument();
  });

  it('does not render quick wins section when empty', () => {
    const noWins = { ...mockInsights, quickWins: [] };
    render(<AIInsightsSection insights={noWins} />);
    expect(screen.queryByText(/Quick Wins/i)).not.toBeInTheDocument();
  });

  it('renders all insight cards', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    expect(screen.getByText('Large JavaScript bundle')).toBeInTheDocument();
    expect(screen.getByText('Missing alt text')).toBeInTheDocument();
    expect(screen.getByText('Missing Open Graph tags')).toBeInTheDocument();
  });

  it('renders priority badges', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('shows "Show code fix" toggle when codeExample is present', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    expect(screen.getByText(/Show code fix/i)).toBeInTheDocument();
  });

  it('does not show code toggle when codeExample is null', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    // Only one insight has a non-null codeExample — there should be exactly one toggle
    const toggles = screen.getAllByText(/Show code fix/i);
    expect(toggles.length).toBe(1);
  });

  it('expands code block when "Show code fix" is clicked', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    const toggle = screen.getByText(/Show code fix/i);
    fireEvent.click(toggle);
    expect(screen.getByText(/dynamic/)).toBeInTheDocument();
  });

  it('collapses code block when "Hide code" is clicked', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    const toggle = screen.getByText(/Show code fix/i);
    fireEvent.click(toggle);
    const hideToggle = screen.getByText(/Hide code/i);
    fireEvent.click(hideToggle);
    expect(screen.queryByText(/dynamic/)).not.toBeInTheDocument();
  });

  it('copy button updates to "Copied" after click', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<AIInsightsSection insights={mockInsights} />);
    const toggle = screen.getByText(/Show code fix/i);
    fireEvent.click(toggle);
    const copyBtn = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(screen.getByText(/Copied/i)).toBeInTheDocument();
    });
  });

  it('renders category icons', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    // Verify category-specific icons render (emoji text or aria labels)
    expect(screen.getByText('⚡')).toBeInTheDocument(); // performance
    expect(screen.getByText('♿')).toBeInTheDocument(); // accessibility
    expect(screen.getByText('🔍')).toBeInTheDocument(); // seo
  });

  it('renders recommendation for each insight', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    expect(screen.getByText(/Code-split the bundle/i)).toBeInTheDocument();
    expect(screen.getByText(/Add descriptive alt text/i)).toBeInTheDocument();
  });

  it('renders estimated impact', () => {
    render(<AIInsightsSection insights={mockInsights} />);
    expect(screen.getByText(/Reduce LCP by ~40%/i)).toBeInTheDocument();
  });
});
