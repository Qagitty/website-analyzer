import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FixRequestStatusBadge } from '@/components/fix-requests/FixRequestStatusBadge';
import { FixRequestSeverityBadge } from '@/components/fix-requests/FixRequestSeverityBadge';
import { FixRequestTypeBadge } from '@/components/fix-requests/FixRequestTypeBadge';
import { FixRequestCard } from '@/components/fix-requests/FixRequestCard';
import type { FixRequestStatus, FixRequestSeverity, FixRequestType } from '@/types/fix-request';

// Polyfill ResizeObserver for jsdom (used by Radix RadioGroup)
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// ── FixRequestStatusBadge ────────────────────────────────────────────────────

describe('FixRequestStatusBadge', () => {
  const ALL_STATUSES: FixRequestStatus[] = [
    'draft', 'ready', 'sending', 'sent', 'delivered', 'delivery_failed',
    'acknowledged', 'in_review', 'accepted', 'declined', 'in_progress',
    'waiting_for_information', 'fix_submitted', 'verification_required',
    'verified', 'closed', 'cancelled',
  ];

  it.each(ALL_STATUSES)('renders status "%s" without throwing', (status) => {
    const { container } = render(<FixRequestStatusBadge status={status} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('shows human-readable label for draft', () => {
    render(<FixRequestStatusBadge status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows "In Progress" for in_progress', () => {
    render(<FixRequestStatusBadge status="in_progress" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('shows "Delivery Failed" for delivery_failed', () => {
    render(<FixRequestStatusBadge status="delivery_failed" />);
    expect(screen.getByText('Delivery Failed')).toBeInTheDocument();
  });

  it('applies animate-pulse class for sending status', () => {
    const { container } = render(<FixRequestStatusBadge status="sending" />);
    expect(container.innerHTML).toContain('animate-pulse');
  });

  it('applies red color class for delivery_failed', () => {
    const { container } = render(<FixRequestStatusBadge status="delivery_failed" />);
    expect(container.innerHTML).toContain('red');
  });

  it('applies emerald color class for verified', () => {
    const { container } = render(<FixRequestStatusBadge status="verified" />);
    expect(container.innerHTML).toContain('emerald');
  });
});

// ── FixRequestSeverityBadge ──────────────────────────────────────────────────

describe('FixRequestSeverityBadge', () => {
  const ALL_SEVERITIES: FixRequestSeverity[] = [
    'critical', 'high', 'medium', 'low', 'informational',
  ];

  it.each(ALL_SEVERITIES)('renders severity "%s" without throwing', (severity) => {
    const { container } = render(<FixRequestSeverityBadge severity={severity} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('shows "Critical" for critical severity', () => {
    render(<FixRequestSeverityBadge severity="critical" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('shows "Info" for informational severity', () => {
    render(<FixRequestSeverityBadge severity="informational" />);
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('applies red class for critical', () => {
    const { container } = render(<FixRequestSeverityBadge severity="critical" />);
    expect(container.innerHTML).toContain('red');
  });

  it('applies amber class for medium', () => {
    const { container } = render(<FixRequestSeverityBadge severity="medium" />);
    expect(container.innerHTML).toContain('amber');
  });
});

// ── FixRequestTypeBadge ──────────────────────────────────────────────────────

describe('FixRequestTypeBadge', () => {
  const ALL_TYPES: FixRequestType[] = [
    'audit', 'fix', 'estimate', 'review', 'verification', 'consultation',
  ];

  it.each(ALL_TYPES)('renders type "%s" without throwing', (type) => {
    const { container } = render(<FixRequestTypeBadge type={type} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('shows "Audit" for audit type', () => {
    render(<FixRequestTypeBadge type="audit" />);
    expect(screen.getByText('Audit')).toBeInTheDocument();
  });

  it('shows "Verification" for verification type', () => {
    render(<FixRequestTypeBadge type="verification" />);
    expect(screen.getByText('Verification')).toBeInTheDocument();
  });

  it('shows "Consultation" for consultation type', () => {
    render(<FixRequestTypeBadge type="consultation" />);
    expect(screen.getByText('Consultation')).toBeInTheDocument();
  });
});

// ── FixRequestCard ────────────────────────────────────────────────────────────

describe('FixRequestCard', () => {
  const baseProps = {
    id: 'test-id-123',
    title: 'Fix missing alt text',
    status: 'draft' as FixRequestStatus,
    severity: 'high' as FixRequestSeverity,
    request_type: 'fix' as FixRequestType,
    created_at: new Date(Date.now() - 60_000).toISOString(),
  };

  it('renders the title', () => {
    render(<FixRequestCard {...baseProps} />);
    expect(screen.getByText('Fix missing alt text')).toBeInTheDocument();
  });

  it('renders the status badge', () => {
    render(<FixRequestCard {...baseProps} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders the severity badge', () => {
    render(<FixRequestCard {...baseProps} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('links to /fix-requests/[id]', () => {
    render(<FixRequestCard {...baseProps} />);
    const link = screen.getByTestId('fix-request-card');
    expect(link).toHaveAttribute('href', '/fix-requests/test-id-123');
  });

  it('renders summary when provided', () => {
    render(<FixRequestCard {...baseProps} summary="Some detailed summary" />);
    expect(screen.getByText('Some detailed summary')).toBeInTheDocument();
  });

  it('renders type badge', () => {
    render(<FixRequestCard {...baseProps} />);
    expect(screen.getByText('Fix')).toBeInTheDocument();
  });
});

// ── FixRequestForm ─────────────────────────────────────────────────────────────

describe('FixRequestForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // mock router
    vi.mock('next/navigation', () => ({
      useRouter: () => ({ push: vi.fn() }),
    }));
  });

  it('renders title input', async () => {
    const { FixRequestForm } = await import('@/components/fix-requests/FixRequestForm');
    render(<FixRequestForm />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  });

  it('shows validation error if title is too short', async () => {
    const { FixRequestForm } = await import('@/components/fix-requests/FixRequestForm');
    render(<FixRequestForm />);
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'ab' } });
    const submitBtn = screen.getByRole('button', { name: /create fix request/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it('calls POST /api/fix-requests on valid submit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fixRequest: { id: 'new-id' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { FixRequestForm } = await import('@/components/fix-requests/FixRequestForm');
    render(<FixRequestForm />);

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Fix the broken layout on mobile' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create fix request/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/fix-requests',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
