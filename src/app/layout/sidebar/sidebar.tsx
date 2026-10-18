import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { lucideChevronRight } from '../../icons';
import { useSession } from '../../user-management/access/session';
import { useAdmin } from '../../user-management/data/admin-store';
import { cx, NgIcon } from '../../user-management/ui';
import { useNavigationEnd } from '../navigation-end';
import { MENU, type MenuItem, type MenuLink } from './menu';
import { useSidebarState } from './sidebar-state';
import './sidebar.scss';

/** Whether a link is the page shown, or one under it, as Angular's routerLinkActive (not exact) */
function linkActive(path: string, link: string | undefined): boolean {
  return !!link && (path === link || path.startsWith(link === '/' ? '/' : link + '/'));
}

/** The group that holds this address, so the current page is in view */
function groupFor(path: string): string | undefined {
  return MENU.flatMap(section => section.items)
    .find(item => item.children?.some(child => path === child.link || path.startsWith(child.link + '/')))?.label;
}

export function Sidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const session = useSession();
  const store = useAdmin();
  const state = useSidebarState();

  // Groups that are expanded, keyed by the group's label; the one holding the current page opens on load
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => {
    const group = groupFor(pathname);
    return new Set(group ? [group] : []);
  });
  /** In the icon-only layout, the item under the pointer shows its name and pages in a flyout */
  const [flyout, setFlyout] = useState<string | null>(null);

  // After every navigation: open the group that holds the page, and the menu makes way for it
  useNavigationEnd(location => {
    const group = groupFor(location.pathname);
    if (group) {
      setOpenGroups(groups => groups.has(group) ? groups : new Set(groups).add(group));
    }
    useSidebarState.getState().close();
  });

  // While the menu is open over the page, the page behind it does not scroll
  useEffect(() => {
    document.body.classList.toggle('menu-open', state.open);
  }, [state.open]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && useSidebarState.getState().close();
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);

  const allowed = (permission: MenuItem['permission']) => !permission || session.canSomewhere(permission);
  /** A page of a group: allowed, or one the signed-in user takes part in, while its setting is on */
  const shows = (link: MenuLink) => {
    const involved = link.tasks === 'accessReviews' && store.accessReviews.length > 0;
    return (allowed(link.permission) || involved) && (!link.setting || store.settings[link.setting]);
  };
  /** How many things wait for the signed-in user on a page, such as roles to decide in an access review */
  const waiting = (link: MenuLink) => link.tasks === 'accessReviews' ? store.accessReviewsWaiting : 0;
  /** The same for a whole group, shown on it while it is closed */
  const groupWaiting = (item: MenuItem) => (item.children ?? []).reduce((count, child) => count + waiting(child), 0);

  /** The menu without the pages the signed-in user's role does not allow, and without groups or sections left empty */
  const menu = MENU
    .map(section => ({
      ...section,
      items: section.items
        .filter(item => allowed(item.permission))
        .map(item => item.children ? { ...item, children: item.children.filter(shows) } : item)
        .filter(item => !item.children || item.children.length),
    }))
    .filter(section => section.items.length);

  const showFlyout = (label: string) => {
    if (document.body.classList.contains('sidebar-icon-only')) {
      setFlyout(label);
    }
  };
  const toggle = (group: string) => setOpenGroups(groups => {
    const next = new Set(groups);
    if (next.has(group)) {
      next.delete(group);
    } else {
      next.add(group);
    }
    return next;
  });

  return (
    <app-sidebar>
      {state.open && <div className="sidebar-backdrop" onClick={state.close} aria-hidden="true"></div>}
      <nav className={cx('sidebar sidebar-offcanvas', state.open && 'active')} id="sidebar" aria-label={t('Main menu')}>
        <ul className="menu">
          <li className="nav-item navbar-brand-mini-wrapper">
            <Link className="nav-link navbar-brand brand-logo-mini" to="/"><img src="assets/images/logo-mini.svg" alt="logo" /></Link>
          </li>
          {menu.map((section, sectionIndex) => (
            <Fragment key={sectionIndex}>
              {section.label && <li className="nav-item nav-category"><span className="nav-link">{t(section.label)}</span></li>}
              {section.items.map((item, index) => {
                if (item.children) {
                  const open = openGroups.has(item.label);
                  const count = !open ? groupWaiting(item) : 0;
                  const active = item.children.some(child => linkActive(pathname, child.link));
                  return (
                    // A group: a button that opens and closes its pages, marked while one of them is open
                    <li key={item.label} className={cx('nav-item nav-group', active && 'active', flyout === item.label && 'hover-open')}
                      onMouseEnter={() => showFlyout(item.label)} onMouseLeave={() => setFlyout(null)}>
                      <button type="button" className="nav-link" onClick={() => toggle(item.label)} aria-expanded={open} aria-controls={`menu-group-${index}`}>
                        <NgIcon svg={item.icon} className="menu-icon" />
                        <span className="menu-title">{t(item.label)}</span>
                        {count > 0 && (
                          <>
                            <span className="menu-count" aria-hidden="true">{count}</span>
                            <span className="ui-sr-only">{t('waitingForYou', { count })}</span>
                          </>
                        )}
                        <NgIcon svg={lucideChevronRight} className="menu-arrow" />
                      </button>
                      {/* Opens by animating its height in CSS; closed, its links are out of reach (inert) */}
                      <div className={cx('sub-menu-wrap', open && 'open')} id={`menu-group-${index}`} inert={!open && flyout !== item.label}>
                        <div className="sub-menu-clip">
                          <ul className="sub-menu">
                            {item.children.map(child => {
                              const childCount = waiting(child);
                              return (
                                <li key={child.link} className="nav-item">
                                  <Link className={cx('nav-link', linkActive(pathname, child.link) && 'active')} to={child.link}>
                                    {` ${t(child.label)} `}
                                    {childCount > 0 && (
                                      <>
                                        <span className="menu-count" aria-hidden="true">{childCount}</span>
                                        <span className="ui-sr-only">{t('waitingForYou', { count: childCount })}</span>
                                      </>
                                    )}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={item.label} className={cx('nav-item', linkActive(pathname, item.link) && 'active', flyout === item.label && 'hover-open')}
                    onMouseEnter={() => showFlyout(item.label)} onMouseLeave={() => setFlyout(null)}>
                    <Link className="nav-link" to={item.link!}>
                      <NgIcon svg={item.icon} className="menu-icon" />
                      <span className="menu-title">{t(item.label)}</span>
                    </Link>
                  </li>
                );
              })}
            </Fragment>
          ))}
        </ul>
      </nav>
    </app-sidebar>
  );
}
