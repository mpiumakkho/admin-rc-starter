import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_DataRouterContext, type Location } from 'react-router';

/**
 * Angular's NavigationEnd: `listener` hears each navigation that completes after the component shows, in step with
 * the address changing. An effect on useLocation() runs only once React has drawn the new page, which it does in a
 * transition: a click in between, such as closing the sidebar's group, would come first and be undone. As Angular, the
 * address it moves to again does not count (onSameUrlNavigation: 'ignore').
 */
export function useNavigationEnd(listener: (location: Location) => void): void {
  const router = useContext(UNSAFE_DataRouterContext)?.router;
  const latest = useRef(listener);
  latest.current = listener;

  useEffect(() => {
    if (!router) {
      return;
    }
    const url = (location: Location) => location.pathname + location.search + location.hash;
    let last = url(router.state.location);
    return router.subscribe(state => {
      if (state.navigation.state === 'idle' && url(state.location) !== last) {
        last = url(state.location);
        latest.current(state.location);
      }
    });
  }, [router]);
}
