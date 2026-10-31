import { redirect, type RouteObject } from 'react-router';

/** Back to the work overview, the back office's first page */
const toOverview = { loader: () => redirect('/backoffice/home/overview'), Component: () => null };

/** The back office's pages, under /backoffice, by the spec's menu groups (shell/nav.ts); its code loads when first opened */
export const BACKOFFICE_ROUTES: RouteObject[] = [
  {
    lazy: async () => ({ Component: (await import('./shell/backoffice-shell')).BackofficeShellComponent }),
    children: [
      { index: true as const, ...toOverview },
      { path: 'home', ...toOverview },
      { path: 'home/overview', lazy: async () => ({ Component: (await import('./pages/home/overview')).OverviewComponent }) },
      { path: 'home/approvals', lazy: async () => ({ Component: (await import('./pages/home/approvals')).ApprovalsComponent }) },
      { path: 'home/alerts', lazy: async () => ({ Component: (await import('./pages/home/alerts')).AlertsComponent }) },
      { path: 'home/activity', lazy: async () => ({ Component: (await import('./pages/home/activity')).ActivityComponent }) },
      { path: '*', ...toOverview },
    ],
  },
];
