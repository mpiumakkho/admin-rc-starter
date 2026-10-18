import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { lucideCheck, lucideClipboardCheck, lucideEllipsis, lucideSearchX, lucideTrash2, lucideX } from '../../icons';
import { useSession } from '../access/session';
import { adminStore, useAdmin } from '../data/admin-store';
import { REVIEW_DECISIONS, REVIEW_OUTCOMES } from '../data/catalog';
import { fullName, type AccessReviewDecision, type AccessReviewItem, type AccessReviewOutcome } from '../data/models';
import { RoleBadge } from '../shared/badges';
import { errorMessage } from '../shared/errors';
import { ExportMenu } from '../shared/export-menu';
import { localDate, localName, useFormat } from '../shared/formatting';
import { reasonPrompt } from '../shared/reason-prompt';
import type { TableExport } from '../shared/table-export';
import {
  cx, NgIcon, uiConfirm, uiTableClass, uiToast, useUiTableMinRows, useUiTableScrollReset, useUiTableState, UiBadge, UiBulkBar, UiButton, UiCard,
  UiCheckbox, UiEmptyState, UiFilterChips, UiLinkButton, UiMenu, UiMenuItem, UiMenuTrigger, UiPageHeader, UiPageSize, UiPagination, UiPerson,
  UiSearchInput, UiSortHeader, type UiOption,
} from '../ui';
import './access-review.scss';
import { reviewScope } from './review-text';

type SortKey = 'person' | 'role' | 'since' | 'decision';
/** What the list shows: everything, what waits for the signed-in user, a decision, or, once closed, an outcome */
type ItemFilter = 'all' | 'mine' | 'undecided' | AccessReviewDecision | AccessReviewOutcome;

/** As the users list; the table keeps the height of the smallest size, so a short page doesn't move the pagination */
const PAGE_SIZES = [10, 25, 50, 100];

const SORTERS: Record<SortKey, (a: AccessReviewItem, b: AccessReviewItem) => number> = {
  person: (a, b) => a.userName.localeCompare(b.userName),
  role: (a, b) => a.roleName.localeCompare(b.roleName),
  since: (a, b) => a.startsAt.localeCompare(b.startsAt),
  decision: (a, b) => (a.decision ?? '').localeCompare(b.decision ?? ''),
};

const itemId = (item: AccessReviewItem) => item.id;
const canDecide = (item: AccessReviewItem) => item.canDecide;
const matchesSearch = (item: AccessReviewItem, query: string) => item.userName.toLowerCase().includes(query)
  || item.email.toLowerCase().includes(query) || item.roleName.toLowerCase().includes(query);

function countsOf(items: AccessReviewItem[]) {
  const count = (test: (item: AccessReviewItem) => boolean) => items.filter(test).length;
  return {
    all: items.length,
    mine: count(item => item.canDecide && !item.decision),
    undecided: count(item => !item.decision),
    keep: count(item => item.decision === 'keep'),
    remove: count(item => item.decision === 'remove'),
    kept: count(item => item.outcome === 'kept'),
    removed: count(item => item.outcome === 'removed'),
    not_reviewed: count(item => item.outcome === 'not_reviewed'),
    gone: count(item => item.outcome === 'gone'),
    last_administrator: count(item => item.outcome === 'last_administrator'),
  };
}

/**
 * One access review (API.md, "Access reviews"): each role it covers, with Keep and Remove for the ones the signed-in
 * user may decide. Nothing changes until it closes, on its due date or when someone with reviews.manage closes it; the
 * roles decided Remove are then taken away. The list exports as the report an auditor asks for. Fills the window on
 * desktop (page-fit); the table scrolls inside its card.
 */
export function AccessReviewComponent() {
  const store = useAdmin();
  const session = useSession();
  const f = useFormat();
  const { t } = f;
  const navigate = useNavigate();
  /** From the address: /access-reviews/:id */
  const id = useParams()['id'] ?? '';

  const review = store.accessReviews.find(item => item.id === id) ?? null;
  const [items, setItems] = useState<AccessReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** Why the roles could not be loaded; empty when they were */
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  const canManage = session.can('reviews.manage');
  const isOpen = review?.status === 'open';
  /** Rows have checkboxes when some of them are the signed-in user's to decide */
  const canSelect = isOpen && items.some(item => item.canDecide);

  const userName = (userId: string | null) => {
    if (!userId) {
      return '';
    }
    const user = store.usersById.get(userId);
    return user ? fullName(user) : t('Deleted user');
  };

  /** Its name in the reader's language, when it is one of the sample's */
  const name = review ? localName(t, review.name) : '';

  /**
   * The header's subtitle: what it covers, when it closes or closed, and who it names to decide all of it, such as
   * "Every role · People of Chiang Mai · closes 23 Oct 2026"
   */
  const summary = (() => {
    if (!review) {
      return '';
    }
    const when = review.status === 'open'
      ? t('reviewClosesOn', { date: localDate(f.language, review.dueAt) })
      : review.closedById
        ? t('reviewClosedOnBy', { date: localDate(f.language, review.closedAt ?? review.dueAt), name: userName(review.closedById) })
        : t('reviewClosedOn', { date: localDate(f.language, review.closedAt ?? review.dueAt) });
    const named = review.reviewerIds.length ? [t('reviewNamed', { names: review.reviewerIds.map(userName).join(', ') })] : [];
    return [reviewScope(review, store, t), when, ...named].join(' · ');
  })();

  const counts = countsOf(items);

  const [filter, setFilterValue] = useState<ItemFilter>('all');
  const filterOptions: UiOption<ItemFilter>[] = isOpen ? [
    { value: 'all', label: t('All'), count: counts.all },
    ...(canSelect ? [{ value: 'mine' as const, label: t('Waiting for you'), count: counts.mine }] : []),
    { value: 'undecided', label: t('Not decided'), count: counts.undecided },
    { value: 'keep', label: t('Keep'), count: counts.keep },
    { value: 'remove', label: t('Remove'), count: counts.remove },
  ] : [
    { value: 'all', label: t('All'), count: counts.all },
    ...(Object.keys(REVIEW_OUTCOMES) as AccessReviewOutcome[])
      .filter(outcome => counts[outcome] || outcome === 'kept' || outcome === 'removed' || outcome === 'not_reviewed')
      .map(outcome => ({ value: outcome, label: t(REVIEW_OUTCOMES[outcome].label), count: counts[outcome] })),
  ];

  const filterRow = useCallback((item: AccessReviewItem) => filter === 'all' ? true
    : filter === 'mine' ? item.canDecide && !item.decision
    : filter === 'undecided' ? !item.decision
    : filter === 'keep' || filter === 'remove' ? item.decision === filter
    : item.outcome === filter, [filter]);

  const table = useUiTableState<AccessReviewItem, SortKey>({
    rows: items,
    id: itemId,
    selectable: canDecide,
    pageSize: PAGE_SIZES[0],
    pageSizeKey: 'review-page-size',
    search: matchesSearch,
    filter: filterRow,
    sorters: SORTERS,
  });

  /** Whether the list was opened on what waits for the signed-in user, once, when it first loaded */
  const filtered = useRef(false);

  const load = async (reviewId: string) => {
    try {
      const loaded = await adminStore.accessReviewItems(reviewId);
      setItems(loaded);
      setFailure('');
      // Someone with roles waiting for them starts on those
      if (!filtered.current) {
        filtered.current = true;
        const loadedCounts = countsOf(loaded);
        if (loadedCounts.mine && loadedCounts.mine < loadedCounts.all) {
          setFilterValue('mine');
        }
      }
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // On arrival, and each time the data is loaded again, such as after someone else decided
  useEffect(() => {
    void load(id);
  }, [id, store.revision]);

  const branchName = (branchId: string | null) => branchId ? store.branchesById.get(branchId)?.name ?? '' : '';

  /** The person as they are now, for their photo and when they last used the app; gone once deleted */
  const person = (item: AccessReviewItem) => store.usersById.get(item.userId);

  const setFilter = (value: ItemFilter | null) => {
    setFilterValue(value ?? 'all');
    table.resetPage();
  };

  const decide = async (chosen: AccessReviewItem[], decision: AccessReviewDecision) => {
    if (!review || !chosen.length) {
      return;
    }
    let note: string | undefined;
    // Taking a role away says why, required where the settings ask a reason for it
    if (decision === 'remove') {
      const reason = await reasonPrompt.ask('removeRole', {
        title: chosen.length === 1
          ? t('confirm.removeInReview', { role: chosen[0].roleName, name: chosen[0].userName })
          : t('confirm.removeInReviewCount', { count: chosen.length }),
        message: t('The role is taken away when the review closes. You can change your mind until then.'),
        confirmLabel: t('Remove'),
        tone: 'danger',
      });
      if (reason === null) {
        return;
      }
      note = reason || undefined;
    }
    setBusy(true);
    try {
      const decided = await adminStore.decideAccessReview(review.id, chosen.map(item => item.id), decision, note);
      const byId = new Map(decided.map(item => [item.id, item]));
      setItems(all => all.map(item => byId.get(item.id) ?? item));
      table.clearSelection();
      if (chosen.length > 1) {
        uiToast.show(t(decision === 'keep' ? 'toast.reviewKept' : 'toast.reviewRemoved', { count: chosen.length }));
      }
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  const closeNow = async () => {
    if (!review) {
      return;
    }
    const { remove, undecided } = counts;
    const confirmed = await uiConfirm.ask({
      title: t('confirm.closeReview', { name: localName(t, review.name) }),
      message: [
        remove ? t('closeReviewRemoves', { count: remove }) : t('No roles are taken away.'),
        undecided ? t('closeReviewUndecided', { count: undecided }) : '',
      ].filter(Boolean).join(' '),
      confirmLabel: t('Close review'),
      cancelLabel: t('Cancel'),
      tone: remove ? 'danger' : 'primary',
    });
    if (!confirmed) {
      return;
    }
    setBusy(true);
    try {
      await adminStore.closeAccessReview(review.id);
      uiToast.show(t('toast.reviewClosed', { name: localName(t, review.name) }));
      await load(review.id);
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!review) {
      return;
    }
    const confirmed = await uiConfirm.ask({
      title: t('confirm.deleteReview', { name: localName(t, review.name) }),
      message: t('Its decisions are lost, and nobody\'s roles change.'),
      confirmLabel: t('Delete'),
      cancelLabel: t('Cancel'),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    try {
      await adminStore.deleteAccessReview(review.id);
      uiToast.show(t('toast.reviewDeleted', { name: localName(t, review.name) }));
      void navigate('/access-reviews');
    } catch (error) {
      uiToast.show(t(errorMessage(error)), 'error');
    }
  };

  /** The report: every role shown, as filtered and sorted, with its decision and, once closed, what became of it */
  const exportTable = (): TableExport => {
    const closed = review?.status === 'closed';
    const shown = table.sorted;
    const scope = (item: AccessReviewItem) => item.branchId ? branchName(item.branchId) : t('Whole organization');
    return {
      fileName: 'access-review',
      title: review ? localName(t, review.name) : t('Access reviews'),
      columns: [
        { header: t('Name') }, { header: t('Email') }, { header: t('Role') }, { header: t('Applies in') },
        { header: t('Held since'), date: 'day' }, { header: t('Ends'), date: 'day' }, { header: t('Decision') },
        { header: t('Note') }, { header: t('Decided by') }, { header: t('Decided on'), date: 'time' },
        ...(closed ? [{ header: t('Outcome') }] : []),
      ],
      rows: shown.map(item => [
        item.userName, item.email, item.roleName, scope(item), new Date(item.startsAt), item.endsAt ? new Date(item.endsAt) : t('For good'),
        t(item.decision ? REVIEW_DECISIONS[item.decision].label : 'Not decided'), item.note, item.decidedByName,
        item.decidedAt ? new Date(item.decidedAt) : null, ...(closed ? [item.outcome ? t(REVIEW_OUTCOMES[item.outcome].label) : ''] : []),
      ]),
      csv: [
        ['Name', 'Email', 'Role', 'Branch', 'Held since', 'Ends', 'Decision', 'Note', 'Decided by', 'Decided at', ...(closed ? ['Outcome'] : [])],
        ...shown.map(item => [
          item.userName, item.email, item.roleName, item.branchId ? store.branchesById.get(item.branchId)?.code ?? '' : '',
          item.startsAt.slice(0, 10), item.endsAt?.slice(0, 10) ?? '', item.decision ?? '', item.note, item.decidedByName, item.decidedAt ?? '',
          ...(closed ? [item.outcome ?? ''] : []),
        ]),
      ],
    };
  };

  const scroll = useRef<HTMLDivElement>(null);
  useUiTableMinRows(scroll, PAGE_SIZES[0]);
  useUiTableScrollReset(scroll, table);

  if (!review) {
    return (
      <app-access-review className="page-fit">
        <UiEmptyState icon={lucideClipboardCheck} title={t('This review no longer exists')} description={t('Someone may have deleted it.')}>
          <UiLinkButton variant="secondary" to="/access-reviews">{t('Back to access reviews')}</UiLinkButton>
        </UiEmptyState>
      </app-access-review>
    );
  }

  return (
    <app-access-review className="page-fit">
      <UiPageHeader title={name} subtitle={summary} icon={lucideClipboardCheck} breadcrumbLabel={t('Breadcrumb')}
        breadcrumbs={[{ label: t('User management') }, { label: t('Access reviews'), link: '/access-reviews' }]}>
        {items.length > 0 && <ExportMenu source={exportTable} />}
        {canManage && isOpen && (
          <>
            <UiButton type="button" disabled={busy} onClick={() => void closeNow()}><NgIcon svg={lucideClipboardCheck} />{` ${t('Close review')}`}</UiButton>
            <UiMenuTrigger menu={
              <UiMenu>
                <UiMenuItem tone="danger" icon={lucideTrash2} onTriggered={() => void remove()}>{t('Delete review')}</UiMenuItem>
              </UiMenu>
            }>
              <UiButton variant="secondary" iconOnly type="button" aria-label={t('More actions')}>
                <NgIcon svg={lucideEllipsis} />
              </UiButton>
            </UiMenuTrigger>
          </>
        )}
      </UiPageHeader>

      <UiCard flush fit>
        <div className="toolbar">
          <UiSearchInput className="toolbar-search" size="sm" value={table.query} onValueChange={table.search} placeholder={t('Search name, email or role')}
            clearLabel={t('Clear search')} />
          <UiFilterChips className="toolbar-chips" scroll options={filterOptions} value={filter} onValueChange={setFilter} ariaLabel={t('Show')} />
        </div>

        {table.selectedIds.size > 0 && (
          <UiBulkBar label={t('selectedCount', { count: table.selectedIds.size })} clearLabel={t('Clear')} onCleared={table.clearSelection}>
            <UiButton size="sm" variant="secondary" type="button" disabled={busy} onClick={() => void decide(table.selectedRows, 'keep')}>
              <NgIcon svg={lucideCheck} />{` ${t('Keep')}`}
            </UiButton>
            <UiButton size="sm" variant="danger-soft" type="button" disabled={busy} onClick={() => void decide(table.selectedRows, 'remove')}>
              <NgIcon svg={lucideX} />{` ${t('Remove')}`}
            </UiButton>
          </UiBulkBar>
        )}

        {failure ? (
          <UiEmptyState icon={lucideSearchX} title={t('Could not load this review')} description={t(failure)} />
        ) : loading ? (
          <p className="loading">{t('Loading…')}</p>
        ) : table.total ? (
          <>
            <div className="ui-table-scroll" ref={scroll}>
              <table className={cx(uiTableClass(true), 'review-table')}>
                <thead>
                  <tr>
                    {canSelect && (
                      <th className="ui-cell-shrink">
                        <UiCheckbox checked={table.allOnPageSelected} indeterminate={table.someOnPageSelected} disabled={!table.pageHasSelectable}
                          onCheckedChange={() => table.togglePage()} ariaLabel={t('Select all on this page')} />
                      </th>
                    )}
                    <th><UiSortHeader table={table} sortKey="person">{t('User')}</UiSortHeader></th>
                    <th><UiSortHeader table={table} sortKey="role">{t('Role')}</UiSortHeader></th>
                    <th className="hide-md">{t('Applies in')}</th>
                    <th className="hide-xl"><UiSortHeader table={table} sortKey="since">{t('Held since')}</UiSortHeader></th>
                    <th className="hide-lg">{t('Last active')}</th>
                    <th><UiSortHeader table={table} sortKey="decision">{t(isOpen ? 'Decision' : 'Outcome')}</UiSortHeader></th>
                    <th className="hide-md">{t('Decided by')}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.pageRows.map(item => {
                    const user = person(item);
                    return (
                      <tr key={item.id} className={cx(table.isSelected(item) && 'ui-row-selected')}>
                        {canSelect && (
                          <td className="ui-cell-shrink cell-check">
                            <UiCheckbox checked={table.isSelected(item)} disabled={!table.isSelectable(item)} onCheckedChange={() => table.toggle(item)}
                              ariaLabel={t('selectReviewItem', { name: item.userName, role: item.roleName })} />
                          </td>
                        )}
                        <td className="cell-person">
                          {user ? (
                            <Link className="person-link" to={`/users/${user.id}?tab=roles`}>
                              <UiPerson name={item.userName} detail={item.email} src={user.avatar} size="xs" />
                            </Link>
                          ) : (
                            <UiPerson name={item.userName} detail={item.email} size="xs" />
                          )}
                        </td>
                        <td className="cell-role">
                          {store.rolesById.has(item.roleId) ? <RoleBadge roleId={item.roleId} /> : <UiBadge tone="neutral">{item.roleName}</UiBadge>}
                        </td>
                        <td className="hide-md muted">{item.branchId ? t('branchOnly', { branch: branchName(item.branchId) }) : t('Whole organization')}</td>
                        <td className="hide-xl muted">{f.localDate(item.startsAt)}</td>
                        <td className="hide-lg muted">{user ? f.timeAgo(user.lastActiveAt, t('Never')) : '—'}</td>
                        <td className="cell-decision">
                          {!isOpen ? (
                            item.outcome && <UiBadge tone={REVIEW_OUTCOMES[item.outcome].tone} dot>{t(REVIEW_OUTCOMES[item.outcome].label)}</UiBadge>
                          ) : item.canDecide ? (
                            <div className="decision-buttons" role="group" aria-label={t('decisionFor', { name: item.userName, role: item.roleName })}>
                              <UiButton size="sm" type="button" variant={item.decision === 'keep' ? 'primary' : 'secondary'} aria-pressed={item.decision === 'keep'}
                                disabled={busy} onClick={() => item.decision !== 'keep' && void decide([item], 'keep')}>
                                <NgIcon svg={lucideCheck} />{` ${t('Keep')} `}
                              </UiButton>
                              <UiButton size="sm" type="button" variant={item.decision === 'remove' ? 'danger' : 'secondary'} aria-pressed={item.decision === 'remove'}
                                disabled={busy} onClick={() => void decide([item], 'remove')}>
                                <NgIcon svg={lucideX} />{` ${t('Remove')} `}
                              </UiButton>
                            </div>
                          ) : item.decision ? (
                            <UiBadge tone={REVIEW_DECISIONS[item.decision].tone}>{t(REVIEW_DECISIONS[item.decision].label)}</UiBadge>
                          ) : (
                            <span className="muted">{t('Not decided')}</span>
                          )}
                        </td>
                        <td className="hide-md cell-decided" title={item.note || undefined}>
                          {item.decidedAt ? (
                            <>
                              <span className="decided-by">{item.decidedByName}</span>
                              <span className="muted">{` · ${f.localDate(item.decidedAt)}`}</span>
                              {item.note && <span className="decision-note">{item.note}</span>}
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
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
          <UiEmptyState icon={lucideSearchX} title={t(items.length ? 'Nothing matches' : 'Nobody held these roles')}
            description={t(items.length ? 'Try another search or show everything.' : 'There was nothing to review when it started.')} />
        )}
      </UiCard>
    </app-access-review>
  );
}
