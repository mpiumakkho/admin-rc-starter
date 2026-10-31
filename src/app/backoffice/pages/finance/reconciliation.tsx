/* The day's reconciliation: bills, payments, refunds and accounting deliveries side by side, and where they differ (FIN-BILL-05) */
import { useState } from 'react';

import { TODAY } from '../../../clinic/data/model';
import { baht } from '../../../clinic/data/rail';
import { cx, UiButton, UiLinkButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { reconcile, type Variance } from '../../data/finance';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const money = (v: number | string) => (typeof v === 'number' ? baht(v) : v);

export function ReconciliationComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [date, setDate] = useState(TODAY);
  const [kind, setKind] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const day = reconcile(store.clinic.data, store.data, date);
  const kinds = [...new Set(day.variances.map(v => v.kind))];
  const rows = day.variances.filter(v => !kind || v.kind === kind);
  const keyOf = (v: Variance) => v.kind + v.reference;
  const selected = day.variances.find(v => keyOf(v) === selectedKey) ?? null;
  const pick = (v: Variance) => setSelectedKey(selectedKey === keyOf(v) ? null : keyOf(v));

  return (
    <bo-reconciliation className="page">
      <PageHead heading="กระทบยอดประจำวัน" source="M11 · ใบแจ้งหนี้ การรับชำระ การคืนเงิน และการส่งบัญชีของวันทำการ · ไม่ใช่การกระทบยอดธนาคารหรือปิดงวด" freshness="ตัดยอดสิ้นวันทำการ">
        <label className="date-field"><span className="visually-hidden">{tx('วันทำการ')}</span><input className="ui-input" type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        <UiButton size="sm" type="button" onClick={() => backofficeActions.saveReconciliation(date, day.variances.length)}>{tx(day.result ? 'บันทึกผลอีกครั้ง' : 'บันทึกผล')}</UiButton>
      </PageHead>

      {day.result && (
        <div className="notice ok">{`${tx('บันทึกผลแล้ว · {by} · {at} · พบ {n} รายการต่าง', { by: tx(day.result.by), at: day.result.at, n: day.result.variances })} — ${tx(day.result.note)}`}</div>
      )}

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(day.totals.issued.amount)}</span><span className="kpi-label">{tx('ออกใบแจ้งหนี้ · {n} ใบ', { n: day.totals.issued.count })}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(day.totals.collected.amount)}</span><span className="kpi-label">{tx('รับชำระ · {n} รายการ', { n: day.totals.collected.count })}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(day.totals.refunded.amount)}</span><span className="kpi-label">{tx('คืนเงิน · {n} รายการ', { n: day.totals.refunded.count })}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{baht(day.totals.net)}</span><span className="kpi-label">{tx('รับสุทธิ')}</span></div>
        <div className={cx('kpi', day.totals.exports.delivered < day.totals.exports.total && 'danger')} role="listitem"><span className="kpi-value">{`${day.totals.exports.delivered}/${day.totals.exports.total}`}</span><span className="kpi-label">{tx('ส่งบัญชีครบ')}</span></div>
        <div className={cx('kpi', day.variances.length > 0 && 'warn')} role="listitem"><span className="kpi-value">{day.variances.length}</span><span className="kpi-label">{tx('รายการต่าง')}</span></div>
      </div>

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <select className="ui-input" aria-label={tx('ประเภทความต่าง')} value={kind} onChange={event => setKind(event.target.value)}>
              <option value="">{tx('ทุกประเภท')}</option>
              {kinds.map(k => <option key={k} value={k}>{tx(k)}</option>)}
            </select>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th scope="col" className="w-kind">{tx('ประเภท')}</th>
                  <th scope="col" className="w-ref">{tx('อ้างอิง')}</th>
                  <th scope="col" className="w-amount num">{tx('ต้นทาง')}</th>
                  <th scope="col" className="w-amount">{tx('เทียบกับ')}</th>
                  <th scope="col" className="w-amount num">{tx('ต่าง')}</th>
                  <th scope="col">{tx('เหตุผล')}</th>
                  <th scope="col" className="w-owner">{tx('ผู้รับผิดชอบ')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(v => (
                  <tr key={keyOf(v)} className={cx(keyOf(v) === selectedKey && 'selected')} tabIndex={0} onClick={() => pick(v)} onKeyDown={event => { if (event.key === 'Enter') { pick(v); } }} aria-selected={keyOf(v) === selectedKey}>
                    <td>{tx(v.kind)}</td>
                    <td><b>{v.reference}</b>{v.invoice && <div className="secondary">{v.invoice.ownerKey}</div>}</td>
                    <td className="num">{money(v.source)}</td>
                    <td>{tx(money(v.compared))}</td>
                    <td className="num text-danger">{money(v.difference)}</td>
                    <td>{tx(v.reason)}</td>
                    <td>{tx(v.owner)}</td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={7} className="empty">{tx('ยอดของวันนี้ตรงกันทุกรายการ')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <Drawer heading={selected.kind} sub={selected.reference} onClosed={() => setSelectedKey(null)} foot={selected.link && <UiLinkButton size="sm" to={selected.link}>{tx('เปิดรายการต้นทาง')}</UiLinkButton>}>
            <dl className="data-grid">
              {selected.invoice && <><dt>{tx('ใบแจ้งหนี้')}</dt><dd>{`${selected.invoice.no || selected.invoice.id} · ${selected.invoice.ownerKey} · ${selected.invoice.pet}`}</dd></>}
              <dt>{tx('ต้นทาง')}</dt><dd>{money(selected.source)}</dd>
              <dt>{tx('เทียบกับ')}</dt><dd>{tx(money(selected.compared))}</dd>
              <dt>{tx('ต่าง')}</dt><dd>{money(selected.difference)}</dd>
              <dt>{tx('เหตุผล')}</dt><dd>{tx(selected.reason)}</dd>
              <dt>{tx('ผู้รับผิดชอบ')}</dt><dd>{tx(selected.owner)}</dd>
            </dl>
            <p className="secondary">{tx('รายการต่างแก้ที่โมดูลเจ้าของ · หน้านี้บันทึกเฉพาะผลการตรวจของวัน')}</p>
          </Drawer>
        )}
      </div>
    </bo-reconciliation>
  );
}
