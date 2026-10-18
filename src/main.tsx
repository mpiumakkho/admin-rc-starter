// The theme variables first, then the base look of plain elements, as the Angular app lists them in angular.json
import './app/user-management/ui/ui.scss';
import './styles.scss';

import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { routes } from './app/app.routes';
import { useLanguage } from './app/layout/language.service';
import { session } from './app/user-management/access/session';
import { configureUserManagement } from './app/user-management/config';

// Users, roles and activity, from sample data kept in the browser; the session is picked up before the first screen.
// For a real backend, such as ../admin-api-starter on port 8080, which npm run dev reaches as /api (vite.config.ts):
// configureUserManagement({ api: new HttpAdminApi({ url: '/api', events: true }) }), see user-management/API.md
configureUserManagement();
useLanguage.getState().init();
await session.restore();

const router = createBrowserRouter(routes);

/** Waits until the router has settled: no navigation under way, and no page holding one back to ask about its changes */
function settled(app: ReturnType<typeof createBrowserRouter>): Promise<void> {
  const done = () => app.state.navigation.state === 'idle' && ![...app.state.blockers.values()].some(blocker => blocker.state !== 'unblocked');
  if (done()) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const stop = app.subscribe(() => {
      if (done()) {
        stop();
        resolve();
      }
    });
  });
}

session.start(
  async (to, options = {}) => {
    const search = options.queryParams ? `?${new URLSearchParams(options.queryParams)}` : '';
    await router.navigate(to + search, { state: options.state });
    await settled(router);
  },
  () => router.state.location.pathname,
);

createRoot(document.querySelector('app-root')!).render(<RouterProvider router={router} />);
