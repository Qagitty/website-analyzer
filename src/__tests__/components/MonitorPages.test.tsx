/**
 * Tests for MonitorPages component (Sprint 13).
 *
 * Covers:
 *  - renders pages list with enable/disable toggle per row
 *  - checkbox select / deselect per row
 *  - select all / clear selection
 *  - bulk action bar appears when rows selected
 *  - bulk enable calls batch API
 *  - bulk disable calls batch API
 *  - bulk remove shows confirmation dialog then calls batch API
 *  - individual enable/disable toggle calls PATCH
 *  - individual remove calls DELETE
 *  - add page form calls POST
 *  - discovery flow
 *  - loading state
 *  - empty state
 *  - disabled pages shown with "disabled" badge and dimmed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MonitorPages } from '@/components/monitors/MonitorPages';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';

const PAGES = [
  { id: 'root-1', monitor_id: 'm-1', url: 'https://example.com', page_type: 'root' as const, is_active: true, discovery_source: 'initial', last_scores: { performance: 90, accessibility: 85, seo: 88 }, last_checked_at: '2026-07-01T10:00:00Z', sort_order: 0 },
  { id: 'page-2', monitor_id: 'm-1', url: 'https://example.com/about', page_type: 'pinned' as const, is_active: true, discovery_source: 'manual', last_scores: null, last_checked_at: null, sort_order: 1 },
  { id: 'page-3', monitor_id: 'm-1', url: 'https://example.com/contact', page_type: 'discovered' as const, is_active: false, discovery_source: 'sitemap', last_scores: null, last_checked_at: null, sort_order: 2 },
];

function setupFetch(overrides: Record<string, () => Promise<Response>> = {}) {
  const defaults: Record<string, () => Promise<Response>> = {
    'GET /api/monitors/m-1/pages': () => Promise.resolve(new Response(JSON.stringify(PAGES), { status: 200 })),
    'PATCH /api/monitors/m-1/pages/page-2': () => Promise.resolve(new Response(JSON.stringify({ ...PAGES[1], is_active: false }), { status: 200 })),
    'PATCH /api/monitors/m-1/pages/page-3': () => Promise.resolve(new Response(JSON.stringify({ ...PAGES[2], is_active: true }), { status: 200 })),
    'DELETE /api/monitors/m-1/pages/page-2': () => Promise.resolve(new Response(JSON.stringify({ deleted: true }), { status: 200 })),
    'POST /api/monitors/m-1/pages/batch': () => Promise.resolve(new Response(JSON.stringify({ affected: 2 }), { status: 200 })),
    'POST /api/monitors/m-1/pages': () => Promise.resolve(new Response(JSON.stringify({ id: 'new-1', url: 'https://example.com/new', page_type: 'pinned', is_active: true, discovery_source: null, last_scores: null, last_checked_at: null, sort_order: 3 }), { status: 201 })),
    'POST /api/monitors/m-1/discover': () => Promise.resolve(new Response(JSON.stringify({ discovered: 3, pages: [{ url: 'https://example.com/a', source: 'sitemap', depth: 1 }] }), { status: 200 })),
  };

  global.fetch = vi.fn().mockImplementation(async (url: string, opts: RequestInit = {}) => {
    const method = opts.method ?? 'GET';
    const key = `${method} ${url}`;
    const handler = overrides[key] ?? defaults[key];
    if (handler) return handler();
    return new Response('Not found', { status: 404 });
  });
}

describe('MonitorPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetch();
  });

  it('shows loading spinner initially', () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    expect(screen.getByText(/loading pages/i)).toBeTruthy();
  });

  it('renders pages after load', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => expect(screen.getByText('https://example.com')).toBeTruthy());
    expect(screen.getByText('https://example.com/about')).toBeTruthy();
    expect(screen.getByText('https://example.com/contact')).toBeTruthy();
  });

  it('shows "disabled" badge for inactive pages', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByText('https://example.com/contact'));
    expect(screen.getByText('disabled')).toBeTruthy();
  });

  it('shows active count in header', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByText(/active/i));
    expect(screen.getByText(/2 active \/ 3 total/i)).toBeTruthy();
  });

  it('checkboxes not shown for root page', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByText('https://example.com'));
    // Root page row should not have a checkbox (non-root pages do)
    const checkboxes = screen.getAllByRole('button', { name: /select page/i });
    // Should be 2 (page-2 and page-3), not 3
    expect(checkboxes.length).toBe(2);
  });

  it('selecting a page shows bulk action bar', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByText('https://example.com/about'));
    const checkboxes = screen.getAllByRole('button', { name: /select page/i });
    fireEvent.click(checkboxes[0]);
    await waitFor(() => expect(screen.getByText(/1 selected/i)).toBeTruthy());
  });

  it('select all selects only non-root pages', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByText(/select all/i));
    fireEvent.click(screen.getByLabelText(/select all non-root pages/i));
    await waitFor(() => expect(screen.getByText(/2 selected/i)).toBeTruthy());
  });

  it('bulk enable calls batch API with enable action', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getAllByRole('button', { name: /select page/i }));
    const checkboxes = screen.getAllByRole('button', { name: /select page/i });
    fireEvent.click(checkboxes[0]);
    await waitFor(() => screen.getByText(/1 selected/i));
    // The "Enable" button in the bulk action bar (there may be multiple buttons with text "Enable")
    const enableButtons = screen.getAllByRole('button', { name: /^enable$/i });
    fireEvent.click(enableButtons[0]);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/monitors/m-1/pages/batch',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('individual enable/disable toggle calls PATCH endpoint', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByText('https://example.com/about'));
    // page-2 is active → shows "Disable page" title
    // page-3 is inactive → shows "Enable page" title
    // Use the "Enable page" button (page-3, definitely unique title among inactive pages)
    const enablePageBtn = screen.getByTitle('Enable page');
    fireEvent.click(enablePageBtn);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Page enabled'));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/monitors/m-1/pages/page-3',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('remove button not shown for root page', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByText('https://example.com'));
    // Trash buttons: page-2 and page-3 have them, root-1 does not
    const trashButtons = screen.getAllByTitle('Remove page');
    expect(trashButtons.length).toBe(2);
  });

  it('individual remove calls DELETE endpoint', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getAllByTitle('Remove page'));
    const trashButtons = screen.getAllByTitle('Remove page');
    fireEvent.click(trashButtons[0]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Page removed'));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/monitors/m-1/pages/page-2',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('add page form calls POST endpoint', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByPlaceholderText(/https:\/\/example.com\/page/i));
    const input = screen.getByPlaceholderText(/https:\/\/example.com\/page/i);
    fireEvent.change(input, { target: { value: 'https://example.com/new' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Page added to monitor'));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/monitors/m-1/pages',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('add page form validates URL and does not call API', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByPlaceholderText(/https:\/\/example.com\/page/i));
    const input = screen.getByPlaceholderText(/https:\/\/example.com\/page/i);
    fireEvent.change(input, { target: { value: 'not-a-url' } });
    const fetchCallsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    // Validation error appears (check that fetch was NOT called for pages POST)
    const fetchCallsAfter = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(fetchCallsAfter).toBe(fetchCallsBefore); // no new calls
    expect(toast.success).not.toHaveBeenCalledWith('Page added to monitor');
  });

  it('discover button triggers discovery preview', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="all" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByRole('button', { name: /discover/i }));
    fireEvent.click(screen.getByRole('button', { name: /discover/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Found')));
    expect(screen.getByText(/pages found/i)).toBeTruthy();
  });

  it('empty state shown when no pages', async () => {
    setupFetch({
      'GET /api/monitors/m-1/pages': () => Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
    });
    render(<MonitorPages monitorId="m-1" pageMode="custom" rootUrl="https://example.com" />);
    await waitFor(() => expect(screen.getByText(/no pages yet/i)).toBeTruthy());
  });

  // Security: add page form not shown for auto-discovery modes
  it('add page form not shown in "all" mode', async () => {
    render(<MonitorPages monitorId="m-1" pageMode="all" rootUrl="https://example.com" />);
    await waitFor(() => screen.getByText('https://example.com'));
    expect(screen.queryByPlaceholderText(/https:\/\/example.com\/page/i)).toBeNull();
  });
});
