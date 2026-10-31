/* One drug: its stock and rules, its lots with their expiry, and everything that moved it (INV-STK-02) */
import { Link, useParams } from 'react-router';

import { lucideArrowLeft } from '../../../icons';
import { cx, NgIcon } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { CONTROL_SYSTEM, EXPIRY_BUCKETS, itemOf, LOT_STATE, MOVEMENT_KIND, movementsOf, type ExpiryBucket } from '../../data/inventory';
import { useBoI18n } from '../../i18n/bo-i18n';

const bucket = (key: ExpiryBucket) => EXPIRY_BUCKETS.find(b => b.key === key)!;

export function ItemDetailComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const { id } = useParams();
  const i = itemOf(store.clinic.data, store.data, decodeURIComponent(id ?? ''));
  if (!i) {
    return (
      <bo-item-detail className="page">
        <div className="panel"><div className="empty">{tx('ไม่พบรายการยา')} · <Link className="link" to="/backoffice/inventory/stock">{tx('คลังยา')}</Link></div></div>
      </bo-item-detail>
    );
  }
  const movements = movementsOf(store.clinic.data, store.data, i.drug.name);
  const recalledLot = i.lots.find(l => l.recall);
  const CONTROL = CONTROL_SYSTEM;

  return (
    <bo-item-detail className="page">
      <div className="page-head">
        <div className="title-block">
          <Link className="link back" to="/backoffice/inventory/stock"><NgIcon svg={lucideArrowLeft} aria-hidden="true" />{tx('คลังยา')}</Link>
          <h1>{i.drug.name} {i.controlled && <span className={`chip ${CONTROL[i.drug.classSystem].cls}`}>{tx(CONTROL[i.drug.classSystem].short)} {i.drug.category}</span>}</h1>
          <div className="subtitle">
            <span>{`${i.drug.id} · ${tx(i.drug.form)} · ${tx('หน่วย')} ${tx(i.drug.unit)} · ${tx(i.location)}`}</span>
            <span className="freshness">{tx('ข้อมูล ณ วันนี้ 11:32')}</span>
          </div>
        </div>
      </div>

      <div className="record">
        <div className="record-main">
          <div className="panel">
            <dl className="data-grid wide">
              <dt>{tx('คงเหลือ')}</dt><dd className={cx(i.isLow && 'text-danger')}><b>{i.onHand ?? '—'} {tx(i.drug.unit)}</b> · {tx(i.isLow ? 'ต่ำกว่าจุดเติม' : 'พอใช้')} ({tx('จุดสั่งเติม')} {i.drug.reorderThreshold})</dd>
              <dt>{tx('นับล่าสุด')}</dt><dd>{i.drug.lastCountAt ? `${i.drug.lastCountAt} · ${tx(i.drug.lastCountBy ?? '')}` : tx('ยังไม่เคยนับ')}</dd>
              <dt>{tx('หมดอายุถัดไป')}</dt><dd>{i.nearest ? <>{i.nearest.lot} · {i.nearest.expiry} · <span className={`chip ${bucket(i.nearest.bucket).cls}`}>{tx(bucket(i.nearest.bucket).label)}</span></> : '—'}</dd>
              <dt>{tx('การจำแนก')}</dt><dd>{tx(CONTROL[i.drug.classSystem].label)}{i.controlled && ` · ${tx('ประเภท')} ${i.drug.category} · ${tx(i.drug.requiresWitnessDispense ? 'เบิกต้องมีพยาน' : 'เบิกไม่ต้องมีพยาน')}`} · {tx('ตรวจสอบโดย')} {tx(i.drug.verifiedBy ?? '')}</dd>
            </dl>
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('Lot ทั้งหมด')}</b><span className="secondary grow">{tx('{n} lot · จำนวนเป็นของระบบ ไม่แก้ในหน้านี้ · Read API ของ lot ยังไม่อนุมัติ (GATED) — ข้อมูลตัวอย่าง', { n: i.lots.length })}</span></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead>
                  <tr>
                    <th scope="col" className="w-ref">Lot</th>
                    <th scope="col" className="w-due">{tx('วันหมดอายุ')}</th>
                    <th scope="col" className="w-kind">{tx('เหลือเวลา')}</th>
                    <th scope="col" className="w-amount num">{tx('คงเหลือ')}</th>
                    <th scope="col" className="w-owner">{tx('ตำแหน่ง')}</th>
                    <th scope="col" className="w-status">{tx('สถานะ Lot')}</th>
                    <th scope="col">{tx('การเรียกคืน')}</th>
                  </tr>
                </thead>
                <tbody>
                  {i.lots.map(l => (
                    <tr key={l.lot} className="static">
                      <td><b>{l.lot}</b></td>
                      <td className="num">{l.expiry}</td>
                      <td><span className={`chip ${bucket(l.bucket).cls}`}>{l.days === null ? '—' : l.days < 0 ? tx('หมดอายุแล้ว') : tx('{n} วัน', { n: l.days })}</span></td>
                      <td className="num">{l.qty ?? '—'} {tx(l.unit)}</td>
                      <td>{tx(l.location)}</td>
                      <td><span className={`chip ${LOT_STATE[l.state].cls}`}>{tx(LOT_STATE[l.state].label)}</span></td>
                      <td>{l.recall ? <Link className="link" to={`/backoffice/inventory/recall?lot=${encodeURIComponent(l.lot)}`}>{l.recall.id}</Link> : <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                  {!i.lots.length && <tr className="static"><td colSpan={7} className="empty">{tx('รายการนี้ไม่มี lot ในคลัง')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('ประวัติการเคลื่อนไหว')}</b><span className="secondary grow">{tx('รับเข้า จ่ายยา ยาเสีย และการนับ · ล่าสุดก่อน · รายการจ่ายของห้องยาที่ยังไม่ผูก lot แสดงเป็น —')}</span></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead>
                  <tr>
                    <th scope="col" className="w-at">{tx('เวลา')}</th>
                    <th scope="col" className="w-kind">{tx('ประเภท')}</th>
                    <th scope="col" className="w-ref">Lot</th>
                    <th scope="col" className="w-amount num">{tx('จำนวน +/−')}</th>
                    <th scope="col" className="w-owner">{tx('ตำแหน่ง')}</th>
                    <th scope="col">{tx('อ้างอิง')}</th>
                    <th scope="col" className="w-owner">{tx('ผู้ทำ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m, index) => (
                    <tr key={index} className="static">
                      <td className="num">{m.at}</td>
                      <td><span className={`chip ${MOVEMENT_KIND[m.kind].cls}`}>{tx(MOVEMENT_KIND[m.kind].label)}</span></td>
                      <td>{m.lot ?? '—'}</td>
                      <td className={cx('num', m.qty !== null && m.qty < 0 && 'text-danger')}>{m.qty === null ? '—' : `${m.qty > 0 ? '+' : ''}${m.qty} ${tx(m.unit)}`}</td>
                      <td>{tx(m.location ?? '—')}</td>
                      <td>{m.link ? <Link className="link" to={m.link}>{tx(m.ref)}</Link> : tx(m.ref)}</td>
                      <td>{tx(m.by)}</td>
                    </tr>
                  ))}
                  {!movements.length && <tr className="static"><td colSpan={7} className="empty">{tx('ยังไม่มีการเคลื่อนไหว')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="record-rail">
          <div className="panel actions">
            <b>{tx('การทำงาน')}</b>
            <Link className="link" to={`/backoffice/inventory/receipts?drug=${encodeURIComponent(i.drug.name)}`}>{tx('รับเข้าคลัง')}</Link>
            {i.isLow && <Link className="link" to="/backoffice/inventory/reorder">{tx('แจ้งต้องเติม')}</Link>}
            {i.controlled && <Link className="link" to={`/backoffice/inventory/controlled?drug=${encodeURIComponent(i.drug.name)}`}>{tx('เปิดบัญชียาควบคุม')}</Link>}
            {i.lots.length > 0 && <Link className="link" to={`/backoffice/inventory/recall?lot=${encodeURIComponent((recalledLot ?? i.lots[0]).lot)}`}>{tx('ตรวจการเรียกคืน')}</Link>}
            <p className="secondary">{tx('ไม่มีการแก้จำนวน lot หรือตัดจำหน่ายในหน้านี้ · ปรับผ่านการรับเข้า การนับ หรือยาเสียเท่านั้น')}</p>
          </div>
          <div className="panel actions">
            <b>{tx('หลักฐาน')}</b>
            <p className="secondary">{tx('จุดสั่งเติมตั้งค่าโดยผู้ดูแลระบบ · การจำแนกยาควบคุมตาม ADR-0026 ตรวจสอบโดยเภสัชกร')}</p>
          </div>
        </aside>
      </div>
    </bo-item-detail>
  );
}
