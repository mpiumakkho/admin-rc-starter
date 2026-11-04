import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import {
  lucideAArrowDown, lucideAArrowUp, lucideAccessibility, lucideArrowLeft, lucideBell, lucideChevronRight, lucideDatabaseBackup, lucideLogOut, lucideMenu,
  lucideMoon, lucidePanelLeft, lucideStethoscope, lucideSun,
} from '../../icons';
import { useContentAnimate } from '../../layout/content-animate';
import { LANGUAGES, useLanguage, type LanguageCode } from '../../layout/language.service';
import { useNavigationEnd } from '../../layout/navigation-end';
import { session as sessionService, useSession } from '../../user-management/access/session';
import { accountText, fullName } from '../../user-management/data/models';
import { RoleBadges } from '../../user-management/shared/badges';
import {
  announce, cx, NgIcon, uiConfirm, useUiAccessibleView, useUiScale, useUiTheme, UiAvatar, UiMenu, UiMenuDivider, UiMenuItem, UiMenuItemCheckbox,
  UiMenuTrigger, UiTooltip, type UiConnectedPosition,
} from '../../user-management/ui';
import { setBackofficeNavigate } from '../backoffice-actions';
import { backofficeUi } from '../backoffice-ui';
import { preloadBackofficePages } from '../backoffice.routes';
import { backofficeStore, useBackofficeStore } from '../backoffice.store';
import { boI18n, useBoI18n } from '../i18n/bo-i18n';
import './backoffice.scss';
import { DialogHost } from './dialog-host';
import { BACKOFFICE_NAV, BRAND_ICON } from './nav';
import { BackofficeSearch } from './search';

const percent = (scale: number) => `${Math.round(scale * 100)}%`;
const SWITCH_TO: Record<LanguageCode, string> = { th: 'เปลี่ยนเป็นภาษาไทย', en: 'เปลี่ยนเป็นภาษาอังกฤษ' };
const MENU_POSITION: UiConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
];
/** The hospital the work is in: the tenant and hospital context the spec allows, and nothing finer */
const CONTEXT = { tenant: 'SLV', hospital: 'โรงพยาบาลสวนหลวงสัตวแพทย์' };
/** The groups with a page; the reserved ones never are here (nav.ts) */
const GROUPS = BACKOFFICE_NAV.filter(g => g.links.length);
const COLLAPSED_KEY = 'backoffice.sidebar.collapsed';
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; } };

/**
 * The back office: a sample of the hospital's administration (seph1-docs 26-backoffice-erp), in the app's own colors.
 * It fills the window on its own, without the admin sidebar (App.tsx), and opens from the account menu, as the clinical
 * workspace does. Its look is all in backoffice.scss, under .backoffice.
 *
 *   bar       the workspace's brand; the tenant and hospital it works in; notifications, theme, display size, language, the person
 *   sidebar   the spec's ten menu groups, those with a page; below 992px it slides in over the page
 *   main      the page
 */
export function BackofficeShellComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const theme = useUiTheme();
  const uiScale = useUiScale();
  const accessibleView = useUiAccessibleView();
  const language = useLanguage(state => state.current);
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const main = useRef<HTMLElement>(null);
  // Another page fades in where the page goes, the menu and bar staying put, as the admin's pages do
  useContentAnimate(main);

  // The actions move between the workspace's pages with the router
  useLayoutEffect(() => {
    setBackofficeNavigate(path => navigate(path));
  }, [navigate]);

  /** The menu, on narrow screens: open over the page */
  const [menuOpen, setMenuOpen] = useState(false);
  /** The group with the current page */
  const current = BACKOFFICE_NAV.find(g => g.links.some(l => location.pathname.startsWith(l.path)))?.key;
  /** The one group folded open, as the admin's menu: the current page's, until another is opened or this one closed */
  const [openKey, setOpenKey] = useState<string | null>(current ?? 'home');
  // Another page's group became current: it opens (state adjusted while rendering, as React advises)
  const [openFor, setOpenFor] = useState(current);
  if (openFor !== current) {
    setOpenFor(current);
    if (current) {
      setOpenKey(current);
    }
  }
  /** The menu folded to its icons (on wide screens), remembered on this device */
  const [collapsed, setCollapsed] = useState(readCollapsed);
  /** Wide enough for the menu beside the page (992px); narrower, it slides in whole and never folds */
  const [wide, setWide] = useState(true);
  const folded = collapsed && wide;
  /** Folded, the group whose pages show beside it, and how far down */
  const [flyoutKey, setFlyoutKey] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const flyoutTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const refocusing = useRef(false);
  const host = useRef<HTMLElement>(null);

  // A page was picked: the menu makes way for it, and the group with it opens
  const shownPath = useRef(location.pathname);
  useNavigationEnd(next => {
    // Another page starts at its top, as the admin's do; the query string alone keeps the place
    if (next.pathname !== shownPath.current) {
      shownPath.current = next.pathname;
      if (main.current) {
        main.current.scrollTop = 0;
      }
    }
    setMenuOpen(false);
    setFlyoutKey(null);
  });

  useEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => setWide(element.clientWidth >= 992));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.title = boI18n.t('SLV BackOffice — โรงพยาบาลสวนหลวงสัตวแพทย์');
  }, [language]);

  useEffect(() => () => useUiScale.getState().release(), []);

  // The other pages' code, while the browser is idle; only from a build, as the development server compiles each file
  // when asked and many at once overwhelm it (nor where the browser can't say when it is idle)
  useEffect(() => (import.meta.env.PROD && typeof window.requestIdleCallback === 'function' ? preloadBackofficePages() : undefined), []);

  const otherLanguage: LanguageCode = LANGUAGES.find(lang => lang.code !== language)?.code ?? 'th';
  const languageLabel = `${language.toUpperCase()} · ${tx(SWITCH_TO[otherLanguage])}`;
  const scaleNow = `${tx('ขนาดการแสดงผล')} ${percent(uiScale.scale)}`;
  const scaleHint = tx('กดเพื่อเปลี่ยนเป็น {size}', { size: percent(uiScale.next) });
  const themeLabel = theme.isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด';
  const counts = store.counts;

  const showFlyout = (key: string, event: SyntheticEvent) => {
    clearTimeout(flyoutTimer.current);
    const group = (event.currentTarget as HTMLElement).closest('.nav-group');
    // The page's display size zooms the document; the box is measured zoomed, the offset is set before zooming
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    setFlyoutTop(Math.round((group?.getBoundingClientRect().top ?? 0) / zoom));
    setFlyoutKey(key);
  };
  /** A short delay, so the pointer can cross from the icon to the pages */
  const hideFlyout = () => {
    clearTimeout(flyoutTimer.current);
    flyoutTimer.current = setTimeout(() => setFlyoutKey(null), 120);
  };
  /** Opens a group and closes the one open, or closes it; folded, shows or hides its pages beside it */
  const groupClicked = (key: string, event: MouseEvent) => {
    if (folded) {
      if (flyoutKey === key) { setFlyoutKey(null); } else { showFlyout(key, event); }
      return;
    }
    setOpenKey(openKey === key ? null : key);
  };
  const groupFocused = (key: string, event: FocusEvent) => {
    if (folded && !refocusing.current) {
      showFlyout(key, event);
    }
  };
  const flyoutLeft = (event: FocusEvent) => {
    const group = (event.currentTarget as HTMLElement).closest('.nav-group');
    if (!group?.contains(event.relatedTarget as Node | null)) {
      hideFlyout();
    }
  };
  /** Escape closes the pages and hands focus back to the group's icon, without opening them again */
  const closeFlyout = (key: string, event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }
    setFlyoutKey(null);
    refocusing.current = true;
    (document.querySelector(`[aria-controls="nav-${key}"]`) as HTMLElement | null)?.focus();
    refocusing.current = false;
  };
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
    setFlyoutKey(null);
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '0' : '1'); } catch { /* the menu just opens wide next time */ }
  };

  const stepScale = (event: MouseEvent) => {
    useUiScale.getState().step({ hold: event.detail > 0 });
    void announce(`${boI18n.t('ขนาดการแสดงผล')} ${percent(useUiScale.getState().scale)}`);
  };

  const skipToContent = (event: MouseEvent) => {
    event.preventDefault();
    main.current?.focus();
  };

  const resetSample = async () => {
    const confirmed = await uiConfirm.ask({
      title: boI18n.t('รีเซ็ตข้อมูลตัวอย่าง'),
      message: boI18n.t('คำขออนุมัติ ข้อยกเว้น และกิจกรรมที่เปลี่ยนไปในเครื่องนี้จะกลับไปเป็นข้อมูลตัวอย่างตั้งต้น ข้อมูลของงานตรวจรักษาไม่เปลี่ยน'),
      confirmLabel: boI18n.t('รีเซ็ตข้อมูล'),
      cancelLabel: boI18n.t('ยกเลิก'),
      tone: 'danger',
    });
    if (confirmed) {
      backofficeStore.reset();
      backofficeUi.toast('รีเซ็ตเป็นข้อมูลตัวอย่างแล้ว');
    }
  };

  const me = session.user;

  return (
    <app-backoffice-shell ref={host} className={cx('backoffice', folded && 'collapsed')}>
      <a className="skip-link" href="#backoffice-main" onClick={skipToContent}>{tx('ข้ามไปเนื้อหาหลัก')}</a>

      {/* The bar along the top, built as the admin navbar is */}
      <header className="navbar">
        <div className="navbar-brand-wrapper">
          <button type="button" className="icon-button menu-button" aria-label={tx('เปิดเมนู')} aria-expanded={menuOpen} aria-controls="backoffice-sidebar" onClick={() => setMenuOpen(!menuOpen)}>
            <NgIcon svg={lucideMenu} aria-hidden="true" />
          </button>
          <Link className="brand" to="/backoffice">
            <span className="logo" aria-hidden="true"><NgIcon svg={BRAND_ICON} /></span>
            <span className="brand-name">SLV <span className="brand-sub">BackOffice</span></span>
          </Link>
        </div>
        {/* Narrows the menu to its icons and back: first in the bar, by the menu's edge, as the admin's */}
        <button type="button" className="icon-button navbar-toggler" aria-label={tx(collapsed ? 'ขยายเมนู' : 'ย่อเมนู')} title={tx(collapsed ? 'ขยายเมนู' : 'ย่อเมนู')}
          aria-controls="backoffice-sidebar" onClick={toggleCollapsed}>
          <NgIcon svg={lucidePanelLeft} aria-hidden="true" />
        </button>

        {/* The tenant and hospital the work is in */}
        <div className="context" title={tx('บริบท: tenant และโรงพยาบาลตาม M14')}>
          <span className="context-label">{tx('บริบท')}</span>
          <span className="context-value">{`${CONTEXT.tenant} · ${tx(CONTEXT.hospital)}`}</span>
        </div>

        <div className="navbar-menu-wrapper">
          {/* Search, as the admin's bar has it: the back office's pages and the work waiting */}
          <BackofficeSearch />
          <ul className="navbar-actions">
            <li>
              <Link className="icon-button count-indicator" to="/backoffice/home/alerts" title={tx('การแจ้งเตือนและข้อยกเว้น')}
                aria-label={counts.alerts ? tx('การแจ้งเตือน {n} รายการที่ยังไม่รับทราบ', { n: counts.alerts }) : tx('การแจ้งเตือน')}>
                <NgIcon svg={lucideBell} aria-hidden="true" />
                {counts.critical > 0 && <span className="count" aria-hidden="true"></span>}
              </Link>
            </li>
            <li>
              <button type="button" className="icon-button" title={tx(themeLabel)} aria-label={tx(themeLabel)} onClick={() => theme.toggle()}>
                <NgIcon svg={theme.isDark ? lucideSun : lucideMoon} aria-hidden="true" />
              </button>
            </li>
            <li className="scale-item" onMouseLeave={() => useUiScale.getState().release()}>
              <UiTooltip text={scaleNow} detail={scaleHint} align="end">
                <button type="button" className="icon-button" aria-label={`${scaleNow} · ${scaleHint}`} onClick={stepScale}>
                  <NgIcon svg={uiScale.atLargest ? lucideAArrowDown : lucideAArrowUp} aria-hidden="true" />
                </button>
              </UiTooltip>
            </li>
            <li>
              <button type="button" className="icon-button language-button" aria-label={languageLabel} title={languageLabel} onClick={() => useLanguage.getState().use(otherLanguage)}>
                <span className="language-code">{language.toUpperCase()}</span>
              </button>
            </li>
            <li className="navbar-divider" aria-hidden="true"></li>
            {me && (
              <li>
                <UiMenuTrigger position={MENU_POSITION} menu={
                  <UiMenu className="backoffice-account-menu" aria-label={`${tx('เมนูผู้ใช้')} · ${fullName(me)}`} aria-describedby="backoffice-account-card">
                    <div className="account-card" id="backoffice-account-card" aria-hidden="true">
                      <UiAvatar name={fullName(me)} src={me.avatar} size="md" />
                      <div className="account-text">
                        <span className="account-name">{fullName(me)}</span>
                        <span className="account-email">{me.email}</span>
                        <RoleBadges className="account-role" user={me} max={3} />
                      </div>
                    </div>
                    <UiMenuDivider />
                    <UiMenuItem icon={lucideArrowLeft} to="/">{tx('กลับหน้าผู้ดูแลระบบ')}</UiMenuItem>
                    <UiMenuItem icon={lucideStethoscope} to="/clinic">{tx('งานตรวจรักษา')}</UiMenuItem>
                    <UiMenuItemCheckbox icon={lucideAccessibility} checked={accessibleView.on} onTriggered={() => accessibleView.toggle()}>{tx('มุมมองเข้าถึงง่าย')}</UiMenuItemCheckbox>
                    <UiMenuItem icon={lucideDatabaseBackup} onTriggered={() => void resetSample()}>{tx('รีเซ็ตข้อมูลตัวอย่าง')}</UiMenuItem>
                    <UiMenuDivider />
                    <UiMenuItem tone="danger" icon={lucideLogOut} onTriggered={() => void sessionService.signOut()}>{tx('ออกจากระบบ')}</UiMenuItem>
                  </UiMenu>
                }>
                  <button type="button" className="user-button" aria-label={`${tx('เมนูผู้ใช้')} · ${accountText(me, session.role?.name, session.roles.length)}`}>
                    <UiAvatar name={fullName(me)} src={me.avatar} size="sm" />
                  </button>
                </UiMenuTrigger>
              </li>
            )}
          </ul>
        </div>
      </header>

      <div className={cx('body', folded && 'collapsed')}>
        {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true"></div>}
        {/* The spec's menu groups, those with a page: one open at a time, the current page's; folded to its icons, each
            group shows its pages beside it on hover or focus (as the admin's) */}
        <nav className={cx('sidebar', menuOpen && 'open')} id="backoffice-sidebar" aria-label={tx('เมนูหลัก')}>
          {GROUPS.map(group => {
            const open = !folded && openKey === group.key;
            const shown = flyoutKey === group.key;
            return (
              <div key={group.key} className={cx('nav-group', open && 'open', current === group.key && 'current')}
                onMouseEnter={event => folded && showFlyout(group.key, event)} onMouseLeave={() => folded && hideFlyout()}>
                <button type="button" className="nav-group-button" onClick={event => groupClicked(group.key, event)} onFocus={event => groupFocused(group.key, event)}
                  aria-expanded={folded ? shown : open} aria-controls={`nav-${group.key}`} aria-label={folded ? tx(group.label) : undefined}>
                  <NgIcon svg={group.icon} className="nav-icon" aria-hidden="true" />
                  <span className="nav-title">{tx(group.label)}</span>
                  <NgIcon svg={lucideChevronRight} className="nav-arrow" aria-hidden="true" />
                </button>
                <div className={cx('nav-links-wrap', folded && 'flyout', shown && 'shown')} style={folded ? { top: flyoutTop } : undefined}
                  onMouseEnter={() => clearTimeout(flyoutTimer.current)} onBlur={flyoutLeft} onKeyDown={event => closeFlyout(group.key, event)}>
                  <ul className="nav-links" id={`nav-${group.key}`} inert={folded ? !shown : !open}>
                    {folded && <li className="flyout-title" aria-hidden="true">{tx(group.label)}</li>}
                    {group.links.map(link => (
                      <Fragment key={link.path}>
                        {link.section && <li className="nav-section">{tx(link.section)}</li>}
                        <li>
                          <NavLink to={link.path}>
                            <span>{tx(link.label)}</span>
                            {link.count && counts[link.count] > 0 && <span className="count">{counts[link.count]}</span>}
                          </NavLink>
                        </li>
                      </Fragment>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
          <p className="nav-note">{tx('เมนูอื่นจะเปิดเมื่อมีหน้าตามสัญญาของ spec · กลุ่มสงวน (จัดซื้อ งบประมาณ CAPEX payroll) ไม่มีในเมนู')}</p>
        </nav>
        <main ref={main} className="main" id="backoffice-main" tabIndex={-1} data-content-animate>
          <Outlet />
        </main>
      </div>

      <DialogHost />
    </app-backoffice-shell>
  );
}
