/* Decommission: requests decided by someone else, what each takes away, and the disposal evidence; the device's history stays (assets.decommission, M22 P2) */
import { useState } from 'react';
import { Link } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  active, costOf, decideBlock, DECOMMISSION_METHOD, DECOMMISSION_STATUS, decommissionImpact, type DecommissionInput, equipmentOf, requestProblems,
} from '../../data/assets';
import type { Decommission } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const baht = (n: number) => `฿${n.toLocaleString('en-US')}`;
const METHODS = Object.keys(DECOMMISSION_METHOD) as Decommission['method'][];
const BLANK: DecommissionInput = { equipmentId: 'EQ-DEN-DEN-01', reason: '', method: 'scrap', replacement: '' };

export function DecommissionComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [selectedId, setSelectedId] = useState<string | null>('DEC-2609-001');
  const [form, setForm] = useState<DecommissionInput>({ ...BLANK });

  const d = store.data;
  const isOpen = (r: Decommission) => Number(r.status === 'requested' || r.status === 'approved');
  const rows = d.decommissions.slice().sort((a, b) => isOpen(b) - isOpen(a) || b.requestedAt.localeCompare(a.requestedAt));
  const selected = d.decommissions.find(r => r.id === selectedId) ?? null;
  const devices = active(d);
  const problems = requestProblems(d, form);
  const eq = (id: string) => equipmentOf(d, id)!;

  const pick = (id: string) => setSelectedId(selectedId === id ? null : id);
  const set = <K extends keyof DecommissionInput>(key: K, value: DecommissionInput[K]) => setForm({ ...form, [key]: value });
  const submit = () => backofficeActions.requestDecommission(form, r => { setForm({ ...BLANK }); setSelectedId(r.id); });
  const impactList = (items: { text: string; severe: boolean }[]) => (
    <ul className="checks">
      {items.length ? items.map(i => <li key={i.text} className={cx(i.severe && 'hard')}>{tx(i.text)}</li>) : <li className="ok-text">{tx('ไม่มีรายการที่ผูกอยู่')}</li>}
    </ul>
  );

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-decommission className="page">
      <PageHead heading="การเลิกใช้งานอุปกรณ์" source="M22 P2 · ขอ → ผู้อื่นอนุมัติ → จำหน่ายพร้อมหลักฐาน · ยกเลิกการผูกเตียง PM ที่ค้าง และสัญญาโดยอัตโนมัติ · ประวัติเก็บไว้ · การตัดจำหน่ายทางบัญชีอยู่นอกขอบเขต · ต้นแบบก่อนสัญญาหน้าของ M22 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" variant="secondary" type="button" onClick={() => setSelectedId(null)}>{tx('ขอเลิกใช้งาน')}</UiButton>
      </PageHead>

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar"><b>{tx('คำขอเลิกใช้งาน')}</b><span className="secondary grow">{tx('ที่ยังไม่ปิดก่อน แล้วตามวันที่ขอ')}</span></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead>
                  <tr>
                    <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                    <th scope="col">{tx('อุปกรณ์')}</th>
                    <th scope="col">{tx('เหตุผล')}</th>
                    <th scope="col" className="w-kind">{tx('วิธี')}</th>
                    <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.rows.map(r => (
                    <tr key={r.id} tabIndex={0} className={cx(r.id === selectedId && 'selected')} aria-selected={r.id === selectedId} onClick={() => pick(r.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(r.id); } }}>
                      <td><b>{r.id}</b><div className="secondary">{r.requestedAt}</div></td>
                      <td>{tx(eq(r.equipmentId).name)}<div className="secondary">{r.equipmentId}</div></td>
                      <td>{tx(r.reason)}</td>
                      <td>{tx(DECOMMISSION_METHOD[r.method])}</td>
                      <td><span className={`chip ${DECOMMISSION_STATUS[r.status].cls}`}>{tx(DECOMMISSION_STATUS[r.status].label)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PagerFoot pager={pager} />
          </div>
        </div>

        <aside className="record-rail">
          {selected ? (() => {
            const r = selected;
            const e = eq(r.equipmentId);
            const block = decideBlock(r, store.userName);
            return (
              <div className="panel action-card">
                <b>{r.id} · {tx(e.name)}</b>
                <span className="secondary">{e.id} · {e.serial} · {tx(e.location)}</span>
                <div className="sum-row"><span>{tx('ขอโดย')}</span><span>{tx(r.requestedBy)}</span></div>
                <div className="sum-row"><span>{tx('วิธี')}</span><span>{tx(DECOMMISSION_METHOD[r.method])}</span></div>
                {r.replacement && <div className="sum-row"><span>{tx('เครื่องทดแทน')}</span><span>{tx(r.replacement)}</span></div>}
                <div className="sum-row"><span>{tx('ต้นทุนสะสม')}</span><span>{baht(costOf(e).total)}</span></div>
                {(r.status === 'requested' || r.status === 'approved') && <>
                  <div className="section-title">{tx('ผลเมื่อเลิกใช้')}</div>
                  {impactList(decommissionImpact(d, e))}
                </>}
                {r.status === 'requested' ? <>
                  {block && <p className="notice info">{tx(block)}</p>}
                  <div className="two">
                    <UiButton variant="secondary" size="sm" type="button" disabled={!!block} onClick={() => backofficeActions.decideDecommission(r, 'rejected')}>{tx('ไม่อนุมัติการเลิกใช้')}</UiButton>
                    <UiButton size="sm" type="button" disabled={!!block} onClick={() => backofficeActions.decideDecommission(r, 'approved')}>{tx('อนุมัติ')}</UiButton>
                  </div>
                </> : r.status === 'approved' ? <>
                  <p className="secondary">{tx('อนุมัติโดย')} {tx(r.decidedBy ?? '')} · {r.decidedAt} — {tx(r.decisionNote ?? '')}</p>
                  <UiButton variant="danger" size="sm" type="button" onClick={() => backofficeActions.completeDecommission(r)}>{tx('ยืนยันการเลิกใช้')}</UiButton>
                </> : <>
                  <p className="secondary">{tx(DECOMMISSION_STATUS[r.status].label)} · {tx(r.decidedBy ?? '')} · {r.decidedAt}{r.decisionNote && <> — {tx(r.decisionNote)}</>}</p>
                  {r.evidence && <div className="sum-row"><span>{tx('หลักฐาน')}</span><span>{tx(r.evidence)}</span></div>}
                  {r.completedAt && <p className="secondary">{tx('จำหน่ายเมื่อ {at} โดย {by}', { at: r.completedAt, by: tx(r.completedBy ?? '') })}</p>}
                </>}
                <Link className="link" to={`/backoffice/assets/equipment/${e.id}`}>{tx('เปิดรายละเอียดอุปกรณ์')}</Link>
              </div>
            );
          })() : (
            <div className="panel action-card">
              <b>{tx('ขอเลิกใช้งาน')}</b>
              <label className="field">{tx('อุปกรณ์')}
                <select className="ui-input" value={form.equipmentId} onChange={event => set('equipmentId', event.target.value)}>
                  {devices.map(e => <option key={e.id} value={e.id}>{`${tx(e.name)} · ${e.id}`}</option>)}
                </select>
              </label>
              <label className="field">{tx('วิธี')}
                <select className="ui-input" value={form.method} onChange={event => set('method', event.target.value as Decommission['method'])}>
                  {METHODS.map(m => <option key={m} value={m}>{tx(DECOMMISSION_METHOD[m])}</option>)}
                </select>
              </label>
              <label className="field">{tx('เหตุผล')}<textarea className="ui-input" rows={2} value={form.reason} onChange={event => set('reason', event.target.value)}></textarea></label>
              <label className="field">{tx('เครื่องทดแทน')}<input className="ui-input" placeholder={tx('(ไม่บังคับ)')} value={form.replacement} onChange={event => set('replacement', event.target.value)} /></label>
              <div className="section-title">{tx('ผลเมื่อเลิกใช้')}</div>
              {impactList(decommissionImpact(d, eq(form.equipmentId)))}
              <div className="sum-row"><span>{tx('ต้นทุนสะสม')}</span><span>{baht(costOf(eq(form.equipmentId)).total)}</span></div>
              {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
              <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={submit}>{tx('ส่งคำขอ')}</UiButton>
            </div>
          )}
        </aside>
      </div>
    </bo-decommission>
  );
}
