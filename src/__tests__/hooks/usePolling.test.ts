import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolling } from '@/hooks/usePolling';

describe('usePolling()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls callback immediately on mount', () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 3000, true));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('calls callback again after each interval', () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 1000, true));
    expect(cb).toHaveBeenCalledTimes(1); // immediate

    act(() => { vi.advanceTimersByTime(1000); });
    expect(cb).toHaveBeenCalledTimes(2);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('does not call callback when active=false', () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 1000, false));
    expect(cb).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(5000); });
    expect(cb).not.toHaveBeenCalled();
  });

  it('stops calling callback after unmount', () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => usePolling(cb, 1000, true));
    expect(cb).toHaveBeenCalledTimes(1);

    unmount();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(cb).toHaveBeenCalledTimes(1); // no more calls after unmount
  });

  it('respects the interval timing', () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 3000, true));
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(2999); });
    expect(cb).toHaveBeenCalledTimes(1); // not yet

    act(() => { vi.advanceTimersByTime(1); });
    expect(cb).toHaveBeenCalledTimes(2); // now
  });

  it('always uses the latest callback reference', () => {
    let counter = 0;
    const cb1 = vi.fn(() => { counter++; });
    const cb2 = vi.fn(() => { counter += 10; });

    const { rerender } = renderHook(
      ({ cb }) => usePolling(cb, 1000, true),
      { initialProps: { cb: cb1 } }
    );

    act(() => { vi.advanceTimersByTime(1000); });
    expect(counter).toBe(2); // 1 (mount) + 1 (interval)

    rerender({ cb: cb2 });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(counter).toBe(12); // previous 2 + 10 from cb2
  });

  it('defaults active to true when not provided', () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 1000));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
