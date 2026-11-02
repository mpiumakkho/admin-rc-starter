/* Dispense history: what left the pharmacy and the ledger, asked for one patient or one drug at a time, never for everyone (INV-DSP-01) */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { dispenseHistory, dispenseScopes, wasteReason, type DispenseRow } from '../../data/inventory';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const SOURCE: Record<DispenseRow['source'], { label: string; cls: string }> = {
  pharmacy: { label: 'ห้องยา', cls: 'info' },
  ward: { label: 'วอร์ด', cls: 'quiet' },
  ledger: { label: 'บัญชียาควบคุม', cls: 'warn' },
};

export function DispensesComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [scope, setScope] = useState<'patient' | 'drug'>(params.get('drug') ? 'drug' : 'patient');
  const [key, setKey] = useState(params.get('drug') ?? params.get('patient') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const scopes = dispenseScopes(store.clinic.data, store.data);
  const options = scope === 'patient' ? scopes.patients : scopes.drugs;
  const rows = dispenseHistory(store.clinic.data, store.data, { [scope]: key, from, to });
  const selected = rows.find(r => r.id === selectedId) ?? null;
  const changeScope = (s: 'patient' | 'drug') => { setScope(s); setKey(''); setSelectedId(null); };
  const pick = (r: DispenseRow) => setSelectedId(selectedId === r.id ? null : r.id);

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-dispenses className="page">
      <PageHead heading="ประวัติการจ่ายยา" source="M06 · ค้นได้ตามผู้ป่วยหรือตามรายการยาเท่านั้น ไม่มีมุมมองทั้งหมด · รายการเป็น append-only" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <div className="segmented" role="group" aria-label={tx('ขอบเขต')}>
              <button type="button" className={cx(scope === 'patient' && 'active')} aria-pressed={scope === 'patient'} onClick={() => changeScope('patient')}>{tx('ตามผู้ป่วย')}</button>
              <button type="button" className={cx(scope === 'drug' && 'active')} aria-pressed={scope === 'drug'} onClick={() => changeScope('drug')}>{tx('ตามรายการยา')}</button>
            </div>
            <select className="ui-input" aria-label={tx(scope === 'patient' ? 'ผู้ป่วย' : 'รายการยา')} value={key} onChange={event => setKey(event.target.value)}>
              <option value="">{tx(scope === 'patient' ? '— เลือกผู้ป่วย —' : '— เลือกรายการยา —')}</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <label className="date-field"><span className="visually-hidden">{tx('ตั้งแต่')}</span><input className="ui-input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
            <span className="secondary">–</span>
            <label className="date-field"><span className="visually-hidden">{tx('ถึง')}</span><input className="ui-input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
            <span className="secondary grow">{key ? tx('{n} รายการ · เวลาตามเขตเวลาของระบบ', { n: rows.length }) : ''}</span>
          </div>
          {!key ? (
            <div className="prompt">{tx('เลือกผู้ป่วยหรือรายการยาก่อนค้นหา')}<div className="secondary">{tx('ประวัติการจ่ายยาเป็นข้อมูลคุ้มครอง จึงเปิดได้ทีละขอบเขตตามสิทธิ์')}</div></div>
          ) : (
            <>
            <div className="table-wrap">
              <table className="bo-table">
                <thead>
                  <tr>
                    <th scope="col" className="w-at">{tx('เวลา')}</th>
                    <th scope="col">{tx(scope === 'patient' ? 'รายการยา' : 'ผู้ป่วย')}</th>
                    <th scope="col" className="w-amount num">{tx('เบิก/ให้จริง')}</th>
                    <th scope="col" className="w-owner">{tx('ผู้จ่าย')}</th>
                    <th scope="col" className="w-owner">{tx('พยาน')}</th>
                    <th scope="col" className="w-ref">{tx('คำสั่ง / visit')}</th>
                    <th scope="col" className="w-kind">{tx('ยาเสีย')}</th>
                    <th scope="col" className="w-kind">{tx('ที่มา')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.rows.map(r => (
                    <tr key={r.id} tabIndex={0} className={cx(r.id === selectedId && 'selected')} aria-selected={r.id === selectedId} onClick={() => pick(r)} onKeyDown={event => { if (event.key === 'Enter') { pick(r); } }}>
                      <td className="num">{r.at}</td>
                      <td><b>{scope === 'patient' ? r.drug : r.patient}</b><div className="secondary">{r.id}</div></td>
                      <td className="num">{tx(r.qty)}{r.administered && <div className="secondary">{tx(r.administered)}</div>}</td>
                      <td>{tx(r.by)}</td>
                      <td>{tx(r.witness ?? '—')}</td>
                      <td>{r.order ?? '—'}{r.encounter && <div className="secondary">{r.encounter}</div>}</td>
                      <td>{r.waste ? <span className="chip warn">{r.waste.qty} {tx(r.waste.unit)}</span> : <span className="muted">—</span>}</td>
                      <td><span className={`chip ${SOURCE[r.source].cls}`}>{tx(SOURCE[r.source].label)}</span></td>
                    </tr>
                  ))}
                  {!rows.length && <tr className="static"><td colSpan={8} className="empty">{tx('ไม่มีการจ่ายยาในขอบเขตที่เลือก')}</td></tr>}
                </tbody>
              </table>
            </div>
            <PagerFoot pager={pager} />
            </>
          )}
        </div>

        {selected && (
          <Drawer heading={selected.drug} sub={`${selected.id} · ${selected.at}`} onClosed={() => setSelectedId(null)} foot={<>
            {(selected.source === 'ledger' || selected.witness) && <Link className="link" to={`/backoffice/inventory/controlled?drug=${encodeURIComponent(selected.drug)}`}>{tx('เปิดบัญชียาควบคุม')}</Link>}
            <span className="grow"></span>
            <UiButton size="sm" type="button" onClick={() => backofficeActions.openItem(selected.drug)}>{tx('เปิดรายการยา')}</UiButton>
          </>}>
            <dl className="data-grid">
              <dt>{tx('ผู้ป่วย')}</dt><dd>{selected.patient}</dd>
              <dt>{tx('เบิก')}</dt><dd>{tx(selected.qty)}</dd>
              {selected.administered && <><dt>{tx('ให้จริง')}</dt><dd>{tx(selected.administered)} · {tx('ตามใบให้ยาของวอร์ด')}</dd></>}
              <dt>{tx('ผู้จ่าย')}</dt><dd>{tx(selected.by)}</dd>
              <dt>{tx('พยาน')}</dt><dd>{tx(selected.witness ?? '—')}</dd>
              <dt>{tx('คำสั่ง')}</dt><dd>{selected.order ?? '—'}{selected.encounter && ` · ${selected.encounter}`}</dd>
              <dt>Lot</dt><dd>{selected.lot ?? tx('ยังไม่ผูก lot (GATED)')}</dd>
              <dt>{tx('ที่มา')}</dt><dd>{tx(SOURCE[selected.source].label)}</dd>
              {selected.waste && <><dt>{tx('ยาเสีย')}</dt><dd>{`${selected.waste.id} · ${selected.waste.qty} ${tx(selected.waste.unit)} · ${tx(wasteReason(selected.waste.reason).label)}`}</dd></>}
            </dl>
            <p className="secondary">{tx('รายการจ่ายแก้ ลบ หรือกลับรายการจากหน้านี้ไม่ได้ · การคืนเข้าคลังผ่าน workflow ของ M06')}</p>
          </Drawer>
        )}
      </div>
    </bo-dispenses>
  );
}
