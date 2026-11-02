/* Leave and time off: the requests, what each takes off the schedule, and a decision by someone other than the person asking (workforce.leave, M24 P2) */
import { useState } from 'react';
import { Link } from 'react-router';

import { TODAY } from '../../../clinic/data/model';
import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import type { LeaveRequest, LeaveType } from '../../data/types';
import {
  addDays, daysOf, LEAVE_STATUS, LEAVE_TYPE, leaveBlock, leaveDays, leaveImpact, leaveProblems, type LeaveImpact, type LeaveInput, onLeave, ROLE, SHIFT, staffOf, weekday, weekOf,
} from '../../data/workforce';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const TYPES = Object.keys(LEAVE_TYPE) as LeaveType[];
const FROM = weekOf(TODAY);
const isGap = (impact: LeaveImpact, date: string, kind: string) => impact.gaps.some(g => g.date === date && g.kind === kind);

export function LeaveComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [selectedId, setSelectedId] = useState<string | null>('LV-2609-08');
  const [form, setForm] = useState<LeaveInput>({ staffId: 'S14', type: 'personal', from: addDays(TODAY, 7), to: addDays(TODAY, 7), reason: '' });

  const d = store.data;
  const rows = d.leaves.slice().sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.requestedAt.localeCompare(a.requestedAt));
  const selected = d.leaves.find(l => l.id === selectedId) ?? null;
  const people = d.staff.filter(s => s.status !== 'inactive');
  const pending = d.leaves.filter(l => l.status === 'pending');
  const k = {
    pending: pending.length, today: d.staff.filter(s => onLeave(d, s.id, TODAY)).length,
    gaps: new Set(pending.flatMap(l => leaveImpact(d, l).gaps.map(g => `${g.date}:${g.kind}:${g.role}`))).size,
  };
  const calendar = [...daysOf(FROM), ...daysOf(addDays(FROM, 7))].map(date => ({
    date, picked: !!selected && selected.from <= date && date <= selected.to,
    people: d.leaves.filter(l => l.status !== 'rejected' && l.from <= date && date <= l.to).map(l => ({ id: l.id, name: staffOf(d, l.staffId)?.name ?? '', status: l.status })),
  }));
  const problems = leaveProblems(d, form);
  const name = (l: LeaveRequest) => staffOf(d, l.staffId)?.name ?? '—';
  const role = (l: LeaveRequest) => { const s = staffOf(d, l.staffId); return s ? ROLE[s.role].label : ''; };
  const impactOf = (l: Pick<LeaveRequest, 'staffId' | 'from' | 'to'>) => leaveImpact(d, l);
  const block = (l: LeaveRequest) => leaveBlock(d, l, store.userName);
  const pick = (id: string) => setSelectedId(selectedId === id ? null : id);
  const set = <K extends keyof LeaveInput>(key: K, value: LeaveInput[K]) => {
    const next = { ...form, [key]: value };
    if (key === 'from' && next.to < next.from) {
      next.to = next.from;
    }
    setForm(next);
  };
  const submit = () => backofficeActions.requestLeave(form, leave => { setForm({ ...form, reason: '' }); setSelectedId(leave.id); });

  const rail = () => {
    if (selected) {
      const impact = impactOf(selected);
      const b = block(selected);
      return (
        <div className="panel action-card">
          <b>{selected.id} · {tx(name(selected))}</b>
          <span className="secondary">{`${tx(LEAVE_TYPE[selected.type])} · ${selected.from} – ${selected.to} · ${tx('{n} วัน', { n: leaveDays(selected) })}`}</span>
          <div className="section-title">{tx('เวรที่กระทบ')}</div>
          {impact.shifts.map(s => (
            <div key={s.id} className="sum-row"><span>{tx(weekday(s.date))} {s.date} · {tx(SHIFT[s.kind].label)}</span><span className={cx(isGap(impact, s.date, s.kind) && 'text-danger')}>{tx(isGap(impact, s.date, s.kind) ? 'คนจะไม่ครบ' : 'ยังพอ')}</span></div>
          ))}
          {!impact.shifts.length && <p className="secondary ok-text">{tx('ไม่มีเวรในช่วงนี้')}</p>}
          {impact.gaps.length > 0 && selected.status === 'pending' && <p className="notice warn">{tx('ถ้าอนุมัติ ต้องจัดคนแทน {n} เวรในตารางเวร', { n: impact.gaps.length })}</p>}
          {selected.status === 'pending' ? <>
            {b && <p className="notice info">{tx(b)}</p>}
            <div className="two">
              <UiButton variant="secondary" size="sm" type="button" disabled={!!b} onClick={() => backofficeActions.decideLeave(selected, 'rejected')}>{tx('ปฏิเสธการลา')}</UiButton>
              <UiButton size="sm" type="button" disabled={!!b} onClick={() => backofficeActions.decideLeave(selected, 'approved')}>{tx('อนุมัติ')}</UiButton>
            </div>
          </> : (
            <p className="secondary">{`${tx(LEAVE_STATUS[selected.status].label)} · ${tx(selected.decidedBy ?? '')} · ${selected.decidedAt}`}{selected.decisionNote && ` — ${tx(selected.decisionNote)}`}</p>
          )}
          {impact.shifts.length > 0 && <Link className="link" to={`/backoffice/workforce/schedule?week=${weekOf(selected.from)}`}>{tx('เปิดตารางเวรสัปดาห์นั้น')}</Link>}
        </div>
      );
    }
    const impact = problems.length ? null : impactOf(form);
    return (
      <div className="panel action-card">
        <b>{tx('ยื่นคำขอลา')}</b>
        <label className="field">{tx('ชื่อบุคลากร')}
          <select className="ui-input" value={form.staffId} onChange={event => set('staffId', event.target.value)}>
            {people.map(s => <option key={s.id} value={s.id}>{tx(s.name)}</option>)}
          </select>
        </label>
        <label className="field">{tx('ประเภท')}
          <select className="ui-input" value={form.type} onChange={event => set('type', event.target.value as LeaveType)}>
            {TYPES.map(t => <option key={t} value={t}>{tx(LEAVE_TYPE[t])}</option>)}
          </select>
        </label>
        <div className="two">
          <label className="field">{tx('ตั้งแต่')}<input className="ui-input" type="date" value={form.from} onChange={event => set('from', event.target.value)} /></label>
          <label className="field">{tx('ถึง')}<input className="ui-input" type="date" value={form.to} onChange={event => set('to', event.target.value)} /></label>
        </div>
        <label className="field">{tx('เหตุผล')}<textarea className="ui-input" rows={2} value={form.reason} onChange={event => set('reason', event.target.value)}></textarea></label>
        {impact && <p className={cx('secondary', impact.gaps.length > 0 && 'text-danger')}>{tx('กระทบ {n} เวร · คนจะไม่ครบ {m} เวร', { n: impact.shifts.length, m: impact.gaps.length })}</p>}
        {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
        <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={submit}>{tx('ยื่นคำขอ')}</UiButton>
      </div>
    );
  };

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-leave className="page">
      <PageHead heading="การลาและวันหยุด" source="M24 P2 · คำขอลาและผลต่อจำนวนคนในเวร · ผู้ขอตัดสินคำขอของตัวเองไม่ได้ · การอนุมัติไม่ลบเวร ตารางเวรแสดงเวรที่ต้องหาคนแทน · ต้นแบบก่อนสัญญาหน้าของ M24 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" variant="secondary" type="button" onClick={() => setSelectedId(null)}>{tx('ยื่นคำขอลา')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        <div className={cx('kpi', k.pending > 0 && 'warn')} role="listitem"><span className="kpi-value">{k.pending}</span><span className="kpi-label">{tx('รออนุมัติ')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{k.today}</span><span className="kpi-label">{tx('ลาวันนี้ (อนุมัติแล้ว)')}</span></div>
        <div className={cx('kpi', k.gaps > 0 && 'danger')} role="listitem"><span className="kpi-value">{k.gaps}</span><span className="kpi-label">{tx('เวรที่จะคนไม่ครบถ้าอนุมัติทั้งหมด')}</span></div>
      </div>

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar"><b>{tx('คำขอลา')}</b><span className="secondary grow">{tx('รออนุมัติก่อน แล้วตามวันที่ยื่น')}</span></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead>
                  <tr>
                    <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                    <th scope="col" className="w-owner">{tx('ผู้ขอ')}</th>
                    <th scope="col" className="w-kind">{tx('ประเภท')}</th>
                    <th scope="col" className="w-at">{tx('ช่วง')}</th>
                    <th scope="col">{tx('เหตุผล')}</th>
                    <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.rows.map(l => {
                    const gapsN = l.status === 'pending' ? impactOf(l).gaps.length : 0;
                    return (
                      <tr key={l.id} tabIndex={0} className={cx(l.id === selectedId && 'selected')} aria-selected={l.id === selectedId} onClick={() => pick(l.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(l.id); } }}>
                        <td><b>{l.id}</b><div className="secondary">{l.requestedAt}</div></td>
                        <td>{tx(name(l))}<div className="secondary">{tx(role(l))}</div></td>
                        <td>{tx(LEAVE_TYPE[l.type])}</td>
                        <td className="num">{l.from}{l.to !== l.from && <div>– {l.to}</div>}<div className="secondary">{tx('{n} วัน', { n: leaveDays(l) })}</div></td>
                        <td>{tx(l.reason)}</td>
                        <td><span className={`chip ${LEAVE_STATUS[l.status].cls}`}>{tx(LEAVE_STATUS[l.status].label)}</span>{gapsN > 0 && <div className="secondary text-danger">{tx('กระทบ {n} เวร', { n: gapsN })}</div>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PagerFoot pager={pager} />
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('ปฏิทินสองสัปดาห์')}</b><span className="secondary grow">{tx('คนที่ลาแต่ละวัน · สีเข้มคืออนุมัติแล้ว')}</span></div>
            <div className="leave-cal">
              {calendar.map(c => (
                <div key={c.date} className={cx('day', c.date === TODAY && 'today', c.picked && 'picked')}>
                  <div className="secondary">{tx(weekday(c.date))} {c.date.slice(8)}</div>
                  {c.people.map(p => <span key={p.id} className={`chip ${p.status === 'approved' ? 'warn' : 'quiet'}`}>{tx(p.name)}</span>)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="record-rail">{rail()}</aside>
      </div>
    </bo-leave>
  );
}
