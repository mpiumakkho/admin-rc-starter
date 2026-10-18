import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { lucideChevronRight, lucideHistory, lucideMonitor, lucideSearchX, lucideSmartphone } from '../../icons';
import { useSession } from '../access/session';
import { adminStore, useAdmin } from '../data/admin-store';
import { ACTIVITY_KINDS, ACTIVITY_META, type ActivityKind } from '../data/catalog';
import { fullName, type Activity, type User } from '../data/models';
import { ExportMenu } from '../shared/export-menu';
import { intlLocale, useFormat } from '../shared/formatting';
import type { TableExport } from '../shared/table-export';
import {
  cx, NgIcon, uiTableClass, useUiTableMinRows, useUiTableScrollReset, useUiTableState, UiButton, UiCard, UiEmptyState, UiFilterChips,
  UiIconChip, UiPageHeader, UiPageSize, UiPagination, UiPerson, UiPersonSelect, UiSearchInput, UiSortHeader, type UiOption, type UiPersonOption,
} from '../ui';
import { targetTo } from './activity-details';
import { ActivityDialog } from './activity-dialog';
import { useActivityFormat, type ActivityTarget } from './activity-format';
import './activity.scss';

type Kind = ActivityKind | 'all';
type Period = 'all' | 'today' | '7d' | '30d' | 'custom';
type SortKey = 'time' | 'actor' | 'action';

/** One table row: the entry plus the text it shows, worked out once per language */
interface ActivityRow {
  entry: Activity;
  actor: User | undefined;
  actorName: string;
  action: string;
  summary: string;
  target: ActivityTarget | null;
  mobile: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/** The same sizes as the users list; the table keeps the height of the smallest */
const PAGE_SIZES = [10, 25, 50, 100];

const SORTERS: Record<SortKey, (a: ActivityRow, b: ActivityRow) => number> = {
  time: (a, b) => a.entry.at.localeCompare(b.entry.at),
  actor: (a, b) => a.actorName.localeCompare(b.actorName),
  action: (a, b) => a.action.localeCompare(b.action),
};

function rowId(row: ActivityRow): string {
  return row.entry.id;
}

/**
 * Every change made in the admin, newest first: searched, filtered by type, person and time, and exported. Fills the
 * window on desktop (page-fit); the log scrolls inside when a page has more rows than fit.
 */
export function ActivityComponent() {
  const store = useAdmin();
  const session = useSession();
  const f = useFormat();
  const { t } = f;
  const format = useActivityFormat();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  /* Filters */

  const [kind, setKindValue] = useState<Kind>('all');
  /** Who did it; null for anyone */
  const [actor, setActorValue] = useState<string | null>(null);
  const [period, setPeriodValue] = useState<Period>('all');
  /** A range of days picked by hand ('custom'), as the date inputs give them: "2026-10-01" */
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');

  /**
   * A range picked by hand is read from the server, so it reaches past what the pages keep loaded; it loads again
   * when the data changes (revision), as the rest of the page does. Another range starts empty until it has loaded.
   */
  const [range, setRange] = useState<Activity[] | undefined>(undefined);
  useLayoutEffect(() => {
    if (period !== 'custom') {
      return undefined;
    }
    let current = true;
    setRange(undefined);
    adminStore.activityBetween(dayRange(fromDay, toDay)).then(entries => current && setRange(entries), () => current && setRange(undefined));
    return () => {
      current = false;
    };
  }, [period, fromDay, toDay, store.revision]);
  /** The entries the page works from: the range read from the server, or everything loaded */
  const entries = period === 'custom' ? range ?? EMPTY : store.activity;

  /** ?user=…: only what one person did or what was done to them, as when opened from their profile */
  const userParam = params.get('user');
  const [subject, setSubject] = useState<string | null>(userParam || null);
  const [subjectFor, setSubjectFor] = useState(userParam);
  if (subjectFor !== userParam) {
    setSubjectFor(userParam);
    setSubject(userParam || null);
  }
  const subjectUser = subject ? store.usersById.get(subject) : undefined;
  const subjectName = subjectUser ? fullName(subjectUser) : t('Deleted user');

  const rows = useMemo<ActivityRow[]>(() => entries.map(entry => ({
    entry,
    actor: store.usersById.get(entry.actorId ?? ''),
    actorName: format.actorName(entry),
    action: format.action(entry),
    summary: format.summary(entry),
    target: format.target(entry),
    mobile: format.isMobile(entry),
  })), [entries, store.usersById, format]);

  /** People who have done something, for the "Done by" filter */
  const actors = useMemo(() => peopleOf(store.usersById, new Set(entries.map(entry => entry.actorId ?? ''))), [entries, store.usersById]);
  /** People something was done by or to, for the "About" filter; the one asked for in the address too, deleted or not */
  const subjects = useMemo(() => {
    const ids = new Set(entries.flatMap(entry => [entry.actorId ?? '', entry.targetId ?? '']));
    const people = peopleOf(store.usersById, subject ? ids.add(subject) : ids);
    return subject && !people.some(person => person.id === subject) ? [{ id: subject, name: subjectName }, ...people] : people;
  }, [entries, store.usersById, subject, subjectName]);

  /** Under a person filter's list when it shows only the first it found */
  const morePeople = (shown: number, total: number) => {
    const number = new Intl.NumberFormat(intlLocale(f.language));
    return t('morePeople', { shown: number.format(shown), total: number.format(total) });
  };

  const filter = useMemo(() => {
    const since = sinceOf(period);
    return (row: ActivityRow) => (kind === 'all' || ACTIVITY_META[row.entry.action].kind === kind)
      && (!actor || row.entry.actorId === actor)
      && (!subject || row.entry.actorId === subject || row.entry.targetId === subject)
      && (!since || row.entry.at >= since);
  }, [kind, actor, subject, period]);

  const table = useUiTableState<ActivityRow, SortKey>({
    rows,
    id: rowId,
    pageSize: PAGE_SIZES[0],
    pageSizeKey: 'activity-page-size',
    search: matchesSearch,
    filter,
    sorters: SORTERS,
    // Newest first, as a log is read
    initialSort: { key: 'time', direction: 'desc' },
  });

  // Counted within the search, person and time range picked, so the numbers match the rows the chips show
  const query = table.query.trim().toLowerCase();
  const since = sinceOf(period);
  const counted = rows.filter(row =>
    (!actor || row.entry.actorId === actor)
    && (!subject || row.entry.actorId === subject || row.entry.targetId === subject)
    && (!since || row.entry.at >= since)
    && (!query || matchesSearch(row, query))).map(row => row.entry);
  const count = (value: ActivityKind) => counted.filter(entry => ACTIVITY_META[entry.action].kind === value).length;
  const kindOptions: UiOption<Kind>[] = [
    { value: 'all', label: t('All'), count: counted.length },
    // Branches only while they are on, and access reviews only once there are any, or when the log has something about them
    ...(Object.keys(ACTIVITY_KINDS) as ActivityKind[])
      .filter(value => (value !== 'branches' || store.branchesEnabled) && (value !== 'reviews' || store.accessReviews.length > 0) || count(value) > 0)
      .map(value => ({ value, label: t(ACTIVITY_KINDS[value]), count: count(value) })),
  ];

  const hasFilters = !!table.query || kind !== 'all' || !!actor || period !== 'all' || !!subject;

  /* Details */

  const [selected, setSelected] = useState<ActivityRow | null>(null);

  // ?q=… to open the log already searched, for example from a user's profile
  const q = params.get('q');
  useLayoutEffect(() => {
    table.search(q ?? '');
  }, [q]);

  // Another person picked through the address: back to the first page
  useLayoutEffect(() => {
    table.resetPage();
  }, [userParam]);

  /** The person the log is about, or everyone (null); the address follows, so Back and reload agree */
  const pickSubject = (id: string | null) => {
    setSubject(id);
    table.resetPage();
    const next = new URLSearchParams(params);
    if (id) {
      next.set('user', id);
    } else {
      next.delete('user');
    }
    const search = next.toString();
    void navigate({ search: search ? `?${search}` : '' }, { replace: true });
  };

  const setKind = (value: Kind | null) => {
    setKindValue(value ?? 'all');
    table.resetPage();
  };

  const setActor = (value: string | null) => {
    setActorValue(value);
    table.resetPage();
  };

  const setPeriod = (value: Period) => {
    setPeriodValue(value);
    table.resetPage();
  };

  const setDay = (which: 'from' | 'to', day: string) => {
    (which === 'from' ? setFromDay : setToDay)(day);
    table.resetPage();
  };

  const clearFilters = () => {
    table.search('');
    setKindValue('all');
    setActorValue(null);
    setPeriodValue('all');
    setFromDay('');
    setToDay('');
    if (subject) {
      pickSubject(null);
    }
  };

  /** The filtered log, in the order shown, for the Export menu */
  const exportTable = (): TableExport => {
    const shown = table.sorted;
    return {
      fileName: 'activity',
      title: t('Activity log'),
      columns: [
        { header: t('Time'), date: 'time' }, { header: t('Done by') }, { header: t('Email') },
        { header: t('Action') },
        // The same in every language, as the API and the CSV name it, for filtering a sheet
        { header: t('Action code'), skip: ['copy', 'print'] },
        { header: t('Description') }, { header: t('Details') }, { header: t('Reason') },
        { header: t('IP address') }, { header: t('Browser') }, { header: t('Operating system') },
        // For finding the one entry again; nobody reads it on paper
        { header: t('Event reference'), skip: ['print'] },
      ],
      rows: shown.map(row => [
        new Date(row.entry.at), row.actorName, row.actor?.email ?? '', row.action, row.entry.action, format.sentence(row.entry), row.summary,
        row.entry.reason ?? '', row.entry.ip, row.entry.browser, row.entry.os, row.entry.id,
      ]),
      csv: [
        ['Time', 'Done by', 'Email', 'Action', 'Description', 'Details', 'Reason', 'IP address', 'Browser', 'OS', 'Event ID'],
        ...shown.map(row => [
          row.entry.at, row.actorName, row.actor?.email ?? '', row.entry.action, format.sentence(row.entry), row.summary,
          row.entry.reason ?? '', row.entry.ip, row.entry.browser, row.entry.os, row.entry.id,
        ]),
      ],
    };
  };

  const scroll = useRef<HTMLDivElement>(null);
  useUiTableMinRows(scroll, PAGE_SIZES[0]);
  useUiTableScrollReset(scroll, table);

  return (
    <app-activity className="page-fit">
      <UiPageHeader title={t('Activity log')} subtitle={subject ? t('activityOf', { name: subjectName }) : t('Every change made in the admin, newest first.')}
        icon={lucideHistory} breadcrumbLabel={t('Breadcrumb')} breadcrumbs={[{ label: t('User management') }]}>
        {session.can('activity.export') && <ExportMenu source={exportTable} />}
      </UiPageHeader>

      <UiCard flush fit>
        <div className="toolbar">
          <UiSearchInput className="toolbar-search" size="sm" value={table.query} onValueChange={table.search} placeholder={t('Search name, item or IP')}
            clearLabel={t('Clear search')} />
          <select className="ui-input ui-input-sm toolbar-select toolbar-period" value={period} onChange={event => setPeriod(event.target.value as Period)}
            aria-label={t('Time range')}>
            <option value="all">{t('Any time')}</option>
            <option value="today">{t('Today')}</option>
            <option value="7d">{t('Last 7 days')}</option>
            <option value="30d">{t('Last 30 days')}</option>
            <option value="custom">{t('Pick dates')}</option>
          </select>
          {period === 'custom' && (
            <span className="date-range">
              <input className="ui-input ui-input-sm" type="date" value={fromDay} max={toDay} onChange={event => setDay('from', event.target.value)}
                aria-label={t('From')} />
              <span aria-hidden="true">–</span>
              <input className="ui-input ui-input-sm" type="date" value={toDay} min={fromDay} onChange={event => setDay('to', event.target.value)}
                aria-label={t('To')} />
            </span>
          )}
          {/* Who did it, and whom it was about (?user=…, as a profile opens it): either can be anyone among thousands, so each searches */}
          <UiPersonSelect className="toolbar-person" label={t('Done by')} people={actors} value={actor} onValueChange={setActor} anyoneLabel={t('Anyone')}
            searchLabel={t('Search name or email')} emptyLabel={t('No one found')} clearLabel={t('clearPersonFilter', { label: t('Done by') })}
            moreText={morePeople} />
          <UiPersonSelect className="toolbar-person subject-select" label={t('About')} people={subjects} value={subject} onValueChange={pickSubject}
            anyoneLabel={t('Anyone')} searchLabel={t('Search name or email')} emptyLabel={t('No one found')}
            clearLabel={t('clearPersonFilter', { label: t('About') })} moreText={morePeople} />
          <UiFilterChips className="toolbar-chips" scroll options={kindOptions} value={kind} onValueChange={setKind} ariaLabel={t('Type')} />
        </div>

        {table.total ? (
          <>
            <div className="ui-table-scroll" ref={scroll}>
              <table className={cx(uiTableClass(true), 'log')}>
                <thead>
                  <tr>
                    <th><UiSortHeader table={table} sortKey="time">{t('Time')}</UiSortHeader></th>
                    <th><UiSortHeader table={table} sortKey="actor">{t('Done by')}</UiSortHeader></th>
                    <th><UiSortHeader table={table} sortKey="action">{t('Action')}</UiSortHeader></th>
                    <th className="hide-md">{t('Details')}</th>
                    <th className="hide-lg"><abbr title={t('abbr.ip')}>IP</abbr>{` ${t('and device')}`}</th>
                    <th className="ui-cell-shrink"><span className="ui-sr-only">{t('Actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {table.pageRows.map(row => (
                    <tr key={row.entry.id} className="ui-row-link" onClick={() => setSelected(row)}>
                      <td className="cell-time">
                        <span className="cell-main">{f.localDate(row.entry.at, 'datetime')}</span>
                        <span className="cell-sub">{f.timeAgo(row.entry.at)}</span>
                      </td>
                      <td className="cell-actor">
                        <UiPerson name={row.actorName} detail={row.actor?.email ?? ''} src={row.actor?.avatar} />
                      </td>
                      <td className="cell-action">
                        <div className="action">
                          <UiIconChip size="sm" icon={ACTIVITY_META[row.entry.action].icon} tone={ACTIVITY_META[row.entry.action].tone} />
                          <div className="action-text">
                            <span className="cell-main action-label">{row.action}</span>
                            {row.entry.action !== 'auth.sign_in' && (row.target ? (
                              <Link className="cell-sub target-link" to={targetTo(row.target)} onClick={event => event.stopPropagation()}>
                                {row.target.label ? t(row.target.label) : f.localName(row.entry.targetLabel)}
                              </Link>
                            ) : (
                              <span className="cell-sub">{`${f.localName(row.entry.targetLabel)} (${t('deleted')})`}</span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className={cx('hide-md cell-details', !row.summary && !row.entry.reason && 'is-empty')} title={row.summary || undefined}>
                        {row.summary ? <span className="cell-main">{row.summary}</span> : !row.entry.reason && <span className="muted">—</span>}
                        {/* Why, as the person gave it */}
                        {row.entry.reason && <span className="cell-sub cell-reason" title={row.entry.reason}>{`“${row.entry.reason}”`}</span>}
                      </td>
                      <td className="hide-lg cell-ip">
                        {/* What the server did by itself came from no browser */}
                        {row.entry.ip ? (
                          <>
                            <span className="cell-main mono">{row.entry.ip}</span>
                            <span className="cell-sub device">
                              <NgIcon svg={row.mobile ? lucideSmartphone : lucideMonitor} />{` ${row.entry.browser} · ${row.entry.os}`}
                            </span>
                          </>
                        ) : (
                          <span className="cell-main muted">—</span>
                        )}
                      </td>
                      <td className="ui-cell-shrink cell-open" onClick={event => event.stopPropagation()}>
                        <UiButton variant="ghost" size="sm" iconOnly type="button" onClick={() => setSelected(row)} aria-label={t('View details')}>
                          <NgIcon svg={lucideChevronRight} />
                        </UiButton>
                      </td>
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
        ) : (
          <UiEmptyState icon={lucideSearchX} title={t('No activity found')} description={t('Try another search or clear the filters.')}>
            {hasFilters && <UiButton variant="secondary" type="button" onClick={clearFilters}>{t('Clear filters')}</UiButton>}
          </UiEmptyState>
        )}
      </UiCard>

      <ActivityDialog entry={selected?.entry ?? null} onClosed={() => setSelected(null)} />
    </app-activity>
  );
}

const EMPTY: Activity[] = [];

/** The earliest time a period includes, as an ISO string, or null for all time (and for a range, read already cut) */
function sinceOf(period: Period): string | null {
  if (period === 'all' || period === 'custom') {
    return null;
  }
  if (period === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  return new Date(Date.now() - (period === '7d' ? 7 : 30) * DAY).toISOString();
}

/** Two days picked in the date inputs as the server's range: from the start of the first to the end of the last, here */
function dayRange(fromDay: string, toDay: string): { from?: string; to?: string } {
  const start = (day: string) => {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date);
  };
  const end = toDay ? start(toDay) : undefined;
  end?.setDate(end.getDate() + 1);
  return { from: fromDay ? start(fromDay).toISOString() : undefined, to: end?.toISOString() };
}

/** The users among these ids, as a person filter lists them: by name, with their email and photo */
function peopleOf(usersById: ReadonlyMap<string, User>, ids: Set<string>): UiPersonOption[] {
  return [...ids].map(id => usersById.get(id)).filter(user => !!user)
    .map(user => ({ id: user.id, name: fullName(user), detail: user.email, avatar: user.avatar }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Who, what, the details or the IP address, as the search box says; the query is already lower case */
function matchesSearch(row: ActivityRow, query: string): boolean {
  return [row.actorName, row.actor?.email ?? '', row.entry.targetLabel, row.action, row.summary, row.entry.reason ?? '', row.entry.ip]
    .some(text => text.toLowerCase().includes(query));
}
