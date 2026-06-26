import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LLMReadinessSection } from '@/components/reports/LLMReadinessSection';

describe('LLMReadinessSection', () => {
  it('returns null when llmReadiness is undefined', () => {
    const { container } = render(<LLMReadinessSection scores={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows score badge with correct value', () => {
    render(<LLMReadinessSection scores={{ llmReadiness: 75 }} />);
    expect(screen.getByText('75/100')).toBeInTheDocument();
  });

  it('shows emerald styling for score >= 80', () => {
    render(<LLMReadinessSection scores={{ llmReadiness: 80 }} />);
    const scoreEl = screen.getByText('80/100');
    expect(scoreEl.className).toContain('emerald');
  });

  it('shows amber styling for score between 50 and 79', () => {
    render(<LLMReadinessSection scores={{ llmReadiness: 62 }} />);
    const scoreEl = screen.getByText('62/100');
    expect(scoreEl.className).toContain('amber');
  });

  it('shows improvement tips when llmSignals has items', () => {
    const signals = ['Add JSON-LD structured data', 'Add a meta description'];
    render(<LLMReadinessSection scores={{ llmReadiness: 50, llmSignals: signals }} />);
    expect(screen.getByText('Add JSON-LD structured data')).toBeInTheDocument();
    expect(screen.getByText('Add a meta description')).toBeInTheDocument();
  });

  it('shows "How to improve" heading when signals present', () => {
    const signals = ['Add JSON-LD structured data'];
    render(<LLMReadinessSection scores={{ llmReadiness: 50, llmSignals: signals }} />);
    expect(screen.getByText('How to improve')).toBeInTheDocument();
  });

  it('does not show "How to improve" heading when no signals', () => {
    render(<LLMReadinessSection scores={{ llmReadiness: 100, llmSignals: [] }} />);
    expect(screen.queryByText('How to improve')).not.toBeInTheDocument();
  });

  it('renders check rows for each llmCheck', () => {
    const llmChecks: Record<string, boolean> = {
      hasStructuredData: true,
      hasMetaDescription: false,
      hasOpenGraph: true,
      hasSitemap: false,
      allowsAIBots: true,
      hasCleanHeadings: false,
      hasSufficientContent: true,
      hasCanonical: false,
    };
    render(<LLMReadinessSection scores={{ llmReadiness: 50, llmChecks }} />);
    // Check that labelled items are shown
    expect(screen.getByText('Structured Data (JSON-LD)')).toBeInTheDocument();
    expect(screen.getByText('Meta Description')).toBeInTheDocument();
    expect(screen.getByText('Open Graph Tags')).toBeInTheDocument();
    expect(screen.getByText('Canonical URL')).toBeInTheDocument();
  });

  it('renders all 8 check labels', () => {
    render(<LLMReadinessSection scores={{ llmReadiness: 50 }} />);
    const labels = [
      'Structured Data (JSON-LD)',
      'Meta Description',
      'Open Graph Tags',
      'Sitemap Linked',
      'AI Bots Allowed',
      'Clean Heading Structure',
      'Sufficient Content',
      'Canonical URL',
    ];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
