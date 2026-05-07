import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingBanner } from '@/components/dashboard/OnboardingBanner';

describe('OnboardingBanner', () => {
  it('renders when analysisCount is 0', () => {
    const { container } = render(<OnboardingBanner analysisCount={0} />);
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByText('Welcome to WebAnalyzer!')).toBeInTheDocument();
  });

  it('does not render when analysisCount > 0', () => {
    const { container } = render(<OnboardingBanner analysisCount={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when analysisCount is 5', () => {
    const { container } = render(<OnboardingBanner analysisCount={5} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('dismisses when X button clicked', () => {
    const { container } = render(<OnboardingBanner analysisCount={0} />);
    expect(container).not.toBeEmptyDOMElement();

    const dismissButton = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissButton);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Analyze a site" link', () => {
    render(<OnboardingBanner analysisCount={0} />);
    expect(screen.getByText(/Analyze a site/i)).toBeInTheDocument();
  });

  it('link points to /analyze', () => {
    render(<OnboardingBanner analysisCount={0} />);
    const link = screen.getByRole('link', { name: /Analyze a site/i });
    expect(link).toHaveAttribute('href', '/analyze');
  });
});
