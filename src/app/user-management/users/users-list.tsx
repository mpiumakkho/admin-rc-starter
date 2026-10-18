import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
  lucideBan, lucideEllipsis, lucideEye, lucideKeyRound, lucidePencil, lucideSearchX, lucideShield, lucideShieldMinus, lucideTrash2, lucideUpload,
  lucideUserCheck, lucideUserPlus, lucideUsers,
} from '../../icons';
import { useSession } from '../access/session';
import { activeRoleIds, roleAssignmentState } from '../data/access-rules';
import { adminStore, useAdmin } from '../data/admin-store';
import { STATUS_META } from '../data/catalog';
import { fullName, type User, type UserStatus } from '../data/models';
import { RoleBadges, StatusBadge } from '../shared/badges';
import { errorMessage } from '../shared/errors';
import { ExportMenu } from '../shared/export-menu';
import { useFormat } from '../shared/formatting';
import { reasonPrompt } from '../shared/reason-prompt';
import type { TableExport } from '../shared/table-export';
import {
  cx, NgIcon, uiTableClass, uiToast, useUiTableMinRows, useUiTableScrollReset, useUiTableState, UiBulkBar, UiButton, UiCard, UiCheckbox,
  UiEmptyState, UiFilterChips, UiLinkButton, UiMenu, UiMenuDivider, UiMenuItem, UiMenuTrigger, UiPageHeader, UiPageSize, UiPagination, UiPerson,
  UiSearchInput, UiSortHeader, type UiOption,
} from '../ui';
import { ImportUsersDialog } from './import-users-dialog';
import { RemoveRoleDialog } from './remove-role-dialog';
import { RoleAssignmentDialog } from './role-assignment-dialog';
import './users-list.scss';

type SortKey = 'name' | 'role' | 'department' | 'branch' | 'lastActive' | 'created';

/** The role filter's value for everyone who holds a role for a time, or will; ?role=temporary */
const TEMPORARY = 'temporary';
/** The branch filter's value for people who belong to no branch; ?branch=none */
const NO_BRANCH = 'none';

/** The table keeps the height of the smallest size, so a short page doesn't move the pagination */
const PAGE_SIZES = [10, 25, 50, 100];

/** ?sort=joined or ?sort=active, newest first */
const SORTS: Record<string, SortKey> = { joined: 'created', active: 'lastActive' };

/**
 * Everyone who can sign in. Fills the window on desktop (page-fit); the table scrolls inside when a page has more rows
 * than fit.
 */
export function UsersListComponent() {
  const store = useAdmin();
  const session = useSession();
  const f = useFormat();
  const { t } = f;
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [importing, setImporting] = useState(false);
  const [givingRole, setGivingRole] = useState(false);
  const [takingRole, setTakingRole] = useState(false);
  const [busy, setBusy] = useState(false);

  /* What the signed-in user's role allows here */

  /** For the whole organization, or through a branch for its people (API.md, "Branch administrators") */
  const canEdit = session.canSomewhere('users.edit');
  const canDelete = session.can('users.delete');
  /** Rows have checkboxes only when there is something to do with a selection */
  const canSelect = canEdit || canDelete;
  const canCreate = session.canSomewhere('users.create');

  /** Why a row cannot be ticked, as a tooltip; empty when it can */
  const lockReason = (user: User): string => {
    if (session.isSelf(user)) {
      return 'You cannot change your own account from the list.';
    }
    if (session.canManage(user)) {
      return '';
    }
    return session.allows('users.edit', user.branchId ?? null) || session.allows('users.delete', user.branchId ?? null)
      ? 'Their role has permissions yours does not, so you cannot change them.'
      : 'They are not in a branch you look after.';
  };

  /* Filters */

  const [status, setStatusFilter] = useState<UserStatus | 'all'>('all');
  /** A role id, all, or everyone who holds a role for a time (or will) */
  const [roleFilter, setRoleFilter] = useState('all');
  /** A branch id, all, or none */
  const [branchFilter, setBranchFilter] = useState('all');

  const branchName = useCallback((branchId: string | null) => branchId ? store.branchesById.get(branchId)?.name ?? '' : '', [store.branchesById]);

  /** Whether someone matches the branch filter; with branches turned off, everyone does */
  const inBranch = useCallback((user: User, filter: string) => filter === 'all' || !store.branchesEnabled
    || (filter === NO_BRANCH ? !user.branchId : user.branchId === filter), [store.branchesEnabled]);

  /** Whether someone matches the role filter */
  const holds = useCallback((user: User, filter: string) => {
    const now = store.now;
    if (filter === TEMPORARY) {
      return user.roles.some(item => roleAssignmentState(item, now) !== 'expired' && (item.endsAt !== null || roleAssignmentState(item, now) === 'scheduled'));
    }
    return filter === 'all' || activeRoleIds(user, now).includes(filter);
  }, [store.now]);

  const selectable = useCallback((user: User) => canSelect && session.canManage(user) && !session.isSelf(user), [canSelect, session]);
  const filter = useCallback((user: User) => (status === 'all' || user.status === status) && holds(user, roleFilter) && inBranch(user, branchFilter),
    [status, roleFilter, branchFilter, holds, inBranch]);
  const sorters = useMemo<Partial<Record<SortKey, (a: User, b: User) => number>>>(() => ({
    name: (a, b) => fullName(a).localeCompare(fullName(b)),
    // By the role each is named by: the one with most permissions
    role: (a, b) => (store.activeRoles(a)[0]?.name ?? '').localeCompare(store.activeRoles(b)[0]?.name ?? ''),
    department: (a, b) => a.department.localeCompare(b.department),
    branch: (a, b) => branchName(a.branchId).localeCompare(branchName(b.branchId)),
    // Never signed in sorts as the oldest
    lastActive: (a, b) => (a.lastActiveAt ?? '').localeCompare(b.lastActiveAt ?? ''),
    created: (a, b) => a.createdAt.localeCompare(b.createdAt),
  }), [store, branchName]);

  const table = useUiTableState<User, SortKey>({
    rows: store.users,
    id: userId,
    // People the reader may change, other than themselves
    selectable,
    pageSize: PAGE_SIZES[0],
    pageSizeKey: 'users-page-size',
    search: matchesSearch,
    filter,
    sorters,
  });

  /** Counted within the search and the role picked, so each number is what the list shows after a click */
  const statusOptions = useMemo<UiOption<UserStatus | 'all'>[]>(() => {
    const query = table.query.trim().toLowerCase();
    const users = store.users.filter(user => holds(user, roleFilter) && inBranch(user, branchFilter) && (!query || matchesSearch(user, query)));
    return [
      { value: 'all', label: t('All'), count: users.length },
      ...(Object.keys(STATUS_META) as UserStatus[]).map(value => ({
        value,
        label: t(STATUS_META[value].label),
        count: users.filter(user => user.status === value).length,
      })),
    ];
  }, [store.users, table.query, roleFilter, branchFilter, holds, inBranch, t]);

  const hasFilters = !!table.query || status !== 'all' || roleFilter !== 'all' || branchFilter !== 'all';

  // ?q=… from the navbar search: on arrival, and when searching again from the navbar while this page is open
  const q = params.get('q');
  useLayoutEffect(() => {
    table.search(q ?? '');
  }, [q]);

  // ?status=…, ?role=… and ?branch=…, from the overview's cards and the branches page
  const statusParam = params.get('status');
  const roleParam = params.get('role');
  const branchParam = params.get('branch');
  useLayoutEffect(() => {
    setStatusFilter(statusParam && statusParam in STATUS_META ? statusParam as UserStatus : 'all');
    setRoleFilter(roleParam && (roleParam === TEMPORARY || store.rolesById.has(roleParam)) ? roleParam : 'all');
    setBranchFilter(branchParam && (branchParam === NO_BRANCH || store.branchesById.has(branchParam)) ? branchParam : 'all');
    table.resetPage();
  }, [statusParam, roleParam, branchParam]);

  // ?sort=joined or ?sort=active (newest first), from the overview's cards
  const sortParam = params.get('sort');
  useLayoutEffect(() => {
    const key = SORTS[sortParam ?? ''];
    if (key) {
      table.setSort(key, 'desc');
    }
  }, [sortParam]);

  const setStatus = (value: UserStatus | 'all' | null) => {
    setStatusFilter(value ?? 'all');
    table.resetPage();
  };

  const setRole = (value: string) => {
    setRoleFilter(value);
    table.resetPage();
  };

  const setBranch = (value: string) => {
    setBranchFilter(value);
    table.resetPage();
  };

  const clearFilters = () => {
    table.search('');
    setStatusFilter('all');
    setRoleFilter('all');
    setBranchFilter('all');
  };

  const open = (user: User) => void navigate(`/users/${user.id}`);

  /* Actions */

  const showError = (error: unknown) => uiToast.show(t(errorMessage(error)), 'error');

  const setStatusFor = async (users: User[], next: UserStatus) => {
    const suspend = next === 'suspended';
    const one = users.length === 1;
    const reason = await reasonPrompt.ask('status', {
      title: one
        ? t(suspend ? 'confirm.suspendUser' : 'confirm.activateUser', { name: fullName(users[0]) })
        : t(suspend ? 'confirm.suspendUsers' : 'confirm.activateUsers', { count: users.length }),
      message: t(suspend ? 'They are signed out and cannot sign in until reactivated.' : 'They can sign in again.'),
      confirmLabel: t(suspend ? 'Suspend' : 'Activate'),
      tone: suspend ? 'danger' : 'primary',
    }, true);
    if (reason === null) {
      return;
    }
    setBusy(true);
    try {
      await adminStore.setUserStatus(users.map(user => user.id), next, reason || undefined);
      uiToast.show(t(suspend ? 'toast.suspended' : 'toast.activated', { count: users.length }));
      table.clearSelection();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (user: User) => {
    const reason = await reasonPrompt.ask('resetSignIn', {
      title: t('confirm.resetPassword', { name: fullName(user) }),
      message: t('Their password stops working and they get an email to set a new one.'),
      confirmLabel: t('Reset password'),
      tone: 'danger',
    }, true);
    if (reason === null) {
      return;
    }
    try {
      await adminStore.resetPassword(user.id, reason || undefined);
      uiToast.show(t('toast.passwordReset', { email: user.email }), 'info');
    } catch (error) {
      showError(error);
    }
  };

  const remove = async (users: User[]) => {
    if (users.some(user => session.isSelf(user))) {
      uiToast.show(t('You cannot delete your own account.'), 'error');
      return;
    }
    const reason = await reasonPrompt.ask('delete', {
      title: users.length === 1 ? t('confirm.deleteUser', { name: fullName(users[0]) }) : t('confirm.deleteUsers', { count: users.length }),
      message: t('They lose access right away. This cannot be undone.'),
      confirmLabel: t('Delete'),
      tone: 'danger',
    });
    if (reason === null) {
      return;
    }
    setBusy(true);
    try {
      await adminStore.deleteUsers(users.map(user => user.id), reason || undefined);
      uiToast.show(t('toast.deleted', { count: users.length }));
      table.clearSelection();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  /** The filtered list, in the order shown, for the Export menu */
  const exportTable = (): TableExport => {
    const users = table.sorted;
    // The roles held now, separated as an import file takes them
    const roleNames = (user: User) => store.activeRoles(user).map(role => role.name).join('; ');
    // With branches on, the branch after the department, by name on screen and by code in the file to import again
    const branches = store.branchesEnabled;
    const branchCode = (user: User) => user.branchId ? store.branchesById.get(user.branchId)?.code ?? '' : '';
    return {
      fileName: 'users',
      title: t('Users'),
      columns: [
        { header: t('First name') }, { header: t('Last name') }, { header: t('Email') }, { header: t('Phone') },
        { header: t('Department') }, ...(branches ? [{ header: t('Branch') }] : []), { header: t('Roles') },
        { header: t('Status') }, { header: t('Joined'), date: 'day' }, { header: t('Last active'), date: 'time' },
      ],
      rows: users.map(user => [
        user.firstName, user.lastName, user.email, user.phone, t(user.department), ...(branches ? [branchName(user.branchId)] : []),
        roleNames(user), t(STATUS_META[user.status].label), new Date(user.createdAt), user.lastActiveAt ? new Date(user.lastActiveAt) : null,
      ]),
      // The same first columns as an import file, so an export can be edited and imported elsewhere
      csv: [
        ['First name', 'Last name', 'Email', 'Phone', 'Department', ...(branches ? ['Branch'] : []), 'Roles', 'Status', 'Joined', 'Last active'],
        ...users.map(user => [
          user.firstName, user.lastName, user.email, user.phone, user.department, ...(branches ? [branchCode(user)] : []), roleNames(user),
          user.status, user.createdAt.slice(0, 10), user.lastActiveAt?.slice(0, 10) ?? '',
        ]),
      ],
    };
  };

  const scroll = useRef<HTMLDivElement>(null);
  useUiTableMinRows(scroll, PAGE_SIZES[0]);
  useUiTableScrollReset(scroll, table);

  const selected = table.selectedRows;

  return (
    <app-users-list className="page-fit">
      <UiPageHeader title={t('Users')} subtitle={t('Everyone who can sign in to the admin.')} icon={lucideUsers} breadcrumbLabel={t('Breadcrumb')}
        breadcrumbs={[{ label: t('User management') }]}>
        <ExportMenu source={exportTable} />
        {canCreate && (
          <>
            <UiButton variant="secondary" type="button" onClick={() => setImporting(true)}><NgIcon svg={lucideUpload} />{` ${t('Import')}`}</UiButton>
            <UiLinkButton to="/users/new"><NgIcon svg={lucideUserPlus} />{` ${t('Add user')}`}</UiLinkButton>
          </>
        )}
      </UiPageHeader>

      {canCreate && <ImportUsersDialog open={importing} onOpenChange={setImporting} />}
      {canEdit && (
        <>
          <RoleAssignmentDialog users={selected} open={givingRole} onOpenChange={setGivingRole} onDone={table.clearSelection} />
          <RemoveRoleDialog users={selected} open={takingRole} onOpenChange={setTakingRole} onDone={table.clearSelection} />
        </>
      )}

      <UiCard flush fit>
        <div className="toolbar">
          <UiSearchInput className="toolbar-search" size="sm" value={table.query} onValueChange={table.search}
            placeholder={t('Search name, email or phone')} clearLabel={t('Clear search')} />
          <select className="ui-input ui-input-sm toolbar-role" value={roleFilter} onChange={event => setRole(event.target.value)} aria-label={t('Role')}>
            <option value="all">{t('All roles')}</option>
            <option value={TEMPORARY}>{t('A role for a time')}</option>
            {store.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          {store.branchesEnabled && (
            <select className="ui-input ui-input-sm toolbar-branch" value={branchFilter} onChange={event => setBranch(event.target.value)}
              aria-label={t('Branch')}>
              <option value="all">{t('All branches')}</option>
              {store.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              <option value={NO_BRANCH}>{t('No branch')}</option>
            </select>
          )}
          <UiFilterChips className="toolbar-chips" scroll options={statusOptions} value={status} onValueChange={setStatus} ariaLabel={t('Status')} />
        </div>

        {table.selectedIds.size > 0 && (
          <UiBulkBar label={t('selectedCount', { count: table.selectedIds.size })} clearLabel={t('Clear')} onCleared={table.clearSelection}>
            {canEdit && (
              <>
                <UiButton size="sm" variant="secondary" type="button" disabled={busy} onClick={() => void setStatusFor(selected, 'active')}>
                  <NgIcon svg={lucideUserCheck} />{` ${t('Activate')}`}
                </UiButton>
                <UiButton size="sm" variant="secondary" type="button" disabled={busy} onClick={() => void setStatusFor(selected, 'suspended')}>
                  <NgIcon svg={lucideBan} />{` ${t('Suspend')}`}
                </UiButton>
                <UiButton size="sm" variant="secondary" type="button" disabled={busy} onClick={() => setGivingRole(true)}>
                  <NgIcon svg={lucideShield} />{` ${t('Give role')}`}
                </UiButton>
                <UiButton size="sm" variant="secondary" type="button" disabled={busy} onClick={() => setTakingRole(true)}>
                  <NgIcon svg={lucideShieldMinus} />{` ${t('Take role away')}`}
                </UiButton>
              </>
            )}
            {canDelete && (
              <UiButton size="sm" variant="danger-soft" type="button" disabled={busy} onClick={() => void remove(selected)}>
                <NgIcon svg={lucideTrash2} />{` ${t('Delete')}`}
              </UiButton>
            )}
          </UiBulkBar>
        )}

        {table.total ? (
          <>
            <div className="ui-table-scroll" ref={scroll}>
              <table className={cx(uiTableClass(true), 'users-table')}>
                <thead>
                  <tr>
                    {canSelect && (
                      <th className="ui-cell-shrink">
                        <UiCheckbox checked={table.allOnPageSelected} indeterminate={table.someOnPageSelected} disabled={!table.pageHasSelectable}
                          onCheckedChange={() => table.togglePage()} ariaLabel={t('Select all on this page')} />
                      </th>
                    )}
                    <th><UiSortHeader table={table} sortKey="name">{t('User')}</UiSortHeader></th>
                    <th><UiSortHeader table={table} sortKey="role">{t('Roles')}</UiSortHeader></th>
                    <th className="hide-md"><UiSortHeader table={table} sortKey="department">{t('Department')}</UiSortHeader></th>
                    {store.branchesEnabled && <th className="hide-lg"><UiSortHeader table={table} sortKey="branch">{t('Branch')}</UiSortHeader></th>}
                    <th>{t('Status')}</th>
                    <th className="hide-lg"><UiSortHeader table={table} sortKey="lastActive">{t('Last active')}</UiSortHeader></th>
                    <th className="hide-lg"><UiSortHeader table={table} sortKey="created">{t('Joined')}</UiSortHeader></th>
                    <th className="ui-cell-shrink"><span className="ui-sr-only">{t('Actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {table.pageRows.map(user => {
                    const lock = canSelect ? lockReason(user) : '';
                    return (
                      <tr key={user.id} className={cx('ui-row-link', table.isSelected(user) && 'ui-row-selected')} onClick={() => open(user)}>
                        {canSelect && (
                          <td className="ui-cell-shrink cell-check" onClick={event => event.stopPropagation()} title={lock ? t(lock) : ''}>
                            <UiCheckbox checked={table.isSelected(user)} disabled={!table.isSelectable(user)} onCheckedChange={() => table.toggle(user)}
                              ariaLabel={t('selectUser', { name: fullName(user) })} />
                          </td>
                        )}
                        <td className="cell-person">
                          <UiPerson name={fullName(user)} detail={user.email} src={user.avatar}>
                            {session.isSelf(user) && <span className="you">{t('You')}</span>}
                          </UiPerson>
                        </td>
                        <td className="cell-role"><RoleBadges user={user} /></td>
                        <td className="hide-md muted">{t(user.department)}</td>
                        {store.branchesEnabled && <td className="hide-lg muted">{branchName(user.branchId) || '—'}</td>}
                        <td className="cell-status"><StatusBadge status={user.status} /></td>
                        <td className="hide-lg muted">{f.timeAgo(user.lastActiveAt, t('Never'))}</td>
                        <td className="hide-lg muted">{f.localDate(user.createdAt)}</td>
                        <td className="ui-cell-shrink cell-actions" onClick={event => event.stopPropagation()}>
                          <UiMenuTrigger menu={
                            <UiMenu>
                              <UiMenuItem icon={lucideEye} onTriggered={() => open(user)}>{t('View profile')}</UiMenuItem>
                              {session.canEditProfile(user) && (
                                <UiMenuItem icon={lucidePencil} to={`/users/${user.id}/edit`}>
                                  {t('Edit')}<span className="ui-sr-only">{` ${fullName(user)}`}</span>
                                </UiMenuItem>
                              )}
                              {/* Status and password reset are for other people; your own password is in the account menu */}
                              {session.canOn('users.edit', user) && !session.isSelf(user) && (
                                <>
                                  {user.status === 'suspended'
                                    ? <UiMenuItem icon={lucideUserCheck} onTriggered={() => void setStatusFor([user], 'active')}>{t('Activate')}</UiMenuItem>
                                    : <UiMenuItem icon={lucideBan} onTriggered={() => void setStatusFor([user], 'suspended')}>{t('Suspend')}</UiMenuItem>}
                                  <UiMenuItem icon={lucideKeyRound} onTriggered={() => void resetPassword(user)}>{t('Reset password')}</UiMenuItem>
                                </>
                              )}
                              {session.canOn('users.delete', user) && !session.isSelf(user) && (
                                <>
                                  <UiMenuDivider />
                                  <UiMenuItem tone="danger" icon={lucideTrash2} onTriggered={() => void remove([user])}>{t('Delete')}</UiMenuItem>
                                </>
                              )}
                            </UiMenu>
                          }>
                            <UiButton variant="ghost" size="sm" iconOnly type="button" aria-label={t('actionsFor', { name: fullName(user) })}>
                              <NgIcon svg={lucideEllipsis} />
                            </UiButton>
                          </UiMenuTrigger>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <UiPageSize table={table} sizes={PAGE_SIZES} label={t('rangeOf', table.range)} heading={t('Rows per page')} />
              <UiPagination ariaLabel={t('Pagination')} page={table.currentPage} onPageChange={table.setPage} pageCount={table.pageCount}
                firstLabel={t('First page')} previousLabel={t('Previous page')} nextLabel={t('Next page')} lastLabel={t('Last page')} />
            </div>
          </>
        ) : (
          <UiEmptyState icon={lucideSearchX} title={t('No users found')}
            description={t(hasFilters ? 'Try another search or clear the filters.' : 'Add the first user to get started.')}>
            {hasFilters
              ? <UiButton variant="secondary" type="button" onClick={clearFilters}>{t('Clear filters')}</UiButton>
              : canCreate && <UiLinkButton to="/users/new">{t('Add user')}</UiLinkButton>}
          </UiEmptyState>
        )}
      </UiCard>
    </app-users-list>
  );
}

function userId(user: User): string {
  return user.id;
}

/** Name, email or phone, as the search box says; the query is already lower case */
function matchesSearch(user: User, query: string): boolean {
  return fullName(user).toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || user.phone.includes(query);
}
