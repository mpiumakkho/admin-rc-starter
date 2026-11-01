/* Preventive maintenance: the open PMs with the 30-day alert, the overdue and critical first, recorded or moved with why (assets.pm, M22 P2) */
import { useState } from 'react';
import { Link } from 'react-router';

import { TODAY } from '../../../clinic/data/model';
import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { CRITICALITY, DUE_STATE, dueState, equipmentOf, pmCounts, pmProblems, type PmInput } from '../../data/assets';
import { daysUntil } from '../../data/home';
import type { PmTask } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

type View = 'alert' | 'all' | 'done';
const VIEWS: [View, string][] = [['alert', 'เกินกำหนดและ 30 วัน'], ['all', 'ที่ค้างทั้งหมด'], ['done', 'ทำแล้ว']];
const BLANK: PmInput = { doneAt: TODAY, outcome: 'pass', findings: '', cost: '' };

export function PmComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [view, setView] = useState<View>('alert');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PmInput>({ ...BLANK });

  const d = store.data;
  const c = pmCounts(d);
  const eq = (t: PmTask) => equipmentOf(d, t.equipmentId)!;
  const open = d.pm.filter(t => t.status === 'open' && equipmentOf(d, t.equipmentId)?.status !== 'decommissioned');
  const rank = (t: PmTask) => (eq(t).criticality === 'critical' ? 0 : 1);
  const rows = view === 'done'
    ? d.pm.filter(t => t.status === 'done').sort((a, b) => b.doneAt!.localeCompare(a.doneAt!))
    : open.filter(t => view === 'all' || dueState(t.due) !== 'scheduled').sort((a, b) => a.due.localeCompare(b.due) || rank(a) - rank(b));
  const urgent = open.filter(t => dueState(t.due) === 'overdue').sort((a, b) => a.due.localeCompare(b.due));
  const selected = d.pm.find(t => t.id === selectedId) ?? null;
  const problems = selected ? pmProblems(selected, form) : [];

  const days = (t: PmTask) => daysUntil(t.due);
  const pick = (id: string) => { setForm({ ...BLANK }); setSelectedId(selectedId === id ? null : id); };
  const set = <K extends keyof PmInput>(key: K, value: PmInput[K]) => setForm({ ...form, [key]: value });
  const record = (t: PmTask) => backofficeActions.completePm(t, form, () => { setForm({ ...BLANK }); setSelectedId(null); });

  return (
    <bo-pm className="page">
      <PageHead heading="แผนบำรุงรักษาเชิงป้องกัน" source="M22 P2 · แจ้งเตือนล่วงหน้า 30 วัน · PM ครั้งถัดไปวางแผนจากวันที่ทำ · PM ไม่ผ่านจะหยุดใช้อุปกรณ์ · ไม่มีใบสั่งงานซ่อมและอะไหล่ในขอบเขต · ต้นแบบก่อนสัญญาหน้าของ M22 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <div className={cx('kpi', c.overdue > 0 && 'danger')} role="listitem"><span className="kpi-value">{c.overdue}</span><span className="kpi-label">{tx('เกินกำหนด')}</span></div>
        <div className={cx('kpi', c.criticalOverdue > 0 && 'danger')} role="listitem"><span className="kpi-value">{c.criticalOverdue}</span><span className="kpi-label">{tx('อุปกรณ์ critical เกินกำหนด')}</span></div>
        <div className={cx('kpi', c.due30 > 0 && 'warn')} role="listitem"><span className="kpi-value">{c.due30}</span><span className="kpi-label">{tx('ภายใน 30 วัน')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{c.scheduled}</span><span className="kpi-label">{tx('ตามแผน')}</span></div>
      </div>

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar">
              <div className="segmented" role="group" aria-label={tx('มุมมอง')}>
                {VIEWS.map(v => <button key={v[0]} type="button" className={cx(view === v[0] && 'active')} aria-pressed={view === v[0]} onClick={() => setView(v[0])}>{tx(v[1])}</button>)}
              </div>
              <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
            </div>
            <div className="table-wrap">
              <table className="bo-table pm">
                <thead>
                  <tr>
                    <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                    <th scope="col">{tx('อุปกรณ์')}</th>
                    <th scope="col" className="w-kind">{tx('ความสำคัญ')}</th>
                    <th scope="col" className="w-due">{tx('กำหนด')}</th>
                    <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(t => {
                    const e = eq(t);
                    const st = dueState(t.due);
                    const n = days(t);
                    return (
                      <tr key={t.id} tabIndex={0} className={cx(t.id === selectedId && 'selected')} aria-selected={t.id === selectedId} onClick={() => pick(t.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(t.id); } }}>
                        <td><b>{t.id}</b></td>
                        <td>{tx(e.name)}<div className="secondary">{e.id} · {tx(e.location)}</div></td>
                        <td><span className={`chip ${CRITICALITY[e.criticality].cls}`}>{tx(CRITICALITY[e.criticality].label)}</span></td>
                        <td className="num">{t.status === 'open' ? t.due : t.doneAt}{t.movedFrom && <div className="secondary">{tx('เลื่อนจาก {date}', { date: t.movedFrom })}</div>}</td>
                        <td>
                          {t.status === 'open' ? <>
                            <span className={`chip ${DUE_STATE[st].cls}`}>{tx(DUE_STATE[st].label)}</span>
                            <div className={cx('secondary', st === 'overdue' && 'text-danger')}>{n < 0 ? tx('เกินกำหนด {n} วัน', { n: -n }) : tx('อีก {n} วัน', { n })}</div>
                          </> : <>
                            <span className={`chip ${t.outcome === 'pass' ? 'ok' : 'danger'}`}>{tx(t.outcome === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน')}</span><div className="secondary">{tx(t.doneBy ?? '')}</div>
                          </>}
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีงาน PM ในมุมมองนี้')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="record-rail">
          {selected ? (() => {
            const t = selected;
            const e = eq(t);
            return (
              <div className="panel action-card">
                <b>{t.id} · {tx(e.name)}</b>
                <span className="secondary">{e.id} · {tx(e.location)} · {tx('ทุก {n} เดือน', { n: e.pmMonths })}</span>
                {t.status === 'open' ? <>
                  <div className="sum-row"><span>{tx('กำหนด')}</span><b className={cx(dueState(t.due) === 'overdue' && 'text-danger')}>{t.due}</b></div>
                  {t.moveReason && <p className="secondary">{tx('เลื่อนจาก {date}', { date: t.movedFrom! })} — {tx(t.moveReason)}</p>}
                  {e.status === 'down' && <p className="notice warn">{tx('อุปกรณ์ขัดข้องอยู่ · PM ทำได้เมื่อซ่อมเสร็จ หรือบันทึกพร้อมการซ่อม')}</p>}
                  <div className="section-title">{tx('บันทึกผล PM')}</div>
                  <div className="two">
                    <label className="field">{tx('วันที่ทำ')}<input className="ui-input" type="date" value={form.doneAt} onChange={event => set('doneAt', event.target.value)} /></label>
                    <label className="field">{tx('ผล')}
                      <select className="ui-input" value={form.outcome} onChange={event => set('outcome', event.target.value as PmInput['outcome'])}>
                        <option value="pass">{tx('ผ่าน')}</option>
                        <option value="fail">{tx('ไม่ผ่าน')}</option>
                      </select>
                    </label>
                  </div>
                  <label className="field">{tx('สิ่งที่พบ / ทำ')}<textarea className="ui-input" rows={2} value={form.findings} onChange={event => set('findings', event.target.value)}></textarea></label>
                  <label className="field">{tx('ค่าใช้จ่าย (บาท)')}<input className="ui-input" inputMode="decimal" value={form.cost} onChange={event => set('cost', event.target.value)} /></label>
                  {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
                  <div className="two">
                    <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.movePm(t)}>{tx('เลื่อน PM')}</UiButton>
                    <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={() => record(t)}>{tx('บันทึก PM')}</UiButton>
                  </div>
                </> : <>
                  <div className="sum-row"><span>{tx('วันที่ทำ')}</span><b>{t.doneAt}</b></div>
                  <div className="sum-row"><span>{tx('ผล')}</span><b>{tx(t.outcome === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน')}</b></div>
                  {t.findings && <p className="secondary">{tx(t.findings)}</p>}
                </>}
                <Link className="link" to={`/backoffice/assets/equipment/${e.id}`}>{tx('เปิดรายละเอียดอุปกรณ์')}</Link>
              </div>
            );
          })() : (
            <div className="panel action-card">
              <b>{tx('ต้องทำก่อน')}</b>
              {urgent.map(t => (
                <button key={t.id} type="button" className="sum-row link-row" onClick={() => pick(t.id)}><span>{tx(eq(t).name)}</span><span className="text-danger">{tx('เกินกำหนด {n} วัน', { n: -days(t) })}</span></button>
              ))}
              {!urgent.length && <p className="secondary ok-text">{tx('ไม่มี PM เกินกำหนด')}</p>}
              <p className="secondary">{tx('เลือกงานในตารางเพื่อบันทึกผลหรือเลื่อน')}</p>
            </div>
          )}
        </aside>
      </div>
    </bo-pm>
  );
}
