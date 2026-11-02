/* Invoices: the queue to collect and the history to search, and a new bill written from the charge items (FIN-BILL-01) */
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { lucidePlus, lucideTrash2 } from '../../../icons';
import { baht } from '../../../clinic/data/rail';
import type { Invoice, InvoiceLine, InvoiceStatus } from '../../../clinic/data/types';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { CHARGE_ITEMS, EXPORT_STATUS, exportsOf, INVOICE_STATUS, invoiceList, lineTotal, statusOf } from '../../data/finance';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const STATUS_KEYS = Object.keys(INVOICE_STATUS) as InvoiceStatus[];

export function InvoicesComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | ''>((params.get('status') as InvoiceStatus | null) ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  /* The new bill */
  const owners = Object.values(store.clinic.data.owners);
  const [creating, setCreating] = useState(false);
  const [ownerKey, setOwnerKey] = useState(owners[0]?.name ?? '');
  const petsOf = (key: string) => (store.clinic.data.owners[key]?.pets ?? []).map(p => p.split(' · ')[0]);
  const [pet, setPet] = useState(petsOf(owners[0]?.name ?? '')[0] ?? '');
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([]);

  const filtered = !!(q || status || from || to || outstandingOnly);
  const rows = invoiceList(store.clinic.data, { q, status, from, to, outstandingOnly });
  const live = rows.filter(i => !['draft', 'cancelled'].includes(statusOf(i)));
  const sum = { total: live.reduce((s, i) => s + i.total, 0), paid: live.reduce((s, i) => s + i.paid, 0), balance: live.filter(i => ['issued', 'partial'].includes(statusOf(i))).reduce((s, i) => s + i.total - i.paid, 0) };
  const draftTotal = Math.round(lines.reduce((s, l) => s + lineTotal(l), 0) * 100) / 100;
  const delivery = (i: Invoice) => exportsOf(store.data, i.id)[0];

  const clear = () => { setQ(''); setStatus(''); setFrom(''); setTo(''); setOutstandingOnly(false); };
  const pickOwner = (name: string) => { setOwnerKey(name); setPet(petsOf(name)[0] ?? ''); };
  const addLine = (key: string) => {
    const [source, name] = key.split('|');
    const item = CHARGE_ITEMS.find(c => c.source === source && c.name === name);
    if (item) {
      setLines(current => [...current, { source: item.source, name: item.name, qty: 1, unitPrice: item.unitPrice, discount: 0, taxRate: item.taxRate }]);
    }
  };
  const setQty = (index: number, value: string) => {
    const qty = Math.max(1, Math.floor(Number(value) || 1));
    setLines(current => current.map((l, i) => (i === index ? { ...l, qty } : l)));
  };
  const create = () => {
    const invoice = store.createInvoice(ownerKey, pet, title.trim(), lines);
    setCreating(false);
    setLines([]);
    setTitle('');
    backofficeActions.openInvoice(invoice);
  };
  const open = (i: Invoice) => backofficeActions.openInvoice(i);

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-invoices className="page">
      <PageHead heading="ใบแจ้งหนี้" source="M11 · คิวรอเก็บเงินและประวัติใบแจ้งหนี้ของเจ้าของ สัตว์ และ visit" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={() => setCreating(!creating)}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('สร้างใบแจ้งหนี้')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{rows.length}</span><span className="kpi-label">{tx('ใบแจ้งหนี้ตามตัวกรอง')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(sum.total)}</span><span className="kpi-label">{tx('ยอดรวม')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(sum.paid)}</span><span className="kpi-label">{tx('ชำระแล้ว')}</span></div>
        <div className={cx('kpi', sum.balance > 0 && 'warn')} role="listitem"><span className="kpi-value">{baht(sum.balance)}</span><span className="kpi-label">{tx('ยอดคงเหลือ')}</span></div>
      </div>

      <div className={cx('split', creating && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <input className="ui-input search" type="search" placeholder={tx('ค้นหาใบแจ้งหนี้ เจ้าของ สัตว์ หรือ visit')} aria-label={tx('ค้นหาใบแจ้งหนี้')} value={q} onChange={event => setQ(event.target.value)} />
            <select className="ui-input" aria-label={tx('สถานะ')} value={status} onChange={event => setStatus(event.target.value as InvoiceStatus | '')}>
              <option value="">{tx('ทุกสถานะ')}</option>
              {STATUS_KEYS.map(s => <option key={s} value={s}>{tx(INVOICE_STATUS[s].label)}</option>)}
            </select>
            <label className="date-field"><span className="visually-hidden">{tx('ตั้งแต่')}</span><input className="ui-input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
            <span className="secondary">–</span>
            <label className="date-field"><span className="visually-hidden">{tx('ถึง')}</span><input className="ui-input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={outstandingOnly} onChange={event => setOutstandingOnly(event.target.checked)} />{tx('เฉพาะยอดค้าง')}</label>
            <button type="button" className="link" onClick={clear}>{tx('ล้างตัวกรอง')}</button>
          </div>
          <div className="table-wrap">
            <table className="bo-table invoices">
              <thead>
                <tr>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col">{tx('เจ้าของ / สัตว์')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  <th scope="col" className="w-amount num">{tx('ยอดรวม')}</th>
                  <th scope="col" className="w-amount num">{tx('ชำระแล้ว')}</th>
                  <th scope="col" className="w-amount num">{tx('ยอดคงเหลือ')}</th>
                  <th scope="col" className="w-due">{tx('ออกเมื่อ')}</th>
                  <th scope="col" className="w-kind">{tx('ส่งบัญชี')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(i => {
                  const st = statusOf(i);
                  const x = delivery(i);
                  const owed = st !== 'draft' && st !== 'cancelled' && st !== 'refunded' && i.total - i.paid > 0;
                  return (
                    <tr key={i.id} tabIndex={0} onClick={() => open(i)} onKeyDown={event => { if (event.key === 'Enter') { open(i); } }}>
                      <td><b>{i.no || `${tx('ฉบับร่าง')} ${i.id}`}</b>{i.encounter && <div className="secondary">{i.encounter}</div>}</td>
                      <td>{i.ownerKey}<div className="secondary">{`${i.pet} · ${tx(i.title)}`}</div></td>
                      <td><span className={`chip ${INVOICE_STATUS[st].cls}`}>{tx(INVOICE_STATUS[st].label)}</span></td>
                      <td className="num">{baht(i.total)}</td>
                      <td className="num">{baht(i.paid)}</td>
                      <td className={cx('num', owed && 'text-danger')}>{st === 'draft' || st === 'cancelled' ? '—' : baht(i.total - i.paid)}</td>
                      <td className="num">{i.issuedAt ?? '—'}</td>
                      <td>{x ? <span className={`chip ${EXPORT_STATUS[x.status].cls}`}>{tx(EXPORT_STATUS[x.status].label)}</span> : <span className="muted">—</span>}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr className="static"><td colSpan={8} className="empty">{tx(filtered ? 'ไม่มีใบแจ้งหนี้ที่ตรงกับตัวกรอง' : 'ยังไม่มีใบแจ้งหนี้')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {/* A new bill: for whom, for what, from the charge items; a draft until it is issued */}
        {creating && (
          <Drawer heading="สร้างใบแจ้งหนี้" sub="ฉบับร่าง · ออกเมื่อรายการครบ" onClosed={() => setCreating(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setCreating(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={!lines.length || !title.trim() || !pet} onClick={create}>{tx('สร้างฉบับร่าง')}</UiButton>
          </>}>
            <div className="form-grid">
              <label>{tx('เจ้าของ')}
                <select className="ui-input" value={ownerKey} onChange={event => pickOwner(event.target.value)}>
                  {owners.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                </select>
              </label>
              <label>{tx('สัตว์')}
                <select className="ui-input" value={pet} onChange={event => setPet(event.target.value)}>
                  {petsOf(ownerKey).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="full">{tx('รายการ')}<input className="ui-input" value={title} onChange={event => setTitle(event.target.value)} placeholder={tx('เช่น Retail · อาหารและของใช้')} /></label>
              <label className="full">{tx('เพิ่มรายการ')}
                <select className="ui-input" value="" onChange={event => addLine(event.target.value)}>
                  <option value="">{tx('— เลือกจากรายการค่าบริการ —')}</option>
                  {CHARGE_ITEMS.map(c => <option key={c.source + c.name} value={`${c.source}|${c.name}`}>{`${c.source} · ${tx(c.name)} · ${baht(c.unitPrice)}`}</option>)}
                </select>
              </label>
            </div>
            <table className="mini-lines">
              <thead><tr><th>{tx('รายการ')}</th><th className="num">{tx('จำนวน')}</th><th className="num">{tx('รวม')}</th><th></th></tr></thead>
              <tbody>
                {lines.map((l, index) => (
                  <tr key={index}>
                    <td>{tx(l.name)}<div className="secondary">{`${l.source} · ${baht(l.unitPrice)}`}{l.taxRate > 0 && ` · VAT ${l.taxRate}%`}</div></td>
                    <td className="num"><input className="ui-input qty" type="number" min={1} defaultValue={l.qty} onChange={event => setQty(index, event.target.value)} aria-label={tx('จำนวน')} /></td>
                    <td className="num">{baht(lineTotal(l))}</td>
                    <td><button type="button" className="link" aria-label={tx('ลบรายการ')} onClick={() => setLines(current => current.filter((_, i) => i !== index))}><NgIcon svg={lucideTrash2} aria-hidden="true" /></button></td>
                  </tr>
                ))}
                {!lines.length && <tr><td colSpan={4} className="muted">{tx('ยังไม่มีรายการ')}</td></tr>}
              </tbody>
              <tfoot><tr><th colSpan={2}>{tx('ยอดรวม')}</th><th className="num">{baht(draftTotal)}</th><th></th></tr></tfoot>
            </table>
          </Drawer>
        )}
      </div>
    </bo-invoices>
  );
}
