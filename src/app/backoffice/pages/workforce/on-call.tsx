/* The on-call rotation: the vets' nights, made fair by the generator, adjusted by hand and published (workforce.onCall, M24 P2) */
import { useState } from 'react';

import { TODAY } from '../../../clinic/data/model';
import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { addDays, daysOf, fairness, isWeekend, licenseOf, licenseState, onCallEligible, onLeave, slotProblem, staffOf, weekday, weekOf } from '../../data/workforce';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const THIS_WEEK = weekOf(TODAY);
/** What is out, and the two weeks after it to plan */
const PERIODS = [
  { key: 'now', from: THIS_WEEK, to: addDays(THIS_WEEK, 6) },
  { key: 'next', from: addDays(THIS_WEEK, 7), to: addDays(THIS_WEEK, 20) },
];
const WEEKDAYS = daysOf(THIS_WEEK).map(weekday);
const label = (from: string, to: string) => `${from.slice(8)}/${from.slice(5, 7)} – ${to.slice(8)}/${to.slice(5, 7)}`;

export function OnCallComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [periodKey, setPeriodKey] = useState('now');
  const d = store.data;
  const period = PERIODS.find(p => p.key === periodKey)!;
  const nights = [];
  for (let date = period.from; date <= period.to; date = addDays(date, 1)) {
    const slot = d.onCall.find(s => s.date === date);
    nights.push({ date, slot, weekend: isWeekend(date), problem: slot ? slotProblem(d, slot) : null, callOuts: d.callOuts.filter(c => c.date === date) });
  }
  const filled = nights.filter(n => n.slot).length;
  const drafts = nights.filter(n => n.slot?.status === 'draft').length;
  const f = fairness(d, period.from, period.to);
  const callOuts = d.callOuts.filter(c => period.from <= c.date && c.date <= period.to);
  const name = (id: string) => staffOf(d, id)?.name ?? id;
  const eligible = (id: string) => onCallEligible(d, period.from).some(s => s.id === id);
  /** Why a vet is off the list from the period's first night */
  const ineligible = (id: string) => {
    if (onLeave(d, id, period.from)) {
      return 'ลาในช่วงนี้';
    }
    const l = licenseOf(d, id, 'vet-license');
    return !l ? 'ไม่มีใบอนุญาตในทะเบียน' : licenseState(l) === 'expired' ? 'ใบอนุญาตหมดอายุ' : 'ใบอนุญาตประกอบวิชาชีพยังไม่ได้ตรวจสอบ';
  };

  return (
    <bo-on-call className="page">
      <PageHead heading="ตารางเวร On-call" source="M24 P2 · สัตวแพทย์รับเวรคืนละคน 20:00–08:00 · สร้างอัตโนมัติให้คนที่มีคืนน้อยก่อน วันหยุดนับแยก เลี่ยงสองคืนติดกัน · ชั่วโมงที่ถูกเรียกเข้านับเป็นล่วงเวลา · ต้นแบบก่อนสัญญาหน้าของ M24 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" variant="secondary" type="button" onClick={() => backofficeActions.generateOnCall(period.from, period.to)}>{tx('สร้างตารางอัตโนมัติ')}</UiButton>
        <UiButton size="sm" type="button" disabled={!drafts} onClick={() => backofficeActions.publishOnCall(period.from, period.to)}>{tx('ประกาศตาราง')}</UiButton>
      </PageHead>

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar">
              <div className="segmented" role="group" aria-label={tx('ช่วง')}>
                {PERIODS.map(p => <button key={p.key} type="button" className={cx(p.key === periodKey && 'active')} aria-pressed={p.key === periodKey} onClick={() => setPeriodKey(p.key)}>{label(p.from, p.to)}</button>)}
              </div>
              <span className="secondary grow">{tx('{n} คืน · จัดแล้ว {m} · ฉบับร่าง {d}', { n: nights.length, m: filled, d: drafts })}</span>
            </div>
            <div className="oncall-cal">
              {WEEKDAYS.map((w, i) => <div key={i} className="head">{tx(w)}</div>)}
              {nights.map(n => (
                <div key={n.date} className={cx('night', n.weekend && 'weekend', n.date === TODAY && 'today', n.problem && 'problem')}>
                  <div className="secondary">{n.date.slice(8)}/{n.date.slice(5, 7)}</div>
                  {n.slot ? <>
                    <button type="button" className={cx('who', n.slot.status === 'draft' && 'draft')} aria-label={`${tx('ปรับเวร on-call {date}', { date: n.date })} · ${tx(name(n.slot.staffId))}`}
                      onClick={() => backofficeActions.adjustOnCall(n.slot!)}>{tx(name(n.slot.staffId))}</button>
                    {n.slot.status === 'draft' && <span className="secondary">{tx('ฉบับร่าง')}</span>}
                    {n.problem && <span className="secondary text-danger">{tx(n.problem)}</span>}
                  </> : <span className="secondary">{tx('ยังไม่จัด')}</span>}
                  {n.callOuts.map(c => <span key={c.id} className="callout">{tx('ถูกเรียก {h} ชม.', { h: c.hours })} · {tx(c.reason)}</span>)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="record-rail">
          <div className="panel actions">
            <b>{tx('การกระจายเวร')}</b>
            <table className="mini-lines">
              <thead><tr><th>{tx('สัตวแพทย์')}</th><th className="num">{tx('คืน')}</th><th className="num">{tx('วันหยุด')}</th></tr></thead>
              <tbody>
                {f.rows.map(r => (
                  <tr key={r.staff.id}><td>{tx(r.staff.name)}{!eligible(r.staff.id) && <div className="secondary text-danger">{tx(ineligible(r.staff.id))}</div>}</td><td className="num">{r.nights}</td><td className="num">{r.weekends}</td></tr>
                ))}
              </tbody>
            </table>
            <span className={`chip ${f.fair ? 'ok' : 'warn'}`}>{tx(f.fair ? 'สมดุล · ต่างกันไม่เกิน 1 คืน' : 'ไม่สมดุล · ต่างกัน {n} คืน', { n: f.spread })}</span>
            <p className="secondary">{tx('รับเวรได้: สัตวแพทย์ที่ใบอนุญาตตรวจสอบแล้วและยังไม่หมดอายุ ไม่ได้ลาคืนนั้น')}</p>
          </div>
          <div className="panel actions">
            <b>{tx('การถูกเรียกเข้า')}</b>
            {callOuts.map(c => <div key={c.id} className="sum-row"><span>{c.date} · {tx(name(c.staffId))}<div className="secondary">{tx(c.reason)}</div></span><b>{c.hours} {tx('ชม.')}</b></div>)}
            {!callOuts.length && <p className="secondary">{tx('ไม่มีการเรียกเข้าในช่วงนี้')}</p>}
          </div>
        </aside>
      </div>
    </bo-on-call>
  );
}
