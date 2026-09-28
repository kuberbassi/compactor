import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPACT_LAYOUT_QUERY, useLayoutMode } from '../compact/hooks/useLayoutMode';

type ChangeListener = (event: MediaQueryListEvent) => void;

const installMatchMedia = (initialMatches: boolean) => {
  let matches = initialMatches;
  const listeners = new Set<ChangeListener>();

  const mediaQuery = {
    get matches() { return matches; },
    media: COMPACT_LAYOUT_QUERY,
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: ChangeListener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: ChangeListener) => listeners.delete(listener)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => mediaQuery),
  });

  return {
    mediaQuery,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches, media: COMPACT_LAYOUT_QUERY } as MediaQueryListEvent;
      listeners.forEach(listener => listener(event));
    },
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLayoutMode', () => {
  it('uses the full workspace at tablet widths', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useLayoutMode());

    expect(result.current).toBe('full');
    expect(window.matchMedia).toHaveBeenCalledWith(COMPACT_LAYOUT_QUERY);
  });

  it('uses compact mode below the shared breakpoint', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useLayoutMode());

    expect(result.current).toBe('compact');
  });

  it('responds to viewport changes and removes its listener', () => {
    const matchMedia = installMatchMedia(false);
    const { result, unmount } = renderHook(() => useLayoutMode());

    act(() => matchMedia.setMatches(true));
    expect(result.current).toBe('compact');

    unmount();
    expect(matchMedia.mediaQuery.removeEventListener).toHaveBeenCalledOnce();
  });
});
