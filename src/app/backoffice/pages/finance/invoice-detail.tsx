/* One invoice: its lines, what it comes to, its payments and refunds, and what may be done with it in its state (FIN-BILL-02) */
import { Link, useParams } from 'react-router';

import { lucideArrowLeft, lucidePrinter } from '../../../icons';
import { baht } from '../../../clinic/data/rail';
import type { Invoice } from '../../../clinic/data/types';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { DISCOUNT_STATUS, DOC_TYPE, EXPORT_STATUS, exportsOf, INVOICE_STATUS, linesOf, lineTotal, PAYMENT_STATUS, REFUND_STATUS, refundable, statusOf, summaryOf } from '../../data/finance';
import { useBoI18n } from '../../i18n/bo-i18n';

export function InvoiceDetailComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const { id } = useParams();
  const i = store.clinic.data.invoices.find(x => x.id === id) ?? null;
  if (!i) {
    return (
      <bo-invoice-detail className="page">
        <div className="panel"><p className="empty">{tx('ไม่พบใบแจ้งหนี้')} · <Link className="link" to="/backoffice/finance/invoices">{tx('กลับไปรายการ')}</Link></p></div>
      </bo-invoice-detail>
    );
  }
  const st = statusOf(i);
  const sum = summaryOf(i);
  const lines = linesOf(i);
  const exports = exportsOf(store.data, i.id);
  const activity = store.data.activity.filter(e => e.module === 'M11' && [e.target, e.ref].some(x => x === i.no || x === i.id || (!!i.no && x.includes(i.no))));
  const refundsOf = (inv: Invoice, paymentIndex: number) => (inv.refunds ?? []).filter(r => r.paymentIndex === paymentIndex);
  const unlinked = (i.refunds ?? []).filter(r => r.paymentIndex < 0);
  const a = backofficeActions;

  const actions = st === 'draft' ? (
    <>
      <UiButton size="sm" type="button" onClick={() => a.issueInvoice(i)}>{tx('ออกใบแจ้งหนี้')}</UiButton>
      <UiButton variant="secondary" size="sm" type="button" onClick={() => a.requestDiscount(i)}>{tx('ส่วนลด')}</UiButton>
      <UiButton variant="danger" size="sm" type="button" onClick={() => a.cancelInvoice(i)}>{tx('ยกเลิกฉบับร่าง')}</UiButton>
    </>
  ) : st === 'issued' ? (
    <>
      <UiButton size="sm" type="button" onClick={() => a.collect(i)}>{tx('รับชำระ')}</UiButton>
      <UiButton variant="secondary" size="sm" type="button" onClick={() => a.requestDiscount(i)}>{tx('ส่วนลด')}</UiButton>
      <UiButton variant="danger" size="sm" type="button" onClick={() => a.cancelInvoice(i)}>{tx('ยกเลิกใบแจ้งหนี้')}</UiButton>
    </>
  ) : st === 'partial' ? (
    <>
      <UiButton size="sm" type="button" onClick={() => a.collect(i)}>{tx('รับชำระส่วนที่เหลือ')}</UiButton>
      <UiButton variant="secondary" size="sm" type="button" onClick={() => a.requestDiscount(i)}>{tx('ส่วนลด')}</UiButton>
      <UiButton variant="secondary" size="sm" type="button" onClick={() => a.requestRefund(i)}>{tx('คืนเงิน')}</UiButton>
      <UiButton variant="secondary" size="sm" type="button" onClick={() => a.printReceipt(i)}>{tx('พิมพ์ใบเสร็จ')}</UiButton>
    </>
  ) : st === 'paid' ? (
    <>
      <UiButton variant="secondary" size="sm" type="button" onClick={() => a.printReceipt(i)}>{tx('พิมพ์ใบเสร็จ')}</UiButton>
      <UiButton variant="secondary" size="sm" type="button" onClick={() => a.requestRefund(i)}>{tx('คืนเงิน')}</UiButton>
    </>
  ) : (
    <p className="secondary">{tx('อ่านและพิมพ์ได้เท่านั้น · ค่าใช้จ่ายใหม่ต้องออกใบแจ้งหนี้ใหม่')}</p>
  );

  return (
    <bo-invoice-detail className="page">
      <div className="page-head">
        <div className="title-block">
          <Link className="link back" to="/backoffice/finance/invoices"><NgIcon svg={lucideArrowLeft} aria-hidden="true" />{tx('ใบแจ้งหนี้')}</Link>
          <h1>{i.no || `${tx('ฉบับร่าง')} ${i.id}`} <span className={`chip ${INVOICE_STATUS[st].cls}`}>{tx(INVOICE_STATUS[st].label)}</span></h1>
          <div className="subtitle">
            <span>{`${i.ownerKey} · ${i.pet} · ${tx(i.title)}`}</span>
            {i.encounter && <span>{`${tx('Visit')} ${i.encounter}`}</span>}
            <span>{`${tx('สร้าง')} ${i.date}`}</span>
            {i.issuedAt && <span>{`${tx('ออก')} ${i.issuedAt}`}</span>}
            {i.dueAt && <span>{`${tx('ครบกำหนด')} ${i.dueAt}`}</span>}
            {i.cancelledAt && <span className="text-danger">{`${tx('ยกเลิกแล้ว')} ${i.cancelledAt} · ${tx(i.cancelReason ?? '')}`}</span>}
          </div>
        </div>
        <div className="page-actions">
          {st !== 'draft' && <UiButton variant="secondary" size="sm" type="button" onClick={() => a.printInvoice(i)}><NgIcon svg={lucidePrinter} aria-hidden="true" />{tx('พิมพ์ใบแจ้งหนี้')}</UiButton>}
        </div>
      </div>

      <div className="record">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar"><b>{tx('รายการ')}</b><span className="secondary grow">{tx('{n} รายการ · ราคาและยอดรวมมาจากบันทึก ไม่คำนวณใหม่ในหน้านี้', { n: lines.length })}</span></div>
            <div className="table-wrap">
              <table className="bo-table lines">
                <thead>
                  <tr>
                    <th scope="col" className="w-kind">{tx('ต้นทาง')}</th>
                    <th scope="col">{tx('รายการ')}</th>
                    <th scope="col" className="w-amount num">{tx('จำนวน')}</th>
                    <th scope="col" className="w-amount num">{tx('ราคาต่อหน่วย')}</th>
                    <th scope="col" className="w-amount num">{tx('ส่วนลด')}</th>
                    <th scope="col" className="w-amount num">{tx('ภาษี')}</th>
                    <th scope="col" className="w-amount num">{tx('รวม')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, index) => (
                    <tr key={index} className="static">
                      <td className="muted">{l.source}</td>
                      <td>{tx(l.name)}</td>
                      <td className="num">{l.qty}</td>
                      <td className="num">{baht(l.unitPrice)}</td>
                      <td className="num">{l.discount ? baht(l.discount) : '—'}</td>
                      <td className="num">{l.taxRate ? `${l.taxRate}%` : '—'}</td>
                      <td className="num">{baht(lineTotal(l))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Every payment, and the refunds against it */}
          <div className="panel">
            <div className="filter-bar"><b>{tx('การรับชำระและคืนเงิน')}</b><span className="secondary grow">{tx('คืนเงินผูกกับการชำระแต่ละครั้ง ไม่ใช่ใบแจ้งหนี้ทั้งใบ')}</span></div>
            <div className="table-wrap">
              <table className="bo-table ledger">
                <thead>
                  <tr>
                    <th scope="col" className="w-at">{tx('เมื่อ')}</th>
                    <th scope="col" className="w-kind">{tx('ช่องทาง')}</th>
                    <th scope="col">{tx('เลขอ้างอิง / เหตุผล')}</th>
                    <th scope="col" className="w-amount num">{tx('จำนวนเงิน')}</th>
                    <th scope="col" className="w-status">{tx('สถานะ')}</th>
                    <th scope="col" className="w-owner">{tx('โดย')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(i.payments ?? []).map((p, index) => {
                    const ps = PAYMENT_STATUS[p[5] ?? 'completed'];
                    const left = refundable(i, index);
                    return [
                      <tr key={`p${index}`} className="static">
                        <td className="num">{p[0]}</td>
                        <td>{tx(p[2])}</td>
                        <td>{p[4] || '—'}{left < p[1] && <div className="secondary">{`${tx('คืนได้อีก')} ${baht(left)}`}</div>}</td>
                        <td className="num">{baht(p[1])}</td>
                        <td><span className={`chip ${ps.cls}`}>{tx(ps.label)}</span></td>
                        <td>{tx(p[3])}</td>
                      </tr>,
                      ...refundsOf(i, index).map(r => (
                        <tr key={r.id} className="static nested">
                          <td className="num">{r.decidedAt ?? r.at}</td>
                          <td className="muted">{`${tx('คืนเงิน')} · ${r.id}`}</td>
                          <td>{tx(r.reason)}{r.approvalId && <div className="secondary"><Link className="link" to="/backoffice/home/approvals">{`${tx('ผ่านการอนุมัติ')} ${r.approvalId}`}</Link></div>}</td>
                          <td className="num text-danger">{`−${baht(r.amount)}`}</td>
                          <td><span className={`chip ${REFUND_STATUS[r.status].cls}`}>{tx(REFUND_STATUS[r.status].label)}</span></td>
                          <td>{tx(r.decidedBy ?? r.by)}</td>
                        </tr>
                      )),
                    ];
                  })}
                  {!(i.payments ?? []).length && <tr className="static"><td colSpan={6} className="empty">{tx('ยังไม่มีการรับชำระ')}</td></tr>}
                  {unlinked.map(r => (
                    <tr key={r.id} className="static">
                      <td className="num">{r.at}</td>
                      <td className="muted">{`${tx('คืนเงิน')} · ${r.id}`}</td>
                      <td>{tx(r.reason)}</td>
                      <td className="num">{baht(r.amount)}</td>
                      <td><span className={`chip ${REFUND_STATUS[r.status].cls}`}>{tx(REFUND_STATUS[r.status].label)}</span></td>
                      <td>{tx(r.by)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* What went to the accounting system, and what the back office did */}
          <div className="panel">
            <div className="filter-bar"><b>{tx('บัญชีและบันทึกตรวจสอบ')}</b><span className="secondary grow">{tx('"ส่งแล้ว" หมายถึงระบบบัญชีรับข้อมูล ไม่ใช่ GL หรือ e-Tax')}</span></div>
            <div className="timeline">
              {exports.map(x => (
                <div key={x.id} className="tl">
                  <span className={`chip ${EXPORT_STATUS[x.status].cls}`}>{tx(EXPORT_STATUS[x.status].label)}</span>
                  <b>{`${tx(DOC_TYPE[x.docType])} · ${baht(x.amount)} → ${x.adapter}`}</b>
                  <div className="secondary">{`${x.lastAt} · ${tx('ครั้งที่')} ${x.attempts}`}{x.externalRef && ` · ${x.externalRef}`}{x.errorText && ` · ${tx(x.errorText)}`}</div>
                </div>
              ))}
              {activity.map(e => (
                <div key={e.id} className="tl"><b>{tx(e.action)}</b><div className="secondary">{`${e.at} · ${tx(e.by)}`}{e.detail && ` · ${tx(e.detail)}`}</div></div>
              ))}
              {!exports.length && !activity.length && <p className="muted">{tx('ยังไม่มีเหตุการณ์')}</p>}
            </div>
          </div>
        </div>

        {/* The summary, and what the state allows */}
        <aside className="record-rail">
          <div className="panel summary">
            <div className="sum-row"><span>{tx('ยอดก่อนส่วนลด')}</span><span className="num">{baht(sum.subtotal)}</span></div>
            <div className="sum-row"><span>{tx('ส่วนลด')}</span><span className="num">{sum.discounts ? `−${baht(sum.discounts)}` : '—'}</span></div>
            <div className="sum-row"><span>{tx('ภาษี')}</span><span className="num">{sum.tax ? baht(sum.tax) : '—'}</span></div>
            <div className="sum-row total"><span>{tx('ยอดรวม')}</span><span className="num">{baht(sum.total)}</span></div>
            <div className="sum-row"><span>{tx('ชำระแล้ว')}</span><span className="num">{baht(sum.paid)}</span></div>
            {sum.refunded > 0 && <div className="sum-row"><span>{tx('คืนเงินแล้ว')}</span><span className="num">{`−${baht(sum.refunded)}`}</span></div>}
            <div className={cx('sum-row total', sum.balance > 0 && (st === 'issued' || st === 'partial') && 'text-danger')}><span>{tx('ยอดคงเหลือ')}</span><span className="num">{st === 'cancelled' || st === 'draft' ? '—' : baht(sum.balance)}</span></div>
            {(i.discounts ?? []).map(d => (
              <div key={d.id} className="secondary">{`${tx('ส่วนลด')} ${d.id} · ${baht(d.amount)} · ${tx(DISCOUNT_STATUS[d.status].label)} · ${tx(d.reason)}`}</div>
            ))}
          </div>
          <div className="panel actions">{actions}</div>
        </aside>
      </div>
    </bo-invoice-detail>
  );
}
