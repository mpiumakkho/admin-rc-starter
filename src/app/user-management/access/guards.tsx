import type { ComponentType } from 'react';
import { redirect, useLoaderData, type LoaderFunctionArgs } from 'react-router';

import { signInPath } from '../config';
import { adminStore, selectUsersById } from '../data/admin-store';
import type { Permission } from '../data/models';
import { NoAccessComponent } from './no-access';
import { isSigningOut, session, TWO_FACTOR_SETUP_PATH } from './session';

/*
 * Route guards, as React Router loaders: they run before a page opens, as Angular's canActivate guards do. A page
 * someone may not open shows the no-access page at the same address, so the address bar still says what they tried
 * to open (guardedPage).
 */

/** What a guard answers when the page is not allowed: guardedPage shows the no-access page in its place */
export interface NoAccess {
  noAccess: true;
}

type Guard = (args: LoaderFunctionArgs) => Response | NoAccess | null;

/** Lets signed-in people through; sends everyone else to sign in, and back here afterwards */
export const signedIn: Guard = ({ request }) => {
  const view = session.view;
  return !view.signedIn ? toSignIn(request) : view.twoFactorSetupRequired ? toTwoFactorSetup() : null;
};

/** For the two-step sign-in setup page: only while the role requires it and it is off */
export const settingUpTwoFactor: Guard = ({ request }) => {
  const view = session.view;
  if (!view.signedIn) {
    return toSignIn(request);
  }
  return view.twoFactorSetupRequired ? null : redirect(view.homeUrl());
};

/** For the sign-in page: someone already signed in goes to their first page instead, unless they are signing out */
export const signedOut: Guard = () => {
  const view = session.view;
  return !view.signedIn || isSigningOut() ? null : redirect(view.homeUrl());
};

/** Lets through people who have every permission listed, somewhere (session.canSomewhere) */
export function requirePermission(...permissions: Permission[]): Guard {
  return ({ request }) => {
    const view = session.view;
    if (!view.signedIn) {
      return toSignIn(request);
    }
    if (view.twoFactorSetupRequired) {
      return toTwoFactorSetup();
    }
    return permissions.every(permission => view.canSomewhere(permission)) ? null : noAccess();
  };
}

/** Access reviews: for people who run them (reviews.manage), and for those who take part in one */
export const canSeeAccessReviews: Guard = ({ request }) => {
  const view = session.view;
  if (!view.signedIn) {
    return toSignIn(request);
  }
  if (view.twoFactorSetupRequired) {
    return toTwoFactorSetup();
  }
  return view.can('reviews.manage') || adminStore.state.accessReviews.length > 0 ? null : noAccess();
};

/** A user's profile: anyone can see their own; other people's need users.view, for the whole organization or a branch */
export const canViewUser: Guard = ({ request, params }) => {
  const view = session.view;
  if (!view.signedIn) {
    return toSignIn(request);
  }
  if (view.twoFactorSetupRequired) {
    return toTwoFactorSetup();
  }
  return params['id'] === view.userId || view.canSomewhere('users.view') ? null : noAccess();
};

/**
 * Editing a user needs users.edit and a role no stronger than your own (see access-rules.ts).
 * Everyone can edit their own profile; the form then locks what they may not change.
 */
export const canEditUser: Guard = ({ request, params }) => {
  const view = session.view;
  if (!view.signedIn) {
    return toSignIn(request);
  }
  if (view.twoFactorSetupRequired) {
    return toTwoFactorSetup();
  }
  const user = selectUsersById(adminStore.state).get(params['id'] ?? '');
  // An unknown id is let through to editors: the form shows "user not found"
  return (user ? view.canEditProfile(user) : view.canSomewhere('users.edit')) ? null : noAccess();
};

/** A loader that runs the guard: it redirects, marks the page not allowed, or lets it open */
export function guard(check: Guard) {
  return (args: LoaderFunctionArgs) => {
    const answer = check(args);
    if (answer instanceof Response) {
      throw answer;
    }
    return answer;
  };
}

/** The page, or the no-access page in its place when its guard said so */
export function guardedPage<P extends object>(Page: ComponentType<P>): ComponentType<P> {
  return function Guarded(props: P) {
    const answer = useLoaderData() as NoAccess | null | undefined;
    return answer?.noAccess ? <NoAccessComponent /> : <Page {...props} />;
  };
}

/**
 * A page loaded when first opened, as Angular's loadComponent, and shown in place of the no-access page when its
 * guard allows it: `{ path: 'roles', loader: guard(requirePermission('roles.view')), lazy: lazyPage(() => import('./roles'), m => m.RolesComponent) }`
 */
export function lazyPage<M>(load: () => Promise<M>, pick: (module: M) => ComponentType) {
  return async () => ({ Component: guardedPage(pick(await load())) });
}

function toSignIn(request: Request) {
  const url = new URL(request.url);
  return redirect(`${signInPath()}?returnUrl=${encodeURIComponent(url.pathname + url.search)}`);
}

function toTwoFactorSetup() {
  return redirect(TWO_FACTOR_SETUP_PATH);
}

/** Shows the no-access page while the address bar keeps the address that was asked for */
function noAccess(): NoAccess {
  return { noAccess: true };
}
