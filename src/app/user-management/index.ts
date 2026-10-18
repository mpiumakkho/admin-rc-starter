/*
 * user-management: users, roles and permissions, and the activity log, together with the data layer and
 * the UI they are built from. README.md explains how to add it to a React app.
 */
export { USER_MANAGEMENT_ROUTES } from './user-management.routes';
export { USER_MANAGEMENT_MENU, USER_MANAGEMENT_OVERVIEW } from './user-management.menu';
export type { UserManagementMenuGroup, UserManagementMenuLink, UserManagementMenuPage } from './user-management.menu';
export { configureUserManagement } from './config';
export type { UserManagementOptions } from './config';
export { Session, session, useSession, TWO_FACTOR_SETUP_PATH } from './access/session';
export type { SessionView } from './access/session';
export {
  canEditUser, canSeeAccessReviews, canViewUser, guard, guardedPage, lazyPage, requirePermission, settingUpTwoFactor, signedIn, signedOut,
} from './access/guards';
export { ReauthDialog } from './access/reauth-dialog';
export { TwoFactorCodeField, TWO_FACTOR_CODE_RULES } from './access/two-factor-code-field';
export { SessionNotices } from './access/session-notices';
export { AdminApi, AdminApiError } from './data/admin-api';
export type { AdminApiErrorCode } from './data/admin-api';
export { HttpAdminApi } from './data/http-admin-api';
export type { HttpAdminApiOptions } from './data/http-admin-api';
export { LocalAdminApi } from './data/local-admin-api';
export { localBackend } from './data/local-backend';
export { AdminStore, adminStore, useAdmin, useAdminStore } from './data/admin-store';
export type { AdminState, AdminView } from './data/admin-store';
export * from './data/models';
