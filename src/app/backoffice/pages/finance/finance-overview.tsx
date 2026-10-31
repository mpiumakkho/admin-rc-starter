/* The finance overview: the day's figures, each from its source page, and what does not add up (FIN-OVW-01) */
import { Link } from 'react-router';

import { TODAY } from '../../../clinic/data/model';
import { baht } from '../../../clinic/data/rail';
import { cx } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { financeOverview, receivables, reconcile } from '../../data/finance';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

export function FinanceOverviewComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const o = financeOverview(store.clinic.data, store.data);
  /* The day's variances, and the bills past their due date */
  const day = reconcile(store.clinic.data, store.data, TODAY);
  const overdue = receivables(store.clinic.data).rows.filter(r => (r.overdue ?? 0) > 0).map(r => ({
    kind: 'ลูกหนี้เกินกำหนด', reference: r.invoice.no, invoice: r.invoice, difference: r.balance as number | string, reason: `เกินกำหนด ${r.overdue} วัน`, owner: 'การเงิน', link: `/backoffice/finance/invoices/${r.invoice.id}` as string | undefined,
  }));
  const rows = [...day.variances, ...overdue];

  return (
    <bo-finance-overview className="page">
      <PageHead heading="ภาพรวมการเงิน" source="รวมจาก M11 ตามสิทธิ์ · ทุกตัวเลขมีที่มาและเปิดไปหน้าต้นทางได้ · ไม่แก้ไขที่หน้านี้" freshness="ตัดยอด ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <Link className="kpi" role="listitem" to="/backoffice/finance/receivables">
          <span className="kpi-value">{baht(o.outstanding.amount)}</span>
          <span className="kpi-label">{tx('ยอดค้างชำระ · {n} ใบ · เกินกำหนด {m}', { n: o.outstanding.count, m: o.outstanding.overdue })}</span>
        </Link>
        <Link className="kpi" role="listitem" to="/backoffice/finance/payments">
          <span className="kpi-value">{baht(o.collected.amount)}</span>
          <span className="kpi-label">{tx('รับชำระวันนี้ · {n} รายการ', { n: o.collected.count })}</span>
        </Link>
        <Link className="kpi" role="listitem" to="/backoffice/finance/adjustments">
          <span className="kpi-value">{baht(o.refunded.amount)}</span>
          <span className="kpi-label">{tx('คืนเงินวันนี้ · {n} รายการ', { n: o.refunded.count })}</span>
        </Link>
        <Link className={cx('kpi', o.pendingRefunds > 0 && 'warn')} role="listitem" to="/backoffice/home/approvals">
          <span className="kpi-value">{o.pendingRefunds}</span>
          <span className="kpi-label">{tx('คืนเงินรออนุมัติ')}</span>
        </Link>
        <Link className={cx('kpi', o.exports.failed > 0 && 'danger')} role="listitem" to="/backoffice/finance/exports">
          <span className="kpi-value">{`${o.exports.delivered}/${o.exports.total}`}</span>
          <span className="kpi-label">{tx('ส่งบัญชีแล้ว · ไม่สำเร็จ {n}', { n: o.exports.failed })}</span>
        </Link>
        <Link className="kpi" role="listitem" to="/backoffice/finance/invoices?status=draft">
          <span className="kpi-value">{o.drafts}</span>
          <span className="kpi-label">{tx('ฉบับร่างค้าง')}</span>
        </Link>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('ข้อยกเว้นของวันนี้')}</b><span className="secondary grow">{tx('{n} รายการ · เปิดรายการต้นทางเพื่อแก้ไข', { n: rows.length })}</span></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th scope="col" className="w-kind">{tx('ประเภท')}</th>
                <th scope="col" className="w-ref">{tx('อ้างอิง')}</th>
                <th scope="col">{tx('รายละเอียด')}</th>
                <th scope="col" className="w-amount num">{tx('จำนวนเงิน')}</th>
                <th scope="col" className="w-owner">{tx('ผู้รับผิดชอบ')}</th>
                <th scope="col" className="w-status"><span className="visually-hidden">{tx('การทำงาน')}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(v => (
                <tr key={v.reference + v.kind} className="static">
                  <td>{tx(v.kind)}</td>
                  <td><b>{v.reference}</b>{v.invoice && <div className="secondary">{`${v.invoice.ownerKey} · ${v.invoice.pet}`}</div>}</td>
                  <td>{tx(v.reason)}</td>
                  <td className="num">{typeof v.difference === 'number' ? baht(v.difference) : v.difference}</td>
                  <td>{tx(v.owner)}</td>
                  <td className="row-actions">{v.link && <Link className="link" to={v.link}>{tx('เปิด')}</Link>}</td>
                </tr>
              ))}
              {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx('วันนี้ไม่มีข้อยกเว้นทางการเงิน')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </bo-finance-overview>
  );
}
