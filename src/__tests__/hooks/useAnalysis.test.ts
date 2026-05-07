import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnalysis } from '@/hooks/useAnalysis';

describe('useAnalysis()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('initialises with null/false state', () => {
    const { result } = renderHook(() => useAnalysis());
    expect(result.current.id).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.queuePosition).toBeNull();
  });

  describe('startAnalysis()', () => {
    it('sets loading=true during the request', async () => {
      let resolvePromise!: (v: unknown) => void;
      const pending = new Promise((r) => { resolvePromise = r; });
      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(pending);

      const { result } = renderHook(() => useAnalysis());

      act(() => {
        result.current.startAnalysis('https://example.com');
      });

      expect(result.current.loading).toBe(true);

      resolvePromise({
        ok: true,
        json: async () => ({ analysisId: 'abc-123', queuePosition: 2 }),
      });
    });

    it('returns the analysisId on success', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysisId: 'abc-123', queuePosition: 1 }),
      });

      const { result } = renderHook(() => useAnalysis());
      let returned: string | null = null;

      await act(async () => {
        returned = await result.current.startAnalysis('https://example.com');
      });

      expect(returned).toBe('abc-123');
      expect(result.current.id).toBe('abc-123');
      expect(result.current.status).toBe('queued');
      expect(result.current.queuePosition).toBe(1);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('sets error and returns null on API failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Insufficient credits. Please upgrade your plan.' }),
      });

      const { result } = renderHook(() => useAnalysis());
      let returned: string | null = 'init';

      await act(async () => {
        returned = await result.current.startAnalysis('https://example.com');
      });

      expect(returned).toBeNull();
      expect(result.current.error).toBe('Insufficient credits. Please upgrade your plan.');
      expect(result.current.loading).toBe(false);
      expect(result.current.id).toBeNull();
    });

    it('sets error and returns null on network error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(() => useAnalysis());
      let returned: string | null = 'init';

      await act(async () => {
        returned = await result.current.startAnalysis('https://example.com');
      });

      expect(returned).toBeNull();
      expect(result.current.error).toBe('Network failure');
      expect(result.current.loading).toBe(false);
    });

    it('sends request to /api/analyze with correct payload', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysisId: 'xyz', queuePosition: 3 }),
      });

      const { result } = renderHook(() => useAnalysis());

      await act(async () => {
        await result.current.startAnalysis('https://test.com');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analyze',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://test.com' }),
        })
      );
    });
  });

  describe('updateStatus()', () => {
    it('updates status in state', () => {
      const { result } = renderHook(() => useAnalysis());

      act(() => {
        result.current.updateStatus('running');
      });

      expect(result.current.status).toBe('running');
    });

    it('updates queuePosition when provided', () => {
      const { result } = renderHook(() => useAnalysis());

      act(() => {
        result.current.updateStatus('queued', 5);
      });

      expect(result.current.status).toBe('queued');
      expect(result.current.queuePosition).toBe(5);
    });

    it('preserves existing queuePosition when not provided', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analysisId: 'abc', queuePosition: 3 }),
      });

      const { result } = renderHook(() => useAnalysis());
      await act(async () => { await result.current.startAnalysis('https://example.com'); });

      act(() => { result.current.updateStatus('running'); });

      expect(result.current.queuePosition).toBe(3);
    });
  });
});
