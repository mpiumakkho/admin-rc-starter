import { session } from './access/session';
import { configureUserManagement } from './config';
import type { AdminApi } from './data/admin-api';
import { adminStore } from './data/admin-store';
import { LocalAdminApi } from './data/local-admin-api';

/**
 * For unit tests: user management as on a first visit, nobody signed in, on fresh sample data (or `api`). It stands in
 * for the fresh services Angular's TestBed gives each test.
 *
 *   beforeEach(async () => {
 *     freshUserManagement();
 *     await session.signIn(ADMIN, 'any-password', false);
 *   });
 */
export function freshUserManagement(api?: AdminApi): void {
  localStorage.clear();
  sessionStorage.clear();
  configureUserManagement({ api: api ?? new LocalAdminApi() });
  adminStore.clear();
  session.store.setState({ account: null, paused: null });
}
