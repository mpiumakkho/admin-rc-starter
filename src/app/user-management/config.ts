import { AdminApi } from './data/admin-api';
import { LocalAdminApi } from './data/local-admin-api';

export interface UserManagementOptions {
  /**
   * Where the data comes from: a LocalAdminApi (the default) keeps sample data in the browser; an HttpAdminApi calls
   * a server, such as `new HttpAdminApi({ url: '/api', events: true })`
   */
  api?: AdminApi;
  /** The app's sign-in page, where people who are not signed in are sent; '/login' by default */
  signInPath?: string;
}

let api: AdminApi | undefined;
let signIn = '/login';

/**
 * What user management needs from the app: where its data comes from, and where its sign-in page is. Call it before
 * the app starts (main.tsx), as the Angular app's provideUserManagement():
 *
 *   configureUserManagement();                                                             // sample data
 *   configureUserManagement({ api: new HttpAdminApi({ url: '/api', events: true }) });      // your backend, see API.md
 */
export function configureUserManagement(options: UserManagementOptions = {}): void {
  api = options.api ?? new LocalAdminApi();
  signIn = options.signInPath ?? '/login';
}

/** The AdminApi the app was configured with */
export function adminApi(): AdminApi {
  api ??= new LocalAdminApi();
  return api;
}

/** The app's sign-in page, where guards send people who are not signed in */
export function signInPath(): string {
  return signIn;
}
