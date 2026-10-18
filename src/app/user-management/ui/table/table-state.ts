import { useCallback, useMemo, useState } from 'react';

export type UiSortDirection = 'asc' | 'desc';

export interface UiTableStateOptions<T, K extends string = string> {
  /** All rows; the state follows them as they change */
  rows: readonly T[];
  /** A stable id for each row, used for selection */
  id: (row: T) => string | number;
  /** Does the row match the search text (already trimmed and lower-cased)? */
  search?: (row: T, query: string) => boolean;
  /** Extra filters, such as a status tab; return false to hide the row. Keep it the same function while the filter is (useCallback). */
  filter?: (row: T) => boolean;
  /** Rows that can be ticked, such as the ones the reader may change; every row when left out */
  selectable?: (row: T) => boolean;
  /** Compare functions for the sortable columns */
  sorters?: Partial<Record<K, (a: T, b: T) => number>>;
  pageSize?: number;
  /** The order before the reader picks one, such as newest first for a log */
  initialSort?: { key: K; direction: UiSortDirection };
  /** Remembers the reader's page size in this browser under this key, such as "users-page-size" */
  pageSizeKey?: string;
}

export interface UiTableState<T, K extends string = string> {
  query: string;
  sortKey: K | null;
  sortDirection: UiSortDirection;
  page: number;
  /** Rows per page; change it with `setPageSize` to keep the reader's place */
  pageSize: number;
  selectedIds: ReadonlySet<string | number>;
  /** Rows that pass the search and filters, in their original order */
  filtered: T[];
  sorted: T[];
  total: number;
  pageCount: number;
  /** The page in range, even after rows were removed */
  currentPage: number;
  /** Rows on the current page */
  pageRows: T[];
  /** 1-based positions of the first and last row shown, for "Showing 11–20 of 57" */
  range: { from: number; to: number; total: number };
  /** Changes when the reader asks for another view (page, page size, sort, search or filters), not when rows change */
  view: readonly unknown[];
  /** Selected rows that still exist and can still be selected */
  selectedRows: T[];
  allOnPageSelected: boolean;
  someOnPageSelected: boolean;
  /** Whether the page has any row to tick, so the "select all" box has something to do */
  pageHasSelectable: boolean;
  setPage(page: number): void;
  search(query: string): void;
  /** Sort by a column; asking again for the same column reverses the order */
  sortBy(key: K): void;
  /** Sort by a column in the given order, such as newest first from a link */
  setSort(key: K | null, direction: UiSortDirection): void;
  isSelected(row: T): boolean;
  isSelectable(row: T): boolean;
  toggle(row: T): void;
  /** Select every row on the page, or clear them if they are all selected already */
  togglePage(): void;
  clearSelection(): void;
  /** Shows `size` rows per page, on the page that holds the row that was first on screen */
  setPageSize(size: number): void;
  /** Back to page one, for example after a filter changed */
  resetPage(): void;
}

/**
 * Search, filter, sort, page and select for a table. It holds no markup, so any table design can use it.
 *
 *   const table = useUiTableState({
 *     rows: users,
 *     id: user => user.id,
 *     search: (user, q) => user.name.toLowerCase().includes(q),
 *     sorters: { name: (a, b) => a.name.localeCompare(b.name) },
 *   });
 *
 *   {table.pageRows.map(user => …)}
 */
export function useUiTableState<T, K extends string = string>(options: UiTableStateOptions<T, K>): UiTableState<T, K> {
  const { rows, id, search: matches, filter, selectable, sorters, pageSizeKey } = options;
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<K | null>(options.initialSort?.key ?? null);
  const [sortDirection, setSortDirection] = useState<UiSortDirection>(options.initialSort?.direction ?? 'asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeValue] = useState(() => readNumber(pageSizeKey) ?? options.pageSize ?? 10);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string | number>>(new Set());

  const isSelectable = useCallback((row: T) => selectable?.(row) ?? true, [selectable]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(row => (!filter || filter(row)) && (!needle || !matches || matches(row, needle)));
  }, [rows, query, filter, matches]);

  const sorted = useMemo(() => {
    const compare = sortKey ? sorters?.[sortKey] : undefined;
    if (!compare) {
      return filtered;
    }
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => compare(a, b) * direction);
  }, [filtered, sortKey, sortDirection, sorters]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);
  const from = total ? (currentPage - 1) * pageSize + 1 : 0;
  const range = useMemo(() => ({ from, to: Math.min(from + pageSize - 1, total), total }), [from, pageSize, total]);
  const view = useMemo(() => [currentPage, pageSize, sortKey, sortDirection, query, filter], [currentPage, pageSize, sortKey, sortDirection, query, filter]);

  const selectedRows = useMemo(() => rows.filter(row => selectedIds.has(id(row)) && isSelectable(row)), [rows, selectedIds, id, isSelectable]);
  /** Rows on the current page that can be ticked */
  const selectableOnPage = useMemo(() => pageRows.filter(isSelectable), [pageRows, isSelectable]);
  const allOnPageSelected = selectableOnPage.length > 0 && selectableOnPage.every(row => selectedIds.has(id(row)));
  const someOnPageSelected = !allOnPageSelected && selectableOnPage.some(row => selectedIds.has(id(row)));

  return {
    query, sortKey, sortDirection, page, pageSize, selectedIds, filtered, sorted, total, pageCount, currentPage, pageRows, range, view,
    selectedRows, allOnPageSelected, someOnPageSelected, pageHasSelectable: selectableOnPage.length > 0,
    setPage,
    search(next) {
      setQuery(next);
      setPage(1);
    },
    sortBy(key) {
      if (sortKey === key) {
        setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
      } else {
        setSortKey(key);
        setSortDirection('asc');
      }
    },
    setSort(key, direction) {
      setSortKey(key);
      setSortDirection(direction);
    },
    isSelected: row => selectedIds.has(id(row)),
    isSelectable,
    toggle(row) {
      if (!isSelectable(row)) {
        return;
      }
      const rowId = id(row);
      setSelectedIds(ids => {
        const next = new Set(ids);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        return next;
      });
    },
    togglePage() {
      const ids = selectableOnPage.map(id);
      const select = !allOnPageSelected;
      setSelectedIds(selected => {
        const next = new Set(selected);
        ids.forEach(rowId => select ? next.add(rowId) : next.delete(rowId));
        return next;
      });
    },
    clearSelection: () => setSelectedIds(new Set()),
    setPageSize(size) {
      const firstIndex = (currentPage - 1) * pageSize;
      setPageSizeValue(size);
      writeNumber(pageSizeKey, size);
      setPage(Math.floor(firstIndex / size) + 1);
    },
    resetPage: () => setPage(1),
  };
}

// Storage can be missing or blocked (private windows, tests); the default page size then applies
function readNumber(key: string | undefined): number | null {
  try {
    const value = key ? Number(localStorage.getItem(key)) : NaN;
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string | undefined, value: number) {
  try {
    if (key) {
      localStorage.setItem(key, String(value));
    }
  } catch {
    // Remembered for this visit only
  }
}
