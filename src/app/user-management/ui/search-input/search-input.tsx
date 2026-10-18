import { useEffect, useImperativeHandle, useRef, type HTMLAttributes, type Ref } from 'react';

import { lucideSearch, lucideX } from '../../../icons';
import { cx } from '../core/types';
import { NgIcon } from '../icon/icon';
import './search-input.scss';

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';
const shortcutKeys = isMac ? 'Meta+K' : 'Control+K';

export interface UiSearchInputHandle {
  focus(): void;
}

export interface UiSearchInputProps extends Omit<HTMLAttributes<HTMLElement>, 'onSubmit'> {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  clearLabel?: string;
  size?: 'md' | 'sm';
  /** Focus this field with Ctrl+K, or ⌘K on a Mac. Use on one field per page. */
  shortcut?: boolean;
  /** Enter was pressed */
  onSubmitted?: (value: string) => void;
  ref?: Ref<UiSearchInputHandle>;
}

/**
 * A search field with an icon, a clear button and an optional Ctrl+K (⌘K on Mac) shortcut.
 * Escape clears it; Enter calls `onSubmitted`. Set `size="sm"` to match small inputs and buttons in a toolbar.
 *
 *   <UiSearchInput value={query} onValueChange={setQuery} placeholder="Search users" shortcut />
 */
export function UiSearchInput({
  value = '', onValueChange, placeholder = 'Search', ariaLabel = '', clearLabel = 'Clear search', size = 'md', shortcut = false, onSubmitted,
  ref, className, ...rest
}: UiSearchInputProps) {
  const field = useRef<HTMLInputElement>(null);
  const focus = () => field.current?.focus();
  useImperativeHandle(ref, () => ({ focus }), []);

  useEffect(() => {
    if (!shortcut) {
      return undefined;
    }
    const focusOnShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (isMac ? event.metaKey : event.ctrlKey)) {
        event.preventDefault();
        focus();
      }
    };
    document.addEventListener('keydown', focusOnShortcut);
    return () => document.removeEventListener('keydown', focusOnShortcut);
  }, [shortcut]);

  const clear = () => {
    onValueChange?.('');
    focus();
  };

  return (
    <ui-search-input {...rest} className={cx('ui-search-input', size === 'sm' && 'ui-search-input-sm', className)}>
      <NgIcon svg={lucideSearch} className="ui-search-icon" />
      <input ref={field} type="search" className={cx('ui-input ui-search-field', size === 'sm' && 'ui-input-sm')}
        placeholder={placeholder} aria-label={ariaLabel || placeholder} aria-keyshortcuts={shortcut ? shortcutKeys : undefined}
        value={value} onChange={event => onValueChange?.(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            onSubmitted?.(value);
          } else if (event.key === 'Escape') {
            clear();
          }
        }} />
      {value
        ? <button type="button" className="ui-search-clear" aria-label={clearLabel} onClick={clear}><NgIcon svg={lucideX} /></button>
        : shortcut && <kbd className="ui-search-kbd" aria-hidden="true">{shortcutLabel}</kbd>}
    </ui-search-input>
  );
}
