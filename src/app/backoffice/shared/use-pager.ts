/* A table's pages: the list cut into pages of so many rows (shared/pager.tsx shows them) */
import { useState } from 'react';

export const PAGE_SIZES = [10, 20, 50];

export interface Pager<T> {
  rows: T[];
  total: number;
  size: number;
  current: number;
  pageCount: number;
  from: number;
  to: number;
  setPage: (page: number) => void;
  resize: (size: number) => void;
}

/** A list cut into pages; the page stays within the list when a filter shortens it */
export function usePager<T>(source: T[]): Pager<T> {
  const [size, setSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const total = source.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pageCount);
  return {
    rows: source.slice((current - 1) * size, current * size),
    total, size, current, pageCount,
    from: total ? (current - 1) * size + 1 : 0,
    to: Math.min(current * size, total),
    setPage,
    resize: next => {
      setSize(next);
      setPage(1);
    },
  };
}
