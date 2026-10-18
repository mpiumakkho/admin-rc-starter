import { act, renderHook } from '@testing-library/react';
import { useCallback } from 'react';

import { useUiTableState, type UiTableStateOptions } from './table-state';

interface Row {
  id: number;
  name: string;
  team: string;
}

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: index + 1, name: `Person ${index + 1}`, team: index % 2 ? 'Sales' : 'Design' }));

const rowId = (row: Row) => row.id;
const byName = (row: Row, query: string) => row.name.toLowerCase().includes(query);
const sorters = { name: (a: Row, b: Row) => a.name.localeCompare(b.name), id: (a: Row, b: Row) => a.id - b.id };

describe('useUiTableState', () => {
  /** The table over `data`, with a team filter; rerender({ data, team }) changes them as signals would */
  const create = (data = rows(25)) => renderHook(({ data, team }: { data: Row[]; team: string | null }) => {
    const filter = useCallback((row: Row) => !team || row.team === team, [team]);
    return useUiTableState<Row, 'name' | 'id'>({ rows: data, id: rowId, search: byName, filter, sorters, pageSize: 10 });
  }, { initialProps: { data, team: null as string | null } });

  it('pages the rows', () => {
    const { result } = create();

    expect(result.current.pageCount).toBe(3);
    expect(result.current.pageRows.length).toBe(10);
    act(() => result.current.setPage(3));
    expect(result.current.pageRows.map(row => row.id)).toEqual([21, 22, 23, 24, 25]);
    expect(result.current.range).toEqual({ from: 21, to: 25, total: 25 });
  });

  it('searches and goes back to the first page', () => {
    const { result } = create();
    act(() => result.current.setPage(2));

    act(() => result.current.search('  PERSON 2'));

    expect(result.current.page).toBe(1);
    expect(result.current.pageRows.map(row => row.id)).toEqual([2, 20, 21, 22, 23, 24, 25]);
  });

  it('applies extra filters', () => {
    const { result, rerender } = create();

    rerender({ data: rows(25), team: 'Sales' });

    expect(result.current.total).toBe(12);
    expect(result.current.filtered.every(row => row.team === 'Sales')).toBe(true);
  });

  it('sorts, and reverses when asked again for the same column', () => {
    const { result } = create(rows(3));

    act(() => result.current.sortBy('id'));
    expect(result.current.pageRows.map(row => row.id)).toEqual([1, 2, 3]);
    act(() => result.current.sortBy('id'));
    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.pageRows.map(row => row.id)).toEqual([3, 2, 1]);
  });

  it('selects a page and forgets rows that are gone', () => {
    const data = rows(25);
    const { result, rerender } = create(data);

    act(() => result.current.togglePage());
    expect(result.current.allOnPageSelected).toBe(true);
    expect(result.current.selectedRows.length).toBe(10);

    act(() => result.current.toggle(data[0]));
    expect(result.current.someOnPageSelected).toBe(true);

    rerender({ data: data.slice(5), team: null });
    expect(result.current.selectedRows.map(row => row.id)).toEqual([6, 7, 8, 9, 10]);

    act(() => result.current.clearSelection());
    expect(result.current.selectedRows).toEqual([]);
  });

  it('only ticks rows that can be selected', () => {
    const data = rows(5);
    const { result, rerender } = renderHook(({ locked }: { locked: Set<number> }) => {
      const selectable = useCallback((row: Row) => !locked.has(row.id), [locked]);
      return useUiTableState<Row>({ rows: data, id: rowId, selectable } satisfies UiTableStateOptions<Row>);
    }, { initialProps: { locked: new Set([2, 4]) } });

    act(() => result.current.togglePage());
    act(() => result.current.toggle(data[1]));
    expect([...result.current.selectedIds]).toEqual([1, 3, 5]);
    expect(result.current.allOnPageSelected).toBe(true);

    // A row that becomes locked drops out of the selection
    rerender({ locked: new Set([2, 4, 5]) });
    expect(result.current.selectedRows.map(row => row.id)).toEqual([1, 3]);

    rerender({ locked: new Set([1, 2, 3, 4, 5]) });
    expect(result.current.pageHasSelectable).toBe(false);
    expect(result.current.allOnPageSelected).toBe(false);
  });

  it('keeps the page in range when rows are removed', () => {
    const { result, rerender } = create();
    act(() => result.current.setPage(3));

    rerender({ data: rows(12), team: null });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.pageRows.map(row => row.id)).toEqual([11, 12]);
  });
});
