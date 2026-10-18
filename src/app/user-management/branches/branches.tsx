import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { lucideBuilding2, lucideEllipsis, lucideMapPinned, lucideMapPinOff, lucidePencil, lucidePlus, lucideSearchX, lucideTrash2 } from '../../icons';
import { useSession } from '../access/session';
import { roleAssignmentState } from '../data/access-rules';
import { adminStore, useAdmin } from '../data/admin-store';
import type { Branch } from '../data/models';
import { errorMessage } from '../shared/errors';
import { useFormat } from '../shared/formatting';
import {
  cx, NgIcon, uiConfirm, uiTableClass, uiToast, useUiTableMinRows, useUiTableScrollReset, useUiTableState, UiAlert, UiBadge, UiButton, UiCard,
  UiDialog, UiEmptyState, UiFilterChips, UiFormField, UiLinkButton, UiMenu, UiMenuDivider, UiMenuItem, UiMenuTrigger, UiPageHeader, UiPageSize,
  UiPagination, UiSearchInput, UiSortHeader, type UiOption,
} from '../ui';
import './branches.scss';

/** A branch as the list shows it: with how many people belong to it and how many roles are limited to it now */
interface BranchRow {
  branch: Branch;
  people: number;
  roles: number;
}

type SortKey = 'name' | 'code' | 'people' | 'roles';
type StatusFilter = 'all' | 'open' | 'closed';

/** The table keeps the height of the smallest size, so a short page doesn't move the pagination */
const PAGE_SIZES = [10, 25, 50];

const SORTERS: Record<SortKey, (a: BranchRow, b: BranchRow) => number> = {
  name: (a, b) => a.branch.name.localeCompare(b.branch.name),
  code: (a, b) => a.branch.code.localeCompare(b.branch.code),
  people: (a, b) => a.people - b.people,
  roles: (a, b) => a.roles - b.roles,
};

/** Name or code, as typed */
function matchesSearch(row: BranchRow, query: string): boolean {
  return row.branch.name.toLowerCase().includes(query) || row.branch.code.toLowerCase().includes(query);
}

function rowId(row: BranchRow): string {
  return row.branch.id;
}

/**
 * The branches (sites, offices) people belong to and roles can be limited to, as Google Workspace's organizational
 * units. Everyone with branches.view sees the list; branches.manage adds, renames, closes and deletes them. A closed
 * branch keeps its people and their roles, but nobody new joins it; a branch in use cannot be deleted. The list
 * searches, filters by status, sorts and pages as the users list does, for an organization with many branches. Fills
 * the window on desktop (page-fit): a long list scrolls inside its card.
 */
export function BranchesComponent() {
  const store = useAdmin();
  const session = useSession();
  const { t } = useFormat();

  const canManage = session.can('branches.manage');

  /** Open ones first, then by name, until a column is sorted */
  const rows = useMemo<BranchRow[]>(() => {
    const scoped = new Map<string, number>();
    for (const user of store.users) {
      for (const item of user.roles) {
        if (item.branchId && roleAssignmentState(item, store.now) === 'active') {
          scoped.set(item.branchId, (scoped.get(item.branchId) ?? 0) + 1);
        }
      }
    }
    return [...store.branches]
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
      .map(branch => ({ branch, people: store.branchCounts.get(branch.id) ?? 0, roles: scoped.get(branch.id) ?? 0 }));
  }, [store.users, store.now, store.branches, store.branchCounts]);

  /* The list */

  const [status, setStatusFilter] = useState<StatusFilter>('all');
  const filter = useCallback((row: BranchRow) => status === 'all' || row.branch.active === (status === 'open'), [status]);

  const table = useUiTableState<BranchRow, SortKey>({
    rows,
    id: rowId,
    pageSize: PAGE_SIZES[0],
    pageSizeKey: 'branches-page-size',
    search: matchesSearch,
    filter,
    sorters: SORTERS,
  });

  /** Counted within the search, so each number is what the list shows after a click */
  const query = table.query.trim().toLowerCase();
  const searched = rows.filter(row => !query || matchesSearch(row, query));
  const openCount = searched.filter(row => row.branch.active).length;
  const statusOptions: UiOption<StatusFilter>[] = [
    { value: 'all', label: t('All'), count: searched.length },
    { value: 'open', label: t('Open'), count: openCount },
    { value: 'closed', label: t('Closed'), count: searched.length - openCount },
  ];

  const setStatus = (value: StatusFilter | null) => {
    setStatusFilter(value ?? 'all');
    table.resetPage();
  };

  const clearFilters = () => {
    table.search('');
    setStatusFilter('all');
  };

  /* Add and edit */

  const [editing, setEditing] = useState<Branch | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');

  const open = (branch: Branch | null) => {
    setEditing(branch);
    setCode(branch?.code ?? '');
    setName(branch?.name ?? '');
    setProblem('');
    setDialogOpen(true);
  };

  const save = async () => {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (!/^[A-Z0-9-]{1,10}$/.test(trimmedCode) || !trimmedName) {
      setProblem(!trimmedName ? 'This field is required.' : 'Use up to 10 letters, digits or dashes.');
      return;
    }
    setSaving(true);
    setProblem('');
    try {
      if (editing) {
        await adminStore.updateBranch(editing.id, { code: trimmedCode, name: trimmedName });
        uiToast.show(t('toast.branchSaved', { name: trimmedName }));
      } else {
        await adminStore.createBranch({ code: trimmedCode, name: trimmedName });
        uiToast.show(t('toast.branchAdded', { name: trimmedName }));
      }
      setDialogOpen(false);
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /* Close, reopen, delete */

  const setOpen = async (branch: Branch, active: boolean) => {
    try {
      await adminStore.updateBranch(branch.id, { active });
      uiToast.show(t(active ? 'toast.branchReopened' : 'toast.branchClosed', { name: branch.name }));
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    }
  };

  const remove = async (branch: Branch) => {
    const confirmed = await uiConfirm.ask({
      title: t('confirm.deleteBranch', { name: branch.name }),
      message: t('This cannot be undone.'),
      confirmLabel: t('Delete'),
      cancelLabel: t('Cancel'),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    try {
      await adminStore.deleteBranch(branch.id);
      uiToast.show(t('toast.branchDeleted', { name: branch.name }));
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    }
  };

  const scroll = useRef<HTMLDivElement>(null);
  useUiTableMinRows(scroll, PAGE_SIZES[0]);
  useUiTableScrollReset(scroll, table);

  return (
    <app-branches className="page-fit">
      <UiPageHeader title={t('Branches')} subtitle={t('Sites and offices people belong to.')} icon={lucideBuilding2} breadcrumbLabel={t('Breadcrumb')}
        breadcrumbs={[{ label: t('User management') }]}>
        {canManage && <UiButton type="button" onClick={() => open(null)}><NgIcon svg={lucidePlus} />{` ${t('Add branch')}`}</UiButton>}
      </UiPageHeader>

      {!store.branchesEnabled && (
        <UiAlert className="branches-note" tone="info" title={t('Branches are turned off')} actions={session.can('settings.manage') && (
          <UiLinkButton variant="secondary" size="sm" to="/settings">{t('Open the settings')}</UiLinkButton>
        )}>
          {` ${t('They do not show on the other pages until branches are turned on in the settings.')} `}
        </UiAlert>
      )}

      <UiCard flush fit>
        {rows.length > 0 && (
          <div className="toolbar">
            <UiSearchInput className="toolbar-search" size="sm" value={table.query} onValueChange={table.search} placeholder={t('Search name or code')}
              clearLabel={t('Clear search')} />
            <UiFilterChips className="toolbar-chips" scroll options={statusOptions} value={status} onValueChange={setStatus} ariaLabel={t('Status')} />
          </div>
        )}
        {table.total ? (
          <>
            <div className="ui-table-scroll" ref={scroll}>
              <table className={cx(uiTableClass(true), 'branches-table')}>
                <thead>
                  <tr>
                    <th><UiSortHeader table={table} sortKey="name">{t('Branch')}</UiSortHeader></th>
                    <th className="hide-sm"><UiSortHeader table={table} sortKey="code">{t('Code')}</UiSortHeader></th>
                    <th className="cell-number"><UiSortHeader table={table} sortKey="people">{t('People')}</UiSortHeader></th>
                    <th className="cell-number hide-md"><UiSortHeader table={table} sortKey="roles">{t('Roles given here')}</UiSortHeader></th>
                    <th>{t('Status')}</th>
                    {canManage && <th className="ui-cell-shrink"><span className="ui-sr-only">{t('Actions')}</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {table.pageRows.map(row => (
                    <tr key={row.branch.id} className={cx(!row.branch.active && 'branch-closed')}>
                      <td className="cell-name">
                        {` ${row.branch.name} `}
                        {/* Phones: the code under the name, in place of its column */}
                        <code className="branch-code name-code">{row.branch.code}</code>
                      </td>
                      <td className="hide-sm"><code className="branch-code">{row.branch.code}</code></td>
                      <td className="cell-number">
                        {row.people && session.canSomewhere('users.view') ? (
                          <Link className="count-link" to={`/users?branch=${encodeURIComponent(row.branch.id)}`}>
                            {row.people}<span className="ui-sr-only">{` ${t('people in')} ${row.branch.name}`}</span>
                          </Link>
                        ) : ` ${row.people} `}
                      </td>
                      <td className="cell-number hide-md">{row.roles}</td>
                      <td>
                        <UiBadge tone={row.branch.active ? 'success' : 'neutral'} dot>{t(row.branch.active ? 'Open' : 'Closed')}</UiBadge>
                      </td>
                      {canManage && (
                        <td className="ui-cell-shrink">
                          <UiMenuTrigger menu={
                            <UiMenu>
                              <UiMenuItem icon={lucidePencil} onTriggered={() => open(row.branch)}>{t('Edit')}</UiMenuItem>
                              {row.branch.active
                                ? <UiMenuItem icon={lucideMapPinOff} onTriggered={() => void setOpen(row.branch, false)}>{t('Close branch')}</UiMenuItem>
                                : <UiMenuItem icon={lucideMapPinned} onTriggered={() => void setOpen(row.branch, true)}>{t('Reopen branch')}</UiMenuItem>}
                              <UiMenuDivider />
                              <UiMenuItem tone="danger" icon={lucideTrash2} onTriggered={() => void remove(row.branch)}>{t('Delete')}</UiMenuItem>
                            </UiMenu>
                          }>
                            <UiButton variant="ghost" size="sm" iconOnly type="button" aria-label={t('actionsFor', { name: row.branch.name })}>
                              <NgIcon svg={lucideEllipsis} />
                            </UiButton>
                          </UiMenuTrigger>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <UiPageSize table={table} sizes={PAGE_SIZES} label={t('rangeOf', table.range)} heading={t('Rows per page')} />
              <UiPagination ariaLabel={t('Pagination')} page={table.currentPage} onPageChange={table.setPage} pageCount={table.pageCount}
                firstLabel={t('First page')} previousLabel={t('Previous page')} nextLabel={t('Next page')} lastLabel={t('Last page')} />
            </div>
          </>
        ) : rows.length ? (
          <UiEmptyState icon={lucideSearchX} title={t('No branches found')} description={t('Try another search or clear the filters.')}>
            <UiButton variant="secondary" type="button" onClick={clearFilters}>{t('Clear filters')}</UiButton>
          </UiEmptyState>
        ) : (
          <UiEmptyState icon={lucideBuilding2} title={t('No branches yet')} description={t('Add the sites or offices people work at.')}>
            {canManage && <UiButton type="button" onClick={() => open(null)}>{t('Add branch')}</UiButton>}
          </UiEmptyState>
        )}
      </UiCard>

      <UiDialog open={dialogOpen} onOpenChange={setDialogOpen} title={t(editing ? 'Edit branch' : 'Add branch')} closeLabel={t('Close')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => setDialogOpen(false)}>{t('Cancel')}</UiButton>
          <UiButton type="submit" form="branchForm" loading={saving}>{t(editing ? 'Save changes' : 'Add branch')}</UiButton>
        </>}>
        <form className="branch-form" id="branchForm" onSubmit={event => { event.preventDefault(); void save(); }} noValidate>
          <UiFormField label={t('Name')} for="branchName" required>
            <input className="ui-input" id="branchName" name="name" value={name} onChange={event => setName(event.target.value)} maxLength={100} autoComplete="off" />
          </UiFormField>
          <UiFormField label={t('Code')} for="branchCode" required hint={t('A short code, such as CNX: up to 10 letters, digits or dashes.')}>
            <input className="ui-input code-input" id="branchCode" name="code" value={code} onChange={event => setCode(event.target.value)} maxLength={10} autoComplete="off" />
          </UiFormField>
          {problem && <p className="branch-problem" role="alert">{t(problem)}</p>}
        </form>
      </UiDialog>
    </app-branches>
  );
}
