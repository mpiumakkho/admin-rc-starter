import { useMemo } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { adminApi } from '../config';
import { activeRoleIds, roleAssignmentState, roleConflictViolations } from './access-rules';
import { AdminApi, AdminApiError } from './admin-api';
import { DEFAULT_SETTINGS } from './catalog';
import { memoSelector } from './memo';
import type {
  AccessReview, AccessReviewDecision, AccessReviewDraft, AccessReviewItem, Activity, ActivityRange, AdminSettings, Branch, BranchChanges, BranchDraft, Role, RoleAssignmentBatch, RoleAssignmentChanges,
  RoleAssignmentDraft, RoleConflict, RoleConflictDraft, RoleDraft, TwoFactorConfirmation, TwoFactorSetup, User, UserChanges, UserDraft, UserSession, UserStatus,
} from './models';

/** How long to wait for more changes before loading again, as one action can change several things */
const REFRESH_DELAY_MS = 300;
/** The clock moves on at least this often, and at each moment an assignment starts or ends */
const CLOCK_MS = 60 * 60_000;

/** The data the screens share */
export interface AdminState {
  users: User[];
  roles: Role[];
  roleConflicts: RoleConflict[];
  branches: Branch[];
  activity: Activity[];
  settings: AdminSettings;
  /** Every access review with reviews.manage; otherwise the ones the signed-in user takes part in */
  accessReviews: AccessReview[];
  loaded: boolean;
  /** Set when the server answers that the session has ended; Session then sends the user to sign in */
  sessionEnded: boolean;
  /**
   * Set when the signed-in user's role requires two-step sign-in and it is off (two_factor_mandatory). Until they turn
   * it on, only the roles and the settings load, and Session keeps them on the page for setting it up.
   */
  twoFactorSetupRequired: boolean;
  /** Goes up each time the data is loaded again, so a page can reload what it fetched itself */
  revision: number;
  /**
   * Changes made elsewhere wait for showChanges() rather than appearing by themselves, so the page never changes
   * under someone (the accessible view, WCAG 2.2.4). Changes the person makes here show at once either way.
   */
  holdChanges: boolean;
  /** Changes made elsewhere are waiting to be shown, while holdChanges is on */
  changesWaiting: boolean;
  /**
   * A change was refused with reauth_required and waits for the signed-in user to confirm who they are (ReauthDialog).
   * endReauth() sends it again, or lets it fail.
   */
  reauthRequested: boolean;
  /**
   * Now, as far as role assignments go: it moves on when one starts or ends, so whatever depends on who holds which
   * role (permissions, badges, counts) follows without a reload. Read it instead of Date.now() in derived values.
   */
  now: number;
}

const EMPTY: Omit<AdminState, 'holdChanges' | 'now' | 'revision'> = {
  users: [], roles: [], roleConflicts: [], branches: [], activity: [], settings: DEFAULT_SETTINGS, accessReviews: [],
  loaded: false, sessionEnded: false, twoFactorSetupRequired: false, changesWaiting: false, reauthRequested: false,
};

/* Derived values, worked out again only when what they read changes (Angular's computed) */

export const selectUsersById = memoSelector((state: AdminState) => [state.users] as const, users => new Map(users.map(user => [user.id, user])));
export const selectRolesById = memoSelector((state: AdminState) => [state.roles] as const, roles => new Map(roles.map(role => [role.id, role])));
export const selectBranchesById = memoSelector((state: AdminState) => [state.branches] as const, branches => new Map(branches.map(branch => [branch.id, branch])));
/** The ones people can join or get a role in */
export const selectOpenBranches = memoSelector((state: AdminState) => [state.branches] as const, branches => branches.filter(branch => branch.active));
/** How many roles under review wait for the signed-in user's decision, in every open review: the menu's count */
export const selectAccessReviewsWaiting = memoSelector((state: AdminState) => [state.accessReviews] as const,
  reviews => reviews.reduce((count, review) => count + review.waitingCount, 0));

/** How many people hold each role now */
export const selectRoleCounts = memoSelector((state: AdminState) => [state.users, state.now] as const, (users, now) => {
  const counts = new Map<string, number>();
  for (const user of users) {
    for (const roleId of activeRoleIds(user, now)) {
      counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
    }
  }
  return counts;
});

/** The roles someone holds now, the ones with most permissions first */
export function activeRolesOf(state: AdminState, user: Pick<User, 'roles'> | null | undefined): Role[] {
  const roles = selectRolesById(state);
  return activeRoleIds(user, state.now)
    .map(id => roles.get(id))
    .filter((role): role is Role => !!role)
    .sort((a, b) => b.permissions.length - a.permissions.length);
}

/**
 * How many people each role is the main role of: the one with most permissions they hold now. Everyone counts once,
 * for a chart of the whole; roleCounts counts everyone who holds each role.
 */
export const selectMainRoleCounts = memoSelector((state: AdminState) => [state.users, state.roles, state.now] as const, (users, roles, now) => {
  const counts = new Map<string, number>();
  const view = { roles, now } as AdminState;
  for (const user of users) {
    const main = activeRolesOf(view, user)[0];
    if (main) {
      counts.set(main.id, (counts.get(main.id) ?? 0) + 1);
    }
  }
  return counts;
});

/** People who hold roles that a rule says cannot be held together, now or later: the ones to fix */
export const selectRoleConflictViolations = memoSelector((state: AdminState) => [state.users, state.roleConflicts, state.now] as const,
  (users, conflicts, now) => roleConflictViolations(users, conflicts, now));

/** How many people belong to each branch */
export const selectBranchCounts = memoSelector((state: AdminState) => [state.users] as const, users => {
  const counts = new Map<string, number>();
  for (const user of users) {
    if (user.branchId) {
      counts.set(user.branchId, (counts.get(user.branchId) ?? 0) + 1);
    }
  }
  return counts;
});

/**
 * The data the screens share, kept in step with the server through AdminApi. Each change waits for the server's
 * answer before updating the state. Session loads it after sign-in and clears it on sign-out.
 *
 * Components read it with useAdmin() (or useAdminStore(selector) for a part); anything else with adminStore.state.
 */
export class AdminStore {
  /** The state, as a Zustand store */
  readonly store = createStore<AdminState>(() => ({ ...EMPTY, holdChanges: false, revision: 0, now: Date.now() }));

  private stopWatching?: () => void;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  /** Settles the changes waiting on reauthRequested: true once the person has confirmed who they are */
  private settleReauth?: (confirmed: boolean) => void;
  private reauthAnswer?: Promise<boolean>;
  private clock?: ReturnType<typeof setTimeout>;

  constructor() {
    // Moves the clock on at the next start or end of an assignment, or within the hour
    const schedule = (state: AdminState) => {
      clearTimeout(this.clock);
      const now = state.now;
      const next = state.users
        .flatMap(user => user.roles.flatMap(item => [item.startsAt, item.endsAt]))
        .map(at => at ? new Date(at).getTime() : Infinity)
        .filter(at => at > now)
        .reduce((soonest, at) => Math.min(soonest, at), now + CLOCK_MS);
      this.clock = setTimeout(() => this.patch({ now: Date.now() }), Math.max(next - now, 1000));
    };
    schedule(this.state);
    this.store.subscribe((state, previous) => {
      if (state.now !== previous.now || state.users !== previous.users) {
        schedule(state);
      }
    });
  }

  private get api(): AdminApi {
    return adminApi();
  }

  /** The state as it is now */
  get state(): AdminState {
    return this.store.getState();
  }

  private patch(partial: Partial<AdminState> | ((state: AdminState) => Partial<AdminState>)): void {
    this.store.setState(partial);
  }

  /** The roles someone holds now, the ones with most permissions first */
  activeRoles(user: Pick<User, 'roles'> | null | undefined): Role[] {
    return activeRolesOf(this.state, user);
  }

  async load(): Promise<void> {
    let loaded: [User[], Role[], Activity[], AdminSettings, Branch[], RoleConflict[], AccessReview[]];
    try {
      loaded = await this.fetchAll();
    } catch (error) {
      if (!(error instanceof AdminApiError && error.code === 'two_factor_mandatory')) {
        throw error;
      }
      // Only what setting up two-step sign-in needs
      const [roles, settings] = await this.call(() => Promise.all([this.api.listRoles(), this.api.getSettings()]));
      this.clear();
      this.patch({ roles, settings, twoFactorSetupRequired: true, loaded: true });
      return;
    }
    const [users, roles, activity, settings, branches, roleConflicts, accessReviews] = loaded;
    this.patch(state => ({
      twoFactorSetupRequired: false, users, roles, roleConflicts, branches, activity, settings, accessReviews,
      sessionEnded: false, changesWaiting: false, loaded: true, revision: state.revision + 1,
    }));
    this.watch();
  }

  /** Signed in again on the same page (Session.resume): what changed meanwhile shows, or waits (holdChanges) */
  resume(): void {
    this.patch({ sessionEnded: false });
    void this.update();
    this.watch();
  }

  /** Shows the changes that were waiting */
  async showChanges(): Promise<void> {
    this.patch({ changesWaiting: false });
    await this.refresh();
  }

  /** Loads everything again, quietly; a session that ended elsewhere is noticed here */
  async refresh(): Promise<void> {
    try {
      const [users, roles, activity, settings, branches, roleConflicts, accessReviews] = await this.fetchAll();
      this.patch(state => ({ users, roles, roleConflicts, branches, activity, settings, accessReviews, revision: state.revision + 1 }));
    } catch {
      // Offline for a moment: the next change tries again
    }
  }

  private fetchAll() {
    return this.call(() => Promise.all([
      this.api.listUsers(), this.api.listRoles(), this.api.listActivity(), this.api.getSettings(), this.api.listBranches(),
      this.api.listRoleConflicts(), this.api.listAccessReviews(),
    ]));
  }

  /** Changes made elsewhere show up without a reload, or wait to be asked for (holdChanges) */
  private watch() {
    this.stopWatching?.();
    this.stopWatching = this.api.watch(() => {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => this.update(), REFRESH_DELAY_MS);
    });
  }

  /**
   * Loads again, or, while holding changes, only looks: the data stays, and the notice shows when something differs.
   * Either way a session that ended elsewhere is noticed.
   */
  private async update() {
    if (!this.state.holdChanges) {
      return this.refresh();
    }
    try {
      const latest = await this.fetchAll();
      const { users, roles, activity, settings, branches, roleConflicts, accessReviews } = this.state;
      const shown = [users, roles, activity, settings, branches, roleConflicts, accessReviews];
      if (JSON.stringify(latest) !== JSON.stringify(shown)) {
        this.patch({ changesWaiting: true });
      }
    } catch {
      // Offline for a moment: the next change tries again
    }
    return undefined;
  }

  /** Forgets everything, after signing out */
  clear() {
    this.stopWatching?.();
    this.stopWatching = undefined;
    clearTimeout(this.refreshTimer);
    this.patch({ ...EMPTY, reauthRequested: this.state.reauthRequested });
    this.endReauth(false);
  }

  /** The person confirmed who they are, or gave up: the changes that waited go again, or fail with reauth_required */
  endReauth(confirmed: boolean): void {
    const settle = this.settleReauth;
    this.settleReauth = undefined;
    this.reauthAnswer = undefined;
    this.patch({ reauthRequested: false });
    settle?.(confirmed);
  }

  /** Changes made elsewhere wait for showChanges() (holdChanges), or show at once */
  setHoldChanges(hold: boolean): void {
    this.patch({ holdChanges: hold });
  }

  isEmailTaken(email: string, exceptId?: string): boolean {
    const value = email.trim().toLowerCase();
    return this.state.users.some(user => user.id !== exceptId && user.email.toLowerCase() === value);
  }

  /* Conflicting roles */

  async createRoleConflict(draft: RoleConflictDraft): Promise<RoleConflict> {
    const rule = await this.call(() => this.api.createRoleConflict(draft));
    this.patch(state => ({ roleConflicts: [...state.roleConflicts, rule] }));
    await this.refreshActivity();
    return rule;
  }

  async updateRoleConflict(id: string, changes: Partial<RoleConflictDraft>): Promise<RoleConflict> {
    const rule = await this.call(() => this.api.updateRoleConflict(id, changes));
    this.patch(state => ({ roleConflicts: state.roleConflicts.map(item => item.id === id ? rule : item) }));
    await this.refreshActivity();
    return rule;
  }

  async deleteRoleConflict(id: string): Promise<void> {
    await this.call(() => this.api.deleteRoleConflict(id));
    this.patch(state => ({ roleConflicts: state.roleConflicts.filter(item => item.id !== id) }));
    await this.refreshActivity();
  }

  /* Users */

  async createUser(draft: UserDraft): Promise<User> {
    const user = await this.call(() => this.api.createUser(draft));
    this.patch(state => ({ users: [user, ...state.users] }));
    await this.refreshActivity();
    return user;
  }

  async createUsers(drafts: UserDraft[]): Promise<User[]> {
    const created = await this.call(() => this.api.createUsers(drafts));
    // Newest first, as the server lists them
    this.patch(state => ({ users: [...[...created].reverse(), ...state.users] }));
    await this.refreshActivity();
    return created;
  }

  async updateUser(id: string, changes: UserChanges): Promise<User> {
    const user = await this.call(() => this.api.updateUser(id, changes));
    this.patch(state => ({ users: state.users.map(item => item.id === id ? user : item) }));
    await this.refreshActivity();
    return user;
  }

  async setUserStatus(ids: string[], status: UserStatus, reason?: string): Promise<void> {
    const changed = await this.call(() => this.api.setUserStatus(ids, status, reason));
    const byId = new Map(changed.map(user => [user.id, user]));
    this.patch(state => ({ users: state.users.map(user => byId.get(user.id) ?? user) }));
    await this.refreshActivity();
  }

  /* Role assignments */

  async assignRole(draft: RoleAssignmentDraft): Promise<User> {
    return this.afterUserChange(await this.call(() => this.api.assignRole(draft)));
  }

  async updateRoleAssignment(id: string, changes: RoleAssignmentChanges): Promise<User> {
    return this.afterUserChange(await this.call(() => this.api.updateRoleAssignment(id, changes)));
  }

  async removeRoleAssignment(id: string, reason?: string): Promise<User> {
    return this.afterUserChange(await this.call(() => this.api.removeRoleAssignment(id, reason)));
  }

  /** Gives several people a role, or takes one away; answers with the people that changed */
  async assignRoles(userIds: string[], change: RoleAssignmentBatch): Promise<User[]> {
    const changed = await this.call(() => this.api.assignRoles(userIds, change));
    const byId = new Map(changed.map(user => [user.id, user]));
    this.patch(state => ({ users: state.users.map(user => byId.get(user.id) ?? user) }));
    await this.refreshActivity();
    return changed;
  }

  /**
   * Whether someone holds a role now or will hold it, for offering to give or take it: in any scope, or, given a branch
   * id or null (the whole organization), in that one
   */
  holdsOrWillHold(user: Pick<User, 'roles'>, roleId: string, branchId?: string | null): boolean {
    const now = this.state.now;
    return user.roles.some(item => item.roleId === roleId && (branchId === undefined || item.branchId === branchId)
      && roleAssignmentState(item, now) !== 'expired');
  }

  async deleteUsers(ids: string[], reason?: string): Promise<void> {
    await this.call(() => this.api.deleteUsers(ids, reason));
    this.patch(state => ({ users: state.users.filter(user => !ids.includes(user.id)) }));
    await this.refreshActivity();
  }

  async resetPassword(id: string, reason?: string): Promise<void> {
    await this.call(() => this.api.resetPassword(id, reason));
    await this.refreshActivity();
  }

  async resendInvite(id: string): Promise<void> {
    await this.call(() => this.api.resendInvite(id));
    await this.refreshActivity();
  }

  /* Branches */

  async createBranch(draft: BranchDraft): Promise<Branch> {
    const branch = await this.call(() => this.api.createBranch(draft));
    this.patch(state => ({ branches: [...state.branches, branch] }));
    await this.refreshActivity();
    return branch;
  }

  async updateBranch(id: string, changes: BranchChanges): Promise<Branch> {
    const branch = await this.call(() => this.api.updateBranch(id, changes));
    this.patch(state => ({ branches: state.branches.map(item => item.id === id ? branch : item) }));
    await this.refreshActivity();
    return branch;
  }

  async deleteBranch(id: string): Promise<void> {
    await this.call(() => this.api.deleteBranch(id));
    this.patch(state => ({ branches: state.branches.filter(branch => branch.id !== id) }));
    // Ended assignments limited to it are gone too
    const users = await this.call(() => this.api.listUsers());
    this.patch({ users });
    await this.refreshActivity();
  }

  /* Roles */

  async createRole(draft: RoleDraft): Promise<Role> {
    const role = await this.call(() => this.api.createRole(draft));
    this.patch(state => ({ roles: [...state.roles, role] }));
    await this.refreshActivity();
    return role;
  }

  async updateRole(id: string, changes: Partial<RoleDraft>): Promise<Role> {
    const role = await this.call(() => this.api.updateRole(id, changes));
    this.patch(state => ({ roles: state.roles.map(item => item.id === id ? role : item) }));
    await this.refreshActivity();
    return role;
  }

  async deleteRole(id: string): Promise<void> {
    await this.call(() => this.api.deleteRole(id));
    this.patch(state => ({ roles: state.roles.filter(role => role.id !== id) }));
    // The server took it off the conflicting-roles rules, and dropped those left with one role
    const roleConflicts = await this.call(() => this.api.listRoleConflicts());
    this.patch({ roleConflicts });
    await this.refreshActivity();
  }

  /* Access reviews */

  async startAccessReview(draft: AccessReviewDraft): Promise<AccessReview> {
    const review = await this.call(() => this.api.startAccessReview(draft));
    this.patch(state => ({ accessReviews: [review, ...state.accessReviews] }));
    await this.refreshActivity();
    return review;
  }

  /** A review's roles, as the signed-in user may see them; pages load them themselves, again on each revision */
  accessReviewItems(reviewId: string): Promise<AccessReviewItem[]> {
    return this.call(() => this.api.listAccessReviewItems(reviewId));
  }

  /** Keeps or removes each of these roles when the review closes; answers them as decided */
  async decideAccessReview(reviewId: string, itemIds: string[], decision: AccessReviewDecision, note?: string): Promise<AccessReviewItem[]> {
    const decided = await this.call(() => this.api.decideAccessReview(reviewId, itemIds, decision, note));
    // Its counts changed
    const accessReviews = await this.call(() => this.api.listAccessReviews());
    this.patch({ accessReviews });
    await this.refreshActivity().catch(() => undefined);
    return decided;
  }

  /** Closes it now: the roles decided 'remove' are taken away */
  async closeAccessReview(reviewId: string): Promise<AccessReview> {
    const review = await this.call(() => this.api.closeAccessReview(reviewId));
    this.patch(state => ({ accessReviews: state.accessReviews.map(item => item.id === reviewId ? review : item) }));
    const users = await this.call(() => this.api.listUsers());
    this.patch({ users });
    await this.refreshActivity();
    return review;
  }

  async deleteAccessReview(reviewId: string): Promise<void> {
    await this.call(() => this.api.deleteAccessReview(reviewId));
    this.patch(state => ({ accessReviews: state.accessReviews.filter(item => item.id !== reviewId) }));
    await this.refreshActivity();
  }

  /* Settings */

  async updateSettings(changes: Partial<AdminSettings>): Promise<AdminSettings> {
    const settings = await this.call(() => this.api.updateSettings(changes));
    this.patch({ settings });
    await this.refreshActivity();
    return settings;
  }

  /* Activity */

  /** A part of the activity log straight from the server, beyond what the pages keep loaded */
  activityBetween(range: ActivityRange): Promise<Activity[]> {
    return this.call(() => this.api.listActivity(range));
  }

  /** The activity log, as the server lists it now */
  setActivity(activity: Activity[]): void {
    this.patch({ activity });
  }

  /* Signed-in devices and two-step sign-in */

  listSessions(userId: string): Promise<UserSession[]> {
    return this.call(() => this.api.listSessions(userId));
  }

  async endSession(sessionId: string, reason?: string): Promise<void> {
    await this.call(() => this.api.endSession(sessionId, reason));
    await this.refreshActivity();
  }

  async endSessions(userId: string, reason?: string): Promise<void> {
    await this.call(() => this.api.endSessions(userId, reason));
    await this.refreshActivity();
  }

  startTwoFactor(): Promise<TwoFactorSetup> {
    return this.call(() => this.api.startTwoFactor());
  }

  /** On, with the first recovery codes, shown this once */
  async confirmTwoFactor(code: string): Promise<TwoFactorConfirmation> {
    const confirmed = await this.call(() => this.api.confirmTwoFactor(code));
    await this.afterUserChange(confirmed.user);
    return confirmed;
  }

  recoveryCodesLeft(): Promise<number> {
    return this.call(() => this.api.recoveryCodesLeft());
  }

  /** Ten new recovery codes, which replace the old ones */
  async createRecoveryCodes(): Promise<string[]> {
    const codes = await this.call(() => this.api.createRecoveryCodes());
    await this.refreshActivity().catch(() => undefined);
    return codes;
  }

  async disableTwoFactor(code: string): Promise<User> {
    // Refused with two_factor_mandatory when the role requires it: two-step sign-in stays on, nothing to set up
    return this.afterUserChange(await this.call(() => this.api.disableTwoFactor(code), false));
  }

  async resetTwoFactor(userId: string, reason?: string): Promise<User> {
    return this.afterUserChange(await this.call(() => this.api.resetTwoFactor(userId, reason)));
  }

  private async afterUserChange(user: User): Promise<User> {
    this.patch(state => ({ users: state.users.map(item => item.id === user.id ? user : item) }));
    await this.refreshActivity().catch(() => undefined);
    return user;
  }

  private async refreshActivity(): Promise<void> {
    const activity = await this.call(() => this.api.listActivity());
    this.patch({ activity });
  }

  /**
   * Runs a request, noting when it failed because the session has ended, or because two-step sign-in has to be set up
   * first (unless the request can only be refused for the other reason two_factor_mandatory has). A change refused
   * with reauth_required goes again, once, after the person confirms who they are.
   */
  private async call<T>(request: () => Promise<T>, setupMayBeRequired = true, reauthAsked = false): Promise<T> {
    try {
      const result = await request();
      // What the server answers is as of now: a role given a moment ago counts at once, not at the clock's next move
      this.patch({ now: Date.now() });
      return result;
    } catch (error) {
      if (error instanceof AdminApiError && error.code === 'unauthenticated') {
        this.patch({ sessionEnded: true });
      }
      if (setupMayBeRequired && error instanceof AdminApiError && error.code === 'two_factor_mandatory') {
        this.patch({ twoFactorSetupRequired: true });
      }
      if (!reauthAsked && error instanceof AdminApiError && error.code === 'reauth_required' && await this.askReauth()) {
        return this.call(request, setupMayBeRequired, true);
      }
      throw error;
    }
  }

  /** Waits for the person to confirm who they are, or give up; changes refused together wait for the same answer */
  private askReauth(): Promise<boolean> {
    this.reauthAnswer ??= new Promise<boolean>(resolve => {
      this.settleReauth = resolve;
      this.patch({ reauthRequested: true });
    });
    return this.reauthAnswer;
  }
}

/** The one store the app shares */
export const adminStore = new AdminStore();

/** A part of the store's state, in a component: it renders again when that part changes */
export function useAdminStore<T>(selector: (state: AdminState) => T): T {
  return useStore(adminStore.store, selector);
}

/** The store's state with its derived values, in a component, as the Angular app's AdminStore signals read */
export interface AdminView extends AdminState {
  usersById: Map<string, User>;
  rolesById: Map<string, Role>;
  branchesById: Map<string, Branch>;
  /** Branches are in use: turned on in the settings */
  branchesEnabled: boolean;
  openBranches: Branch[];
  accessReviewsWaiting: number;
  roleCounts: Map<string, number>;
  mainRoleCounts: Map<string, number>;
  roleConflictViolations: ReturnType<typeof roleConflictViolations>;
  branchCounts: Map<string, number>;
  activeRoles(user: Pick<User, 'roles'> | null | undefined): Role[];
  holdsOrWillHold(user: Pick<User, 'roles'>, roleId: string, branchId?: string | null): boolean;
  isEmailTaken(email: string, exceptId?: string): boolean;
}

export function adminView(state: AdminState): AdminView {
  return {
    ...state,
    usersById: selectUsersById(state),
    rolesById: selectRolesById(state),
    branchesById: selectBranchesById(state),
    branchesEnabled: state.settings.branchesEnabled,
    openBranches: selectOpenBranches(state),
    accessReviewsWaiting: selectAccessReviewsWaiting(state),
    roleCounts: selectRoleCounts(state),
    mainRoleCounts: selectMainRoleCounts(state),
    roleConflictViolations: selectRoleConflictViolations(state),
    branchCounts: selectBranchCounts(state),
    activeRoles: user => activeRolesOf(state, user),
    holdsOrWillHold: (user, roleId, branchId) => user.roles.some(item => item.roleId === roleId && (branchId === undefined || item.branchId === branchId)
      && roleAssignmentState(item, state.now) !== 'expired'),
    isEmailTaken: (email, exceptId) => {
      const value = email.trim().toLowerCase();
      return state.users.some(user => user.id !== exceptId && user.email.toLowerCase() === value);
    },
  };
}

/** The whole store, in a component: renders again on any change */
export function useAdmin(): AdminView {
  const state = useStore(adminStore.store);
  return useMemo(() => adminView(state), [state]);
}
