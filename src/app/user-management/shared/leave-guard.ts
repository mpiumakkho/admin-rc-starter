import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { create } from 'zustand';

/**
 * Where a navigation held back by a leave guard is going, while the page asks about its changes; null otherwise. The
 * shell lays itself out for that page meanwhile, as the Angular app's does from NavigationStart until the guard answers.
 */
export const usePendingNavigation = create<{ path: string | null }>(() => ({ path: null }));

/**
 * Angular's canDeactivate for a page with changes not saved yet: going to another page first asks whether to leave.
 * `shouldAsk` is read when a navigation starts; `ask` answers true to leave.
 *
 *   useLeaveGuard(() => dirty.current && !saved.current, () => uiConfirm.ask({ title: t('Discard your changes?'), … }));
 *
 * Only a change of page asks, as Angular runs the guard when the route changes, not for another query string.
 */
export function useLeaveGuard(shouldAsk: () => boolean, ask: () => Promise<boolean>): void {
  const latest = useRef({ shouldAsk, ask });
  latest.current = { shouldAsk, ask };
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    currentLocation.pathname !== nextLocation.pathname && latest.current.shouldAsk());

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return;
    }
    usePendingNavigation.setState({ path: blocker.location.pathname });
    void latest.current.ask().then(leave => {
      usePendingNavigation.setState({ path: null });
      if (leave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    });
  }, [blocker.state]);
}
