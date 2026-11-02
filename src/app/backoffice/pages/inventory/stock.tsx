/* Medication inventory: every drug's stock as the shelf has it, what is below its reorder point, and when it was last counted (INV-STK-01) */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { lucideCircleAlert, lucideCircleCheck } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { CONTROL_SYSTEM, EXPIRY_BUCKETS, locationsOf, LOT_STATE, stockList, type ExpiryBucket, type StockItem } from '../../data/inventory';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const bucket = (key: ExpiryBucket) => EXPIRY_BUCKETS.find(b => b.key === key)!;

export function StockComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const [lowOnly, setLowOnly] = useState(params.get('low') === '1');
  const [controlledOnly, setControlledOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const all = store.stock;
  const low = all.filter(i => i.isLow).length;
  const controlled = all.filter(i => i.controlled).length;
  const lots = all.flatMap(i => i.lots).filter(l => (l.qty ?? 0) > 0).length;
  const locations = locationsOf(all);
  const filtered = !!(q || location || lowOnly || controlledOnly);
  const rows = stockList(all, { q, location, lowOnly, controlledOnly });
  const selected = all.find(i => i.drug.id === selectedId) ?? null;
  const pick = (i: StockItem) => setSelectedId(selectedId === i.drug.id ? null : i.drug.id);

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-stock className="page">
      <PageHead heading="คลังยา" source="M06 · คงเหลือ จุดสั่งเติม และการนับล่าสุดเป็นของระบบ ไม่คำนวณใหม่ในหน้านี้ · ปรับสต็อกได้ผ่านการรับเข้าและการนับเท่านั้น" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{all.length}</span><span className="kpi-label">{tx('รายการยาในทะเบียน')}</span></div>
        <button type="button" className={cx('kpi', low > 0 && 'warn', lowOnly && 'active')} role="listitem" onClick={() => setLowOnly(!lowOnly)}><span className="kpi-value">{low}</span><span className="kpi-label">{tx('ต่ำกว่าจุดสั่งเติม')}</span></button>
        <button type="button" className={cx('kpi', controlledOnly && 'active')} role="listitem" onClick={() => setControlledOnly(!controlledOnly)}><span className="kpi-value">{controlled}</span><span className="kpi-label">{tx('ยาควบคุม')}</span></button>
        <div className="kpi" role="listitem"><span className="kpi-value">{lots}</span><span className="kpi-label">{tx('lot ที่มีของ')}</span></div>
      </div>

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <input className="ui-input search" type="search" placeholder={tx('ค้นหายาหรือรหัส')} aria-label={tx('ค้นหายา')} value={q} onChange={event => setQ(event.target.value)} />
            <select className="ui-input" aria-label={tx('ตำแหน่งจัดเก็บ')} value={location} onChange={event => setLocation(event.target.value)}>
              <option value="">{tx('ทุกตำแหน่ง')}</option>
              {locations.map(l => <option key={l} value={l}>{tx(l)}</option>)}
            </select>
            <label className="check"><input type="checkbox" checked={lowOnly} onChange={event => setLowOnly(event.target.checked)} />{tx('ต่ำกว่าจุดสั่งเติม')}</label>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table stock">
              <thead>
                <tr>
                  <th scope="col">{tx('รายการยา')}</th>
                  <th scope="col" className="w-amount num">{tx('คงเหลือ')}</th>
                  <th scope="col" className="w-amount num">{tx('จุดสั่งเติม')}</th>
                  <th scope="col" className="w-status">{tx('สถานะสต็อก')}</th>
                  <th scope="col" className="w-at">{tx('นับล่าสุด')}</th>
                  <th scope="col" className="w-kind">{tx('ควบคุม')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(i => (
                  <tr key={i.drug.id} tabIndex={0} className={cx(i.drug.id === selectedId && 'selected')} aria-selected={i.drug.id === selectedId} onClick={() => pick(i)} onKeyDown={event => { if (event.key === 'Enter') { pick(i); } }}>
                    <td><b>{i.drug.name}</b><div className="secondary">{`${i.drug.id} · ${tx(i.drug.form)} · ${tx(i.location)}`}</div></td>
                    <td className={cx('num', i.isLow && 'text-danger')}>{i.onHand ?? '—'} {tx(i.drug.unit)}</td>
                    <td className="num">{i.drug.reorderThreshold}</td>
                    <td>
                      {i.isLow
                        ? <span className="chip danger"><NgIcon svg={lucideCircleAlert} aria-hidden="true" /> {tx('ต่ำกว่าจุดเติม')}</span>
                        : <span className="chip ok"><NgIcon svg={lucideCircleCheck} aria-hidden="true" /> {tx('พอใช้')}</span>}
                    </td>
                    <td className="num">{i.drug.lastCountAt ?? '—'}{i.drug.lastCountBy && <div className="secondary">{tx(i.drug.lastCountBy)}</div>}</td>
                    <td>{i.controlled ? <span className={`chip ${CONTROL_SYSTEM[i.drug.classSystem].cls}`}>{tx(CONTROL_SYSTEM[i.drug.classSystem].short)} {i.drug.category}</span> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx(filtered ? 'ไม่มีรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีรายการยาในทะเบียน')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {selected && (
          <Drawer heading={selected.drug.name} sub={`${selected.drug.id} · ${selected.drug.form} · ${selected.location}`} onClosed={() => setSelectedId(null)} foot={<>
            {selected.isLow && <Link className="link" to="/backoffice/inventory/reorder">{tx('ไปรายการต้องเติม')}</Link>}
            <span className="grow"></span>
            <UiButton size="sm" type="button" onClick={() => backofficeActions.openItem(selected.drug.id)}>{tx('เปิดรายการยา')}</UiButton>
          </>}>
            <dl className="data-grid">
              <dt>{tx('คงเหลือ')}</dt><dd className={cx(selected.isLow && 'text-danger')}>{selected.onHand ?? '—'} {tx(selected.drug.unit)} · {tx(selected.isLow ? 'ต่ำกว่าจุดเติม' : 'พอใช้')}</dd>
              <dt>{tx('จุดสั่งเติม')}</dt><dd>{selected.drug.reorderThreshold} {tx(selected.drug.unit)}</dd>
              <dt>{tx('นับล่าสุด')}</dt><dd>{selected.drug.lastCountAt ? `${selected.drug.lastCountAt} · ${tx(selected.drug.lastCountBy ?? '')}` : tx('ยังไม่เคยนับ')}</dd>
              <dt>{tx('หมดอายุถัดไป')}</dt><dd>{selected.nearest ? <>{selected.nearest.expiry} · <span className={`chip ${bucket(selected.nearest.bucket).cls}`}>{tx(bucket(selected.nearest.bucket).label)}</span></> : '—'}</dd>
              <dt>{tx('ควบคุม')}</dt><dd>{tx(CONTROL_SYSTEM[selected.drug.classSystem].label)}{selected.controlled && ` · ${tx('ประเภท')} ${selected.drug.category} · ${tx(selected.drug.requiresWitnessDispense ? 'เบิกต้องมีพยาน' : 'เบิกไม่ต้องมีพยาน')}`}</dd>
            </dl>
            <p className="secondary">{tx('Lot ทั้งหมด')} · {tx('ข้อมูล lot เป็นตัวอย่าง — Read API ของ lot ยังไม่อนุมัติ (GATED)')}</p>
            <table className="mini-lines">
              <thead><tr><th>Lot</th><th>{tx('วันหมดอายุ')}</th><th className="num">{tx('คงเหลือ')}</th><th>{tx('สถานะ')}</th></tr></thead>
              <tbody>
                {selected.lots.map(l => (
                  <tr key={l.lot}><td>{l.lot}<div className="secondary">{tx(l.location)}</div></td><td>{l.expiry}</td><td className="num">{l.qty ?? '—'}</td><td><span className={`chip ${LOT_STATE[l.state].cls}`}>{tx(LOT_STATE[l.state].label)}</span></td></tr>
                ))}
                {!selected.lots.length && <tr><td colSpan={4} className="muted">{tx('ยังไม่มี lot ในคลัง')}</td></tr>}
              </tbody>
            </table>
          </Drawer>
        )}
      </div>
    </bo-stock>
  );
}
