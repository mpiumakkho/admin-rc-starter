import { useEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router';

/**
 * Page load animation: a short fade, so the new page reads as new without making anyone wait for it. Plays only
 * when the page changes, not when just the query string does (picking a role on the roles page, searching from the
 * navbar), so the content doesn't flash; and not at all when the system asks for less motion (WCAG 2.3.3).
 *
 *   const page = useRef<HTMLDivElement>(null);
 *   useContentAnimate(page);
 */
export function useContentAnimate(element: RefObject<HTMLElement | null>): void {
  const { pathname } = useLocation();
  const path = useRef(pathname);

  useEffect(() => {
    if (pathname === path.current) {
      return;
    }
    path.current = pathname;
    const target = element.current;
    // Nor in the accessible view (useUiAccessibleView), which keeps everything still
    if (!target || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('ui-aaa')) {
      return;
    }
    target.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
  }, [pathname]);
}
