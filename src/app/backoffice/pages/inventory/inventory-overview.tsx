/* The inventory overview: the risks across the shelves, each counted from the rows its own page shows (INV-STK-00, composed over M06) */
import { Link } from 'react-router';

import { cx } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { CONTROL_SYSTEM, EXPIRY_BUCKETS, inventoryOverview, LOT_STATE, type ExpiryBucket } from '../../data/inventory';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const bucket = (key: ExpiryBucket) => EXPIRY_BUCKETS.find(b => b.key === key)!;

export function InventoryOverviewComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const o = inventoryOverview(store.clinic.data, store.data);
  const open = (id: string) => backofficeActions.openItem(id);

  return (
    <bo-inventory-overview className="page">
      <PageHead heading="ภาพรวมคลัง" source="รวมจาก M06 ตามสิทธิ์ · ทุกตัวเลขนับจากแถวเดียวกับหน้าต้นทาง · ไม่แก้ไขที่หน้านี้" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <Link className={cx('kpi', o.low > 0 && 'warn')} role="listitem" to="/backoffice/inventory/reorder">
          <span className="kpi-value">{o.low}</span><span className="kpi-label">{tx('ต่ำกว่าจุดสั่งเติม · จาก {n} รายการ', { n: o.items })}</span>
        </Link>
        <Link className={cx('kpi', o.expiry.d30 > 0 && 'danger', !o.expiry.d30 && o.expiring > 0 && 'warn')} role="listitem" to="/backoffice/inventory/lots">
          <span className="kpi-value">{o.expiring}</span><span className="kpi-label">{tx('lot หมดอายุใน 90 วัน · ใน 30 วัน {n}', { n: o.expiry.d30 })}</span>
        </Link>
        <Link className={cx('kpi', o.expiry.expired > 0 && 'danger')} role="listitem" to="/backoffice/inventory/lots?bucket=expired">
          <span className="kpi-value">{o.expiry.expired}</span><span className="kpi-label">{tx('lot หมดอายุที่ยังมีของ')}</span>
        </Link>
        <Link className={cx('kpi', o.investigations > 0 && 'danger')} role="listitem" to="/backoffice/inventory/controlled?tab=count">
          <span className="kpi-value">{o.investigations}</span><span className="kpi-label">{tx('การสอบสวนส่วนต่างที่เปิดอยู่')}</span>
        </Link>
        <Link className={cx('kpi', o.recalls > 0 && 'danger')} role="listitem" to="/backoffice/inventory/recall">
          <span className="kpi-value">{o.recalls}</span><span className="kpi-label">{tx('การเรียกคืนที่ยังไม่ปิด')}</span>
        </Link>
        <Link className="kpi" role="listitem" to="/backoffice/inventory/dispenses">
          <span className="kpi-value">{o.dispensedToday}</span><span className="kpi-label">{tx('จ่ายยาวันนี้ · รับเข้า {n}', { n: o.receiptsToday })}</span>
        </Link>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('Lot ที่ต้องจัดการก่อน')}</b><span className="secondary grow">{tx('{n} lot หมดอายุแล้วหรือภายใน 90 วัน · จ่ายก่อนตาม FEFO หรือบันทึกยาเสีย', { n: o.expiringLots.length })}</span></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th scope="col" className="w-ref">Lot</th>
                <th scope="col">{tx('รายการยา')}</th>
                <th scope="col" className="w-due">{tx('วันหมดอายุ')}</th>
                <th scope="col" className="w-kind">{tx('เหลือเวลา')}</th>
                <th scope="col" className="w-amount num">{tx('คงเหลือ')}</th>
                <th scope="col" className="w-owner">{tx('ตำแหน่ง')}</th>
                <th scope="col" className="w-status">{tx('สถานะ Lot')}</th>
              </tr>
            </thead>
            <tbody>
              {o.expiringLots.map(l => (
                <tr key={l.lot} tabIndex={0} onClick={() => open(l.drug)} onKeyDown={event => { if (event.key === 'Enter') { open(l.drug); } }}>
                  <td><b>{l.lot}</b></td>
                  <td>{l.drug}</td>
                  <td className="num">{l.expiry}</td>
                  <td><span className={`chip ${bucket(l.bucket).cls}`}>{l.days! < 0 ? tx('หมดอายุแล้ว') : tx('{n} วัน', { n: l.days! })}</span></td>
                  <td className="num">{l.qty} {tx(l.unit)}</td>
                  <td>{tx(l.location)}</td>
                  <td><span className={`chip ${LOT_STATE[l.state].cls}`}>{tx(LOT_STATE[l.state].label)}</span></td>
                </tr>
              ))}
              {!o.expiringLots.length && <tr className="static"><td colSpan={7} className="empty">{tx('ไม่มี lot ที่ใกล้หมดอายุ')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('ต่ำกว่าจุดสั่งเติม')}</b><span className="secondary grow">{tx('{n} รายการ · การสั่งซื้ออยู่นอกขอบเขตที่อนุมัติ', { n: o.lowItems.length })}</span></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th scope="col">{tx('รายการยา')}</th>
                <th scope="col" className="w-amount num">{tx('คงเหลือ')}</th>
                <th scope="col" className="w-amount num">{tx('จุดสั่งเติม')}</th>
                <th scope="col" className="w-at">{tx('นับล่าสุด')}</th>
                <th scope="col" className="w-kind">{tx('ควบคุม')}</th>
              </tr>
            </thead>
            <tbody>
              {o.lowItems.map(i => (
                <tr key={i.drug.id} tabIndex={0} onClick={() => open(i.drug.id)} onKeyDown={event => { if (event.key === 'Enter') { open(i.drug.id); } }}>
                  <td><b>{i.drug.name}</b><div className="secondary">{`${i.drug.id} · ${tx(i.location)}`}</div></td>
                  <td className="num text-danger">{i.onHand ?? '—'} {tx(i.drug.unit)}</td>
                  <td className="num">{i.drug.reorderThreshold} {tx(i.drug.unit)}</td>
                  <td className="num">{i.drug.lastCountAt ?? '—'}</td>
                  <td>{i.controlled ? <span className={`chip ${CONTROL_SYSTEM[i.drug.classSystem].cls}`}>{tx(CONTROL_SYSTEM[i.drug.classSystem].short)} {i.drug.category}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
              {!o.lowItems.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีรายการต่ำกว่าจุดสั่งเติม')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </bo-inventory-overview>
  );
}
