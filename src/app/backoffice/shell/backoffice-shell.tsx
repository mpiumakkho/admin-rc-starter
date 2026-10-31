import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import {
  lucideAArrowDown, lucideAArrowUp, lucideAccessibility, lucideArrowLeft, lucideBell, lucideChevronRight, lucideDatabaseBackup, lucideLogOut, lucideMenu,
  lucideMoon, lucideStethoscope, lucideSun,
} from '../../icons';
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
import { backofficeStore, useBackofficeStore } from '../backoffice.store';
import { boI18n, useBoI18n } from '../i18n/bo-i18n';
import './backoffice.scss';
import { DialogHost } from './dialog-host';
import { BACKOFFICE_NAV, BRAND_ICON } from './nav';

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

  // The actions move between the workspace's pages with the router
  useLayoutEffect(() => {
    setBackofficeNavigate(path => navigate(path));
  }, [navigate]);

  /** The menu, on narrow screens: open over the page */
  const [menuOpen, setMenuOpen] = useState(false);
  /** The groups folded open or closed by hand; the one with the current page is open unless it was closed */
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const current = BACKOFFICE_NAV.find(g => g.links.some(l => location.pathname.startsWith(l.path)))?.key;
  const isOpen = (key: string) => toggled.get(key) ?? key === current;

  // A page was picked: the menu makes way for it
  useNavigationEnd(() => setMenuOpen(false));

  useEffect(() => {
    document.title = boI18n.t('SLV BackOffice — โรงพยาบาลสวนหลวงสัตวแพทย์');
  }, [language]);

  useEffect(() => () => useUiScale.getState().release(), []);

  const otherLanguage: LanguageCode = LANGUAGES.find(lang => lang.code !== language)?.code ?? 'th';
  const languageLabel = `${language.toUpperCase()} · ${tx(SWITCH_TO[otherLanguage])}`;
  const scaleNow = `${tx('ขนาดการแสดงผล')} ${percent(uiScale.scale)}`;
  const scaleHint = tx('กดเพื่อเปลี่ยนเป็น {size}', { size: percent(uiScale.next) });
  const themeLabel = theme.isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด';
  const counts = store.counts;

  const toggleGroup = (key: string) => setToggled(map => new Map(map).set(key, !isOpen(key)));

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
    <app-backoffice-shell className="backoffice">
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

        {/* The tenant and hospital the work is in */}
        <div className="context" title={tx('บริบท: tenant และโรงพยาบาลตาม M14')}>
          <span className="context-label">{tx('บริบท')}</span>
          <span className="context-value">{`${CONTEXT.tenant} · ${tx(CONTEXT.hospital)}`}</span>
        </div>

        <div className="navbar-menu-wrapper">
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
                    <span className="user-text" aria-hidden="true">
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

      <div className="body">
        {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true"></div>}
        {/* The spec's menu groups, those with a page */}
        <nav className={cx('sidebar', menuOpen && 'open')} id="backoffice-sidebar" aria-label={tx('เมนูหลัก')}>
          {GROUPS.map(group => {
            const open = isOpen(group.key);
            return (
              <div key={group.key} className={cx('nav-group', open && 'open')}>
                <button type="button" className="nav-group-button" onClick={() => toggleGroup(group.key)} aria-expanded={open} aria-controls={`nav-${group.key}`}>
                  <NgIcon svg={group.icon} className="nav-icon" aria-hidden="true" />
                  <span className="nav-title">{tx(group.label)}</span>
                  <NgIcon svg={lucideChevronRight} className="nav-arrow" aria-hidden="true" />
                </button>
                <ul className="nav-links" id={`nav-${group.key}`} inert={!open}>
                  {group.links.map(link => (
                    <li key={link.path}>
                      <NavLink to={link.path}>
                        <span>{tx(link.label)}</span>
                        {link.count && counts[link.count] > 0 && <span className="count">{counts[link.count]}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="nav-note">{tx('เมนูอื่นจะเปิดเมื่อมีหน้าตามสัญญาของ spec · กลุ่มสงวน (จัดซื้อ งบประมาณ CAPEX payroll) ไม่มีในเมนู')}</p>
        </nav>

        <main ref={main} className="main" id="backoffice-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <DialogHost />
    </app-backoffice-shell>
  );
}
