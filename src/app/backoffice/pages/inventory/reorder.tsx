/* The reorder worklist: what is at or below its reorder point, to read before buying elsewhere; nothing is ordered or acknowledged here (INV-ROP-01) */
import { useState } from 'react';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { CONTROL_SYSTEM, stockList, type StockItem } from '../../data/inventory';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const gap = (i: StockItem) => Math.round((i.drug.reorderThreshold - (i.onHand ?? 0)) * 100) / 100;

export function ReorderComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = stockList(store.stock, { lowOnly: true, q }).sort((a, b) => (a.onHand ?? 0) / a.drug.reorderThreshold - (b.onHand ?? 0) / b.drug.reorderThreshold);
  const selected = rows.find(i => i.drug.id === selectedId) ?? null;
  const pick = (i: StockItem) => setSelectedId(selectedId === i.drug.id ? null : i.drug.id);

  return (
    <bo-reorder className="page">
      <PageHead heading="รายการยาที่ต้องเติม" source="M06 · รายการที่คงเหลือถึงจุดสั่งเติม (is_low) · อ่านอย่างเดียว ไม่มีการรับทราบ มอบหมาย หรือปิดรายการ" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="notice">{tx('การสั่งซื้ออยู่นอกขอบเขตที่อนุมัติ — ไม่มีการสร้างใบขอซื้อ ใบสั่งซื้อ หรือเลือกผู้จำหน่ายจากหน้านี้ · จุดสั่งเติมตั้งค่าโดยผู้ดูแลระบบ')}</div>

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <input className="ui-input search" type="search" placeholder={tx('ค้นหายาหรือรหัส')} aria-label={tx('ค้นหายา')} value={q} onChange={event => setQ(event.target.value)} />
            <span className="secondary grow">{tx('{n} รายการ · เรียงตามสัดส่วนที่เหลือของจุดสั่งเติม', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th scope="col">{tx('รายการยา')}</th>
                  <th scope="col" className="w-amount num">{tx('คงเหลือ')}</th>
                  <th scope="col" className="w-amount num">{tx('จุดสั่งเติม')}</th>
                  <th scope="col" className="w-amount num">{tx('ขาด')}</th>
                  <th scope="col" className="w-at">{tx('นับล่าสุด')}</th>
                  <th scope="col" className="w-kind">{tx('ควบคุม')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(i => (
                  <tr key={i.drug.id} tabIndex={0} className={cx(i.drug.id === selectedId && 'selected')} aria-selected={i.drug.id === selectedId} onClick={() => pick(i)} onKeyDown={event => { if (event.key === 'Enter') { pick(i); } }}>
                    <td><b>{i.drug.name}</b><div className="secondary">{`${i.drug.id} · ${tx(i.location)}`}</div></td>
                    <td className="num text-danger">{i.onHand ?? '—'} {tx(i.drug.unit)}</td>
                    <td className="num">{i.drug.reorderThreshold}</td>
                    <td className="num">{gap(i)}</td>
                    <td className="num">{i.drug.lastCountAt ?? '—'}</td>
                    <td>{i.controlled ? <span className={`chip ${CONTROL_SYSTEM[i.drug.classSystem].cls}`}>{tx(CONTROL_SYSTEM[i.drug.classSystem].short)} {i.drug.category}</span> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx(q ? 'ไม่มีรายการที่ตรงกับตัวกรอง' : 'ไม่มีรายการถึงจุดสั่งเติม')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <Drawer heading={selected.drug.name} sub={`${selected.drug.id} · ${selected.location}`} onClosed={() => setSelectedId(null)} foot={<>
            <span className="grow"></span>
            <UiButton size="sm" type="button" onClick={() => backofficeActions.openItem(selected.drug.id)}>{tx('เปิดรายการยา')}</UiButton>
          </>}>
            <dl className="data-grid">
              <dt>{tx('คงเหลือ')}</dt><dd className="text-danger">{selected.onHand ?? '—'} {tx(selected.drug.unit)}</dd>
              <dt>{tx('จุดสั่งเติม')}</dt><dd>{selected.drug.reorderThreshold} {tx(selected.drug.unit)} · {tx('ขาด')} {gap(selected)}</dd>
              <dt>{tx('นับล่าสุด')}</dt><dd>{selected.drug.lastCountAt ? `${selected.drug.lastCountAt} · ${tx(selected.drug.lastCountBy ?? '')}` : tx('ยังไม่เคยนับ')}</dd>
              <dt>{tx('หมดอายุถัดไป')}</dt><dd>{selected.nearest ? `${selected.nearest.lot} · ${selected.nearest.expiry}` : '—'}</dd>
            </dl>
            <p className="secondary">{tx('การจัดหาทำนอกระบบนี้จนกว่า procurement จะมีสัญญา · เมื่อรับยาเข้าคลังแล้ว รายการจะพ้นจากหน้านี้เอง')}</p>
          </Drawer>
        )}
      </div>
    </bo-reorder>
  );
}
