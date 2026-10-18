import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { lucideClipboardCheck, lucidePlus, lucideSearchX } from '../../icons';
import { useSession } from '../access/session';
import { useAdmin } from '../data/admin-store';
import { REVIEW_STATUS } from '../data/catalog';
import type { AccessReview, AccessReviewStatus } from '../data/models';
import { localName, useFormat } from '../shared/formatting';
import {
  cx, NgIcon, uiTableClass, useUiTableMinRows, useUiTableScrollReset, useUiTableState, UiBadge, UiButton, UiCard, UiEmptyState, UiFilterChips,
  UiPageHeader, UiPageSize, UiPagination, UiSearchInput, UiSortHeader, type UiOption,
} from '../ui';
import './access-reviews.scss';
import { reviewScope } from './review-text';
import { StartReviewDialog } from './start-review-dialog';

/** A review as the list shows it: its name and what it covers in the reader's language, and how far it has got */
interface ReviewRow {
  review: AccessReview;
  name: string;
  scope: string;
  /** Decided, in percent */
  progress: number;
}

type SortKey = 'name' | 'closes' | 'decided' | 'status';
type StatusFilter = 'all' | AccessReviewStatus;

/** The table keeps the height of the smallest size, so a short page doesn't move the pagination */
const PAGE_SIZES = [10, 25, 50];

const SORTERS: Record<SortKey, (a: ReviewRow, b: ReviewRow) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  closes: (a, b) => (a.review.closedAt ?? a.review.dueAt).localeCompare(b.review.closedAt ?? b.review.dueAt),
  decided: (a, b) => a.progress - b.progress,
  status: (a, b) => a.review.status.localeCompare(b.review.status),
};

/** Name or what it covers, as typed */
function matchesSearch(row: ReviewRow, query: string): boolean {
  return row.name.toLowerCase().includes(query) || row.scope.toLowerCase().includes(query);
}

function rowId(row: ReviewRow): string {
  return row.review.id;
}

/**
 * Access reviews (API.md, "Access reviews"): rounds of checking that people still need the roles they hold, as audits
 * ask. People with reviews.manage see and start them all; anyone else sees the ones they decide in, with how many roles
 * wait for them. The list searches, filters by status, sorts and pages as the branches list does. Fills the window on
 * desktop (page-fit); a long list scrolls inside its card.
 */
export function AccessReviewsComponent() {
  const store = useAdmin();
  const session = useSession();
  const f = useFormat();
  const { t } = f;
  const navigate = useNavigate();

  const canManage = session.can('reviews.manage');
  const [starting, setStarting] = useState(false);

  /** Newest first, as the server lists them, until a column is sorted */
  const rows = useMemo<ReviewRow[]>(() => store.accessReviews.map(review => ({
    review,
    name: localName(t, review.name),
    scope: reviewScope(review, store, t),
    progress: review.itemCount ? Math.round(review.decidedCount / review.itemCount * 100) : 100,
  })), [store, t]);

  const [status, setStatusFilter] = useState<StatusFilter>('all');
  const filter = useCallback((row: ReviewRow) => status === 'all' || row.review.status === status, [status]);

  const table = useUiTableState<ReviewRow, SortKey>({
    rows,
    id: rowId,
    pageSize: PAGE_SIZES[0],
    pageSizeKey: 'reviews-page-size',
    search: matchesSearch,
    filter,
    sorters: SORTERS,
  });

  /** Counted within the search, so each number is what the list shows after a click */
  const query = table.query.trim().toLowerCase();
  const searched = rows.filter(row => !query || matchesSearch(row, query));
  const open = searched.filter(row => row.review.status === 'open').length;
  const statusOptions: UiOption<StatusFilter>[] = [
    { value: 'all', label: t('All'), count: searched.length },
    { value: 'open', label: t('Open'), count: open },
    { value: 'closed', label: t('Closed'), count: searched.length - open },
  ];

  const setStatus = (value: StatusFilter | null) => {
    setStatusFilter(value ?? 'all');
    table.resetPage();
  };

  const clearFilters = () => {
    table.search('');
    setStatusFilter('all');
  };

  const openReview = (review: AccessReview) => void navigate(`/access-reviews/${review.id}`);

  const scroll = useRef<HTMLDivElement>(null);
  useUiTableMinRows(scroll, PAGE_SIZES[0]);
  useUiTableScrollReset(scroll, table);

  return (
    <app-access-reviews className="page-fit">
      <UiPageHeader title={t('Access reviews')} subtitle={t('Check now and then that people still need the roles they hold, as audits ask.')}
        icon={lucideClipboardCheck} breadcrumbLabel={t('Breadcrumb')} breadcrumbs={[{ label: t('User management') }]}>
        {canManage && <UiButton type="button" onClick={() => setStarting(true)}><NgIcon svg={lucidePlus} />{` ${t('Start review')}`}</UiButton>}
      </UiPageHeader>

      {canManage && <StartReviewDialog open={starting} onOpenChange={setStarting} onStarted={openReview} />}

      <UiCard flush fit>
        {rows.length > 0 && (
          <div className="toolbar">
            <UiSearchInput className="toolbar-search" size="sm" value={table.query} onValueChange={table.search} placeholder={t('Search reviews')}
              clearLabel={t('Clear search')} />
            <UiFilterChips className="toolbar-chips" scroll options={statusOptions} value={status} onValueChange={setStatus} ariaLabel={t('Status')} />
          </div>
        )}
        {table.total ? (
          <>
            <div className="ui-table-scroll" ref={scroll}>
              <table className={cx(uiTableClass(true), 'reviews-table')}>
                <thead>
                  <tr>
                    <th><UiSortHeader table={table} sortKey="name">{t('Review')}</UiSortHeader></th>
                    <th className="hide-md">{t('Covers')}</th>
                    <th className="hide-sm"><UiSortHeader table={table} sortKey="closes">{t('Closes')}</UiSortHeader></th>
                    <th><UiSortHeader table={table} sortKey="decided">{t('Decided')}</UiSortHeader></th>
                    <th className="hide-sm">{t('For you')}</th>
                    <th><UiSortHeader table={table} sortKey="status">{t('Status')}</UiSortHeader></th>
                  </tr>
                </thead>
                <tbody>
                  {table.pageRows.map(row => (
                    <tr key={row.review.id} className="ui-row-link" onClick={() => openReview(row.review)}>
                      <td className="cell-name">
                        <Link className="review-name" to={`/access-reviews/${row.review.id}`} onClick={event => event.stopPropagation()}>{row.name}</Link>
                      </td>
                      <td className="hide-md muted">{row.scope}</td>
                      <td className="hide-sm muted">{f.localDate(row.review.closedAt ?? row.review.dueAt)}</td>
                      <td className="cell-progress">
                        <span className="progress" aria-hidden="true"><span className="progress-bar" style={{ width: `${row.progress}%` }}></span></span>
                        <span className="progress-text">{t('decidedOf', { decided: row.review.decidedCount, total: row.review.itemCount })}</span>
                      </td>
                      <td className="hide-sm">
                        {row.review.waitingCount
                          ? <UiBadge tone="warning">{t('toDecide', { count: row.review.waitingCount })}</UiBadge>
                          : <span className="muted">—</span>}
                      </td>
                      <td><UiBadge tone={REVIEW_STATUS[row.review.status].tone} dot>{t(REVIEW_STATUS[row.review.status].label)}</UiBadge></td>
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
          <UiEmptyState icon={lucideSearchX} title={t('Nothing matches')} description={t('Try another search or clear the filters.')}>
            <UiButton variant="secondary" type="button" onClick={clearFilters}>{t('Clear filters')}</UiButton>
          </UiEmptyState>
        ) : (
          <UiEmptyState icon={lucideClipboardCheck} title={t('No access reviews yet')}
            description={t(canManage ? 'Start one to check that people still need the roles they hold.' : 'Reviews you decide in show here.')}>
            {canManage && <UiButton type="button" onClick={() => setStarting(true)}>{t('Start review')}</UiButton>}
          </UiEmptyState>
        )}
      </UiCard>
    </app-access-reviews>
  );
}
