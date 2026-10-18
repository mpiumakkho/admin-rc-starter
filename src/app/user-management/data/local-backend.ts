import { AdminApiError, type AdminApiErrorCode } from './admin-api';
import type { TokenAnswer } from './http-admin-api';
import { LocalAdminApi } from './local-admin-api';
import type { AccessReviewDraft, BranchDraft, RoleAssignmentBatch, RoleAssignmentDraft, RoleConflictDraft, RoleDraft, User, UserDraft } from './models';

/** The status a server would answer each refusal with */
const STATUS: Record<AdminApiErrorCode, number> = {
  unauthenticated: 401,
  invalid_credentials: 401,
  forbidden: 403,
  self_change: 403,
  account_suspended: 403,
  invite_pending: 403,
  not_found: 404,
  email_taken: 409,
  role_in_use: 409,
  system_role: 409,
  not_invited: 409,
  email_domain: 422,
  weak_password: 422,
  default_role: 409,
  invalid_request: 400,
  two_factor_required: 401,
  invalid_code: 401,
  invalid_token: 400,
  two_factor_mandatory: 403,
  password_reused: 422,
  too_many_requests: 429,
  already_assigned: 409,
  last_administrator: 409,
  assignment_too_long: 422,
  reason_required: 422,
  code_taken: 409,
  branch_in_use: 409,
  branch_closed: 409,
  role_conflict: 409,
  reauth_required: 403,
  review_closed: 409,
};

/** How long an access token lasts, in seconds, as on the server */
const TOKEN_SECONDS = 900;

/** The access tokens handed out, and when each runs out */
const tokens = new Map<string, number>();

type Body = Record<string, never>;
type Route = [
  method: string,
  path: RegExp,
  answer: (api: LocalAdminApi, body: Body, id: string, query: URLSearchParams) => Promise<unknown>,
];

/**
 * Every request in API.md, answered by LocalAdminApi. The session it keeps in the browser stands in for the
 * refresh cookie, and every token handed out belongs to that one session.
 */
const ROUTES: Route[] = [
  ['POST', /^\/auth\/login$/, async (api, body) => issue(await api.signIn(body['email'], body['password'], body['remember'], body['code']))],
  ['POST', /^\/auth\/refresh$/, async api => issue(signedIn(await api.getSession()))],
  ['POST', /^\/auth\/logout$/, api => {
    tokens.clear();
    return api.signOut();
  }],
  ['POST', /^\/auth\/activate$/, (api, body) => api.acceptInvitation(body['token'], body['password'])],
  ['POST', /^\/auth\/password-reset\/request$/, (api, body) => api.requestPasswordReset(body['email'])],
  ['POST', /^\/auth\/password-reset\/confirm$/, (api, body) => api.confirmPasswordReset(body['token'], body['password'])],
  ['GET', /^\/auth\/password-policy$/, api => api.getPasswordPolicy()],
  ['GET', /^\/me$/, async api => signedIn(await api.getSession())],
  ['POST', /^\/me\/password$/, (api, body) => api.changePassword(body['currentPassword'], body['newPassword'])],
  ['POST', /^\/me\/reauthenticate$/, (api, body) => api.reauthenticate(body['password'], body['code'])],
  ['POST', /^\/me\/two-factor$/, api => api.startTwoFactor()],
  ['POST', /^\/me\/two-factor\/confirm$/, (api, body) => api.confirmTwoFactor(body['code'])],
  ['POST', /^\/me\/two-factor\/disable$/, (api, body) => api.disableTwoFactor(body['code'])],
  ['GET', /^\/me\/recovery-codes$/, async api => ({ remaining: await api.recoveryCodesLeft() })],
  ['POST', /^\/me\/recovery-codes$/, async api => ({ codes: await api.createRecoveryCodes() })],
  ['GET', /^\/users\/([^/]+)\/sessions$/, (api, _body, id) => api.listSessions(id)],
  ['POST', /^\/users\/([^/]+)\/sessions\/end$/, (api, body, id) => api.endSessions(id, body['reason'])],
  ['DELETE', /^\/sessions\/([^/]+)$/, (api, body, id) => api.endSession(id, body['reason'])],
  ['POST', /^\/users\/([^/]+)\/two-factor\/reset$/, (api, body, id) => api.resetTwoFactor(id, body['reason'])],
  ['GET', /^\/users$/, api => api.listUsers()],
  ['POST', /^\/users$/, (api, body) => api.createUser(body as unknown as UserDraft)],
  ['POST', /^\/users\/import$/, (api, body) => api.createUsers(body['users'])],
  ['POST', /^\/users\/status$/, (api, body) => api.setUserStatus(body['ids'], body['status'], body['reason'])],
  ['POST', /^\/users\/delete$/, (api, body) => api.deleteUsers(body['ids'], body['reason'])],
  ['POST', /^\/users\/([^/]+)\/reset-password$/, (api, body, id) => api.resetPassword(id, body['reason'])],
  ['POST', /^\/users\/([^/]+)\/resend-invite$/, (api, _body, id) => api.resendInvite(id)],
  ['PATCH', /^\/users\/([^/]+)$/, (api, body, id) => api.updateUser(id, body)],
  ['POST', /^\/role-assignments$/, (api, body) => api.assignRole(body as unknown as RoleAssignmentDraft)],
  ['POST', /^\/role-assignments\/batch$/, (api, body) => {
    const { userIds, ...change } = body;
    return api.assignRoles(userIds, change as unknown as RoleAssignmentBatch);
  }],
  ['PATCH', /^\/role-assignments\/([^/]+)$/, (api, body, id) => api.updateRoleAssignment(id, body)],
  ['DELETE', /^\/role-assignments\/([^/]+)$/, (api, body, id) => api.removeRoleAssignment(id, body['reason'])],
  ['GET', /^\/branches$/, api => api.listBranches()],
  ['POST', /^\/branches$/, (api, body) => api.createBranch(body as unknown as BranchDraft)],
  ['PATCH', /^\/branches\/([^/]+)$/, (api, body, id) => api.updateBranch(id, body)],
  ['DELETE', /^\/branches\/([^/]+)$/, (api, _body, id) => api.deleteBranch(id)],
  ['GET', /^\/roles$/, api => api.listRoles()],
  ['POST', /^\/roles$/, (api, body) => api.createRole(body as unknown as RoleDraft)],
  ['PATCH', /^\/roles\/([^/]+)$/, (api, body, id) => api.updateRole(id, body)],
  ['DELETE', /^\/roles\/([^/]+)$/, (api, _body, id) => api.deleteRole(id)],
  ['GET', /^\/role-conflicts$/, api => api.listRoleConflicts()],
  ['POST', /^\/role-conflicts$/, (api, body) => api.createRoleConflict(body as unknown as RoleConflictDraft)],
  ['PATCH', /^\/role-conflicts\/([^/]+)$/, (api, body, id) => api.updateRoleConflict(id, body)],
  ['DELETE', /^\/role-conflicts\/([^/]+)$/, (api, _body, id) => api.deleteRoleConflict(id)],
  ['GET', /^\/access-reviews$/, api => api.listAccessReviews()],
  ['POST', /^\/access-reviews$/, (api, body) => api.startAccessReview(body as unknown as AccessReviewDraft)],
  ['GET', /^\/access-reviews\/([^/]+)\/items$/, (api, _body, id) => api.listAccessReviewItems(id)],
  ['POST', /^\/access-reviews\/([^/]+)\/decisions$/, (api, body, id) => api.decideAccessReview(id, body['itemIds'], body['decision'], body['note'])],
  ['POST', /^\/access-reviews\/([^/]+)\/close$/, (api, _body, id) => api.closeAccessReview(id)],
  ['DELETE', /^\/access-reviews\/([^/]+)$/, (api, _body, id) => api.deleteAccessReview(id)],
  ['GET', /^\/activity$/, (api, _body, _id, query) => api.listActivity({
    from: query.get('from') ?? undefined,
    to: query.get('to') ?? undefined,
  })],
  ['GET', /^\/settings$/, api => api.getSettings()],
  ['PATCH', /^\/settings$/, (api, body) => api.updateSettings(body)],
];

let backend: LocalAdminApi | undefined;

/** Whether the pretend server has answered, so the sign-in page can offer the sample accounts */
export function localBackendActive(): boolean {
  return !!backend;
}

/**
 * A pretend server in the browser: answers HttpAdminApi's requests with the sample data, as real HTTP responses and
 * errors, access tokens included. Use it to work on the HTTP side before the backend exists:
 *
 *   configureUserManagement({ api: new HttpAdminApi({ fetch: localBackend() }) });
 *
 * Like the server, it answers 401 to a request without a token it handed out, so after a reload HttpAdminApi
 * refreshes its token as it will against the backend. Requests outside the API's address go out as usual.
 */
export function localBackend(apiUrl = '/api'): typeof fetch {
  return async (input, init) => {
    // Against the page's address, as a browser's fetch reads a relative one
    const request = input instanceof Request ? new Request(input, init) : new Request(new URL(String(input), location.href), init);
    const base = new URL(apiUrl.replace(/\/$/, ''), location.origin);
    const url = new URL(request.url, location.origin);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname + '/')) {
      return fetch(input, init);
    }
    const path = url.pathname.slice(base.pathname.length);
    for (const [method, pattern, answer] of ROUTES) {
      const match = request.method === method ? pattern.exec(path) : null;
      if (match) {
        backend ??= new LocalAdminApi();
        // Outside /auth, only a token handed out and not yet run out lets a request in
        const token = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? '';
        if (!path.startsWith('/auth/') && !((tokens.get(token) ?? 0) > Date.now())) {
          return toHttpError(new AdminApiError('unauthenticated'));
        }
        const text = await request.text();
        try {
          const body = await answer(backend, (text ? JSON.parse(text) : {}) as Body, decodeURIComponent(match[1] ?? ''), url.searchParams);
          return body === undefined
            ? new Response(null, { status: 204 })
            : new Response(JSON.stringify(body ?? null), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          return toHttpError(error);
        }
      }
    }
    return new Response(null, { status: 404, statusText: 'Not Found' });
  };
}

/** A new access token for the user, answered as /auth/login and /auth/refresh do */
function issue(user: User): TokenAnswer {
  const accessToken = `local.${crypto.randomUUID()}`;
  tokens.set(accessToken, Date.now() + TOKEN_SECONDS * 1000);
  return { accessToken, expiresIn: TOKEN_SECONDS, user };
}

/** The signed-in user, refusing the request when nobody is */
function signedIn(user: User | null): User {
  if (!user) {
    throw new AdminApiError('unauthenticated');
  }
  return user;
}

function toHttpError(error: unknown): Response {
  if (!(error instanceof AdminApiError)) {
    return new Response(String(error), { status: 500, statusText: 'Server Error' });
  }
  return new Response(JSON.stringify({ code: error.code }), { status: STATUS[error.code], headers: { 'Content-Type': 'application/json' } });
}
