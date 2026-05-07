import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCredits } from '@/hooks/useCredits';

describe('useCredits()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('starts with loading=true', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ credits: 3, creditsUsed: 0 }),
    });

    const { result } = renderHook(() => useCredits());
    expect(result.current.loading).toBe(true);
  });

  it('returns credits and creditsUsed after fetch resolves', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ credits: 7, creditsUsed: 2 }),
    });

    const { result } = renderHook(() => useCredits());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.credits).toBe(7);
    expect(result.current.creditsUsed).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('sets error when fetch returns non-ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useCredits());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to load credits');
    expect(result.current.credits).toBe(0);
  });

  it('sets error on network failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useCredits());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network down');
  });

  it('fetches from /api/user/credits', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ credits: 3, creditsUsed: 0 }),
    });

    renderHook(() => useCredits());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/user/credits');
    });
  });

  it('refresh() re-fetches credits', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ credits: 3, creditsUsed: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ credits: 2, creditsUsed: 1 }) });

    const { result } = renderHook(() => useCredits());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.credits).toBe(3);

    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.credits).toBe(2);
    expect(result.current.creditsUsed).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ── Background poll anti-flicker ──────────────────────────────────────────
  it('background poll does NOT set loading=true after initialization', async () => {
    // First fetch: initializes the hook
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ credits: 5, creditsUsed: 1 }) })
      // Second fetch: simulates a background poll (e.g. refresh() called internally)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ credits: 4, creditsUsed: 2 }) });

    const { result } = renderHook(() => useCredits());

    // Wait for initial load to complete
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.credits).toBe(5);

    // Capture loading states during the second fetch
    const loadingDuringPoll: boolean[] = [];

    // Trigger a background poll via refresh()
    act(() => { result.current.refresh(); });

    // loading must never go back to true
    loadingDuringPoll.push(result.current.loading);

    await waitFor(() => expect(result.current.credits).toBe(4));

    // loading should remain false throughout (no flicker)
    expect(result.current.loading).toBe(false);
    expect(loadingDuringPoll.every((v) => v === false)).toBe(true);
  });

  it('loading stays false when error occurs during background poll', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ credits: 3, creditsUsed: 0 }) })
      .mockRejectedValueOnce(new Error('Network blip'));

    const { result } = renderHook(() => useCredits());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.refresh(); });

    await waitFor(() => expect(result.current.error).toBe('Network blip'));

    // loading must never flip to true during background failure
    expect(result.current.loading).toBe(false);
    // credits preserved from last successful fetch
    expect(result.current.credits).toBe(3);
  });
});
