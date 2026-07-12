/**
 * Tests for src/components/error-monitoring/ErrorLevelBadge.tsx
 * Covers: colour classes per level, accessible aria-label.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorLevelBadge } from '@/components/error-monitoring/ErrorLevelBadge';

describe('ErrorLevelBadge', () => {
  it('renders "Fatal" label for level="fatal"', () => {
    render(<ErrorLevelBadge level="fatal" />);
    expect(screen.getByText('Fatal')).toBeInTheDocument();
  });

  it('applies red background class for fatal', () => {
    const { container } = render(<ErrorLevelBadge level="fatal" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('red');
  });

  it('renders "Error" label for level="error"', () => {
    render(<ErrorLevelBadge level="error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('applies orange background class for error', () => {
    const { container } = render(<ErrorLevelBadge level="error" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('orange');
  });

  it('renders "Warning" label for level="warning"', () => {
    render(<ErrorLevelBadge level="warning" />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('applies amber background class for warning', () => {
    const { container } = render(<ErrorLevelBadge level="warning" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('amber');
  });

  it('renders "Info" label for level="info"', () => {
    render(<ErrorLevelBadge level="info" />);
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('has accessible aria-label including the level name', () => {
    render(<ErrorLevelBadge level="fatal" />);
    const badge = screen.getByRole('generic', { name: /fatal/i });
    expect(badge).toBeInTheDocument();
  });
});
