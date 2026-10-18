import type { FocusEvent, HTMLAttributes } from 'react';

import { cx, type UiOption } from '../core/types';
import './filter-chips.scss';

export interface UiFilterChipsProps<T> extends HTMLAttributes<HTMLElement> {
  options?: UiOption<T>[];
  value?: T | null;
  onValueChange?: (value: T) => void;
  ariaLabel?: string;
  /** One line that scrolls sideways rather than wrapping */
  scroll?: boolean;
}

/**
 * A row of pill filters, each with an optional count. One is active at a time.
 *
 *   <UiFilterChips options={statusFilters} value={status} onValueChange={setStatus} />
 *
 * They wrap onto more lines when they do not fit; with `scroll` they stay on one line that scrolls sideways
 * instead, which keeps a phone's toolbar short.
 */
export function UiFilterChips<T = string>({ options = [], value = null, onValueChange, ariaLabel = '', scroll = false, className, ...rest }: UiFilterChipsProps<T>) {
  /** In a row that scrolls sideways, the browser may leave a focused chip partly out of view (WCAG 2.4.11) */
  const reveal = (event: FocusEvent) => {
    if (scroll && event.target instanceof HTMLElement) {
      event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };
  return (
    <ui-filter-chips role="group" aria-label={ariaLabel || undefined} {...rest} onFocus={reveal}
      className={cx('ui-filter-chips', scroll && 'ui-filter-chips-scroll', className)}>
      {options.map(option => (
        <button key={String(option.value)} type="button" className={cx('ui-chip', option.value === value && 'ui-chip-active')}
          aria-pressed={option.value === value} onClick={() => onValueChange?.(option.value)}>
          {` ${option.label} `}
          {option.count !== undefined && <span className="ui-chip-count">{option.count}</span>}
        </button>
      ))}
    </ui-filter-chips>
  );
}
