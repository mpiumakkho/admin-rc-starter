/* The bar's search, as the admin's: the back office's pages and the work waiting, as you type (ux/02: global search) */
import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { lucideSearch, lucideX } from '../../icons';
import { cx, NgIcon } from '../../user-management/ui';
import { useBackofficeStore } from '../backoffice.store';
import { boI18n, useBoI18n } from '../i18n/bo-i18n';
import { searchBackoffice } from './search-hits';

// Ctrl+K, or Cmd+K on a Mac, as the admin's
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';
const shortcutKeys = isMac ? 'Meta+K' : 'Control+K';

export function BackofficeSearch() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const navigate = useNavigate();
  const field = useRef<HTMLInputElement>(null);
  /** On phones the field is hidden until the search button opens it over the bar */
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  /** The hit picked with the arrow keys; -1 none */
  const [active, setActive] = useState(-1);

  const hits = searchBackoffice(query, store.worklist, s => boI18n.t(s));
  const shown = focused && hits.length > 0;

  const openSearch = () => {
    setSearchOpen(true);
    requestAnimationFrame(() => field.current?.focus());
  };

  const finish = () => {
    setQuery('');
    setActive(-1);
    setFocused(false);
    field.current?.blur();
    setSearchOpen(false);
  };

  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (isMac ? event.metaKey : event.ctrlKey)) {
        event.preventDefault();
        openSearch();
      }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);

  const key = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = hits.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      // Past either end the field itself is picked again (-1), as in most search boxes
      if (count) {
        setActive(index => event.key === 'ArrowDown'
          ? (index + 1 >= count ? -1 : index + 1)
          : (index - 1 < -1 ? count - 1 : index - 1));
      }
    } else if (event.key === 'Escape') {
      // First the list goes, then the text, then (on phones) the field
      if (active >= 0 || shown) {
        setActive(-1);
        setFocused(false);
      } else if (query) {
        setQuery('');
      } else {
        setSearchOpen(false);
      }
    }
  };

  /** Enter: the hit picked, or the first */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const hit = hits[Math.max(active, 0)];
    if (hit) {
      finish();
      void navigate(hit.path);
    }
  };

  /** The list closes once the keyboard leaves the search, not when a click lands on a hit */
  const focusOut = (event: FocusEvent<HTMLFormElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocused(false);
      setActive(-1);
    }
  };

  return (
    <>
      {/* Phones: the field opens over the bar from this button */}
      <button type="button" className="icon-button search-button" onClick={openSearch} aria-label={tx('ค้นหาใน BackOffice')}>
        <NgIcon svg={lucideSearch} aria-hidden="true" />
      </button>
      <form className={cx('search-form', searchOpen && 'search-open')} role="search" onSubmit={submit} onBlur={focusOut}>
        <NgIcon svg={lucideSearch} className="search-icon" aria-hidden="true" />
        {/* Hits show as you type (an ARIA combobox): arrow keys pick one, Enter opens it, or the first when none is picked */}
        <input ref={field} type="search" className="search-input" role="combobox" aria-autocomplete="list" aria-controls="bo-search-results"
          aria-expanded={shown} aria-activedescendant={active >= 0 ? `bo-search-${active}` : undefined}
          placeholder={tx('ค้นหาหน้า งาน หรือเลขที่')} aria-label={tx('ค้นหาใน BackOffice')} aria-keyshortcuts={shortcutKeys}
          value={query} onChange={event => { setQuery(event.target.value); setActive(-1); }} onFocus={() => setFocused(true)} onKeyDown={key} autoComplete="off" />
        <kbd className="search-shortcut" aria-hidden="true">{shortcutLabel}</kbd>
        <button type="button" className="icon-button search-close" onClick={finish} aria-label={tx('ปิด')}>
          <NgIcon svg={lucideX} aria-hidden="true" />
        </button>
        {focused && query.trim() && (
          <div className="search-results">
            <div id="bo-search-results" role="listbox" aria-label={tx('ค้นหาใน BackOffice')}>
              {hits.map((hit, index) => (
                <Link key={hit.key} className={cx('search-result', index === active && 'active')} role="option" tabIndex={-1} id={`bo-search-${index}`}
                  aria-selected={index === active} to={hit.path} onMouseDown={event => event.preventDefault()} onClick={finish}>
                  <span className="search-result-icon" aria-hidden="true"><NgIcon svg={hit.icon} /></span>
                  <span className="search-result-text">
                    <span className="search-result-name">{hit.name}</span>
                    <span className="search-result-detail">{hit.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
            {!hits.length && <p className="search-empty">{tx('ไม่พบหน้าหรืองานที่ตรงกัน')}</p>}
          </div>
        )}
        <span className="ui-sr-only" aria-live="polite">{focused && query.trim() ? tx('พบ {n} รายการ', { n: hits.length }) : ''}</span>
      </form>
    </>
  );
}
