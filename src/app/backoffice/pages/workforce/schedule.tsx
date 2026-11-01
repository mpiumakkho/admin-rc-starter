/* The staff schedule: a week of shifts per person, with the conflict and coverage checks beside it, assigned as drafts and published together (workforce.schedule, M24 P2) */
import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router';

import { TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import type { Area, ShiftKind, StaffMember } from '../../data/types';
import {
  addDays, AREAS, coverage, daysOf, gaps, onLeave, previewShift, ROLE, SCHEDULED_ROLES, SHIFT, SHIFT_KINDS, type ShiftInput, staffOf, weekConflicts, weekday, weekOf, weekStatus,
} from '../../data/workforce';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const THIS_WEEK = weekOf(TODAY);
const WEEKS = [THIS_WEEK, addDays(THIS_WEEK, 7)];
const label = (monday: string) => `${monday.slice(8)}/${monday.slice(5, 7)} – ${addDays(monday, 6).slice(8)}/${addDays(monday, 6).slice(5, 7)}`;

export function ScheduleComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const asked = params.get('week') ?? '';
  const [week, setWeek] = useState(WEEKS.includes(asked) ? asked : THIS_WEEK);
  const [form, setForm] = useState<ShiftInput>(() => ({ staffId: 'S05', date: addDays(WEEKS.includes(asked) ? asked : THIS_WEEK, 5), kind: 'night', area: 'Ward' }));

  const d = store.data;
  const days = daysOf(week);
  const status = weekStatus(d, week);
  const scheduled = d.staff.filter(s => SCHEDULED_ROLES.includes(s.role) && s.status !== 'inactive');
  const groups = SCHEDULED_ROLES.map(role => ({ role, people: scheduled.filter(s => s.role === role) })).filter(g => g.people.length);
  const conflicts = weekConflicts(d, week).sort((a, b) => Number(b.hard) - Number(a.hard) || a.date.localeCompare(b.date));
  const short = gaps(coverage(d, week));
  const weekShifts = d.shifts.filter(s => days.includes(s.date));
  const k = { shifts: weekShifts.length, drafts: weekShifts.filter(s => s.status === 'draft').length, hard: conflicts.filter(c => c.hard).length, soft: conflicts.filter(c => !c.hard).length, gaps: short.length };
  const preview = previewShift(d, form);
  const blocked = preview.some(c => c.hard);

  const set = <K extends keyof ShiftInput>(key: K, value: ShiftInput[K]) => setForm({ ...form, [key]: value });
  const selectWeek = (monday: string) => {
    setWeek(monday);
    if (!daysOf(monday).includes(form.date)) {
      setForm({ ...form, date: monday });
    }
  };
  const shiftsOn = (staffId: string, date: string) => d.shifts.filter(s => s.staffId === staffId && s.date === date).sort((a, b) => SHIFT[a.kind].start - SHIFT[b.kind].start);
  const conflictOn = (staffId: string, date: string) => conflicts.some(c => c.staffId === staffId && c.date === date && c.hard);
  const shortOn = (date: string) => short.some(g => g.date === date);
  const hours = (s: StaffMember) => weekShifts.filter(x => x.staffId === s.id).reduce((n, x) => n + SHIFT[x.kind].end - SHIFT[x.kind].start, 0);
  const name = (id: string) => staffOf(d, id)?.name ?? id;
  /** The cell's person and day go to the form, with the area they usually work and the shift the day misses, if any */
  const pickCell = (s: StaffMember, date: string) => {
    const missing = short.find(g => g.date === date && g.role === s.role);
    const usual = d.shifts.find(x => x.staffId === s.id)?.area ?? (s.department as Area);
    setForm({ staffId: s.id, date, kind: (missing?.kind ?? form.kind) as ShiftKind, area: AREAS.includes(usual) ? usual : 'OPD' });
  };

  return (
    <bo-schedule className="page">
      <PageHead heading="ตารางเวรบุคลากร" source="M24 P2 · เช้า 08–16 · บ่าย 12–20 · ดึก 20–08 · จัดเป็นฉบับร่างแล้วประกาศทั้งสัปดาห์ · ตารางเวรไม่ให้บทบาทหรือสิทธิ์วิชาชีพ · ต้นแบบก่อนสัญญาหน้าของ M24 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" disabled={status !== 'draft'} onClick={() => backofficeActions.publishWeek(week)}>{tx('ประกาศตารางเวร')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{k.shifts}</span><span className="kpi-label">{tx('เวรทั้งหมด · ฉบับร่าง {n}', { n: k.drafts })}</span></div>
        <div className={cx('kpi', k.hard > 0 && 'danger')} role="listitem"><span className="kpi-value">{k.hard}</span><span className="kpi-label">{tx('ความขัดแย้งที่ต้องแก้')}</span></div>
        <div className={cx('kpi', k.soft > 0 && 'warn')} role="listitem"><span className="kpi-value">{k.soft}</span><span className="kpi-label">{tx('คำเตือน')}</span></div>
        <div className={cx('kpi', k.gaps > 0 && 'danger')} role="listitem"><span className="kpi-value">{k.gaps}</span><span className="kpi-label">{tx('เวรที่คนไม่ครบขั้นต่ำ')}</span></div>
      </div>

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar">
              <div className="segmented" role="group" aria-label={tx('สัปดาห์')}>
                {WEEKS.map(w => <button key={w} type="button" className={cx(w === week && 'active')} aria-pressed={w === week} onClick={() => selectWeek(w)}>{label(w)}</button>)}
              </div>
              <span className={`chip ${status === 'published' ? 'ok' : 'warn'}`}>{tx(status === 'published' ? 'ประกาศแล้ว' : 'ฉบับร่าง')}</span>
              <span className="secondary grow">{tx('กดเวรเพื่อยกเลิก · กด + เพื่อจัดเวรในแถบข้าง')}</span>
            </div>
            <div className="table-wrap">
              <table className="bo-table roster">
                <thead>
                  <tr>
                    <th scope="col" className="who">{tx('ชื่อบุคลากร')}</th>
                    {days.map(day => (
                      <th key={day} scope="col" className={cx(day === TODAY && 'today', shortOn(day) && 'short')}>{tx(weekday(day))} {day.slice(8)}{shortOn(day) && <div className="text-danger">{tx('คนไม่ครบ')}</div>}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <Fragment key={g.role}>
                      <tr className="static group"><th scope="rowgroup" colSpan={8}>{tx(ROLE[g.role].label)}</th></tr>
                      {g.people.map(s => (
                        <tr key={s.id} className="static">
                          <th scope="row" className="who"><b>{tx(s.name)}</b><div className="secondary">{hours(s)} {tx('ชม.')} / {s.weeklyHours}</div></th>
                          {days.map(day => {
                            const l = onLeave(d, s.id, day, ['approved', 'pending']);
                            return (
                              <td key={day} className={cx(conflictOn(s.id, day) && 'conflict', day === TODAY && 'today')}>
                                {l && <span className={`chip ${l.status === 'approved' ? 'warn' : 'quiet'}`}>{tx(l.status === 'approved' ? 'ลา' : 'ขอลา')}</span>}
                                {shiftsOn(s.id, day).map(x => (
                                  <button key={x.id} type="button" className={cx('shift', x.kind, x.status === 'draft' && 'draft')} aria-label={`${tx(s.name)} ${day} ${tx('เวร' + SHIFT[x.kind].label)} · ${tx('ยกเลิกเวร')}`}
                                    title={`${SHIFT[x.kind].time} · ${x.area}`} onClick={() => backofficeActions.removeShift(x)}>{tx(SHIFT[x.kind].short)}</button>
                                ))}
                                <button type="button" className={cx('add', form.staffId === s.id && form.date === day && 'picked')} aria-label={tx('จัดเวร {name} {date}', { name: tx(s.name), date: day })} onClick={() => pickCell(s, day)}><NgIcon svg={lucidePlus} aria-hidden="true" /></button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="legend">
              {SHIFT_KINDS.map(kind => <span key={kind}><span className={`shift ${kind}`} aria-hidden="true">{tx(SHIFT[kind].short)}</span>{tx(SHIFT[kind].label)} {SHIFT[kind].time}</span>)}
              <span><span className="shift draft morning" aria-hidden="true">{tx(SHIFT.morning.short)}</span>{tx('ฉบับร่าง')}</span>
            </div>
          </div>
        </div>

        <aside className="record-rail">
          <div className="panel action-card">
            <b>{tx('จัดเวร')}</b>
            <label className="field">{tx('ชื่อบุคลากร')}
              <select className="ui-input" value={form.staffId} onChange={event => set('staffId', event.target.value)}>
                {scheduled.map(s => <option key={s.id} value={s.id}>{tx(s.name)}</option>)}
              </select>
            </label>
            <div className="two">
              <label className="field">{tx('วันที่')}
                <select className="ui-input" value={form.date} onChange={event => set('date', event.target.value)}>
                  {days.map(day => <option key={day} value={day}>{tx(weekday(day))} {day}</option>)}
                </select>
              </label>
              <label className="field">{tx('เวร')}
                <select className="ui-input" value={form.kind} onChange={event => set('kind', event.target.value as ShiftKind)}>
                  {SHIFT_KINDS.map(kind => <option key={kind} value={kind}>{tx(SHIFT[kind].label)} {SHIFT[kind].time}</option>)}
                </select>
              </label>
            </div>
            <label className="field">{tx('จุดงาน')}
              <select className="ui-input" value={form.area} onChange={event => set('area', event.target.value as Area)}>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            {preview.length ? (
              <ul className="checks">{preview.map((c, i) => <li key={i} className={cx(c.hard && 'hard')}>{tx(c.text)}</li>)}</ul>
            ) : <p className="secondary ok-text">{tx('ไม่ขัดแย้งกับเวรอื่น การลา หรือใบอนุญาต')}</p>}
            <UiButton size="sm" type="button" disabled={blocked} onClick={() => backofficeActions.assignShift(form)}>{tx('จัดเวร (ฉบับร่าง)')}</UiButton>
          </div>

          <div className="panel actions">
            <b>{tx('เวรที่คนไม่ครบขั้นต่ำ')}</b>
            {short.map((g, i) => <div key={i} className="sum-row"><span>{tx(weekday(g.date))} {g.date} · {tx(SHIFT[g.kind].label)}</span><span className="text-danger">{tx(ROLE[g.role].label)} {g.have}/{g.need}</span></div>)}
            {!short.length && <p className="secondary ok-text">{tx('คนครบทุกเวร')}</p>}
            <p className="secondary">{tx('ขั้นต่ำวันธรรมดา: เช้า สัตวแพทย์ 2 พยาบาล 2 เภสัชกร 1 · บ่าย สัตวแพทย์ 1 พยาบาล 1 · ดึก พยาบาล 1 · วันหยุดลดลง · กลางคืนสัตวแพทย์อยู่เวร on-call')}</p>
          </div>

          <div className="panel actions">
            <b>{tx('ความขัดแย้งและคำเตือน')}</b>
            {conflicts.map((c, i) => <div key={i} className={cx('conflict-row', c.hard && 'hard')}><b>{tx(name(c.staffId))}</b> · {c.date}<div>{tx(c.text)}</div></div>)}
            {!conflicts.length && <p className="secondary ok-text">{tx('ไม่มีความขัดแย้ง')}</p>}
          </div>
        </aside>
      </div>
    </bo-schedule>
  );
}
