import { cloneElement, Suspense, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

export interface DeferOnViewportProps {
  /** One element, shown until it has come into view and the content has loaded */
  placeholder: ReactElement<{ ref?: unknown }>;
  /** The content, typically a component loaded with React.lazy */
  children: ReactNode;
}

/**
 * Angular's `@defer (on viewport) { … } @placeholder { … }`: the placeholder stays until it scrolls into view, then the
 * content loads (a lazy component's code with it) and takes its place.
 *
 *   const UiChart = lazy(() => import('../ui/charts/chart').then(m => ({ default: m.UiChart })));
 *   <DeferOnViewport placeholder={<div></div>}><UiChart … /></DeferOnViewport>
 */
export function DeferOnViewport({ placeholder, children }: DeferOnViewportProps) {
  const [visible, setVisible] = useState(false);
  const watched = useRef<Element | null>(null);

  useEffect(() => {
    const target = watched.current;
    if (visible || !target) {
      return undefined;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible]);

  if (!visible) {
    return cloneElement(placeholder, { ref: (element: Element | null) => { watched.current = element; } });
  }
  return <Suspense fallback={placeholder}>{children}</Suspense>;
}
