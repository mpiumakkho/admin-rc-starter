import { redirect, type RouteObject } from 'react-router';

/** Back to the queue, the workspace's first tab */
const toQueue = { loader: () => redirect('/clinic/queue'), Component: () => null };

/** The clinical workspace's tabs, under /clinic; the workspace's code loads when it is first opened */
export const CLINIC_ROUTES: RouteObject[] = [
  {
    lazy: async () => ({ Component: (await import('./shell/clinic-shell')).ClinicShellComponent }),
    children: [
      { index: true as const, ...toQueue },
      { path: 'queue', lazy: async () => ({ Component: (await import('./pages/queue')).QueueComponent }) },
      { path: 'appointments', lazy: async () => ({ Component: (await import('./pages/appointments')).AppointmentsComponent }) },
      { path: 'register', lazy: async () => ({ Component: (await import('./pages/register')).RegisterComponent }) },
      { path: 'encounter', lazy: async () => ({ Component: (await import('./pages/encounter')).EncounterComponent }) },
      { path: 'orders', lazy: async () => ({ Component: (await import('./pages/boards')).OrdersComponent }) },
      { path: 'results', lazy: async () => ({ Component: (await import('./pages/boards')).ResultsComponent }) },
      { path: 'dispense', lazy: async () => ({ Component: (await import('./pages/boards')).DispenseComponent }) },
      { path: '*', ...toQueue },
    ],
  },
];
