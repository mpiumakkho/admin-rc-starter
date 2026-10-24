import { useRef, useState } from 'react';

import { lucideCalendar, lucideChevronLeft, lucideChevronRight } from '../../icons';
import { cx, NgIcon, UiButton, UiSegmented } from '../../user-management/ui';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import { addDays, formatDate, SLOTS, TODAY, WAITLIST, weekStart } from '../data/model';
import type { Appointment } from '../data/types';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { BoardColumn, MiniAlerts, SUBTITLE, TaskCard, Toolbar } from '../shared/parts';

const STATE_CHIP: Record<string, string> = { Confirmed: 'ok', 'Checked in': 'info', Waitlist: 'quiet', Completed: 'none' };
const byTime = (a: Appointment, b: Appointment) => a.time.localeCompare(b.time);

/**
 * The appointment calendar: a day by time slot (and the waitlist), or a week by day. The vet reads it; front desk
 * books, moves and checks in.
 */
export function AppointmentsComponent() {
  const store = useClinicStore();
  const { tx, lang } = useClinicI18n();
  const picker = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(TODAY);
  const [view, setView] = useState<'day' | 'week'>('day');
  const views = [
    { value: 'day' as const, label: tx('Day') },
    { value: 'week' as const, label: tx('Week') },
  ];

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i));
  const heading = view === 'day' ? formatDate(date, 'long', lang) : `${formatDate(days[0], 'short', lang)} – ${formatDate(days[6], 'short', lang)}`;
  const diff = Math.round((new Date(date + 'T00:00:00').getTime() - new Date(TODAY + 'T00:00:00').getTime()) / 86400000);
  const relative = diff === 0 ? tx('วันนี้') : diff === 1 ? tx('พรุ่งนี้') : diff === -1 ? tx('เมื่อวาน') : formatDate(date, 'short', lang);
  const shortDate = formatDate(date, 'short', lang);

  const appointments = store.data.appointments;
  const columns = [...SLOTS, WAITLIST].map(name => ({ name, list: appointments.filter(a => a.date === date && a.slot === name).sort(byTime) }));
  const week = days.map(day => ({ date: day, label: formatDate(day, 'weekday', lang), list: appointments.filter(a => a.date === day).sort(byTime) }));

  const move = (direction: number) => setDate(addDays(date, direction * (view === 'day' ? 1 : 7)));

  /** The browser's own calendar, from the button that shows the date in the page's language */
  const openPicker = () => {
    const input = picker.current!;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  const pick = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setDate(value);
    }
  };

  const patientOf = (a: Appointment) => a.date === TODAY ? store.data.patients.find(p => p.pet === a.pet && p.ownerKey === a.owner) : undefined;
  /** An appointment opens with its pet selected, when the pet is in today's clinic, so the context rail is about it */
  const openAppointment = (a: Appointment) => {
    store.selectPet(a.pet, a.owner);
    clinicUi.openSheet('appointment', { id: a.id });
  };

  return (
    <app-clinic-appointments className="workspace">
      <Toolbar heading={tx('Appointments')} subtitle={
        <span {...SUBTITLE} className="appt-heading">
          {` ${heading} `}
          {view === 'day' && <span className={`chip ${date === TODAY ? 'info' : 'quiet'}`}>{relative}</span>}
        </span>
      }>
        <span className="btn-group" role="group" aria-label={tx('เลือกช่วงวันที่')}>
          <UiButton variant="secondary" size="sm" iconOnly type="button" aria-label={tx(view === 'day' ? 'วันก่อนหน้า' : 'สัปดาห์ก่อนหน้า')} onClick={() => move(-1)}>
            <NgIcon svg={lucideChevronLeft} aria-hidden="true" />
          </UiButton>
          <UiButton variant="secondary" size="sm" type="button" disabled={date === TODAY} onClick={() => setDate(TODAY)}>{tx('วันนี้')}</UiButton>
          <UiButton variant="secondary" size="sm" iconOnly type="button" aria-label={tx(view === 'day' ? 'วันถัดไป' : 'สัปดาห์ถัดไป')} onClick={() => move(1)}>
            <NgIcon svg={lucideChevronRight} aria-hidden="true" />
          </UiButton>
        </span>
        <span className="date-field">
          <button type="button" className="date-button" aria-label={tx('ไปที่วันที่') + ' · ' + shortDate} onClick={openPicker}>
            {` ${shortDate}`}<NgIcon svg={lucideCalendar} aria-hidden="true" />
          </button>
          <input ref={picker} type="date" tabIndex={-1} aria-hidden="true" value={date} onChange={event => pick(event.target.value)} />
        </span>
        <UiSegmented size="sm" options={views} value={view} onValueChange={setView} ariaLabel={tx('มุมมอง')} />
      </Toolbar>

      {view === 'day' ? (
        <div className="board">
          <div className="board-grid cols-5">
            {columns.map(column => (
              <BoardColumn key={column.name} name={column.name} count={column.list.length} empty="ไม่มีนัด">
                {column.list.map(a => {
                  const p = patientOf(a);
                  return (
                    <TaskCard key={a.id} title={a.pet + ' · ' + (a.time === '—' ? tx('Waitlist') : a.time)} line1={tx(a.type) + ' · ' + tx(a.provider)} line2={a.owner}
                      status={a.state === 'Confirmed' ? null : { text: a.state, cls: STATE_CHIP[a.state] || 'quiet' }}
                      onOpened={() => openAppointment(a)}>
                      {p && p.alerts.length > 0 && <MiniAlerts patient={p} blank />}
                    </TaskCard>
                  );
                })}
              </BoardColumn>
            ))}
          </div>
        </div>
      ) : (
        <div className="board">
          <div className="week-grid">
            {week.map(day => (
              <section key={day.date} className={cx('column day-col', day.date === TODAY && 'today')} aria-label={day.label}>
                <button type="button" className="day-head" title={tx('เปิด Day view')} onClick={() => { setDate(day.date); setView('day'); }}>
                  <span>{day.label}</span><span className="count">{day.list.length}</span>
                </button>
                {day.list.map(a => (
                  <button key={a.id} type="button" className={cx('appt-mini', a.state === 'Completed' && 'done')} onClick={() => openAppointment(a)}>
                    <b>{a.time === '—' ? tx('Waitlist') : a.time}</b>{` ${a.pet} `}
                    <span className="secondary">{`${tx(a.type)} · ${tx(a.provider)}`}</span>
                  </button>
                ))}
                {!day.list.length && <p className="column-empty">{tx('ว่าง')}</p>}
              </section>
            ))}
          </div>
        </div>
      )}
    </app-clinic-appointments>
  );
}
