/* The payment ledger: every payment and refund across the bills, to review what was collected (FIN-PAY-01) */
import { useState } from 'react';

import { baht } from '../../../clinic/data/rail';
import { cx } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { ledger, PAYMENT_METHODS, PAYMENT_STATUS } from '../../data/finance';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

export function PaymentsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const needle = q.trim().toLowerCase();
  const rows = ledger(store.clinic.data).filter(r => (!method || r.method === method)
    && (!status || (status === 'refund' ? r.kind === 'refund' : r.kind === 'payment' && r.status === status))
    && (!from || r.at >= from) && (!to || r.at.slice(0, 10) <= to)
    && (!needle || `${r.reference} ${r.invoice.no} ${r.invoice.ownerKey} ${r.invoice.pet} ${r.id}`.toLowerCase().includes(needle)));
  const payments = rows.filter(r => r.kind === 'payment' && r.status === 'completed');
  const refunds = rows.filter(r => r.kind === 'refund');
  const received = payments.reduce((s, r) => s + r.amount, 0);
  const refunded = -refunds.reduce((s, r) => s + r.amount, 0);

  return (
    <bo-payments className="page">
      <PageHead heading="รายการชำระเงิน" source="M11 · การรับชำระและการคืนเงินข้ามทุกใบแจ้งหนี้ · รับชำระทำที่ใบแจ้งหนี้" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(received)}</span><span className="kpi-label">{tx('รับชำระ · {n} รายการ', { n: payments.length })}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(refunded)}</span><span className="kpi-label">{tx('คืนเงิน · {n} รายการ', { n: refunds.length })}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(received - refunded)}</span><span className="kpi-label">{tx('สุทธิตามตัวกรอง')}</span></div>
      </div>

      <div className="panel">
        <div className="filter-bar">
          <input className="ui-input search" type="search" placeholder={tx('ค้นหาเลขอ้างอิง ใบแจ้งหนี้ หรือเจ้าของ')} aria-label={tx('ค้นหา')} value={q} onChange={event => setQ(event.target.value)} />
          <select className="ui-input" aria-label={tx('ช่องทาง')} value={method} onChange={event => setMethod(event.target.value)}>
            <option value="">{tx('ทุกช่องทาง')}</option>
            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{tx(m.label)}</option>)}
          </select>
          <select className="ui-input" aria-label={tx('สถานะ')} value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">{tx('ทุกสถานะ')}</option>
            <option value="completed">{tx('รับชำระแล้ว')}</option>
            <option value="reversed">{tx('กลับรายการแล้ว')}</option>
            <option value="refund">{tx('คืนเงิน')}</option>
          </select>
          <label className="date-field"><span className="visually-hidden">{tx('ตั้งแต่')}</span><input className="ui-input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
          <span className="secondary">–</span>
          <label className="date-field"><span className="visually-hidden">{tx('ถึง')}</span><input className="ui-input" type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
          <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
        </div>
        <div className="table-wrap">
          <table className="bo-table ledger">
            <thead>
              <tr>
                <th scope="col" className="w-at">{tx('เมื่อ')}</th>
                <th scope="col" className="w-ref">{tx('ใบแจ้งหนี้')}</th>
                <th scope="col">{tx('เจ้าของ / สัตว์')}</th>
                <th scope="col" className="w-kind">{tx('ช่องทาง')}</th>
                <th scope="col" className="w-ref">{tx('เลขอ้างอิง')}</th>
                <th scope="col" className="w-amount num">{tx('จำนวนเงิน')}</th>
                <th scope="col" className="w-status">{tx('สถานะ')}</th>
                <th scope="col" className="w-owner">{tx('โดย')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const ps = PAYMENT_STATUS[r.status === 'reversed' ? 'reversed' : 'completed'];
                return (
                  <tr key={r.id} tabIndex={0} onClick={() => backofficeActions.openInvoice(r.invoice)} onKeyDown={event => { if (event.key === 'Enter') { backofficeActions.openInvoice(r.invoice); } }}>
                    <td className="num">{r.at}</td>
                    <td><b>{r.invoice.no}</b><div className="secondary">{r.id}</div></td>
                    <td>{r.invoice.ownerKey}<div className="secondary">{r.invoice.pet}</div></td>
                    <td>{tx(r.method)}</td>
                    <td>{r.reference || '—'}</td>
                    <td className={cx('num', r.amount < 0 && 'text-danger')}>{r.amount < 0 ? `−${baht(-r.amount)}` : baht(r.amount)}</td>
                    <td>{r.kind === 'refund' ? <span className="chip quiet">{tx('คืนเงิน')}</span> : <span className={`chip ${ps.cls}`}>{tx(ps.label)}</span>}</td>
                    <td>{tx(r.by)}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr className="static"><td colSpan={8} className="empty">{tx('ไม่มีรายการที่ตรงกับตัวกรอง')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </bo-payments>
  );
}
