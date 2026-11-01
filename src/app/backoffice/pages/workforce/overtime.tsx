/* Overtime summary: the hours the schedule holds against each contract, and the call-outs, for a week; operational, not payroll (workforce.overtime, M24 P2) */
import { useState } from 'react';

import { TODAY } from '../../../clinic/data/model';
import { cx, UiButton } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { addDays, overtime, ROLE, weekOf } from '../../data/workforce';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const THIS_WEEK = weekOf(TODAY);
const WEEKS = [THIS_WEEK, addDays(THIS_WEEK, 7)];
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const label = (monday: string) => `${monday.slice(8)}/${monday.slice(5, 7)} – ${addDays(monday, 6).slice(8)}/${addDays(monday, 6).slice(5, 7)}`;

export function OvertimeComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [week, setWeek] = useState(THIS_WEEK);
  const rows = overtime(store.data, week).sort((a, b) => b.total - a.total || a.staff.id.localeCompare(b.staff.id));
  const sum = (k: 'shifts' | 'hours' | 'night' | 'scheduled' | 'callOut' | 'total') => rows.reduce((n, r) => n + r[k], 0);
  const t = { shifts: sum('shifts'), hours: sum('hours'), night: sum('night'), scheduled: sum('scheduled'), callOut: sum('callOut'), total: sum('total'), people: rows.filter(r => r.total).length };

  return (
    <bo-overtime className="page">
      <PageHead heading="สรุปการทำงานล่วงเวลา" source="M24 P2 · คำนวณจากเวรในตาราง (ไม่นับวันลา) เทียบชั่วโมงตามสัญญา และชั่วโมงที่ถูกเรียกเข้าตอนรับเวร on-call · ตัวเลขเพื่อการดำเนินงาน ไม่ใช่ข้อมูลเงินเดือน" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" variant="secondary" type="button" disabled title={tx('ส่งออกได้เมื่อสัญญาของ M24 อนุมัติ (GATED)')}>{tx('ส่งออก (รอสัญญา)')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        <div className={cx('kpi', t.total > 0 && 'warn')} role="listitem"><span className="kpi-value">{fmt(t.total)}</span><span className="kpi-label">{tx('ชั่วโมงล่วงเวลารวม')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{t.people}</span><span className="kpi-label">{tx('คนที่มีล่วงเวลา')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{fmt(t.callOut)}</span><span className="kpi-label">{tx('ชั่วโมงถูกเรียกเข้า')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{fmt(t.night)}</span><span className="kpi-label">{tx('ชั่วโมงเวรดึก')}</span></div>
      </div>

      <div className="panel">
        <div className="filter-bar">
          <div className="segmented" role="group" aria-label={tx('สัปดาห์')}>
            {WEEKS.map(w => <button key={w} type="button" className={cx(w === week && 'active')} aria-pressed={w === week} onClick={() => setWeek(w)}>{label(w)}</button>)}
          </div>
          <span className="secondary grow">{tx('สัปดาห์ที่ยังเป็นฉบับร่างคำนวณจากเวรที่จัดไว้ · เปลี่ยนได้จนกว่าจะประกาศ')}</span>
        </div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th scope="col">{tx('ชื่อบุคลากร')}</th>
                <th scope="col" className="w-amount num">{tx('จำนวนเวร')}</th>
                <th scope="col" className="w-amount num">{tx('ชั่วโมงในตาราง')}</th>
                <th scope="col" className="w-amount num">{tx('เวรดึก')}</th>
                <th scope="col" className="w-amount num">{tx('ตามสัญญา')}</th>
                <th scope="col" className="w-amount num">{tx('เกินจากตาราง')}</th>
                <th scope="col" className="w-amount num">{tx('ถูกเรียกเข้า')}</th>
                <th scope="col" className="w-amount num">{tx('ล่วงเวลารวม')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.staff.id} className="static">
                  <td><b>{tx(r.staff.name)}</b><div className="secondary">{tx(ROLE[r.staff.role].label)}</div></td>
                  <td className="num">{r.shifts}</td>
                  <td className="num">{fmt(r.hours)}</td>
                  <td className="num">{fmt(r.night)}</td>
                  <td className="num">{r.contract}</td>
                  <td className="num">{r.scheduled ? fmt(r.scheduled) : '—'}</td>
                  <td className="num">{r.callOut ? fmt(r.callOut) : '—'}</td>
                  <td className={cx('num', r.total >= 16 && 'text-danger')}><b>{r.total ? fmt(r.total) : '—'}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="static">
                <th scope="row">{tx('รวม')}</th>
                <td className="num">{t.shifts}</td>
                <td className="num">{fmt(t.hours)}</td>
                <td className="num">{fmt(t.night)}</td>
                <td></td>
                <td className="num">{fmt(t.scheduled)}</td>
                <td className="num">{fmt(t.callOut)}</td>
                <td className="num"><b>{fmt(t.total)}</b></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="secondary foot-note">{tx('ไม่มีอัตราค่าจ้าง ภาษี หรือสวัสดิการในหน้านี้ — การคำนวณเงินต้องมีกฎ payroll ที่อนุมัติแล้ว ซึ่งอยู่นอกขอบเขต')}</p>
      </div>
    </bo-overtime>
  );
}
