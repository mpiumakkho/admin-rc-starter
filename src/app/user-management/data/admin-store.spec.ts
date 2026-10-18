import { session } from '../access/session';
import { freshUserManagement } from '../testing';
import { AdminApiError } from './admin-api';
import { adminStore as store, selectRoleCounts, selectRolesById, selectUsersById } from './admin-store';
import { LocalAdminApi } from './local-admin-api';
import { DEMO_ACCOUNTS } from './mock-data';
import type { UserDraft } from './models';

const draft: UserDraft = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '0812345678',
  department: 'Engineering',
  roles: [{ roleId: 'viewer', endsAt: null }],
  status: 'active',
  avatar: '',
};

const ADMIN = DEMO_ACCOUNTS.find(account => account.roleId === 'admin')!.email;

describe('AdminStore', () => {
  beforeEach(async () => {
    freshUserManagement();
    await session.signIn(ADMIN, 'any-password', false);
  });

  it('loads the sample data after signing in', () => {
    expect(store.state.loaded).toBe(true);
    expect(store.state.users.length).toBe(48);
    expect(store.state.roles.length).toBe(14);
    expect(session.view.user?.email).toBe(ADMIN);
    expect(store.state.activity[0]).toMatchObject({ action: 'auth.sign_in', actorId: session.view.userId });
  });

  it('adds a user and records it in the activity log', async () => {
    const user = await store.createUser(draft);

    expect(store.state.users[0]).toEqual(user);
    // Newest first: the role it was given, after the user
    expect(store.state.activity[0]).toMatchObject({ action: 'role_assignment.added', targetId: user.id, changes: [{ field: 'roleId', to: 'viewer' }] });
    expect(store.state.activity[1]).toMatchObject({ action: 'user.created', targetId: user.id, actorId: session.view.userId });
    expect(store.isEmailTaken('ADA@example.com')).toBe(true);
    expect(store.isEmailTaken('ada@example.com', user.id)).toBe(false);
  });

  it('refuses an email another user has', async () => {
    const taken = store.state.users[1].email;

    await expect(store.createUser({ ...draft, email: taken })).rejects.toEqual(new AdminApiError('email_taken'));
    expect(store.state.users.length).toBe(48);
  });

  it('sends an invitation again, only to someone still invited', async () => {
    const invited = store.state.users.find(user => user.status === 'invited')!;
    const active = store.state.users.find(user => user.status === 'active' && user.id !== session.view.userId)!;

    await store.resendInvite(invited.id);

    expect(store.state.activity[0]).toMatchObject({ action: 'user.invited', targetId: invited.id, actorId: session.view.userId });
    await expect(store.resendInvite(active.id)).rejects.toEqual(new AdminApiError('not_invited'));
  });

  it('suspends users and only logs real changes', async () => {
    const [first, second] = store.state.users.filter(user => user.status === 'active' && user.id !== session.view.userId);
    const before = store.state.activity.length;

    await store.setUserStatus([first.id, second.id], 'suspended', 'On leave');
    await store.setUserStatus([first.id], 'suspended', 'On leave');

    expect(selectUsersById(store.state).get(first.id)?.status).toBe('suspended');
    expect(selectUsersById(store.state).get(second.id)?.status).toBe('suspended');
    expect(store.state.activity.length).toBe(before + 2);
  });

  it('keeps roles that are built in or still in use', async () => {
    await expect(store.deleteRole('admin')).rejects.toEqual(new AdminApiError('system_role'));
    expect(selectRoleCounts(store.state).get('support')).toBeGreaterThan(0);
    await expect(store.deleteRole('support')).rejects.toEqual(new AdminApiError('role_in_use'));
  });

  it('creates and deletes an unused role', async () => {
    const role = await store.createRole({ name: 'Auditor', description: '', tone: 'info', permissions: ['activity.view'] });
    expect(selectRolesById(store.state).get(role.id)?.system).toBe(false);

    await store.deleteRole(role.id);
    expect(selectRolesById(store.state).has(role.id)).toBe(false);
    expect(store.state.activity[0]).toMatchObject({ action: 'role.deleted', targetLabel: 'Auditor' });
  });

  it('logs which fields changed, and from where', async () => {
    const user = store.state.users.find(item => item.department !== 'Design')!;

    await store.updateUser(user.id, { department: 'Design', phone: user.phone });

    expect(store.state.activity[0]).toMatchObject({
      action: 'user.updated',
      ip: '127.0.0.1',
      changes: [{ field: 'department', from: user.department, to: 'Design' }],
    });
    expect(store.state.activity[0].browser).toBeTruthy();
  });

  it('logs permissions a role gained and lost', async () => {
    const support = selectRolesById(store.state).get('support')!;

    await store.updateRole('support', { permissions: [...support.permissions.filter(key => key !== 'users.edit'), 'users.create'] });

    expect(store.state.activity[0].changes).toEqual([{ field: 'permissions', added: ['users.create'], removed: ['users.edit'] }]);
  });

  it('sends a change refused with reauth_required again once the person confirms who they are', async () => {
    const [first, second] = store.state.users.filter(user => user.status === 'active' && user.id !== session.view.userId);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 10 * 60_000);

      // Given up: the change fails, and nothing waits any more
      const reset = store.resetPassword(first.id, 'Lost their phone');
      await vi.waitFor(() => expect(session.view.reauthRequested).toBe(true));
      session.cancelReauth();
      await expect(reset).rejects.toEqual(new AdminApiError('reauth_required'));
      expect(session.view.reauthRequested).toBe(false);

      // Confirmed: changes refused together go again, without the page sending them
      const deleted = store.deleteUsers([first.id], 'Left the company');
      const removed = store.removeRoleAssignment(second.roles[0].id, 'Moved team');
      await vi.waitFor(() => expect(session.view.reauthRequested).toBe(true));
      await expect(session.reauthenticate('nope')).rejects.toEqual(new AdminApiError('invalid_credentials'));
      expect(session.view.reauthRequested).toBe(true);
      await session.reauthenticate('any-password');
      await Promise.all([deleted, removed]);
      expect(selectUsersById(store.state).has(first.id)).toBe(false);
      expect(selectUsersById(store.state).get(second.id)?.roles.some(item => item.id === second.roles[0].id)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps changes for the next visit', async () => {
    const other = store.state.users.find(user => user.id !== session.view.userId)!;
    await store.deleteUsers([other.id], 'Left the company');

    const next = new LocalAdminApi();
    expect((await next.listUsers()).length).toBe(47);
  });
});
