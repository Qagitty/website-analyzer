import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EAAComplianceSection } from '@/components/reports/EAAComplianceSection';

const mockIssues = [
  {
    id: 'color-contrast',
    impact: 'serious' as const,
    description: 'Elements must have sufficient color contrast',
    nodes: ['button.cta'],
    wcagCriteria: ['wcag2aa', 'wcag143'],
  },
  {
    id: 'keyboard-trap',
    impact: 'critical' as const,
    description: 'Keyboard focus must not be trapped',
    nodes: ['div.modal'],
    wcagCriteria: ['wcag2aa', 'wcag241'],
  },
];

describe('EAAComplianceSection', () => {
  it('returns null when accessibilityIssues is undefined', () => {
    const { container } = render(<EAAComplianceSection accessibilityIssues={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Compliant" when no issues', () => {
    render(<EAAComplianceSection accessibilityIssues={[]} />);
    expect(screen.getByText(/Compliant/i)).toBeInTheDocument();
  });

  it('shows "Non-Compliant" when critical issues present', () => {
    render(<EAAComplianceSection accessibilityIssues={mockIssues} />);
    expect(screen.getByText(/Non-Compliant/i)).toBeInTheDocument();
  });

  it('shows "Partially Compliant" when only non-critical issues', () => {
    const minorIssues = [
      {
        id: 'label',
        impact: 'moderate' as const,
        description: 'Labels must be present',
        nodes: ['input'],
        wcagCriteria: ['wcag2aa'],
      },
    ];
    render(<EAAComplianceSection accessibilityIssues={minorIssues} />);
    expect(screen.getByText(/Partially Compliant/i)).toBeInTheDocument();
  });

  it('renders three compliance categories', () => {
    render(<EAAComplianceSection accessibilityIssues={mockIssues} />);
    expect(screen.getByText(/WCAG 2\.1/i)).toBeInTheDocument();
    expect(screen.getByText(/Perceivable/i)).toBeInTheDocument();
    expect(screen.getByText(/Operable/i)).toBeInTheDocument();
  });

  it('shows EAA legal notice callout', () => {
    render(<EAAComplianceSection accessibilityIssues={[]} />);
    expect(screen.getByText(/EAA|European Accessibility Act/i)).toBeInTheDocument();
  });

  it('shows WCAG criterion tags on issues', () => {
    render(<EAAComplianceSection accessibilityIssues={mockIssues} />);
    expect(screen.getByText('wcag143')).toBeInTheDocument();
    expect(screen.getByText('wcag2aa')).toBeInTheDocument();
  });

  it('shows issue count per category', () => {
    render(<EAAComplianceSection accessibilityIssues={mockIssues} />);
    const countBadges = screen.getAllByText(/\d+ issue/i);
    expect(countBadges.length).toBeGreaterThan(0);
  });
});
