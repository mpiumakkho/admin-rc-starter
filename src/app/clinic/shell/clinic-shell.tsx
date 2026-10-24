import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';

import {
  lucideAArrowDown, lucideAArrowUp, lucideAccessibility, lucideArrowLeft, lucideDatabaseBackup, lucideLogOut, lucideMoon, lucidePawPrint, lucideSun,
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
import { setClinicNavigate } from '../clinic-actions';
import { clinicUi } from '../clinic-ui';
import { clinicStore, useClinicStore } from '../clinic.store';
import { clinicI18n, useClinicI18n } from '../i18n/clinic-i18n';
import { DialogHost } from '../sheets/dialog-host';
import { SheetHost } from '../sheets/sheet-host';
import { NAV_ICONS } from '../shared/icons';
import './clinic.scss';
import { ContextRail, GlobalSearch, Notifications } from './shell-parts';

const percent = (scale: number) => `${Math.round(scale * 100)}%`;

/** What the language button does, by the language it switches to */
const SWITCH_TO: Record<LanguageCode, string> = { th: 'เปลี่ยนเป็นภาษาไทย', en: 'เปลี่ยนเป็นภาษาอังกฤษ' };

const TABS = [
  { key: 'queue', label: 'Queue', icon: NAV_ICONS.queue },
  { key: 'appointments', label: 'Appointments', icon: NAV_ICONS.appointments },
  { key: 'register', label: 'Register', icon: NAV_ICONS.register },
  { key: 'encounter', label: 'Encounter', icon: NAV_ICONS.encounter },
  { key: 'orders', label: 'Orders', icon: NAV_ICONS.orders },
  { key: 'results', label: 'Results', icon: NAV_ICONS.results },
  { key: 'dispense', label: 'Dispense', icon: NAV_ICONS.dispense },
] as const;

/** As the admin navbar: menus open under their button, lined up with its right edge, or above it when there is no room */
const MENU_POSITION: UiConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
];

/**
 * The clinical workspace: a sample of a veterinary hospital's clinical work (งานตรวจรักษา), drawn after the design in
 * seph1-vet-erp-rc in the app's own colors (--ui-* variables). It fills the window on its own, without the admin
 * sidebar (app.tsx), and opens from the account menu, as the component gallery does. Its look is all in clinic.scss,
 * under .clinic.
 *
 *   bar           as the admin navbar: the workspace's brand; the tabs (queue, appointments, register, encounter, orders,
 *                 results, dispense: child routes); patient search, notifications, theme, display size, language, the person
 *   main          the tab | the context rail; a side sheet slides out over the tab, one at a time
 */
export function ClinicShellComponent() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const theme = useUiTheme();
  const uiScale = useUiScale();
  const accessibleView = useUiAccessibleView();
  const language = useLanguage(state => state.current);
  const session = useSession();
  const navigate = useNavigate();
  const host = useRef<HTMLElement>(null);
  const main = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);

  // The actions move between the workspace's pages with the router
  useLayoutEffect(() => {
    setClinicNavigate(path => navigate(path));
  }, [navigate]);

  // Another page closes the sheet, as the design does; before what opens one after going there
  useNavigationEnd(() => clinicUi.closeSheet());

  // The document's title follows the language
  useEffect(() => {
    document.title = clinicI18n.t('SLV — โรงพยาบาลสวนหลวงสัตวแพทย์');
  }, [language]);

  /** The language a press of the language button switches to: the other one */
  const otherLanguage: LanguageCode = LANGUAGES.find(lang => lang.code !== language)?.code ?? 'th';
  /** What the button shows (TH), then what it does, so a voice command with what is on it still finds it */
  const languageLabel = `${language.toUpperCase()} · ${tx(SWITCH_TO[otherLanguage])}`;

  /** The display size: what it is now, and what a press of its button makes it */
  const scaleNow = `${tx('ขนาดการแสดงผล')} ${percent(uiScale.scale)}`;
  const scaleHint = tx('กดเพื่อเปลี่ยนเป็น {size}', { size: percent(uiScale.next) });
  const themeLabel = theme.isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด';

  /*
   * Below 992px the tabs leave the bar for a row of their own, where they keep their names and scroll sideways. By the
   * workspace's own width, as its stylesheet's container queries are: the display size zooms it, and the window's width
   * (a media query) does not show that. In the bar, the tabs show just their icon and count when their names do not
   * fit; the name is still read out, and shown on hover.
   */
  const [tabsOwnRow, setTabsOwnRow] = useState(false);
  const ownRow = useRef(false);
  const [compactTabs, setCompactTabs] = useState(false);
  const compact = useRef(false);
  /** How wide the tabs are with their names, from when they last had them */
  const namedWidth = useRef(0);
  /** The names came back: measure once they are drawn */
  const fitPending = useRef(false);

  const setCompact = (value: boolean) => {
    compact.current = value;
    setCompactTabs(value);
  };
  /** Names off when the tabs overflow the bar, back on once the bar is as wide as they were with them */
  const fitTabs = () => {
    const element = nav.current;
    if (!element || ownRow.current) {
      return;
    }
    if (!compact.current) {
      namedWidth.current = element.scrollWidth;
      if (element.scrollWidth > element.clientWidth) {
        setCompact(true);
      }
    } else if (element.clientWidth >= namedWidth.current) {
      setCompact(false);
    }
  };

  // Measured after the names are drawn again
  useLayoutEffect(() => {
    if (fitPending.current && !compact.current) {
      fitPending.current = false;
      fitTabs();
    }
  });
  // The tabs' names come back whenever what they say or the room for them changes, and go again if they do not fit
  const counts = store.counts;
  const countsKey = TABS.map(tab => counts[tab.key]).join(',');
  useLayoutEffect(() => {
    if (compact.current) {
      fitPending.current = true;
      setCompact(false);
    } else {
      fitTabs();
    }
  }, [language, countsKey, tabsOwnRow]);
  useEffect(() => {
    const resize = new ResizeObserver(() => {
      ownRow.current = (host.current?.clientWidth ?? 0) < 992;
      setTabsOwnRow(ownRow.current);
      fitTabs();
    });
    resize.observe(host.current!);
    resize.observe(nav.current!);
    return () => {
      resize.disconnect();
      useUiScale.getState().release();
    };
  }, []);

  /**
   * One size up, or back to 100%; screen readers hear the new size. A press with the pointer (not a key) holds the bar's
   * controls at their size until the pointer leaves the button.
   */
  const stepScale = (event: MouseEvent) => {
    useUiScale.getState().step({ hold: event.detail > 0 });
    void announce(`${clinicI18n.t('ขนาดการแสดงผล')} ${percent(useUiScale.getState().scale)}`);
  };

  const skipToContent = (event: MouseEvent) => {
    event.preventDefault();
    main.current?.focus();
  };

  const resetSample = async () => {
    const confirmed = await uiConfirm.ask({
      title: clinicI18n.t('รีเซ็ตข้อมูลตัวอย่าง'),
      message: clinicI18n.t('ข้อมูลที่เพิ่มหรือแก้ไขทั้งหมดในเครื่องนี้ (visit นัดหมาย order ใบแจ้งหนี้ ฯลฯ) จะถูกลบ และกลับไปเป็นข้อมูลตัวอย่างตั้งต้น'),
      confirmLabel: clinicI18n.t('รีเซ็ตข้อมูล'),
      cancelLabel: clinicI18n.t('ยกเลิก'),
      tone: 'danger',
    });
    if (confirmed) {
      clinicUi.closeSheet();
      clinicStore.reset();
      clinicUi.toast('รีเซ็ตเป็นข้อมูลตัวอย่างแล้ว');
    }
  };

  const me = session.user;

  return (
    <app-clinic-shell ref={host} className="clinic">
      <a className="skip-link" href="#clinic-main" onClick={skipToContent}>{tx('ข้ามไปเนื้อหาหลัก')}</a>

      {/* L0 · the bar along the top, built as the admin navbar is: the workspace's brand, its tabs, then search, notifications,
          theme, language and the person */}
      <header className="navbar">
        <div className="navbar-brand-wrapper">
          <Link className="brand" to="/clinic/queue" aria-label={'SLV · ' + tx('งานตรวจรักษา')} title={tx('งานตรวจรักษา')}>
            <span className="logo" aria-hidden="true"><NgIcon svg={lucidePawPrint} /></span>
            <span className="brand-name">SLV</span>
          </Link>
        </div>

        {/* The tabs of the clinical work, each with how many items wait in it; just the icon and the count when the names do not fit */}
        <nav ref={nav} className={cx('nav', compactTabs && 'compact')} aria-label={tx('เมนูหลัก')}>
          {TABS.map(tab => (
            <NavLink key={tab.key} to={`/clinic/${tab.key}`} title={compactTabs ? tx(tab.label) : undefined}>
              <NgIcon svg={tab.icon} aria-hidden="true" />
              <span className="tab-label">{tx(tab.label)}</span>
              {counts[tab.key] > 0 && <span className="count">{counts[tab.key]}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="navbar-menu-wrapper">
          <ul className="navbar-actions">
            <li><GlobalSearch /></li>
            <li><Notifications /></li>
            <li>
              <button type="button" className="icon-button" title={tx(themeLabel)} aria-label={tx(themeLabel)} onClick={() => theme.toggle()}>
                <NgIcon svg={theme.isDark ? lucideSun : lucideMoon} aria-hidden="true" />
              </button>
            </li>

            {/* The size of the whole UI, for those who find small text hard to read: a press steps up (A↑), from the largest
                back to 100% (A↓). While the pointer stays on it the bar's controls keep their size, so it does not move away. */}
            <li className="scale-item" onMouseLeave={() => useUiScale.getState().release()}>
              <UiTooltip text={scaleNow} detail={scaleHint} align="end">
                <button type="button" className="icon-button" aria-label={`${scaleNow} · ${scaleHint}`} onClick={stepScale}>
                  <NgIcon svg={uiScale.atLargest ? lucideAArrowDown : lucideAArrowUp} aria-hidden="true" />
                </button>
              </UiTooltip>
            </li>

            {/* The language: one button with the language in use on it; a press switches to the other */}
            <li>
              <button type="button" className="icon-button language-button" aria-label={languageLabel} title={languageLabel}
                onClick={() => useLanguage.getState().use(otherLanguage)}>
                <span className="language-code">{language.toUpperCase()}</span>
              </button>
            </li>
            <li className="navbar-divider" aria-hidden="true"></li>

            {me && (
              <li>
                <UiMenuTrigger position={MENU_POSITION} menu={
                  // A menu holds only items, so the card is read out as the menu's description instead
                  <UiMenu className="clinic-account-menu" aria-label={`${tx('เมนูผู้ใช้')} · ${fullName(me)}`} aria-describedby="clinic-account-card">
                    <div className="clinic-account-card" id="clinic-account-card" aria-hidden="true">
                      <UiAvatar name={fullName(me)} src={me.avatar} size="md" />
                      <div className="clinic-account-text">
                        <span className="clinic-account-name">{fullName(me)}</span>
                        <span className="clinic-account-email">{me.email}</span>
                        <RoleBadges className="clinic-account-role" user={me} max={3} />
                      </div>
                    </div>
                    <UiMenuDivider />
                    <UiMenuItem icon={lucideArrowLeft} to="/">{tx('กลับหน้าผู้ดูแลระบบ')}</UiMenuItem>
                    <UiMenuItemCheckbox icon={lucideAccessibility} checked={accessibleView.on} onTriggered={() => accessibleView.toggle()}>
                      {tx('มุมมองเข้าถึงง่าย')}
                    </UiMenuItemCheckbox>
                    <UiMenuItem icon={lucideDatabaseBackup} onTriggered={() => void resetSample()}>{tx('รีเซ็ตข้อมูลตัวอย่าง')}</UiMenuItem>
                    <UiMenuDivider />
                    <UiMenuItem tone="danger" icon={lucideLogOut} onTriggered={() => void sessionService.signOut()}>{tx('ออกจากระบบ')}</UiMenuItem>
                  </UiMenu>
                }>
                  <button type="button" className="user-button" aria-label={`${tx('เมนูผู้ใช้')} · ${accountText(me, session.role?.name, session.roles.length)}`}>
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

      {/* The tab | the context rail; a side sheet slides out over the tab, one at a time */}
      <main ref={main} className="clinic-main" id="clinic-main" tabIndex={-1}>
        <div className="views">
          <router-outlet></router-outlet>
          <Outlet />
        </div>
        <ContextRail />
        <SheetHost />
      </main>

      <DialogHost />
    </app-clinic-shell>
  );
}
