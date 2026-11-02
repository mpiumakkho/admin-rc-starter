/* Accounts receivable: the bills still owed, aged by their due date (FIN-AR-01) */
import { useState } from 'react';

import { baht } from '../../../clinic/data/rail';
import { cx } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { AGING, type AgingKey, INVOICE_STATUS, receivables, statusOf } from '../../data/finance';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const aging = (key: AgingKey) => AGING.find(b => b.key === key)!;

export function ReceivablesComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [bucket, setBucket] = useState<AgingKey | ''>('');
  const ar = receivables(store.clinic.data);
  const rows = ar.rows.filter(r => !bucket || r.bucket === bucket);

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-receivables className="page">
      <PageHead heading="ลูกหนี้คงค้าง" source="M11 · ใบแจ้งหนี้ที่ออกแล้วและยังชำระไม่ครบ · อายุหนี้นับจากวันครบกำหนดของแต่ละใบ" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(ar.total)}</span><span className="kpi-label">{tx('ค้างชำระทั้งหมด · {n} ใบ', { n: ar.rows.length })}</span></div>
        {ar.buckets.filter(b => b.count || b.key !== 'none').map(b => (
          <button key={b.key} type="button" className={cx('kpi', b.count > 0 && b.cls, bucket === b.key && 'active')} role="listitem" onClick={() => setBucket(bucket === b.key ? '' : b.key)}>
            <span className="kpi-value">{baht(b.amount)}</span><span className="kpi-label">{`${tx(b.label)} · ${b.count}`}</span>
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="filter-bar"><span className="secondary grow">{tx('{n} ใบ · เปิดใบแจ้งหนี้เพื่อติดตามหรือรับชำระ', { n: rows.length })}</span></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                <th scope="col">{tx('เจ้าของ / สัตว์')}</th>
                <th scope="col" className="w-due">{tx('ออกเมื่อ')}</th>
                <th scope="col" className="w-due">{tx('ครบกำหนด')}</th>
                <th scope="col" className="w-kind">{tx('อายุหนี้')}</th>
                <th scope="col" className="w-amount num">{tx('ยอดรวม')}</th>
                <th scope="col" className="w-amount num">{tx('ชำระแล้ว')}</th>
                <th scope="col" className="w-amount num">{tx('ยอดคงเหลือ')}</th>
              </tr>
            </thead>
            <tbody>
              {pager.rows.map(r => (
                <tr key={r.invoice.id} tabIndex={0} onClick={() => backofficeActions.openInvoice(r.invoice)} onKeyDown={event => { if (event.key === 'Enter') { backofficeActions.openInvoice(r.invoice); } }}>
                  <td><b>{r.invoice.no}</b><div className="secondary">{tx(INVOICE_STATUS[statusOf(r.invoice)].label)}</div></td>
                  <td>{r.invoice.ownerKey}<div className="secondary">{`${r.invoice.pet} · ${tx(r.invoice.title)}`}</div></td>
                  <td className="num">{r.invoice.issuedAt?.slice(0, 10) ?? r.invoice.date}</td>
                  <td className="num">{r.invoice.dueAt ?? '—'}</td>
                  <td><span className={`chip ${aging(r.bucket).cls}`}>{r.overdue ? tx('เกิน {n} วัน', { n: r.overdue }) : tx(aging(r.bucket).label)}</span></td>
                  <td className="num">{baht(r.invoice.total)}</td>
                  <td className="num">{baht(r.invoice.paid)}</td>
                  <td className="num text-danger">{baht(r.balance)}</td>
                </tr>
              ))}
              {!rows.length && <tr className="static"><td colSpan={8} className="empty">{tx('ไม่มีลูกหนี้คงค้าง')}</td></tr>}
            </tbody>
          </table>
        </div>
        <PagerFoot pager={pager} />
      </div>
    </bo-receivables>
  );
}
