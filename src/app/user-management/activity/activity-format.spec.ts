import { session } from '../access/session';
import { adminStore, adminView } from '../data/admin-store';
import { describeBrowser } from '../data/local-admin-api';
import { DEMO_ACCOUNTS } from '../data/mock-data';
import type { Activity } from '../data/models';
import { freshUserManagement } from '../testing';
import { ActivityFormat } from './activity-format';

// No translations are used, so the text below is the translation keys themselves
const entry = (changes: Activity['changes'], action: Activity['action'] = 'user.updated'): Activity => ({
  id: 'a-1', at: new Date().toISOString(), actorId: 'u-001', action, targetLabel: 'Jane Doe', targetId: 'u-002',
  ip: '10.0.0.1', browser: 'Chrome', os: 'Windows', changes,
});

describe('ActivityFormat', () => {
  let format: ActivityFormat;

  beforeEach(async () => {
    freshUserManagement();
    await session.signIn(DEMO_ACCOUNTS[0].email, 'any-password', false);
    format = new ActivityFormat(adminView(adminStore.state), key => key, 'en');
  });

  it('shows values as people read them', () => {
    expect(format.summary(entry([{ field: 'roleId', from: 'viewer', to: 'manager' }]))).toBe('Role: Viewer → Manager');
    expect(format.summary(entry([{ field: 'status', from: 'active', to: 'suspended' }]))).toBe('Status: Active → Suspended');
  });

  it('names a few permissions and counts many', () => {
    expect(format.summary(entry([{ field: 'permissions', added: ['users.view'], removed: [] }], 'role.updated')))
      .toBe('Permissions: +View users');
    expect(format.summary(entry([{ field: 'permissions', added: ['users.view', 'users.edit', 'roles.view'], removed: ['activity.view'] }], 'role.updated')))
      .toBe('Permissions: +3 −1');
  });

  it('shows two changes and counts the rest', () => {
    const summary = format.summary(entry([
      { field: 'roleId', to: 'viewer' }, { field: 'department', to: 'Sales' }, { field: 'email', to: 'jane@example.com' },
    ], 'user.created'));
    expect(summary).toBe('Role: Viewer · Department: Sales · +1');
  });

  it('links to targets that still exist', () => {
    expect(format.target(entry(undefined))).toEqual({ link: ['/users', 'u-002'] });
    expect(format.target({ ...entry(undefined), targetId: 'u-gone' })).toBeNull();
    expect(format.target({ ...entry(undefined, 'role.updated'), targetId: 'support' })).toEqual({ link: ['/roles'], queryParams: { role: 'support' } });
  });
});

describe('describeBrowser', () => {
  it('tells browsers and systems apart', () => {
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0'))
      .toEqual({ browser: 'Edge', os: 'Windows' });
    expect(describeBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'))
      .toEqual({ browser: 'Safari', os: 'iOS' });
    expect(describeBrowser('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36'))
      .toEqual({ browser: 'Chrome', os: 'Android' });
  });
});
