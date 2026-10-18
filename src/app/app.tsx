import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigation } from 'react-router';

import { AccessibleViewSwitch } from './layout/accessible-view-switch';
import { useContentAnimate } from './layout/content-animate';
import { Footer } from './layout/footer/footer';
import { Navbar } from './layout/navbar/navbar';
import { Sidebar } from './layout/sidebar/sidebar';
import { Spinner } from './layout/spinner/spinner';
import { ReauthDialog } from './user-management/access/reauth-dialog';
import { useSession } from './user-management/access/session';
import { SessionNotices } from './user-management/access/session-notices';
import { usePendingNavigation } from './user-management/shared/leave-guard';
import { cx, useUiAccessibleView, UiConfirmHost, UiToaster } from './user-management/ui';
import './app.scss';

const AUTH_PAGES = ['/login', '/forgot-password', '/activate', '/reset-password', '/setup-two-factor'];
const ERROR_PAGES = ['/error-pages/404', '/error-pages/500'];
/** Workspaces with their own shell bar and menu, which fill the window */
const WORKSPACES = ['/clinic'];
/** Read by public/theme.js: someone was signed in when the app last ran */
const SIGNED_IN_KEY = 'app-signed-in';

/**
 * The shell around every page: the navbar along the top, the sidebar on the left and the page beside it. Sign-in and
 * error pages fill the window on their own, and so do workspaces such as the clinic, which bring their own shell.
 */
export function App() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigation = useNavigation();
  const session = useSession();
  const accessible = useUiAccessibleView(state => state.on);
  const page = useRef<HTMLDivElement>(null);
  useContentAnimate(page);

  // The page being opened as soon as the navigation starts, as Angular's NavigationStart: the layout changes with it,
  // also while a page asks about its unsaved changes; a navigation that stays where it was brings back the page's layout
  const pending = usePendingNavigation(state => state.path);
  const path = navigation.location?.pathname ?? pending ?? location.pathname;
  // The spinner covers the page while the next one loads. The page stays, so it can still ask about unsaved changes.
  const isLoading = navigation.state === 'loading';
  const isErrorPage = ERROR_PAGES.includes(path);
  const isWorkspace = WORKSPACES.some(workspace => path === workspace || path.startsWith(workspace + '/'));
  // Sidebar, Navbar, Footer and Settings are removed for Error and Auth pages, and for workspaces, which bring their own
  const isFullPage = isErrorPage || AUTH_PAGES.includes(path) || isWorkspace;

  // Tells public/theme.js, on the next load, to show the app's frame rather than a spinner while the session loads
  useEffect(() => {
    try {
      if (session.signedIn) {
        localStorage.setItem(SIGNED_IN_KEY, '1');
      } else {
        localStorage.removeItem(SIGNED_IN_KEY);
      }
    } catch {
      // Storage unavailable: the spinner shows instead
    }
  }, [session.signedIn]);

  // Back to the top after every navigation, as the Angular router's scrollPositionRestoration: 'top'; a navigation with
  // the state { scroll: 'manual' } stays where it is, as one with Angular's scroll: 'manual'
  useEffect(() => {
    if ((location.state as { scroll?: string } | null)?.scroll !== 'manual') {
      window.scrollTo(0, 0);
    }
  }, [location.key]);

  return (
    <>
      {!isFullPage && <Navbar />}
      <div className={cx('app-body', isFullPage && 'full-page')}>
        {!isFullPage && <Sidebar />}
        <div className="main-panel">
          <main className="content-wrapper">
            {/* The accessible view keeps messages until dismissed, so they sit above the page instead of covering it */}
            {accessible && <UiToaster inline dismissLabel={t('Dismiss')} />}
            {!isFullPage && <SessionNotices />}
            {isLoading && <Spinner />}
            <div ref={page} className="page">
              {/* Where Angular's <router-outlet> stands, the page after it: the same elements, for the same layout */}
              <router-outlet></router-outlet>
              <Outlet />
            </div>
          </main>
          {!isFullPage && <Footer />}
        </div>
      </div>
      {/* On the pages without the navbar, the switch to the accessible view; signed in, it is in the account menu */}
      {isFullPage && !isWorkspace && <AccessibleViewSwitch />}
      {!accessible && <UiToaster dismissLabel={t('Dismiss')} />}
      <ReauthDialog />
      <UiConfirmHost />
    </>
  );
}
