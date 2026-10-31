/* Lots and expiry: every lot on every shelf, the soonest to expire first, in the 30/60/90-day windows (inventory.lotsExpiry, the lot read model of INV-STK-02) */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { allLots, EXPIRY_BUCKETS, expiryCounts, LOT_STATE, type ExpiryBucket, type LotRow } from '../../data/inventory';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const info = (key: ExpiryBucket) => EXPIRY_BUCKETS.find(b => b.key === key)!;

export function LotsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<ExpiryBucket | ''>((params.get('bucket') as ExpiryBucket | null) ?? '');
  const [withStock, setWithStock] = useState(true);
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const counts = expiryCounts(store.stock);
  const rows = allLots(store.stock, { bucket, q, withStock });
  const selected = rows.find(l => l.lot === selectedLot) ?? null;
  const pick = (l: LotRow) => setSelectedLot(selectedLot === l.lot ? null : l.lot);

  return (
    <bo-lots className="page">
      <PageHead heading="Lot และวันหมดอายุ" source="M06 · lot ของทุกรายการยา เรียงตามวันหมดอายุ · ช่วงเตือน 30/60/90 วันนับถึงวันสุดท้ายของเดือนที่ระบุ · Read API ของ lot ยังไม่อนุมัติ (GATED) — ข้อมูลตัวอย่าง" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        {EXPIRY_BUCKETS.map(b => (
          <button key={b.key} type="button" className={cx('kpi', counts[b.key] > 0 && b.key !== 'ok' && b.cls, bucket === b.key && 'active')} role="listitem" onClick={() => setBucket(bucket === b.key ? '' : b.key)}>
            <span className="kpi-value">{counts[b.key]}</span><span className="kpi-label">{tx(b.label)}</span>
          </button>
        ))}
      </div>

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <input className="ui-input search" type="search" placeholder={tx('ค้นหายาหรือ lot')} aria-label={tx('ค้นหา lot')} value={q} onChange={event => setQ(event.target.value)} />
            <label className="check"><input type="checkbox" checked={withStock} onChange={event => setWithStock(event.target.checked)} />{tx('เฉพาะ lot ที่มีของ')}</label>
            <span className="secondary grow">{tx('{n} lot', { n: rows.length })}</span>
          </div>
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
                {rows.map(l => (
                  <tr key={l.lot} tabIndex={0} className={cx(l.lot === selectedLot && 'selected')} aria-selected={l.lot === selectedLot} onClick={() => pick(l)} onKeyDown={event => { if (event.key === 'Enter') { pick(l); } }}>
                    <td><b>{l.lot}</b></td>
                    <td>{l.drug}</td>
                    <td className="num">{l.expiry}</td>
                    <td><span className={`chip ${info(l.bucket).cls}`}>{l.days === null ? '—' : l.days < 0 ? tx('หมดอายุแล้ว') : tx('{n} วัน', { n: l.days })}</span></td>
                    <td className="num">{l.qty ?? '—'} {tx(l.unit)}</td>
                    <td>{tx(l.location)}</td>
                    <td><span className={`chip ${LOT_STATE[l.state].cls}`}>{tx(LOT_STATE[l.state].label)}</span></td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={7} className="empty">{tx(bucket || q ? 'ไม่มี lot ที่ตรงกับตัวกรอง' : 'ไม่มี lot ในคลัง')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <Drawer heading={selected.lot} sub={selected.drug} onClosed={() => setSelectedLot(null)} foot={<>
            <Link className="link" to={`/backoffice/inventory/recall?lot=${encodeURIComponent(selected.lot)}`}>{tx('ตรวจการเรียกคืน')}</Link>
            <span className="grow"></span>
            <UiButton size="sm" type="button" onClick={() => backofficeActions.openItem(selected.drug)}>{tx('เปิดรายการยา')}</UiButton>
          </>}>
            <dl className="data-grid">
              <dt>{tx('วันหมดอายุ')}</dt><dd>{selected.expiry} · <span className={`chip ${info(selected.bucket).cls}`}>{tx(info(selected.bucket).label)}</span></dd>
              <dt>{tx('คงเหลือ')}</dt><dd>{selected.qty ?? '—'} {tx(selected.unit)} · {tx(selected.location)}</dd>
              <dt>{tx('สถานะ Lot')}</dt><dd><span className={`chip ${LOT_STATE[selected.state].cls}`}>{tx(LOT_STATE[selected.state].label)}</span>{selected.recall && ` · ${selected.recall.id}`}</dd>
            </dl>
            <p className="secondary">{tx(selected.bucket === 'expired' ? 'หมดอายุแล้ว — ห้องยาจ่ายจาก lot นี้ไม่ได้ · บันทึกเป็นยาเสียเมื่อทำลาย' : selected.bucket === 'ok' ? 'ยังไม่ถึงช่วงเตือน' : 'จ่ายจาก lot นี้ก่อนตาม FEFO · ห้องยาเลือก lot ที่หมดอายุก่อนให้อัตโนมัติ')}</p>
          </Drawer>
        )}
      </div>
    </bo-lots>
  );
}
