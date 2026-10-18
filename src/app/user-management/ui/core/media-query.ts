import { useSyncExternalStore } from 'react';

/**
 * Whether a media query matches, following it as the window changes (the CDK's BreakpointObserver). Where there is no
 * matchMedia, such as jsdom in the unit tests, nothing matches, as the CDK's MediaMatcher falls back to.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    onChange => {
      const list = window.matchMedia?.(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    () => !!window.matchMedia?.(query).matches,
  );
}
