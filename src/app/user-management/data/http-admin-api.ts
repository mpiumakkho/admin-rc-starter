import { AdminApi, AdminApiError, type AdminApiErrorCode } from './admin-api';
import type {
  AccessReview, AccessReviewDecision, AccessReviewDraft, AccessReviewItem, Activity, ActivityRange, AdminSettings, Branch, BranchChanges, BranchDraft, PasswordPolicy, Role, RoleAssignmentBatch,
  RoleAssignmentChanges, RoleAssignmentDraft, RoleConflict, RoleConflictDraft, RoleDraft, TwoFactorConfirmation, TwoFactorSetup, User, UserChanges, UserDraft,
  UserSession, UserStatus,
} from './models';

/** How HttpAdminApi reaches the server */
export interface HttpAdminApiOptions {
  /** Where the server's API starts, such as "/api" or "https://admin.example.com/api"; '/api' by default */
  url?: string;
  /** Whether the server streams change events at GET /events, for live updates; off by default */
  events?: boolean;
  /** How requests go out; the browser's fetch by default. localBackend answers them in the browser instead. */
  fetch?: typeof fetch;
}

/** A refusal or failure the server answered with, as Angular's HttpErrorResponse: its status, and its JSON body */
export class HttpErrorResponse extends Error {
  readonly status: number;
  readonly error: unknown;
  readonly url: string;

  constructor(status: number, error: unknown, url = '') {
    super(`Http failure response for ${url}: ${status}`);
    this.status = status;
    this.error = error;
    this.url = url;
  }
}

/** What POST /auth/login and POST /auth/refresh answer; expiresIn is in seconds */
export interface TokenAnswer {
  accessToken: string;
  expiresIn: number;
  user: User;
}

/** Every code a refusal can carry; a record, so that a code added to AdminApiErrorCode must be added here too */
const CODES: Record<AdminApiErrorCode, true> = {
  email_taken: true, not_found: true, not_invited: true, role_in_use: true, system_role: true,
  invalid_credentials: true, account_suspended: true, invite_pending: true, unauthenticated: true, forbidden: true,
  self_change: true, email_domain: true, weak_password: true, default_role: true, invalid_request: true,
  two_factor_required: true, invalid_code: true, invalid_token: true, two_factor_mandatory: true, password_reused: true,
  too_many_requests: true, already_assigned: true, last_administrator: true, assignment_too_long: true,
  reason_required: true, code_taken: true, branch_in_use: true, branch_closed: true, role_conflict: true,
  reauth_required: true, review_closed: true,
};

/** The /auth requests carry the refresh cookie, also to an API on another origin */
const CREDENTIALS: RequestInit = { credentials: 'include' };
/** How long watch() waits before connecting again, doubling after each failed try up to the longest */
const RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

/**
 * AdminApi over HTTP, for a real backend. API.md describes each request and response.
 *
 * Signing in answers a short-lived access token, kept in memory only and sent as `Authorization: Bearer …` outside
 * /auth, and sets an HttpOnly refresh cookie that only the /auth requests carry. On start, and whenever a request is
 * answered 401, the cookie buys a new token (one refresh at a time, shared by every request waiting for it) and the
 * request goes out again; when that fails too, the person is signed out. Refusals come back as JSON
 * `{ "code": "email_taken" }`; without a known code, 401 means unauthenticated, 403 forbidden, 404 not_found and
 * 429 too_many_requests.
 */
export class HttpAdminApi extends AdminApi {
  private readonly url: string;
  private readonly events: boolean;
  private readonly fetcher: typeof fetch;
  /** In memory only: storage would let any script on the page read it */
  private token: string | null = null;
  /** The refresh under way, which every request that needs a new token waits for */
  private refreshing?: Promise<User>;

  constructor(options: HttpAdminApiOptions = {}) {
    super();
    this.url = (options.url ?? '/api').replace(/\/$/, '');
    this.events = options.events ?? false;
    this.fetcher = options.fetch ?? ((input, init) => fetch(input, init));
  }

  /* Session */

  async getSession(): Promise<User | null> {
    try {
      return await this.refresh();
    } catch (error) {
      if (unauthenticated(error)) {
        return null;
      }
      throw error;
    }
  }

  signIn(email: string, password: string, remember: boolean, code?: string): Promise<User> {
    return this.keepToken(this.call<TokenAnswer>('POST', `${this.url}/auth/login`, { email, password, remember, code }, CREDENTIALS));
  }

  /** Ends the refresh cookie's session, which works after the access token has run out too */
  async signOut(): Promise<void> {
    try {
      await this.call('POST', `${this.url}/auth/logout`, null, CREDENTIALS);
    } finally {
      this.token = null;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.send('POST', '/me/password', { currentPassword, newPassword });
  }

  async reauthenticate(password: string, code?: string): Promise<void> {
    await this.send('POST', '/me/reauthenticate', { password, code });
  }

  /* Links in emails: no access token, no cookie */

  async acceptInvitation(token: string, password: string): Promise<void> {
    await this.call('POST', `${this.url}/auth/activate`, { token, password });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.call('POST', `${this.url}/auth/password-reset/request`, { email });
  }

  async confirmPasswordReset(token: string, password: string): Promise<void> {
    await this.call('POST', `${this.url}/auth/password-reset/confirm`, { token, password });
  }

  getPasswordPolicy(): Promise<PasswordPolicy> {
    return this.call<PasswordPolicy>('GET', `${this.url}/auth/password-policy`);
  }

  /* Users */

  listUsers(): Promise<User[]> {
    return this.send<User[]>('GET', '/users');
  }

  createUser(draft: UserDraft): Promise<User> {
    return this.send<User>('POST', '/users', draft);
  }

  createUsers(drafts: UserDraft[]): Promise<User[]> {
    return this.send<User[]>('POST', '/users/import', { users: drafts });
  }

  updateUser(id: string, changes: UserChanges): Promise<User> {
    return this.send<User>('PATCH', `/users/${encodeURIComponent(id)}`, changes);
  }

  setUserStatus(ids: string[], status: UserStatus, reason?: string): Promise<User[]> {
    return this.send<User[]>('POST', '/users/status', { ids, status, ...withReason(reason) });
  }

  async deleteUsers(ids: string[], reason?: string): Promise<void> {
    await this.send('POST', '/users/delete', { ids, ...withReason(reason) });
  }

  async resetPassword(id: string, reason?: string): Promise<void> {
    await this.send('POST', `/users/${encodeURIComponent(id)}/reset-password`, withReason(reason));
  }

  async resendInvite(id: string): Promise<void> {
    await this.send('POST', `/users/${encodeURIComponent(id)}/resend-invite`);
  }

  /* Role assignments */

  assignRole(draft: RoleAssignmentDraft): Promise<User> {
    return this.send<User>('POST', '/role-assignments', draft);
  }

  updateRoleAssignment(id: string, changes: RoleAssignmentChanges): Promise<User> {
    return this.send<User>('PATCH', `/role-assignments/${encodeURIComponent(id)}`, changes);
  }

  removeRoleAssignment(id: string, reason?: string): Promise<User> {
    return this.send<User>('DELETE', `/role-assignments/${encodeURIComponent(id)}`, withReason(reason));
  }

  assignRoles(userIds: string[], change: RoleAssignmentBatch): Promise<User[]> {
    return this.send<User[]>('POST', '/role-assignments/batch', { userIds, ...change });
  }

  /* Conflicting roles */

  listRoleConflicts(): Promise<RoleConflict[]> {
    return this.send<RoleConflict[]>('GET', '/role-conflicts');
  }

  createRoleConflict(draft: RoleConflictDraft): Promise<RoleConflict> {
    return this.send<RoleConflict>('POST', '/role-conflicts', draft);
  }

  updateRoleConflict(id: string, changes: Partial<RoleConflictDraft>): Promise<RoleConflict> {
    return this.send<RoleConflict>('PATCH', `/role-conflicts/${encodeURIComponent(id)}`, changes);
  }

  async deleteRoleConflict(id: string): Promise<void> {
    await this.send('DELETE', `/role-conflicts/${encodeURIComponent(id)}`);
  }

  /* Access reviews */

  listAccessReviews(): Promise<AccessReview[]> {
    return this.send<AccessReview[]>('GET', '/access-reviews');
  }

  startAccessReview(draft: AccessReviewDraft): Promise<AccessReview> {
    return this.send<AccessReview>('POST', '/access-reviews', draft);
  }

  listAccessReviewItems(reviewId: string): Promise<AccessReviewItem[]> {
    return this.send<AccessReviewItem[]>('GET', `/access-reviews/${encodeURIComponent(reviewId)}/items`);
  }

  decideAccessReview(reviewId: string, itemIds: string[], decision: AccessReviewDecision, note?: string): Promise<AccessReviewItem[]> {
    return this.send<AccessReviewItem[]>('POST', `/access-reviews/${encodeURIComponent(reviewId)}/decisions`, {
      itemIds, decision, ...(note ? { note } : {}),
    });
  }

  closeAccessReview(reviewId: string): Promise<AccessReview> {
    return this.send<AccessReview>('POST', `/access-reviews/${encodeURIComponent(reviewId)}/close`);
  }

  async deleteAccessReview(reviewId: string): Promise<void> {
    await this.send('DELETE', `/access-reviews/${encodeURIComponent(reviewId)}`);
  }

  /* Branches */

  listBranches(): Promise<Branch[]> {
    return this.send<Branch[]>('GET', '/branches');
  }

  createBranch(draft: BranchDraft): Promise<Branch> {
    return this.send<Branch>('POST', '/branches', draft);
  }

  updateBranch(id: string, changes: BranchChanges): Promise<Branch> {
    return this.send<Branch>('PATCH', `/branches/${encodeURIComponent(id)}`, changes);
  }

  async deleteBranch(id: string): Promise<void> {
    await this.send('DELETE', `/branches/${encodeURIComponent(id)}`);
  }

  /* Roles */

  listRoles(): Promise<Role[]> {
    return this.send<Role[]>('GET', '/roles');
  }

  createRole(draft: RoleDraft): Promise<Role> {
    return this.send<Role>('POST', '/roles', draft);
  }

  updateRole(id: string, changes: Partial<RoleDraft>): Promise<Role> {
    return this.send<Role>('PATCH', `/roles/${encodeURIComponent(id)}`, changes);
  }

  async deleteRole(id: string): Promise<void> {
    await this.send('DELETE', `/roles/${encodeURIComponent(id)}`);
  }

  /* Activity */

  listActivity(range: ActivityRange = {}): Promise<Activity[]> {
    const query = new URLSearchParams(Object.entries(range).filter((entry): entry is [string, string] => !!entry[1]));
    return this.send<Activity[]>('GET', `/activity${query.size ? `?${query}` : ''}`);
  }

  /* Settings */

  getSettings(): Promise<AdminSettings> {
    return this.send<AdminSettings>('GET', '/settings');
  }

  updateSettings(changes: Partial<AdminSettings>): Promise<AdminSettings> {
    return this.send<AdminSettings>('PATCH', '/settings', changes);
  }

  /* Signed-in devices */

  listSessions(userId: string): Promise<UserSession[]> {
    return this.send<UserSession[]>('GET', `/users/${encodeURIComponent(userId)}/sessions`);
  }

  async endSession(sessionId: string, reason?: string): Promise<void> {
    await this.send('DELETE', `/sessions/${encodeURIComponent(sessionId)}`, withReason(reason));
  }

  async endSessions(userId: string, reason?: string): Promise<void> {
    await this.send('POST', `/users/${encodeURIComponent(userId)}/sessions/end`, withReason(reason));
  }

  /* Two-step sign-in */

  startTwoFactor(): Promise<TwoFactorSetup> {
    return this.send<TwoFactorSetup>('POST', '/me/two-factor');
  }

  confirmTwoFactor(code: string): Promise<TwoFactorConfirmation> {
    return this.send<TwoFactorConfirmation>('POST', '/me/two-factor/confirm', { code });
  }

  disableTwoFactor(code: string): Promise<User> {
    return this.send<User>('POST', '/me/two-factor/disable', { code });
  }

  async recoveryCodesLeft(): Promise<number> {
    return (await this.send<{ remaining: number }>('GET', '/me/recovery-codes')).remaining;
  }

  async createRecoveryCodes(): Promise<string[]> {
    return (await this.send<{ codes: string[] }>('POST', '/me/recovery-codes')).codes;
  }

  resetTwoFactor(userId: string, reason?: string): Promise<User> {
    return this.send<User>('POST', `/users/${encodeURIComponent(userId)}/two-factor/reset`, withReason(reason));
  }

  /* Live updates */

  /**
   * With events on, reads the server's event stream; each message with data means something changed. EventSource
   * cannot send the access token, so the stream comes through fetch. The server closes it when the token runs out; it
   * opens again at once, with a new token if the old one is refused, and after a growing wait on failures.
   */
  override watch(onChange: () => void): () => void {
    if (!this.events) {
      return () => undefined;
    }
    let stopped = false;
    let stream: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** The wait after the next failure, doubling each time until a stream carries something again */
    let delay = RECONNECT_MS;

    const reconnect = (refreshFirst: boolean, atOnce: boolean) => {
      if (stopped) {
        return;
      }
      timer = setTimeout(() => connect(refreshFirst), atOnce ? 0 : delay);
      if (!atOnce) {
        delay = Math.min(delay * 2, MAX_RECONNECT_MS);
      }
    };

    const connect = async (refreshFirst: boolean) => {
      const refreshed = refreshFirst || !this.token;
      if (refreshed) {
        try {
          await this.refresh();
        } catch (error) {
          if (!unauthenticated(error)) {
            reconnect(false, false);
          } else if (!stopped) {
            // Signed out: stop listening, and let the pages load again, which notices it and asks to sign in
            onChange();
          }
          return;
        }
      }
      if (stopped) {
        return;
      }
      // The text grows as messages arrive; a blank line ends each one
      let read = 0;
      let rest = '';
      const take = (text: string) => {
        if (text) {
          delay = RECONNECT_MS;
        }
        read += text.length;
        rest += text;
        const messages = rest.split(/\r?\n\r?\n/);
        rest = messages.pop()!;
        // Comments such as ": ping" only keep the connection open
        messages.filter(message => /^data:/m.test(message)).forEach(() => onChange());
      };
      stream = new AbortController();
      try {
        const response = await this.fetcher(`${this.url}/events`, { headers: this.bearer(), signal: stream.signal });
        if (!response.ok) {
          // Only the stream's own text, not the body of a refusal
          throw new HttpErrorResponse(response.status, await readJson(response), response.url);
        }
        const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          take(chunk.value);
        }
        // A stream that closes without a word counts as a failure, so a broken server is not called in a loop
        reconnect(false, read > 0);
      } catch (error) {
        if (stopped) {
          return;
        }
        // A token that has run out is refreshed at once; a fresh one refused, or any other failure, waits
        const expired = unauthenticated(toApiError(error));
        reconnect(expired, expired && !refreshed);
      }
    };

    void connect(false);
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.abort();
    };
  }

  /* Helpers */

  /**
   * Sends a request with the access token, getting one first when there is none. Answered unauthenticated, it
   * refreshes the token and sends the request once more.
   */
  private async send<T>(method: string, path: string, body: unknown = null): Promise<T> {
    const call = () => this.call<T>(method, `${this.url}${path}`, body, { headers: this.bearer() });
    if (!this.token) {
      await this.refresh();
    }
    const token = this.token;
    try {
      return await call();
    } catch (error) {
      // Other 401 refusals, such as a wrong code, are answers to the request
      if (!unauthenticated(error)) {
        throw error;
      }
    }
    // Requests that fail together share one refresh, and one that finished meanwhile has already brought a new token
    if (!this.token || this.token === token) {
      await this.refresh();
    }
    return call();
  }

  /** Trades the refresh cookie for a new access token, one refresh at a time; forgets the old token when it fails */
  private refresh(): Promise<User> {
    this.refreshing ??= this.keepToken(this.call<TokenAnswer>('POST', `${this.url}/auth/refresh`, null, CREDENTIALS))
      .catch(error => {
        this.token = null;
        throw error;
      })
      .finally(() => {
        this.refreshing = undefined;
      });
    return this.refreshing;
  }

  /** Keeps the access token from a sign-in or refresh and hands back whose it is */
  private async keepToken(answer: Promise<TokenAnswer>): Promise<User> {
    const { accessToken, user } = await answer;
    this.token = accessToken;
    return user;
  }

  private bearer(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  /**
   * Sends one request and waits for the answer, as Angular's HttpClient does: a body as JSON, the answer read as JSON
   * (none for 204), and a refusal turned into an AdminApiError the pages understand
   */
  private async call<T>(method: string, url: string, body: unknown = null, init: RequestInit = {}): Promise<T> {
    try {
      const headers = new Headers(init.headers);
      if (body !== null && body !== undefined) {
        headers.set('Content-Type', 'application/json');
      }
      headers.set('Accept', 'application/json, text/plain, */*');
      const response = await this.fetcher(url, {
        ...init, method, headers, body: body === null || body === undefined ? undefined : JSON.stringify(body),
      });
      const answer = await readJson(response);
      if (!response.ok) {
        throw new HttpErrorResponse(response.status, answer, response.url || url);
      }
      return answer as T;
    } catch (error) {
      throw toApiError(error);
    }
  }
}

/** The AdminApiError for a failed request, or the error itself when the server never answered (offline, 500) */
export function toApiError(error: unknown): unknown {
  if (!(error instanceof HttpErrorResponse)) {
    return error;
  }
  const code = (error.error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && Object.hasOwn(CODES, code)) {
    return new AdminApiError(code as AdminApiErrorCode);
  }
  switch (error.status) {
    case 401:
      return new AdminApiError('unauthenticated');
    case 403:
      return new AdminApiError('forbidden');
    case 404:
      return new AdminApiError('not_found');
    case 429:
      return new AdminApiError('too_many_requests');
    default:
      return error;
  }
}

/** A response's body as JSON, or as text when it is not JSON, or null when there is none */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unauthenticated(error: unknown): boolean {
  return error instanceof AdminApiError && error.code === 'unauthenticated';
}

/** The body of a request that takes a reason: none when there is no reason */
function withReason(reason: string | undefined): { reason: string } | undefined {
  return reason ? { reason } : undefined;
}
