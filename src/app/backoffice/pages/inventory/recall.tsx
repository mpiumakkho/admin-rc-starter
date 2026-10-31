/* Drug recall: one lot traced to the shelf and to the patients it reached, and what was done about it (INV-RCL-01; the trace is a gated design) */
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { allLots, LOT_STATE, RECALL_NEXT, RECALL_SEVERITY, RECALL_STATUS, traceLot } from '../../data/inventory';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

export function RecallComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [lot, setLot] = useState(params.get('lot') ?? '');
  const lots = allLots(store.stock).sort((a, b) => a.drug.localeCompare(b.drug) || a.lot.localeCompare(b.lot));
  const recalls = store.data.recalls;
  const recall = recalls.find(r => r.lot === lot && r.status !== 'closed') ?? recalls.find(r => r.lot === lot) ?? null;
  const t = traceLot(store.clinic.data, store.data, lot);
  const held = !!store.clinic.data.holds?.[lot];

  return (
    <bo-recall className="page">
      <PageHead heading="การเรียกคืนยา" source="M06 · ตาม lot ไปยังคงคลังและผู้ป่วยที่ได้รับ · การเรียกคืนเปลี่ยนสถานะ lot และบันทึกหลักฐาน ไม่แก้รายการจ่ายยา · traceback API ยังไม่อนุมัติ (GATED) — ข้อมูลตัวอย่าง" freshness="ข้อมูล ณ วันนี้ 11:32">
        <select className="ui-input" aria-label={tx('เลือกยา/Lot')} value={lot} onChange={event => setLot(event.target.value)}>
          <option value="">{tx('— เลือกยา/Lot —')}</option>
          {lots.map(l => <option key={l.lot} value={l.lot}>{`${l.drug} · ${l.lot}${l.recall ? ` · ${l.recall.id}` : ''}`}</option>)}
        </select>
      </PageHead>

      <div className="kpi-strip" role="list">
        {recalls.map(r => (
          <button key={r.id} type="button" className={cx('kpi', r.status !== 'closed' && RECALL_STATUS[r.status].cls, lot === r.lot && 'active')} role="listitem" onClick={() => setLot(r.lot)}>
            <span className="kpi-value">{r.id}</span><span className="kpi-label">{`${r.drug} · ${r.lot} · ${tx(RECALL_STATUS[r.status].label)}`}</span>
          </button>
        ))}
        {!recalls.length && <div className="kpi" role="listitem"><span className="kpi-value">0</span><span className="kpi-label">{tx('ยังไม่มีการเรียกคืน')}</span></div>}
      </div>

      {lot ? (
        <div className="record">
          <div className="record-main">
            <div className="panel">
              <div className="filter-bar">
                <b>{tx('รายการที่ได้รับผลกระทบ')}</b>
                <span className="secondary grow">{tx('{n} รายการ · คงคลัง {a} · จ่ายแล้ว {b}', { n: t.onHand.length + t.dispensed.length, a: t.onHand.length, b: t.dispensed.length })}</span>
              </div>
              {t.untraced > 0 && <div className="notice warn">{tx('ผลการ trace อาจยังไม่ครบ — {n} รายการจ่ายของยานี้ไม่ได้ผูก lot (dispense ยังไม่บันทึก lot ตาม slice ปัจจุบัน)', { n: t.untraced })}</div>}
              <div className="table-wrap">
                <table className="bo-table">
                  <thead>
                    <tr>
                      <th scope="col" className="w-kind">{tx('ประเภทผลกระทบ')}</th>
                      <th scope="col" className="w-ref">Lot</th>
                      <th scope="col">{tx('ตำแหน่ง / ผู้ป่วย')}</th>
                      <th scope="col" className="w-amount num">{tx('จำนวน')}</th>
                      <th scope="col" className="w-ref">{tx('อ้างอิง')}</th>
                      <th scope="col" className="w-status">{tx('สถานะ')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.onHand.map(l => (
                      <tr key={l.lot + l.location} className="static">
                        <td><span className="chip info">{tx('คงคลัง')}</span></td>
                        <td><b>{l.lot}</b></td>
                        <td>{tx(l.location)}<div className="secondary">{`${l.drug} · ${tx('หมดอายุ')} ${l.expiry}`}</div></td>
                        <td className="num">{l.qty ?? '—'} {tx(l.unit)}</td>
                        <td>—</td>
                        <td><span className={`chip ${LOT_STATE[l.state].cls}`}>{tx(LOT_STATE[l.state].label)}</span>{held && <div className="secondary">{tx('กันไว้แล้ว')}</div>}</td>
                      </tr>
                    ))}
                    {t.dispensed.map(d => (
                      <tr key={d.id} className="static">
                        <td><span className={`chip ${d.administered ? 'danger' : 'warn'}`}>{tx(d.administered ? 'ให้ยาแล้ว' : 'จ่ายแล้ว')}</span></td>
                        <td>{d.lot}</td>
                        <td>{d.patient}<div className="secondary">{`${d.at} · ${tx(d.by)}`}</div></td>
                        <td className="num">{tx(d.qty)}{d.administered && <div className="secondary">{`${tx('ให้แล้ว')} ${tx(d.administered)}`}</div>}</td>
                        <td>{d.order ?? d.id}</td>
                        <td><span className="chip quiet">{tx('ติดตามทางคลินิก')}</span></td>
                      </tr>
                    ))}
                    {!t.onHand.length && !t.dispensed.length && <tr className="static"><td colSpan={6} className="empty">{tx('ไม่พบ lot นี้ในคลังหรือในรายการจ่าย')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {recall && (
              <div className="panel">
                <div className="filter-bar"><b>{tx('ลำดับเหตุการณ์')}</b><span className="secondary grow">{`${recall.id} · ${tx('เปิดโดย')} ${tx(recall.openedBy)} · ${recall.openedAt}`}</span></div>
                <div className="timeline">
                  {recall.updates.map((u, index) => (
                    <div key={index} className="tl"><span className={`chip ${RECALL_STATUS[u[2]].cls}`}>{tx(RECALL_STATUS[u[2]].label)}</span>{`${u[0]} · ${tx(u[1])} — ${tx(u[3])}`}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="record-rail">
            <div className="panel actions">
              {recall ? (
                <>
                  <b>{recall.id} <span className={`chip ${RECALL_STATUS[recall.status].cls}`}>{tx(RECALL_STATUS[recall.status].label)}</span></b>
                  <dl className="data-grid">
                    <dt>{tx('รายการยา')}</dt><dd>{`${recall.drug} · ${recall.lot}`}</dd>
                    <dt>{tx('ระดับ')}</dt><dd>{recall.severity ? tx(RECALL_SEVERITY[recall.severity]) : tx('ยังไม่ระบุ')}</dd>
                    <dt>{tx('เหตุผล')}</dt><dd>{tx(recall.reason)}</dd>
                    <dt>{tx('ผู้รับผิดชอบ')}</dt><dd>{tx(recall.openedBy)}</dd>
                  </dl>
                  {RECALL_NEXT[recall.status].length > 0 && <UiButton size="sm" type="button" onClick={() => backofficeActions.updateRecall(recall)}>{tx('อัปเดตการเรียกคืน')}</UiButton>}
                  {t.onHand.length > 0 && !held && recall.status !== 'closed' && <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.quarantine(lot, recall)}>{tx('กันของคงคลัง')}</UiButton>}
                  {held && <p className="secondary">{tx('lot นี้ถูกกันไว้ — ห้องยาจ่ายจาก lot นี้ไม่ได้')}</p>}
                </>
              ) : (
                <>
                  <b>{tx('ยังไม่มีการเรียกคืน lot นี้')}</b>
                  <p className="secondary">{tx('เปิดการเรียกคืนเมื่อมีประกาศจากผู้ผลิตหรือ อย. · ผู้อำนวยการรับผิดชอบการอนุมัติ')}</p>
                  {(t.onHand.length > 0 || t.dispensed.length > 0) && <UiButton size="sm" type="button" onClick={() => backofficeActions.openRecall(t.onHand[0]?.drug ?? t.dispensed[0].drug, lot)}>{tx('เริ่มการเรียกคืน')}</UiButton>}
                </>
              )}
            </div>
            <div className="panel actions">
              <b>{tx('หลักฐาน')}</b>
              <p className="secondary">{tx('การแจ้งเจ้าของทำผ่านโมดูลการสื่อสารตามความยินยอม ไม่ใช่หน้านี้')}</p>
              <p className="secondary">{tx('ยังไม่มีการส่งออกรายงานการเรียกคืน — รอ export จากระบบพร้อมสิทธิ์และการปกปิดข้อมูล')}</p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="panel"><div className="prompt">{tx('เลือกยา/Lot เพื่อดูรายการที่ได้รับผลกระทบ')}<div className="secondary">{tx('หรือกดการเรียกคืนที่เปิดอยู่ด้านบน')}</div></div></div>
      )}
    </bo-recall>
  );
}
