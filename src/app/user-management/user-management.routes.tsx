import type { RouteObject } from 'react-router';

import {
  canEditUser, canSeeAccessReviews, canViewUser, guard, lazyPage, requirePermission, settingUpTwoFactor,
} from './access/guards';
import { NoAccessComponent } from './access/no-access';

/**
 * The user management pages, each loaded when first opened and only for people whose role allows it.
 * Spread them into the app's routes, at the top level.
 */
export const USER_MANAGEMENT_ROUTES: RouteObject[] = [
  { path: 'overview', loader: guard(requirePermission('users.view')), lazy: lazyPage(() => import('./overview/overview'), m => m.OverviewComponent) },
  // Each users page checks its own permission; anyone can open their own profile
  {
    path: 'users',
    children: [
      { index: true, loader: guard(requirePermission('users.view')), lazy: lazyPage(() => import('./users/users-list'), m => m.UsersListComponent) },
      { path: 'new', loader: guard(requirePermission('users.create')), lazy: lazyPage(() => import('./users/user-form'), m => m.UserFormComponent) },
      { path: ':id', loader: guard(canViewUser), lazy: lazyPage(() => import('./users/user-detail'), m => m.UserDetailComponent) },
      { path: ':id/edit', loader: guard(canEditUser), lazy: lazyPage(() => import('./users/user-form'), m => m.UserFormComponent) },
    ],
  },
  { path: 'roles', loader: guard(requirePermission('roles.view')), lazy: lazyPage(() => import('./roles/roles'), m => m.RolesComponent) },
  {
    path: 'roles/conflicts', loader: guard(requirePermission('roles.view')),
    lazy: lazyPage(() => import('./roles/role-conflicts'), m => m.RoleConflictsComponent),
  },
  {
    path: 'access-reviews', loader: guard(canSeeAccessReviews),
    lazy: lazyPage(() => import('./access-reviews/access-reviews'), m => m.AccessReviewsComponent),
  },
  {
    path: 'access-reviews/:id', loader: guard(canSeeAccessReviews),
    lazy: lazyPage(() => import('./access-reviews/access-review'), m => m.AccessReviewComponent),
  },
  { path: 'branches', loader: guard(requirePermission('branches.view')), lazy: lazyPage(() => import('./branches/branches'), m => m.BranchesComponent) },
  { path: 'activity', loader: guard(requirePermission('activity.view')), lazy: lazyPage(() => import('./activity/activity'), m => m.ActivityComponent) },
  { path: 'settings', loader: guard(requirePermission('settings.view')), lazy: lazyPage(() => import('./settings/settings'), m => m.SettingsComponent) },
  // Where the guards send people whose role does not allow a page
  { path: 'no-access', Component: NoAccessComponent },
  // Where the guards send people whose role requires two-step sign-in while it is off
  {
    path: 'setup-two-factor', loader: guard(settingUpTwoFactor),
    lazy: lazyPage(() => import('./access/two-factor-setup'), m => m.TwoFactorSetupComponent),
  },
];
