import { redirect, type RouteObject } from 'react-router';

import { App } from './app';
import { CLINIC_ROUTES } from './clinic/clinic.routes';
import { BootFrame } from './layout/boot-frame';
import { guard, lazyPage, signedIn, signedOut } from './user-management/access/guards';
import { session } from './user-management/access/session';
import { USER_MANAGEMENT_ROUTES } from './user-management/user-management.routes';

export const routes: RouteObject[] = [
  {
    Component: App,
    // Until the first page has loaded, what index.html showed stays
    HydrateFallback: BootFrame,
    children: [
      // The first page the signed-in user's role allows, or the sign-in page
      { index: true, loader: () => redirect(session.view.homeUrl()), Component: () => null },
      // Overview, users, roles and activity
      ...USER_MANAGEMENT_ROUTES,
      // Component reference for building other dashboards; not linked from the menu
      { path: 'ui-kit', loader: guard(signedIn), lazy: lazyPage(() => import('./ui-kit/ui-kit'), m => m.UiKitComponent) },
      // A sample clinical workspace (งานตรวจรักษา) in the app's own colors, full page; opened from the account menu
      { path: 'clinic', loader: guard(signedIn), children: CLINIC_ROUTES },
      { path: 'login', loader: guard(signedOut), lazy: lazyPage(() => import('./auth/login/login'), m => m.LoginComponent) },
      { path: 'forgot-password', loader: guard(signedOut), lazy: lazyPage(() => import('./auth/forgot-password/forgot-password'), m => m.ForgotPasswordComponent) },
      // Where the links in emails lead (API.md, "Links in emails"); they work whether or not someone is signed in here
      { path: 'activate', lazy: async () => ({ Component: (await import('./auth/set-password/set-password')).ActivatePage }) },
      { path: 'reset-password', lazy: async () => ({ Component: (await import('./auth/set-password/set-password')).ResetPasswordPage }) },
      {
        path: 'error-pages',
        children: [
          { path: '404', lazy: async () => ({ Component: (await import('./error-pages/error404')).Error404Component }) },
          { path: '500', lazy: async () => ({ Component: (await import('./error-pages/error500')).Error500Component }) },
        ],
      },
      { path: '*', loader: () => redirect('/error-pages/404') },
    ],
  },
];
