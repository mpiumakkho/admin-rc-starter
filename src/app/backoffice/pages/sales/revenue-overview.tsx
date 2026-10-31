/* Customer revenue overview: M11's money by source, M16's claims and M15's messages side by side, each from its owner, and what needs attention (sales.overview, COMPOSED) */
import { Link } from 'react-router';

import { baht } from '../../../clinic/data/rail';
import { cx } from '../../../user-management/ui';
import { backofficeNavigate } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { revenueOverview } from '../../data/sales';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const money = (n: number) => (n === 0 ? '—' : n < 0 ? `−${baht(-n)}` : baht(n));

export function RevenueOverviewComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const o = revenueOverview(store.clinic.data, store.data);
  const go = (link: string) => void backofficeNavigate(link);

  return (
    <bo-revenue-overview className="page">
      <PageHead heading="ภาพรวมรายได้จากลูกค้า" source="รวมจาก M11 M15 M16 ตามสิทธิ์ · ไม่ใช่การรับรู้รายได้ทางบัญชี · Retail (M18) และ Wellness (M32) เป็น P4 ยังไม่มีข้อมูล" freshness="ตัดยอด ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <Link className="kpi" role="listitem" to="/backoffice/finance/payments">
          <span className="kpi-value">{baht(o.collectedToday)}</span><span className="kpi-label">{tx('รับชำระวันนี้ · 30 วันสุทธิ {amount}', { amount: baht(o.collectedMonth) })}</span>
        </Link>
        <Link className={cx('kpi', o.outstanding.count > 0 && 'warn')} role="listitem" to="/backoffice/finance/receivables">
          <span className="kpi-value">{baht(o.outstanding.amount)}</span><span className="kpi-label">{tx('ยอดค้างชำระ · {n} ใบ', { n: o.outstanding.count })}</span>
        </Link>
        <Link className={cx('kpi', o.claims.waiting.count > 0 && 'warn')} role="listitem" to="/backoffice/sales/claims?status=submitted">
          <span className="kpi-value">{baht(o.claims.waiting.amount)}</span><span className="kpi-label">{tx('เคลมรอผล · {n} รายการ', { n: o.claims.waiting.count })}</span>
        </Link>
        <Link className="kpi" role="listitem" to="/backoffice/sales/claims?status=approved">
          <span className="kpi-value">{baht(o.claims.approved.amount)}</span><span className="kpi-label">{tx('อนุมัติแล้ว รอรับเงิน · {n}', { n: o.claims.approved.count })}</span>
        </Link>
        <Link className={cx('kpi', o.outbox.ready > 0 && 'info')} role="listitem" to="/backoffice/sales/line">
          <span className="kpi-value">{o.outbox.ready}</span><span className="kpi-label">{tx('ข้อความ LINE รอส่ง · ติดความยินยอม {n}', { n: o.outbox.blocked })}</span>
        </Link>
        <Link className="kpi" role="listitem" to="/backoffice/sales/line">
          <span className="kpi-value">{`${o.line.linked}/${o.line.owners}`}</span><span className="kpi-label">{tx('เจ้าของที่เชื่อม LINE · อ่านแล้ว {n}%', { n: o.line.readRate })}</span>
        </Link>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('รายได้ตามที่มา')}</b><span className="secondary grow">{tx('รับชำระตามช่องทางจาก M11 · วันนี้ / 7 วัน / 30 วันถึงวันนี้ · คืนเงินหักแล้ว')}</span></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th scope="col">{tx('ที่มา')}</th>
                <th scope="col" className="w-kind">{tx('โมดูล')}</th>
                <th scope="col" className="w-amount num">{tx('วันนี้')}</th>
                <th scope="col" className="w-amount num">{tx('7 วัน')}</th>
                <th scope="col" className="w-amount num">{tx('30 วัน')}</th>
              </tr>
            </thead>
            <tbody>
              {o.sources.map(s => (
                <tr key={s.source} className="static">
                  <td>{tx(s.source)}{s.note && <div className="secondary">{tx(s.note)}</div>}</td>
                  <td><span className="module-tag"><b>{s.module}</b></span></td>
                  <td className={cx('num', s.today < 0 && 'text-danger')}>{money(s.today)}</td>
                  <td className={cx('num', s.week < 0 && 'text-danger')}>{money(s.week)}</td>
                  <td className={cx('num', s.month < 0 && 'text-danger')}>{money(s.month)}</td>
                </tr>
              ))}
              <tr className="static">
                <td>{tx('Retail POS · Wellness plans')}<div className="secondary">{tx('M18 / M32 เป็น P4 — ยังไม่มีข้อมูล')}</div></td>
                <td><span className="module-tag"><b>M18/M32</b></span></td>
                <td className="num muted">—</td><td className="num muted">—</td><td className="num muted">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('ต้องติดตาม')}</b><span className="secondary grow">{tx('{n} รายการ · แก้ที่โมดูลเจ้าของ', { n: o.exceptions.length })}</span></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th scope="col" className="w-kind">{tx('ประเภท')}</th>
                <th scope="col" className="w-kind">{tx('โมดูล')}</th>
                <th scope="col" className="w-ref">{tx('อ้างอิง')}</th>
                <th scope="col">{tx('รายละเอียด')}</th>
                <th scope="col" className="w-amount num">{tx('จำนวนเงิน')}</th>
              </tr>
            </thead>
            <tbody>
              {o.exceptions.map(x => (
                <tr key={x.ref} tabIndex={0} onClick={() => go(x.link)} onKeyDown={event => { if (event.key === 'Enter') { go(x.link); } }}>
                  <td>{tx(x.kind)}</td>
                  <td><span className="module-tag"><b>{x.module}</b></span></td>
                  <td><b>{x.ref}</b></td>
                  <td>{tx(x.detail)}</td>
                  <td className="num">{x.amount ? baht(x.amount) : '—'}</td>
                </tr>
              ))}
              {!o.exceptions.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีรายการที่ต้องติดตาม')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </bo-revenue-overview>
  );
}
