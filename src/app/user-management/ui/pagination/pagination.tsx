import { useLayoutEffect, useRef, type HTMLAttributes, type MouseEvent } from 'react';

import { lucideChevronLeft, lucideChevronRight, lucideChevronsLeft, lucideChevronsRight } from '../../../icons';
import { cx } from '../core/types';
import { NgIcon } from '../icon/icon';
import './pagination.scss';

/** The most page numbers shown at once */
const VISIBLE_PAGES = 5;

export interface UiPaginationProps extends HTMLAttributes<HTMLElement> {
  page?: number;
  onPageChange?: (page: number) => void;
  pageCount: number;
  firstLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  lastLabel?: string;
  ariaLabel?: string;
}

/**
 * Page buttons with previous and next. At most five page numbers show, with the current one in the middle where it
 * can be; with more pages than that, first and last buttons appear on the outside: << < 6 7 8 9 10 > >>
 *
 *   <UiPagination page={page} onPageChange={setPage} pageCount={12} />
 */
export function UiPagination({
  page = 1, onPageChange, pageCount, firstLabel = 'First page', previousLabel = 'Previous page', nextLabel = 'Next page',
  lastLabel = 'Last page', ariaLabel = 'Pagination', className, ...rest
}: UiPaginationProps) {
  const host = useRef<HTMLElement>(null);
  /** The button just pressed, to move focus off it once it turns off */
  const pressed = useRef<HTMLButtonElement | null>(null);

  const count = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), count);
  /** More pages than fit: the first and last buttons show */
  const hasMore = count > VISIBLE_PAGES;
  // Five pages with the current one in the middle, moved along at either end so there are always five
  const shown = Math.min(count, VISIBLE_PAGES);
  const start = Math.min(Math.max(1, current - Math.floor(VISIBLE_PAGES / 2)), count - shown + 1);
  const items = Array.from({ length: shown }, (_, index) => start + index);

  // First, previous, next and last turn off at either end; the keyboard focus moves to the current page instead of
  // being lost with them
  useLayoutEffect(() => {
    if (pressed.current?.disabled) {
      host.current?.querySelector<HTMLButtonElement>('.ui-page-active')?.focus();
    }
    pressed.current = null;
  });

  const go = (target: number, event: MouseEvent<HTMLButtonElement>) => {
    pressed.current = event.currentTarget;
    onPageChange?.(Math.min(Math.max(1, target), count));
  };

  return (
    <ui-pagination ref={host} role="navigation" aria-label={ariaLabel} {...rest} className={cx('ui-pagination', className)}>
      {hasMore && (
        <button type="button" className="ui-page ui-page-arrow" disabled={current <= 1} aria-label={firstLabel} onClick={event => go(1, event)}>
          <NgIcon svg={lucideChevronsLeft} />
        </button>
      )}
      <button type="button" className="ui-page ui-page-arrow" disabled={current <= 1} aria-label={previousLabel} onClick={event => go(current - 1, event)}>
        <NgIcon svg={lucideChevronLeft} />
      </button>
      {items.map(item => (
        <button key={item} type="button" className={cx('ui-page', item === current && 'ui-page-active')} aria-current={item === current ? 'page' : undefined}
          onClick={event => go(item, event)}>{item}</button>
      ))}
      <button type="button" className="ui-page ui-page-arrow" disabled={current >= count} aria-label={nextLabel} onClick={event => go(current + 1, event)}>
        <NgIcon svg={lucideChevronRight} />
      </button>
      {hasMore && (
        <button type="button" className="ui-page ui-page-arrow" disabled={current >= count} aria-label={lastLabel} onClick={event => go(count, event)}>
          <NgIcon svg={lucideChevronsRight} />
        </button>
      )}
    </ui-pagination>
  );
}
