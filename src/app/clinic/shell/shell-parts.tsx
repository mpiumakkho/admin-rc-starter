/* The shell bar's search and notifications, and the context rail (the design's GlobalSearch, Notifications, ContextRail) */
import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';

import {
  lucideBell, lucideCalendarDays, lucideFlaskConical, lucideHourglass, lucidePawPrint, lucidePill, lucideSearch, lucideTriangleAlert,
} from '../../icons';
import { cx, leaveRef, NgIcon, usePresence, UiMenu, UiMenuHeading, UiMenuItem, UiMenuTrigger, type UiConnectedPosition, type UiIcon } from '../../user-management/ui';
import { clinicNavigate } from '../clinic-actions';
import { clinicUi, useClinicUi, type SheetKind } from '../clinic-ui';
import { clinicStore, useClinicStore } from '../clinic.store';
import { stageState, statusOf, TODAY } from '../data/model';
import type { Patient } from '../data/types';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { RAIL_ICONS } from '../shared/icons';

interface SearchHit { kind: 'patient' | 'appointment'; id: string; title: string; detail: string; patient?: Patient }

// As the admin navbar's search: Ctrl K, or ⌘K on a Mac; "/" works too, as in the design
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl K';
const SHORTCUT_KEYS = isMac ? 'Meta+K /' : 'Control+K /';

/**
 * Patients in today's queue and upcoming appointments, by name, code, HN or phone. An icon among the bar's others; it
 * opens a panel with the field and the results, as the admin navbar's menus open. Ctrl+K (⌘K) or "/" from anywhere;
 * Escape, a click elsewhere or tabbing away closes it.
 */
export function GlobalSearch() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const host = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState(false);
  const presence = usePresence(panel);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [focusField, setFocusField] = useState(0);
  /** The results show once something is typed; a line on what can be found until then */
  const searching = !!query.trim();

  const hits: SearchHit[] = (() => {
    const needle = query.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');
    if (!needle) {
      return [];
    }
    const d = store.data;
    const matches = (text: string, phone: string) => text.toLowerCase().includes(needle) || (digits.length >= 3 && phone.replace(/\D/g, '').includes(digits));
    const patients: SearchHit[] = d.patients
      .filter(p => matches([p.pet, p.code, p.hn, d.owners[p.ownerKey].name].join(' '), d.owners[p.ownerKey].phone))
      .map(p => ({
        kind: 'patient', id: String(p.id), patient: p, title: `${p.pet} · ${p.code}`,
        detail: `${d.owners[p.ownerKey].name} · ${tx(statusOf(p).text)} · ${tx('คิววันนี้')} ${p.time}`,
      }));
    const appointments: SearchHit[] = d.appointments
      .filter(a => a.date >= TODAY && a.state !== 'Completed' && matches([a.pet, a.owner].join(' '), a.phone))
      .map(a => ({ kind: 'appointment', id: a.id, title: `${a.pet} · ${a.time === '—' ? tx('Waitlist') : a.time}`, detail: `${a.owner} · ${tx(a.type)} · ${a.date}` }));
    return [...patients, ...appointments].slice(0, 8);
  })();

  /** Opens the panel, or goes back to its field when it is open */
  const show = () => {
    if (field.current) {
      field.current.focus();
      return;
    }
    setPanel(true);
    setFocusField(count => count + 1);
  };
  useLayoutEffect(() => {
    if (focusField) {
      field.current?.focus();
    }
  }, [focusField]);

  /** Closes the panel and forgets the search; `refocus` puts focus back on the icon, as Escape does */
  const close = (refocus = false) => {
    setPanel(false);
    setQuery('');
    setActive(0);
    if (refocus) {
      toggle.current?.focus();
    }
  };

  const latest = useRef({ show, close, panel });
  latest.current = { show, close, panel };
  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.matches('input, textarea, select, [contenteditable="true"]');
      if ((event.key === '/' && !typing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        latest.current.show();
      }
    };
    const outside = (event: MouseEvent) => {
      if (latest.current.panel && !host.current?.contains(event.target as Node)) {
        latest.current.close();
      }
    };
    document.addEventListener('keydown', shortcut);
    document.addEventListener('click', outside);
    return () => {
      document.removeEventListener('keydown', shortcut);
      document.removeEventListener('click', outside);
    };
  }, []);

  const choose = (hit: SearchHit) => {
    close();
    if (hit.patient) {
      store.select(hit.patient);
      clinicUi.openSheet('visit');
    } else {
      void clinicNavigate('/clinic/appointments').then(() => clinicUi.openSheet('appointment', { id: hit.id }));
    }
  };

  const key = (event: KeyboardEvent) => {
    const count = hits.length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      setActive(i => (i + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      setActive(i => (i - 1 + count) % count);
    } else if (event.key === 'Enter' && count) {
      event.preventDefault();
      choose(hits[active]);
    } else if (event.key === 'Escape') {
      // Only the panel: a sheet open behind it stays open
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };

  /** Tabbing out of the panel closes it; a click elsewhere is the document's */
  const leave = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next && !host.current?.contains(next)) {
      close();
    }
  };

  return (
    <cl-global-search ref={host} className="contents">
      <button ref={toggle} type="button" className="icon-button" aria-label={tx('ค้นหา')} title={`${tx('ค้นหา')} (${SHORTCUT_LABEL})`}
        aria-keyshortcuts={SHORTCUT_KEYS} aria-expanded={panel} aria-controls={panel ? 'clinic-search-panel' : undefined}
        onClick={() => panel ? close() : show()}>
        <NgIcon svg={lucideSearch} aria-hidden="true" />
      </button>
      {presence.mounted && (
        <div className={cx('search-panel clinic-pop-in', presence.leaving && 'clinic-pop-out')} id="clinic-search-panel" role="search"
          ref={presence.leaving ? leaveRef(presence.done) : undefined} onAnimationEnd={presence.leaving ? presence.done : undefined} onBlur={leave}>
          <div className="search-form">
            <NgIcon className="search-icon" svg={lucideSearch} aria-hidden="true" />
            <input ref={field} className="search-input" type="search" role="combobox" autoComplete="off" aria-autocomplete="list"
              aria-label={tx('ค้นหาเจ้าของ เบอร์โทร สัตว์ หรือรหัสการมารักษา')} placeholder={tx('ค้นหาเจ้าของ เบอร์โทร สัตว์ หรือรหัสการมารักษา')}
              aria-controls="clinic-search-results" aria-expanded={searching} aria-activedescendant={hits.length ? `clinic-hit-${active}` : undefined}
              value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={key} />
            <kbd className="search-shortcut" aria-hidden="true">Esc</kbd>
          </div>
          {searching ? (
            <>
              <div className="search-list" id="clinic-search-results" role="listbox" aria-label={tx('ผลการค้นหา')}>
                {hits.map((hit, i) => (
                  <div key={hit.kind + hit.id} className={cx('search-result', i === active && 'active')} role="option" id={`clinic-hit-${i}`} aria-selected={i === active}
                    onMouseDown={event => event.preventDefault()} onClick={() => choose(hit)} onMouseMove={() => setActive(i)}>
                    <span className="search-result-icon"><NgIcon svg={hit.kind === 'patient' ? lucidePawPrint : lucideCalendarDays} aria-hidden="true" /></span>
                    <span className="search-result-text">
                      <span className="search-result-name">{hit.title}</span>
                      <span className="search-result-detail">{hit.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
              {!hits.length && <p className="search-empty">{tx('ไม่พบรายการที่ตรงกับคำค้น')}</p>}
            </>
          ) : (
            <p className="search-hint">{tx('สัตว์ในคิววันนี้และนัดหมายที่จะถึง ค้นจากชื่อสัตว์ เจ้าของ เบอร์โทร HN หรือรหัสการมารักษา')}</p>
          )}
        </div>
      )}
    </cl-global-search>
  );
}

interface Notice { id: string; tone: 'danger' | 'warn' | 'info'; icon: UiIcon; title: string; detail: string; go: () => void }

const MENU_POSITION: UiConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
];

/** What needs the vet now, worked out from the data: critical and new results, pets over their SLA, verbal orders */
export function Notifications() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  /** The notices seen when the menu was last opened; the dot means something came since, as the admin bell */
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());

  const d = store.data;
  const notices: Notice[] = [];
  for (const r of d.results.filter(x => !x.ack)) {
    const critical = r.flag === 'critical';
    notices.push({
      id: 'r' + r.id, tone: critical ? 'danger' : 'info', icon: critical ? lucideTriangleAlert : lucideFlaskConical,
      title: `${r.pet} · ${tx(r.name)}`, detail: tx(critical ? 'ค่าวิกฤต · ต้องรับทราบทางโทรศัพท์' : 'ผลตรวจใหม่รอรับทราบ'),
      go: () => void clinicNavigate('/clinic/results').then(() => clinicUi.openSheet('result', { id: r.id })),
    });
  }
  for (const p of d.patients.filter(x => stageState(x) === 'late')) {
    notices.push({
      id: 'q' + p.id, tone: 'warn', icon: lucideHourglass, title: `${p.pet} · ${tx(statusOf(p).text)}`, detail: tx('ค้างเกินเกณฑ์เวลาของขั้นตอน'),
      go: () => { clinicStore.select(p); void clinicNavigate('/clinic/queue').then(() => clinicUi.openSheet('visit')); },
    });
  }
  for (const rx of d.prescriptions.filter(x => x.verbal && !x.cosignedBy)) {
    notices.push({
      id: 'x' + rx.id, tone: 'warn', icon: lucidePill, title: `${rx.pet} · ${rx.drug}`, detail: tx('คำสั่งวาจา · รอเซ็นกำกับ'),
      go: () => void clinicNavigate('/clinic/orders'),
    });
  }
  const unread = notices.filter(n => !seen.has(n.id)).length;

  return (
    <cl-notifications className="contents">
      <UiMenuTrigger position={MENU_POSITION} onOpened={() => setSeen(new Set(notices.map(n => n.id)))} menu={
        <UiMenu className="clinic-activity-menu" aria-label={tx('การแจ้งเตือน')}>
          <UiMenuHeading>{tx('การแจ้งเตือน')}</UiMenuHeading>
          {notices.map(notice => (
            <UiMenuItem key={notice.id} className="clinic-activity-item" onTriggered={() => notice.go()}>
              <span className={`clinic-notice-icon ${notice.tone}`}><NgIcon svg={notice.icon} aria-hidden="true" /></span>
              <span className="clinic-activity-text">
                <span className="clinic-activity-title">{notice.title}</span>
                <span className="clinic-activity-time">{notice.detail}</span>
              </span>
            </UiMenuItem>
          ))}
          {!notices.length && <p className="clinic-activity-empty">{tx('ไม่มีการแจ้งเตือน')}</p>}
        </UiMenu>
      }>
        <button type="button" className="icon-button count-indicator" aria-label={unread ? tx('การแจ้งเตือน ยังไม่อ่าน {n}', { n: unread }) : tx('การแจ้งเตือน')}>
          <NgIcon svg={lucideBell} aria-hidden="true" />
          {unread > 0 && <span className="count" aria-hidden="true"></span>}
        </button>
      </UiMenuTrigger>
    </cl-notifications>
  );
}

interface RailItem { sep?: boolean; icon?: UiIcon; label?: string; kind?: SheetKind; tab?: string; badge?: (p: Patient) => number; danger?: boolean }

const RAIL_ITEMS: RailItem[] = [
  { icon: RAIL_ICONS.alerts, label: 'Clinical alerts', kind: 'patient', tab: 'alerts', danger: true, badge: p => p.alerts.length },
  { icon: RAIL_ICONS.patient, label: 'Patient summary', kind: 'patient', tab: 'overview' },
  { icon: RAIL_ICONS.owner, label: 'Owner', kind: 'owner' },
  { sep: true },
  { icon: RAIL_ICONS.problems, label: 'Problem list', kind: 'patient', tab: 'problems', badge: p => p.problems.length },
  { icon: RAIL_ICONS.meds, label: 'Medications', kind: 'patient', tab: 'meds', badge: p => p.meds.length },
  { icon: RAIL_ICONS.vaccines, label: 'Vaccines / reminders', kind: 'patient', tab: 'vaccines', badge: p => p.vaccines.filter(v => v[2] !== 'ok').length },
  { icon: RAIL_ICONS.visits, label: 'Visit history', kind: 'patient', tab: 'visits' },
  { icon: RAIL_ICONS.docs, label: 'Documents', kind: 'patient', tab: 'docs' },
  { icon: RAIL_ICONS.notes, label: 'Notes', kind: 'notes' },
  { sep: true },
  { icon: RAIL_ICONS.results, label: 'Results preview', kind: 'results', badge: p => clinicStore.resultsFor(p).filter(r => !r.ack).length },
  { icon: RAIL_ICONS.estimate, label: 'Estimate', kind: 'estimate' },
];

/** Shortcuts to the selected patient's sheets, beside the page (the collapsed right sidebar) */
export function ContextRail() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const open = useClinicUi(state => state.sheet);
  const p = store.selected;
  const isOpen = (item: RailItem) => !!open && open.kind === item.kind && (!item.tab || open.tab === item.tab);
  return (
    <cl-context-rail className="contents">
      <aside className="rail" aria-label={tx('Context rail')}>
        {RAIL_ITEMS.map((item, index) => {
          if (item.sep) {
            return <span key={index} className="rail-sep" aria-hidden="true"></span>;
          }
          const n = item.badge ? item.badge(p) : 0;
          return (
            <button key={index} type="button" className={cx('rail-btn', isOpen(item) && 'active')} aria-pressed={isOpen(item)}
              aria-label={tx(item.label!) + (n ? ': ' + n : '') + ' · ' + p.pet} title={tx(item.label!) + ' · ' + p.pet}
              onClick={() => clinicUi.toggleSheet(item.kind!, item.tab)}>
              <NgIcon svg={item.icon!} aria-hidden="true" />
              {n > 0 && <span className={cx('badge', item.danger && 'danger')} aria-hidden="true">{n}</span>}
            </button>
          );
        })}
      </aside>
    </cl-context-rail>
  );
}
