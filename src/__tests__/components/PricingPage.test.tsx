/**
 * Tests for the PricingPage component and COMPARE_ROWS data.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { COMPARE_ROWS } from '@/components/pricing/PricingPage';

// ─── Mocks (no JSX in factory — hoisted before JSX transform) ────────────────

vi.mock('@/components/auth/AuthModal', () => ({
  AuthModal: ({ open }: { open: boolean; defaultTab?: string; onClose?: () => void }) => {
    if (!open) return null;
    // Use createElement to avoid JSX in hoisted factory
    const { createElement } = require('react');
    return createElement('div', { 'data-testid': 'auth-modal' });
  },
}));

vi.mock('@/components/shared/ThemeToggle', () => ({
  ThemeToggle: () => null,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode; [k: string]: unknown }) => {
    const { createElement } = require('react');
    return createElement('a', { href, ...rest }, children);
  },
}));

import { PricingPage } from '@/components/pricing/PricingPage';

// ─── COMPARE_ROWS data integrity tests ───────────────────────────────────────

describe('COMPARE_ROWS data', () => {
  it('has at least 15 rows', () => {
    expect(COMPARE_ROWS.length).toBeGreaterThanOrEqual(15);
  });

  it('every row has all four plan columns', () => {
    for (const row of COMPARE_ROWS) {
      expect('free' in row).toBe(true);
      expect('pro' in row).toBe(true);
      expect('agency' in row).toBe(true);
      expect('compliance' in row).toBe(true);
    }
  });

  it('if pro is false, free must also be false', () => {
    for (const row of COMPARE_ROWS) {
      if (row.pro === false) {
        expect(row.free).toBe(false);
      }
    }
  });

  it('if pro is true, agency must not be false', () => {
    for (const row of COMPARE_ROWS) {
      if (row.pro === true) {
        expect(row.agency).not.toBe(false);
      }
    }
  });

  it('if agency is true, compliance must not be false', () => {
    for (const row of COMPARE_ROWS) {
      if (row.agency === true) {
        expect(row.compliance).not.toBe(false);
      }
    }
  });

  it('has an API access row — locked on free and pro', () => {
    const row = COMPARE_ROWS.find((r) => r.label.toLowerCase().includes('api access'));
    expect(row).toBeDefined();
    expect(row!.free).toBe(false);
    expect(row!.pro).toBe(false);
    expect(row!.agency).not.toBe(false);
  });

  it('has a team members row — locked on free and pro', () => {
    const row = COMPARE_ROWS.find((r) => r.label.toLowerCase().includes('team'));
    expect(row).toBeDefined();
    expect(row!.free).toBe(false);
    expect(row!.pro).toBe(false);
    expect(row!.agency).not.toBe(false);
  });

  it('WCAG checks row is compliance-only', () => {
    const row = COMPARE_ROWS.find((r) => r.label.toLowerCase().includes('wcag'));
    expect(row).toBeDefined();
    expect(row!.agency).toBe(false);
    expect(row!.compliance).not.toBe(false);
  });

  it('all labels are non-empty strings', () => {
    for (const row of COMPARE_ROWS) {
      expect(row.label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ─── Component render tests ───────────────────────────────────────────────────

describe('PricingPage component', () => {
  it('renders the page heading', () => {
    render(<PricingPage />);
    // h1 should be present
    const h1 = document.querySelector('h1');
    expect(h1).toBeTruthy();
  });

  it('renders all four plan names at least once', () => {
    render(<PricingPage />);
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pro').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Agency').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Compliance').length).toBeGreaterThanOrEqual(1);
  });

  it('shows monthly prices by default ($29 for Pro)', () => {
    render(<PricingPage />);
    expect(screen.getAllByText('$29').length).toBeGreaterThanOrEqual(1);
  });

  it('shows monthly prices by default ($99 for Agency)', () => {
    render(<PricingPage />);
    expect(screen.getAllByText('$99').length).toBeGreaterThanOrEqual(1);
  });

  // Helper — the billing toggle "Annual" button is the FIRST button whose
  // accessible name starts with "Annual" (vs FAQ item "Do you offer annual billing?")
  function clickAnnual() {
    const annualBtns = screen.getAllByRole('button', { name: /annual/i });
    const toggleBtn = annualBtns.find((b) => /^annual/i.test(b.textContent ?? ''));
    fireEvent.click(toggleBtn!);
  }

  it('switches to annual billing — Pro becomes $23', () => {
    render(<PricingPage />);
    clickAnnual();
    // $29 * 0.8 = $23.2 → Math.round → $23
    expect(screen.getAllByText('$23').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to annual billing — Agency becomes $79', () => {
    render(<PricingPage />);
    clickAnnual();
    // $99 * 0.8 = $79.2 → Math.round → $79
    expect(screen.getAllByText('$79').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to annual billing — Compliance becomes $199', () => {
    render(<PricingPage />);
    clickAnnual();
    // $249 * 0.8 = $199.2 → Math.round → $199
    expect(screen.getAllByText('$199').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the billing toggle with Monthly and Annual buttons', () => {
    render(<PricingPage />);
    expect(screen.getByRole('button', { name: /^monthly$/i })).toBeTruthy();
    // At least one button whose text starts with Annual
    const annualBtns = screen.getAllByRole('button', { name: /annual/i });
    expect(annualBtns.some((b) => /^annual/i.test(b.textContent ?? ''))).toBe(true);
  });

  it('renders the FAQ section heading', () => {
    render(<PricingPage />);
    expect(screen.getByText('Frequently asked questions')).toBeTruthy();
  });

  it('FAQ item expands when clicked', () => {
    render(<PricingPage />);
    const faqBtn = screen.getByRole('button', { name: /what counts as one audit/i });
    fireEvent.click(faqBtn);
    expect(screen.getByText(/each url you submit/i)).toBeTruthy();
  });

  it('FAQ item collapses when clicked twice', () => {
    render(<PricingPage />);
    const faqBtn = screen.getByRole('button', { name: /what counts as one audit/i });
    fireEvent.click(faqBtn);
    fireEvent.click(faqBtn);
    expect(screen.queryByText(/each url you submit/i)).toBeNull();
  });

  it('renders the comparison table heading', () => {
    render(<PricingPage />);
    expect(screen.getByText('Full feature comparison')).toBeTruthy();
  });

  it('renders the "Which plan is right for you?" section', () => {
    render(<PricingPage />);
    expect(screen.getByText('Which plan is right for you?')).toBeTruthy();
  });

  it('opens the auth modal when a CTA button is clicked', () => {
    render(<PricingPage />);
    // "Get started free" CTA in the nav or page body
    const ctaBtns = screen.getAllByRole('button', { name: /get started free/i });
    fireEvent.click(ctaBtns[0]);
    expect(screen.getByTestId('auth-modal')).toBeTruthy();
  });
});
