import { useEffect, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode, type RefObject } from 'react';

import { lucideArrowUpDown, lucideChevronDown, lucideChevronsUpDown, lucideChevronUp, lucideX } from '../../../icons';
import { UiButton } from '../button/button';
import { cx } from '../core/types';
import { NgIcon } from '../icon/icon';
import { UiMenu, UiMenuHeading, UiMenuItemRadio, UiMenuTrigger } from '../menu/menu';
import type { UiTableState } from './table-state';
import './table.scss';

/**
 * The library's table style for a native <table> (table[uiTable] in the Angular app). Wrap it in `.ui-table-scroll`
 * on narrow screens. `dense` for tighter rows in long lists.
 *
 *   <table className={uiTableClass()}>
 */
export function uiTableClass(dense = false): string {
  return cx('ui-table', dense && 'ui-table-dense');
}

/**
 * Keeps a table's scroll area at least as tall as `minRows` rows, so a short last page or a filtered list doesn't move
 * the pagination below it. Give it the `.ui-table-scroll` wrapper. The row height is measured from the table. Inside a
 * flex column, such as `<UiCard fit>`, the area can still shrink to the space there is.
 *
 *   const scroll = useRef<HTMLDivElement>(null);
 *   useUiTableMinRows(scroll, 10);
 *   <div className="ui-table-scroll" ref={scroll}>
 */
export function useUiTableMinRows(host: RefObject<HTMLElement | null>, minRows: number): void {
  /** Height of a full body row, remembered for pages with fewer rows */
  const rowHeight = useRef(0);
  const latest = useRef(minRows);
  latest.current = minRows;

  const update = () => {
    const element = host.current;
    if (!element) {
      return;
    }
    const table = element.querySelector('table');
    const rows = Array.from(table?.tBodies[0]?.rows ?? []);
    // The last row has no bottom border, so measure the others when there are some
    const fullRows = rows.slice(0, -1).map(row => row.getBoundingClientRect().height);
    if (fullRows.length) {
      rowHeight.current = Math.max(...fullRows);
    } else if (rows.length && !rowHeight.current) {
      rowHeight.current = rows[0].getBoundingClientRect().height + 1;
    }
    const missing = latest.current - rows.length;
    const height = table && missing > 0 && rowHeight.current ? table.getBoundingClientRect().height + missing * rowHeight.current : 0;
    // In a flex column a basis keeps the area shrinkable; elsewhere a minimum height does the job
    const inFlex = !!element.parentElement && getComputedStyle(element.parentElement).display.endsWith('flex');
    element.style.flexBasis = height && inFlex ? `${height}px` : '';
    element.style.minHeight = height && !inFlex ? `${height}px` : '';
  };

  // After every render, as rows come and go
  useLayoutEffect(update);
  // And whenever the table's size changes; the table can come later, or be another one, when it shows only with rows
  const watched = useRef<{ table: Element | null; observer: ResizeObserver | null }>({ table: null, observer: null });
  useEffect(() => {
    const table = host.current?.querySelector('table') ?? null;
    if (table !== watched.current.table) {
      watched.current.observer?.disconnect();
      const observer = table ? new ResizeObserver(update) : null;
      observer?.observe(table!);
      watched.current = { table, observer };
    }
  });
  useEffect(() => () => watched.current.observer?.disconnect(), []);
}

/**
 * Scrolls a table's scroll area back to the top when the reader turns the page, changes the page size, sorts,
 * searches or filters, so the new rows start at the first one. Give it the `.ui-table-scroll` wrapper.
 *
 *   useUiTableScrollReset(scroll, table);
 */
export function useUiTableScrollReset(host: RefObject<HTMLElement | null>, table: UiTableState<any, any>): void {
  useLayoutEffect(() => {
    host.current?.scrollTo({ top: 0 });
  }, table.view);
}

export interface UiSortHeaderProps extends HTMLAttributes<HTMLElement> {
  table: UiTableState<any, any>;
  sortKey: string;
}

/**
 * A sortable column header. Put it inside the <th>.
 *
 *   <th aria-sort={…}><UiSortHeader table={table} sortKey="name">Name</UiSortHeader></th>
 */
export function UiSortHeader({ table, sortKey, children, ...rest }: UiSortHeaderProps) {
  const active = table.sortKey === sortKey;
  const icon = !active ? lucideArrowUpDown : table.sortDirection === 'asc' ? lucideChevronUp : lucideChevronDown;
  return (
    <ui-sort-header {...rest}>
      <button type="button" className="ui-sort" onClick={() => table.sortBy(sortKey)}>
        {children}
        <NgIcon svg={icon} className={cx(!active && 'ui-sort-idle')} />
      </button>
    </ui-sort-header>
  );
}

export interface UiBulkBarProps extends HTMLAttributes<HTMLElement> {
  label: string;
  clearLabel?: string;
  onCleared?: () => void;
  children?: ReactNode;
}

/**
 * A strip shown while table rows are selected: how many, the bulk actions (as content) and a clear button.
 *
 *   {table.selectedIds.size > 0 && (
 *     <UiBulkBar label={`${table.selectedIds.size} selected`} onCleared={table.clearSelection}>
 *       <UiButton size="sm" variant="danger-soft">Delete</UiButton>
 *     </UiBulkBar>
 *   )}
 */
export function UiBulkBar({ label, clearLabel = 'Clear', onCleared, className, children, ...rest }: UiBulkBarProps) {
  return (
    <ui-bulk-bar {...rest} className={cx('ui-bulk-bar', className)}>
      <span className="ui-bulk-label">{label}</span>
      {children}
      <UiButton variant="ghost" size="sm" type="button" className="ui-bulk-clear" onClick={() => onCleared?.()}>
        <NgIcon svg={lucideX} />{` ${clearLabel} `}
      </UiButton>
    </ui-bulk-bar>
  );
}

export interface UiPageSizeProps {
  table: UiTableState<any, any>;
  /** The button text, for example "1–10 of 48" */
  label: string;
  /** Shown above the sizes and read out as the menu's name */
  heading?: string;
  sizes?: number[];
}

/**
 * The "1–10 of 48" line of a table footer as a button that opens a menu of page sizes.
 *
 *   <UiPageSize table={table} label="1–10 of 48" heading="Rows per page" />
 */
export function UiPageSize({ table, label, heading = 'Rows per page', sizes = [10, 25, 50, 100] }: UiPageSizeProps) {
  return (
    <ui-page-size>
      <UiMenuTrigger menu={
        <UiMenu className="ui-page-size-menu" aria-label={heading || undefined}>
          {heading && <UiMenuHeading>{heading}</UiMenuHeading>}
          {sizes.map(size => (
            <UiMenuItemRadio key={size} checked={size === table.pageSize} onTriggered={() => table.setPageSize(size)}>{size}</UiMenuItemRadio>
          ))}
        </UiMenu>
      }>
        <UiButton variant="secondary" size="sm" type="button">
          {` ${label} `}
          <NgIcon svg={lucideChevronsUpDown} />
        </UiButton>
      </UiMenuTrigger>
    </ui-page-size>
  );
}
