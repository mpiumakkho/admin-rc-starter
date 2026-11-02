/* Discounts and refunds: every adjustment with its reason, who made it and the approval it rested on (FIN-BILL-04) */
import { useState } from 'react';
import { Link } from 'react-router';

import { baht } from '../../../clinic/data/rail';
import { cx } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { adjustments, REFUND_STATUS } from '../../data/finance';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const statusCls = (status: string) => (status === 'requested' ? 'warn' : status === 'rejected' ? 'danger' : 'ok');
const statusLabel = (status: string, kind: 'refund' | 'discount') =>
  kind === 'refund' ? REFUND_STATUS[status as keyof typeof REFUND_STATUS].label : status === 'applied' ? 'ใช้แล้ว' : REFUND_STATUS[status as 'requested' | 'rejected'].label;

export function AdjustmentsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [kind, setKind] = useState<'' | 'refund' | 'discount'>('');
  const all = adjustments(store.clinic.data);
  const rows = all.filter(r => !kind || r.kind === kind);
  const counts = {
    requested: all.filter(r => r.status === 'requested').length,
    rejected: all.filter(r => r.status === 'rejected').length,
    refunded: all.filter(r => r.kind === 'refund' && r.status === 'done').reduce((s, r) => s + r.amount, 0),
    discounted: all.filter(r => r.kind === 'discount' && r.status === 'applied').reduce((s, r) => s + r.amount, 0),
  };

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-adjustments className="page">
      <PageHead heading="ส่วนลดและคืนเงิน" source="M11 · ขอได้จากใบแจ้งหนี้ · คืนเงินเกิน ฿500 และส่วนลดเกิน 10% ต้องให้ผู้จัดการการเงินอนุมัติ" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <div className={cx('kpi', counts.requested > 0 && 'warn')} role="listitem"><span className="kpi-value">{counts.requested}</span><span className="kpi-label">{tx('รออนุมัติ')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(counts.refunded)}</span><span className="kpi-label">{tx('คืนเงินแล้ว')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(counts.discounted)}</span><span className="kpi-label">{tx('ส่วนลดที่ใช้แล้ว')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{counts.rejected}</span><span className="kpi-label">{tx('ปฏิเสธ')}</span></div>
      </div>

      <div className="panel">
        <div className="filter-bar">
          <div className="segmented" role="group" aria-label={tx('ประเภท')}>
            <button type="button" className={cx(kind === '' && 'active')} aria-pressed={kind === ''} onClick={() => setKind('')}>{tx('ทั้งหมด')}</button>
            <button type="button" className={cx(kind === 'refund' && 'active')} aria-pressed={kind === 'refund'} onClick={() => setKind('refund')}>{tx('คืนเงิน')}</button>
            <button type="button" className={cx(kind === 'discount' && 'active')} aria-pressed={kind === 'discount'} onClick={() => setKind('discount')}>{tx('ส่วนลด')}</button>
          </div>
          <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
        </div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th scope="col" className="w-at">{tx('เมื่อ')}</th>
                <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                <th scope="col" className="w-ref">{tx('ใบแจ้งหนี้')}</th>
                <th scope="col">{tx('เหตุผล')}</th>
                <th scope="col" className="w-amount num">{tx('จำนวนเงิน')}</th>
                <th scope="col" className="w-owner">{tx('ขอโดย')}</th>
                <th scope="col" className="w-status">{tx('สถานะ')}</th>
              </tr>
            </thead>
            <tbody>
              {pager.rows.map(r => (
                <tr key={r.id} tabIndex={0} onClick={() => backofficeActions.openInvoice(r.invoice)} onKeyDown={event => { if (event.key === 'Enter') { backofficeActions.openInvoice(r.invoice); } }}>
                  <td className="num">{r.at}</td>
                  <td><b>{r.id}</b><div className="secondary">{tx(r.kind === 'refund' ? 'คืนเงิน' : 'ส่วนลด')}</div></td>
                  <td>{r.invoice.no || r.invoice.id}<div className="secondary">{`${r.invoice.ownerKey} · ${r.invoice.pet}`}</div></td>
                  <td>{tx(r.reason)}{r.approvalId && <div className="secondary"><Link className="link" to="/backoffice/home/approvals" onClick={event => event.stopPropagation()}>{`${tx('รายการอนุมัติ')} ${r.approvalId}`}</Link></div>}</td>
                  <td className="num">{baht(r.amount)}</td>
                  <td>{tx(r.by)}</td>
                  <td><span className={`chip ${statusCls(r.status)}`}>{tx(statusLabel(r.status, r.kind))}</span></td>
                </tr>
              ))}
              {!rows.length && <tr className="static"><td colSpan={7} className="empty">{tx('ยังไม่มีรายการ')}</td></tr>}
            </tbody>
          </table>
        </div>
        <PagerFoot pager={pager} />
      </div>
    </bo-adjustments>
  );
}
