import { useEffect, useState } from 'react';

export const COMPACT_LAYOUT_MAX_WIDTH = 767;
export const COMPACT_LAYOUT_QUERY = `(max-width: ${COMPACT_LAYOUT_MAX_WIDTH}px)`;

export type LayoutMode = 'compact' | 'full';

const getLayoutMode = (): LayoutMode => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'full';
  }

  return window.matchMedia(COMPACT_LAYOUT_QUERY).matches ? 'compact' : 'full';
};

export function useLayoutMode(): LayoutMode {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(getLayoutMode);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const updateLayoutMode = (event?: MediaQueryListEvent) => {
      const isCompact = event?.matches ?? mediaQuery.matches;
      setLayoutMode(isCompact ? 'compact' : 'full');
    };

    updateLayoutMode();
    mediaQuery.addEventListener('change', updateLayoutMode);
    return () => mediaQuery.removeEventListener('change', updateLayoutMode);
  }, []);

  return layoutMode;
}
