/* Stock receipt: a lot received into a drug's shelf, with what it does to the stock shown before it is posted (INV-RCV-01) */
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';

import { UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { CONTROL_SYSTEM, daysLeft, EXPIRY_BUCKETS, expiryBucket, locationsOf, monthToExpiry, receiptProblems, type ReceiptInput } from '../../data/inventory';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

export function ReceiptsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const stock = store.stock;
  const drugs = store.data.drugs;
  const locations = locationsOf(stock);
  const receipts = store.data.receipts;
  const itemLocation = (name: string) => stock.find(i => i.drug.name === name)?.location;

  const [drug, setDrug] = useState(params.get('drug') ?? '');
  const [lot, setLot] = useState('');
  const [month, setMonth] = useState('');
  const [qty, setQty] = useState('');
  const [location, setLocation] = useState(itemLocation(params.get('drug') ?? '') ?? locations[0] ?? '');
  const [sourceRef, setSourceRef] = useState('');
  const [note, setNote] = useState('');

  const item = stock.find(i => i.drug.name === drug) ?? null;
  const unit = item?.drug.unit ?? '';
  const input: ReceiptInput = { drug, lot, expiry: monthToExpiry(month), qty: Number(qty), location, sourceRef, note };
  const problemList = Object.values(receiptProblems(store.clinic.data, store.data, input)) as string[];
  const canSubmit = !problemList.length;
  const after = Math.round(((item?.onHand ?? 0) + (Number(qty) || 0)) * 100) / 100;
  const days = daysLeft(monthToExpiry(month));
  const expiryBucketKey = days === null ? 'ok' : expiryBucket(days);
  const expiryNote = days === null || expiryBucketKey === 'ok' ? null
    : { cls: EXPIRY_BUCKETS.find(b => b.key === expiryBucketKey)!.cls, text: days < 0 ? 'วันหมดอายุเป็นอดีต — รับเข้าไม่ได้' : 'lot นี้จะหมดอายุใน {n} วัน — ตรวจกับผู้จำหน่ายก่อนรับ'.replace('{n}', String(days)) };

  const reset = () => { setDrug(''); setLot(''); setMonth(''); setQty(''); setSourceRef(''); setNote(''); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    backofficeActions.receive(input, receipt => {
      reset();
      backofficeActions.openItem(receipt.drug);
    });
  };
  const pickDrug = (name: string) => {
    setDrug(name);
    const loc = itemLocation(name);
    if (loc) {
      setLocation(loc);
    }
  };

  /** The table's pages */
  const pager = usePager(receipts);
  return (
    <bo-receipts className="page">
      <PageHead heading="รับยาเข้าคลัง" source="M06 · รับได้เฉพาะยาในทะเบียน · การบันทึกเพิ่มคงเหลือเมื่อระบบยืนยัน · ไม่มีใบสั่งซื้อหรือ supplier master ในหน้านี้ (procurement reserved)" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="record">
        <div className="record-main">
          <form className="panel receipt-form" onSubmit={submit}>
            <div className="filter-bar"><b>{tx('แบบฟอร์มรับเข้า')}</b><span className="secondary grow">{tx('ช่อง Lot และวันหมดอายุบันทึกตามสัญญาที่ยังรอ BE lot slice (GATED) — ตัวอย่างนี้เก็บไว้ให้ห้องยาใช้ FEFO')}</span></div>
            <div className="form-grid">
              <label>{tx('รายการยา')}
                <select className="ui-input" name="drug" value={drug} onChange={event => pickDrug(event.target.value)}>
                  <option value="">{tx('— เลือกจากทะเบียนยา —')}</option>
                  {drugs.map(d => <option key={d.id} value={d.name}>{`${d.id} · ${d.name}`}</option>)}
                </select>
              </label>
              <label>{tx('ตำแหน่งจัดเก็บ')}
                <select className="ui-input" name="location" value={location} onChange={event => setLocation(event.target.value)}>
                  {locations.map(l => <option key={l} value={l}>{tx(l)}</option>)}
                </select>
              </label>
              <label>Lot<input className="ui-input" name="lot" value={lot} onChange={event => setLot(event.target.value)} placeholder={tx('เช่น AM-2509-01')} /></label>
              <label>{tx('วันหมดอายุ')}<input className="ui-input" name="expiry" type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
              <label>{tx('จำนวนรับ')}{unit ? ` (${tx(unit)})` : ''}<input className="ui-input" name="qty" type="number" min="0" step="any" value={qty} onChange={event => setQty(event.target.value)} /></label>
              <label>{tx('อ้างอิงที่มา')} <span className="muted">{tx('(ไม่บังคับ)')}</span><input className="ui-input" name="sourceRef" value={sourceRef} onChange={event => setSourceRef(event.target.value)} placeholder={tx('เลขที่ใบส่งของ · ผู้จำหน่าย')} /></label>
              <label className="full">{tx('หมายเหตุ')} <span className="muted">{tx('(ไม่บังคับ)')}</span><textarea className="ui-input" name="note" rows={2} value={note} onChange={event => setNote(event.target.value)}></textarea></label>
            </div>
            <div className="form-foot">
              <UiButton variant="secondary" size="sm" type="button" onClick={reset}>{tx('ล้างฟอร์ม')}</UiButton>
              <span className="grow"></span>
              <UiButton size="sm" type="submit" disabled={!canSubmit}>{tx('บันทึกการรับเข้า')}</UiButton>
            </div>
          </form>

          <div className="panel">
            <div className="filter-bar"><b>{tx('รับเข้าล่าสุด')}</b><span className="secondary grow">{tx('receipt ที่บันทึกแล้วแก้ไขไม่ได้ · การแก้ไขผ่านกฎ reversal ของโมดูลเจ้าของ (GATED)')}</span></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead>
                  <tr>
                    <th scope="col" className="w-at">{tx('เวลา')}</th>
                    <th scope="col">{tx('รายการยา')}</th>
                    <th scope="col" className="w-ref">Lot</th>
                    <th scope="col" className="w-due">{tx('วันหมดอายุ')}</th>
                    <th scope="col" className="w-amount num">{tx('จำนวน')}</th>
                    <th scope="col" className="w-owner">{tx('ตำแหน่ง')}</th>
                    <th scope="col" className="w-owner">{tx('ผู้รับ')}</th>
                    <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.rows.map(r => (
                    <tr key={r.id} tabIndex={0} onClick={() => backofficeActions.openItem(r.drug)} onKeyDown={event => { if (event.key === 'Enter') { backofficeActions.openItem(r.drug); } }}>
                      <td className="num">{r.at}</td>
                      <td><b>{r.drug}</b><div className="secondary">{r.id}{r.sourceRef && ` · ${r.sourceRef}`}</div></td>
                      <td>{r.lot}</td>
                      <td className="num">{r.expiry}</td>
                      <td className="num">+{r.qty} {tx(r.unit)}</td>
                      <td>{tx(r.location)}</td>
                      <td>{tx(r.by)}</td>
                      <td><span className="chip ok">{tx('บันทึกแล้ว')}</span></td>
                    </tr>
                  ))}
                  {!receipts.length && <tr className="static"><td colSpan={8} className="empty">{tx('ยังไม่มีการรับเข้า')}</td></tr>}
                </tbody>
              </table>
            </div>
            <PagerFoot pager={pager} />
          </div>
        </div>

        {/* What the receipt will do, before it is posted; the figures are a preview until the system confirms */}
        <aside className="record-rail">
          <div className="panel actions impact">
            <b>{tx('ผลต่อคงเหลือ (ประมาณการ)')}</b>
            {item ? (
              <>
                <dl className="data-grid">
                  <dt>{tx('คงเหลือตอนนี้')}</dt><dd>{item.onHand ?? '—'} {tx(item.drug.unit)}</dd>
                  <dt>{tx('หลังรับเข้า')}</dt><dd><b>{after} {tx(item.drug.unit)}</b>{item.isLow && after > item.drug.reorderThreshold && <> · <span className="chip ok">{tx('พ้นจุดสั่งเติม')}</span></>}</dd>
                  <dt>{tx('จุดสั่งเติม')}</dt><dd>{item.drug.reorderThreshold} {tx(item.drug.unit)}</dd>
                  <dt>{tx('lot ในคลัง')}</dt><dd>{item.lots.length}</dd>
                </dl>
                {item.controlled && <div className="notice warn">{tx('ยาควบคุม ({cls} ประเภท {cat}) — รับโดยเภสัชกร ลงบัญชียาควบคุม และนับหลังรับเข้า', { cls: tx(CONTROL_SYSTEM[item.drug.classSystem].short), cat: item.drug.category ?? '' })}</div>}
                {expiryNote && <div className={`notice ${expiryNote.cls}`}>{tx(expiryNote.text)}</div>}
              </>
            ) : (
              <p className="secondary">{tx('เลือกรายการยาเพื่อดูผลต่อคงเหลือ')}</p>
            )}
          </div>
          <div className="panel actions">
            <b>{tx('การตรวจสอบ')}</b>
            {problemList.length ? (
              <ul className="problems">{problemList.map(p => <li key={p}>{tx(p)}</li>)}</ul>
            ) : (
              <p className="secondary ok-text">{tx('ครบถ้วน — ตรวจทานกับของจริงแล้วกดบันทึก')}</p>
            )}
            <p className="secondary">{tx('ผู้รับ: {name} · บันทึกเป็นหลักฐานพร้อมเวลา', { name: store.userName })}</p>
          </div>
        </aside>
      </div>
    </bo-receipts>
  );
}
