import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  lucideAArrowDown, lucideAArrowUp, lucideAccessibility, lucideActivity, lucideBell, lucideBlocks, lucideHistory, lucideLogOut, lucideMenu, lucideMoon,
  lucidePanelLeft, lucideSearch, lucideShieldCheck, lucideStethoscope, lucideSun, lucideUser, lucideX,
} from '../../icons';
import { session as sessionService, useSession } from '../../user-management/access/session';
import { ActivityDialog } from '../../user-management/activity/activity-dialog';
import { useAdmin } from '../../user-management/data/admin-store';
import { accountText, fullName, type Activity, type User } from '../../user-management/data/models';
import { ActivityText } from '../../user-management/shared/activity-text';
import { RoleBadges } from '../../user-management/shared/badges';
import { idleTimeoutLabel, useFormat } from '../../user-management/shared/formatting';
import {
  announce, cx, NgIcon, useMediaQuery, useUiAccessibleView, useUiScale, useUiTheme, UiAvatar, UiMenu, UiMenuDivider, UiMenuHeading, UiMenuItem,
  UiMenuItemCheckbox, UiMenuItemRadio, UiMenuTrigger, UiSegmented, UiTooltip, type UiConnectedPosition, type UiOption,
} from '../../user-management/ui';
import { LANGUAGES, useLanguage, type LanguageCode } from '../language.service';
import { useSidebarState } from '../sidebar/sidebar-state';
import './navbar.scss';

/** The most people the search shows as you type; the rest are a click away on the users list */
const QUICK_RESULTS = 6;

/** When the bell menu was last opened, so its dot means "new since you looked" */
const ACTIVITY_SEEN_KEY = 'activity-seen';

/** Menus open under their button, lined up with its right edge, or above it when there is no room below */
const MENU_POSITION: UiConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
];

/** TH | EN on screen; each language's own name for screen readers, said in that language */
const LANGUAGE_OPTIONS: UiOption<LanguageCode>[] = LANGUAGES.map(lang => ({
  value: lang.code,
  label: lang.code.toUpperCase(),
  ariaLabel: lang.label,
  lang: lang.code,
}));

// Search opens with Ctrl+K, or Cmd+K on a Mac
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const searchShortcutLabel = isMac ? '⌘K' : 'Ctrl K';
const searchShortcutKeys = isMac ? 'Meta+K' : 'Control+K';
/** The shortcut in words, for its tooltip */
const searchShortcutName = isMac ? 'Command + K' : 'Control + K';

export function Navbar() {
  const f = useFormat();
  const { t } = f;
  const navigate = useNavigate();
  const store = useAdmin();
  const session = useSession();
  const sidebar = useSidebarState();
  const theme = useUiTheme();
  const uiScale = useUiScale();
  const accessibleView = useUiAccessibleView();
  const language = useLanguage();
  /** Phones: the language switch moves from the bar into the account menu */
  const isPhone = useMediaQuery('(max-width: 575.98px)');
  const search = useRef<HTMLInputElement>(null);

  /** How long before the app signs out someone who is away, when the settings say it should (WCAG 2.2.6) */
  const idleTimeout = store.settings.sessionTimeoutMinutes ? idleTimeoutLabel(t, store.settings.sessionTimeoutMinutes) : '';
  const themeToggleLabel = theme.isDark ? 'Switch to light mode' : 'Switch to dark mode';

  /* Display size */

  const scaleNow = `${t('Display size')} ${Math.round(uiScale.scale * 100)}%`;
  const scaleHint = t('displaySizeNext', { size: `${Math.round(uiScale.next * 100)}%` });

  /** One size up, or back to 100%; screen readers hear the new size. A press with the pointer (not a key) holds the bar's
   * controls at their size until the pointer leaves the button. */
  const stepScale = (event: MouseEvent) => {
    useUiScale.getState().step({ hold: event.detail > 0 });
    const scale = useUiScale.getState().scale;
    void announce(`${t('Display size')} ${Math.round(scale * 100)}%`);
  };

  // Leaving the page with the bar's controls held at their size: the next bar starts at the size of the rest
  useEffect(() => () => useUiScale.getState().release(), []);

  /* Recent activity */

  const recentActivity = store.activity.slice(0, 4);
  /** The entry open in the details dialog */
  const [selectedEntry, setSelectedEntry] = useState<Activity | null>(null);
  const [activitySeenAt, setActivitySeenAt] = useState(() => readStorage(ACTIVITY_SEEN_KEY) ?? '');
  /** Something was logged after the bell menu was last opened (the log is newest first) */
  const hasNewActivity = (store.activity[0]?.at ?? '') > activitySeenAt;

  const markActivitySeen = () => {
    const latest = store.activity[0]?.at;
    if (latest) {
      setActivitySeenAt(latest);
      writeStorage(ACTIVITY_SEEN_KEY, latest);
    }
  };

  /** Who did it; nothing for what the server did by itself */
  const actorName = (id: string | null) => {
    const user = store.usersById.get(id ?? '');
    return user ? fullName(user) : '';
  };
  const actorAvatar = (id: string | null) => store.usersById.get(id ?? '')?.avatar ?? '';

  /* Search */

  /** On phones the search field is hidden until the search button opens it over the bar */
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  /** The person picked with the arrow keys; one past the last is "see all results", -1 none */
  const [activeIndex, setActiveIndex] = useState(-1);

  /** Everyone the text matches, as the users list searches: name, email or phone. Names that start with it first. */
  const needle = query.trim().toLowerCase();
  const matches: User[] = !needle ? [] : store.users
    .filter(user => fullName(user).toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle) || user.phone.includes(needle))
    .sort((a, b) => Number(!fullName(a).toLowerCase().startsWith(needle)) - Number(!fullName(b).toLowerCase().startsWith(needle)));
  const results = matches.slice(0, QUICK_RESULTS);
  const resultsShown = searchFocused && matches.length > 0;
  const [focusField, setFocusField] = useState(0);

  useEffect(() => {
    if (focusField) {
      search.current?.focus();
    }
  }, [focusField]);

  const typed = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);
  };

  const closeSearch = () => setSearchOpen(false);

  const openSearch = () => {
    setSearchOpen(true);
    setFocusField(count => count + 1);
  };

  const finishSearch = () => {
    setQuery('');
    setActiveIndex(-1);
    setSearchFocused(false);
    search.current?.blur();
    closeSearch();
  };

  /** Opens the user list filtered by the search text */
  const searchUsers = (text: string) => {
    closeSearch();
    const q = text.trim();
    void navigate(q ? `/users?q=${encodeURIComponent(q)}` : '/users');
  };

  /** Enter with nobody picked: the users list, filtered by the text */
  const submitSearch = () => {
    const text = query;
    finishSearch();
    searchUsers(text);
  };

  const searchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const options = results.length + (matches.length ? 1 : 0);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      // Past either end the field itself is picked again (-1), as in most search boxes
      if (options) {
        setActiveIndex(index => event.key === 'ArrowDown'
          ? (index + 1 >= options ? -1 : index + 1)
          : (index - 1 < -1 ? options - 1 : index - 1));
      }
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      search.current?.closest('form')?.querySelector<HTMLAnchorElement>(`#quick-search-${activeIndex}`)?.click();
    } else if (event.key === 'Escape') {
      // First the list goes, then the text, then (on phones) the field
      if (activeIndex >= 0 || resultsShown) {
        setActiveIndex(-1);
        setSearchFocused(false);
      } else if (query) {
        setQuery('');
      } else {
        closeSearch();
      }
    }
  };

  /** The list closes once the keyboard leaves the search, not when a click lands on one of its people */
  const searchFocusOut = (event: FocusEvent<HTMLFormElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setSearchFocused(false);
      setActiveIndex(-1);
    }
  };

  const canSearch = session.canSomewhere('users.view');
  useEffect(() => {
    const focusSearchOnShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (isMac ? event.metaKey : event.ctrlKey) && canSearch) {
        event.preventDefault();
        openSearch();
      }
    };
    document.addEventListener('keydown', focusSearchOnShortcut);
    return () => document.removeEventListener('keydown', focusSearchOnShortcut);
  }, [canSearch]);

  /* Sidebar */

  const iconOnlyToggled = useRef(false);
  /** Narrows the pinned sidebar to its icons, or back */
  const toggleSidebar = () => {
    iconOnlyToggled.current = !iconOnlyToggled.current;
    document.body.classList.toggle('sidebar-icon-only', iconOnlyToggled.current);
  };

  const me = session.user;
  const searchCount = searchFocused && query.trim() ? t('searchResultCount', { count: matches.length }) : '';

  return (
    <app-navbar>
      {/* The banner landmark; the sidebar is the navigation */}
      <header className="navbar">
        <div className="navbar-brand-wrapper">
          {/* Below 992px: the menu button first, then the logo, as most apps place them */}
          <button className="menu-toggle icon-button" type="button" onClick={sidebar.toggle} aria-controls="sidebar" aria-expanded={sidebar.open}
            aria-label={t(sidebar.open ? 'Close menu' : 'Open menu')}>
            <NgIcon svg={sidebar.open ? lucideX : lucideMenu} />
          </button>
          <Link className="navbar-brand brand-logo" to="/">
            <img src="assets/images/logo.svg" alt="logo" className="logo-dark" />
            <img src="assets/images/logo-light.svg" alt="logo" className="logo-light" />
          </Link>
          <Link className="navbar-brand brand-logo-mini" to="/"><img src="assets/images/logo-mini.svg" alt="logo" /></Link>
          <button className="navbar-toggler icon-button" type="button" onClick={toggleSidebar} title={t('Toggle menu')} aria-label={t('Toggle menu')}>
            <NgIcon svg={lucidePanelLeft} />
          </button>
        </div>
        <div className="navbar-menu-wrapper">
          {/* Search on the left, where it is found first. On phones the search button opens it over the bar. */}
          {canSearch && (
            // People show as you type (an ARIA combobox): arrow keys pick one, Enter opens it, or the whole list when none is picked
            <form className={cx('search-form', searchOpen && 'search-open')} role="search" onSubmit={event => { event.preventDefault(); submitSearch(); }} onBlur={searchFocusOut}>
              <NgIcon svg={lucideSearch} className="search-icon" />
              <input ref={search} type="search" className="search-input" role="combobox" aria-autocomplete="list" aria-controls="quick-search-results"
                aria-expanded={resultsShown} aria-activedescendant={activeIndex >= 0 ? `quick-search-${activeIndex}` : undefined}
                placeholder={t('Search users')} aria-label={t('Search users')} aria-keyshortcuts={searchShortcutKeys}
                value={query} onChange={event => typed(event.target.value)} onFocus={() => setSearchFocused(true)} onKeyDown={searchKey} autoComplete="off" />
              <kbd className="search-shortcut" aria-hidden="true" title={t('searchShortcut', { keys: searchShortcutName })}>{searchShortcutLabel}</kbd>
              <button type="button" className="icon-button search-close" onClick={closeSearch} aria-label={t('Close')}>
                <NgIcon svg={lucideX} />
              </button>
              {searchFocused && query.trim() && (
                <div className="search-results">
                  <div id="quick-search-results" role="listbox" aria-label={t('Search users')}>
                    {results.map((user, index) => (
                      <Link key={user.id} className={cx('search-result', index === activeIndex && 'active')} role="option" tabIndex={-1} id={`quick-search-${index}`}
                        aria-selected={index === activeIndex} to={`/users/${user.id}`} onMouseDown={event => event.preventDefault()} onClick={finishSearch}>
                        <UiAvatar name={fullName(user)} src={user.avatar} size="sm" />
                        <span className="search-result-text">
                          <span className="search-result-name">{fullName(user)}</span>
                          <span className="search-result-detail">{user.email}</span>
                        </span>
                        <RoleBadges user={user} max={1} />
                      </Link>
                    ))}
                    {matches.length > 0 && (
                      <Link className={cx('search-result search-all', activeIndex === results.length && 'active')} role="option" tabIndex={-1}
                        id={`quick-search-${results.length}`} aria-selected={activeIndex === results.length}
                        to={`/users?q=${encodeURIComponent(query.trim())}`} onMouseDown={event => event.preventDefault()} onClick={finishSearch}>
                        {` ${t('seeAllResults', { count: matches.length })} `}
                      </Link>
                    )}
                  </div>
                  {!matches.length && <p className="search-empty">{t('No users found')}</p>}
                </div>
              )}
              <span className="ui-sr-only" aria-live="polite">{searchCount}</span>
            </form>
          )}

          <ul className="navbar-actions">
            {canSearch && (
              <li className="search-button-item">
                <button type="button" className="icon-button" onClick={openSearch} aria-label={t('Search users')}>
                  <NgIcon svg={lucideSearch} />
                </button>
              </li>
            )}

            {/* The dot means something was logged since the menu was last opened */}
            {session.canSomewhere('activity.view') && (
              <li>
                <UiMenuTrigger position={MENU_POSITION} onOpened={markActivitySeen} menu={
                  <UiMenu className="activity-menu" aria-label={t('Recent activity')}>
                    <UiMenuHeading>{t('Recent activity')}</UiMenuHeading>
                    {recentActivity.map(entry => (
                      <UiMenuItem key={entry.id} className="activity-item" onTriggered={() => setSelectedEntry(entry)}>
                        <UiAvatar name={actorName(entry.actorId)} src={actorAvatar(entry.actorId)} size="sm" />
                        <span className="activity-item-text">
                          <ActivityText entry={entry} />
                          <span className="activity-item-time">{f.timeAgo(entry.at)}</span>
                        </span>
                      </UiMenuItem>
                    ))}
                    {recentActivity.length === 0 && <p className="activity-empty">{t('No activity yet')}</p>}
                    <UiMenuDivider />
                    <UiMenuItem to="/activity" icon={lucideHistory}>{t('View all')}<span className="ui-sr-only"> {t('Activity log')}</span></UiMenuItem>
                  </UiMenu>
                }>
                  <button type="button" className="icon-button count-indicator" aria-label={t(hasNewActivity ? 'Recent activity, new items' : 'Recent activity')}>
                    <NgIcon svg={lucideBell} />
                    {hasNewActivity && <span className="count" aria-hidden="true"></span>}
                  </button>
                </UiMenuTrigger>
              </li>
            )}

            <li>
              <button type="button" className="icon-button theme-toggle" title={t(themeToggleLabel)} aria-label={t(themeToggleLabel)} onClick={theme.toggle}>
                <NgIcon svg={theme.isDark ? lucideSun : lucideMoon} />
              </button>
            </li>

            {/* The size of the whole UI, for those who find small text hard to read: a press steps up (A↑), from the largest
                back to 100% (A↓). While the pointer stays on it the bar's controls keep their size, so it does not move away. */}
            <li className="scale-item" onMouseLeave={() => useUiScale.getState().release()}>
              <UiTooltip text={scaleNow} detail={scaleHint} align="end">
                <button type="button" className="icon-button" aria-label={`${scaleNow} · ${scaleHint}`} onClick={stepScale}>
                  <NgIcon svg={uiScale.atLargest ? lucideAArrowDown : lucideAArrowUp} />
                </button>
              </UiTooltip>
            </li>
            <li className="navbar-divider" aria-hidden="true"></li>

            {/* Both languages in view, one click to switch; on phones it moves into the account menu */}
            <li className="language-item">
              <UiSegmented className="language-switch" size="sm" options={LANGUAGE_OPTIONS} value={language.current} onValueChange={language.use} ariaLabel={t('Language')} />
            </li>

            {me && (
              // On every screen size: profile and sign out live here. Below 1200px only the photo shows.
              <li>
                <UiMenuTrigger position={MENU_POSITION} menu={
                  // A menu holds only items, so the card is read out as the menu's description instead
                  <UiMenu className="account-menu" aria-label={t('accountMenu', { name: fullName(me) })} aria-describedby="account-card">
                    <div className="account-card" id="account-card" aria-hidden="true">
                      <UiAvatar name={fullName(me)} src={me.avatar} size="md" />
                      <div className="account-text">
                        <span className="account-name">{fullName(me)}</span>
                        <span className="account-email">{me.email}</span>
                        <RoleBadges className="account-role" user={me} max={3} />
                        {idleTimeout && <span className="account-idle">{t('idleNotice', { time: idleTimeout })}</span>}
                      </div>
                    </div>
                    <UiMenuDivider />
                    {isPhone && (
                      <>
                        <UiMenuHeading>{t('Language')}</UiMenuHeading>
                        {LANGUAGE_OPTIONS.map(option => (
                          <UiMenuItemRadio key={option.value} checked={option.value === language.current} lang={option.lang}
                            onTriggered={() => language.use(option.value)}>{option.ariaLabel}</UiMenuItemRadio>
                        ))}
                        <UiMenuDivider />
                      </>
                    )}
                    <UiMenuItem icon={lucideUser} to={`/users/${me.id}`}>{t('My Profile')}</UiMenuItem>
                    <UiMenuItem icon={lucideShieldCheck} to={`/users/${me.id}?tab=security`}>{t('Security and devices')}</UiMenuItem>
                    {session.canSomewhere('activity.view') && (
                      <UiMenuItem icon={lucideActivity} to={`/activity?user=${me.id}`}>{t('My activity')}</UiMenuItem>
                    )}
                    <UiMenuItemCheckbox icon={lucideAccessibility} checked={accessibleView.on} onTriggered={accessibleView.toggle}>{t('Accessible view')}</UiMenuItemCheckbox>
                    <UiMenuItem icon={lucideBlocks} to="/ui-kit">{t('Component gallery')}</UiMenuItem>
                    <UiMenuItem icon={lucideStethoscope} to="/clinic">{t('Clinical work')}</UiMenuItem>
                    <UiMenuDivider />
                    <UiMenuItem tone="danger" icon={lucideLogOut} onTriggered={() => void sessionService.signOut()}>{t('Sign Out')}</UiMenuItem>
                  </UiMenu>
                }>
                  <button type="button" className="user-button" aria-label={t('accountMenu', { name: accountText(me, session.role?.name, session.roles.length) })}>
                    <UiAvatar name={fullName(me)} src={me.avatar} size="sm" />
                    <span className="user-text" aria-hidden="true">
                      {/* A space between name and role, which the column does not show, so they read as words, as the button's name has them */}
                      <span className="user-name">{fullName(me)}</span>{' '}
                      <span className="user-role">{session.role?.name}{session.roles.length > 1 && ` +${session.roles.length - 1}`}</span>
                    </span>
                  </button>
                </UiMenuTrigger>
              </li>
            )}
          </ul>
        </div>
      </header>

      <ActivityDialog entry={selectedEntry} onClosed={() => setSelectedEntry(null)} />
    </app-navbar>
  );
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the dot then just shows again next time
  }
}
