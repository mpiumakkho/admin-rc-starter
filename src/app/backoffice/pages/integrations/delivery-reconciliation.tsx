/* Accounting delivery reconciliation: each billing event against its delivery record, totals by document type, and what is missing, failed, waiting or doubled; with no readback from PEAK the books are never called matched (INT-ACC-03, GATED) */
import { useState } from 'react';
import { Link } from 'react-router';

import { baht } from '../../../clinic/data/rail';
import { cx } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { DOC_TYPE, EXPORT_STATUS } from '../../data/finance';
import { OUTCOME, type Outcome, PERIODS, RECON_FORMULA, reconcileDeliveries, reconSummary } from '../../data/integrations';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const STRIP: Outcome[] = ['awaiting', 'failed', 'missing', 'duplicate', 'variance'];
const rank = (o: Outcome) => (o === 'delivered' ? 1 : 0);

export function DeliveryReconciliationComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [period, setPeriod] = useState('month');
  const [outcome, setOutcome] = useState<Outcome | ''>('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const results = reconcileDeliveries(store.clinic.data, store.data, period);
  const s = reconSummary(results);
  const rows = results.filter(r => !outcome || r.outcome === outcome).sort((a, b) => rank(a.outcome) - rank(b.outcome) || b.at.localeCompare(a.at));
  const selected = results.find(r => r.key === selectedKey);
  const pick = (key: string) => setSelectedKey(selectedKey === key ? null : key);
  const outcomeChip = (o: Outcome) => <span className={`chip ${OUTCOME[o].cls}`}>{tx(OUTCOME[o].label)}</span>;

  return (
    <bo-delivery-reconciliation className="page">
      <PageHead heading="กระทบยอดการส่งบัญชี" source="INT-ACC-03 · M11 · เหตุการณ์ต้นทางเทียบกับรายการส่ง · ไม่รวมกระทบยอดธนาคาร GL หรือ e-Tax · สูตรเป็นต้นแบบ (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32 · ตัดยอด 23:00">
        <div className="segmented" role="group" aria-label={tx('ช่วงเวลา')}>
          {PERIODS.map(([key, label]) => <button key={key} type="button" className={cx(period === key && 'active')} aria-pressed={period === key} onClick={() => setPeriod(key)}>{tx(label)}</button>)}
        </div>
      </PageHead>
      <p className="notice warn">{tx('PEAK ไม่มี readback ตามสัญญา จึงยืนยันได้เพียงความครบของการส่ง ไม่ได้ยืนยันว่ายอดในระบบบัญชีตรงกัน · การรันและการทบทวนรอสัญญา')}</p>

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{s.events}</span><span className="kpi-label">{tx('เหตุการณ์ต้นทาง')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{s.counts.delivered}</span><span className="kpi-label">{tx('ส่งแล้ว')}</span></div>
        {STRIP.map(o => (
          <button key={o} type="button" className={cx('kpi', s.counts[o] > 0 && OUTCOME[o].cls, outcome === o && 'active')} role="listitem" onClick={() => setOutcome(outcome === o ? '' : o)}>
            <span className="kpi-value">{s.counts[o]}</span><span className="kpi-label">{tx(OUTCOME[o].label)}</span>
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('ยอดตามประเภทเอกสาร')}</b><span className="secondary grow">{tx('สกุลเงิน THB · ยอดจากเอกสารต้นทาง ไม่คำนวณใหม่')}</span></div>
        <div className="table-wrap">
          <table className="bo-table recon-totals">
            <thead><tr>
              <th scope="col">{tx('ประเภทเอกสาร')}</th>
              <th scope="col" className="num">{tx('ยอดต้นทาง')}</th>
              <th scope="col" className="num">{tx('ยอดที่ส่ง')}</th>
              <th scope="col" className="num">{tx('ส่วนต่าง')}</th>
              <th scope="col" className="num">{tx('เลขอ้างอิงระบบบัญชี')}</th>
              <th scope="col">{tx('เทียบกับระบบบัญชี')}</th>
            </tr></thead>
            <tbody>
              {s.rows.map(r => (
                <tr key={r.docType} className="static">
                  <td><b>{tx(DOC_TYPE[r.docType])}</b></td>
                  <td className="num">{baht(r.sourceAmount)}<div className="secondary">{tx('{n} รายการ', { n: r.sourceCount })}</div></td>
                  <td className="num">{baht(r.deliveredAmount)}<div className="secondary">{tx('{n} รายการ', { n: r.deliveredCount })}</div></td>
                  <td className={cx('num', r.sourceAmount !== r.deliveredAmount && 'text-danger')}>{baht(r.sourceAmount - r.deliveredAmount)}{r.open > 0 && <div className="secondary">{tx('ยังไม่ครบ {n}', { n: r.open })}</div>}</td>
                  <td className="num">{r.refs}</td>
                  <td><span className="chip quiet">{tx('ยังเปรียบเทียบไม่ได้')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar"><b>{tx('ผลรายเหตุการณ์')}</b><span className="secondary grow">{`${tx('รายการที่ยังไม่ครบก่อน')} · ${tx('{n} รายการ', { n: rows.length })}`}</span></div>
          <div className="table-wrap">
            <table className="bo-table recon-results">
              <thead><tr>
                <th scope="col">{tx('เอกสารต้นทาง')}</th>
                <th scope="col" className="w-at">{tx('เวลาเหตุการณ์')}</th>
                <th scope="col" className="w-amount num">{tx('ยอดต้นทาง')}</th>
                <th scope="col" className="w-ref">{tx('รหัสส่ง')}</th>
                <th scope="col" className="w-status">{tx('ผล')}</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key} className={cx(r.key === selectedKey && 'selected')} tabIndex={0} onClick={() => pick(r.key)} onKeyDown={event => { if (event.key === 'Enter') { pick(r.key); } }} aria-selected={r.key === selectedKey}>
                    <td><b>{r.document}</b><div className="secondary">{tx(DOC_TYPE[r.docType])}</div></td>
                    <td className="num">{r.at}</td>
                    <td className="num">{r.event ? baht(r.event.amount) : '—'}</td>
                    <td>{r.delivery?.id ?? '—'}</td>
                    <td>{outcomeChip(r.outcome)}</td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีเหตุการณ์ในช่วงนี้')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <Drawer heading={selected.document} sub={DOC_TYPE[selected.docType]} onClosed={() => setSelectedKey(null)} foot={<>
            <Link className="link" to={`/backoffice/finance/invoices/${selected.invoiceId}`}>{tx('เปิดเอกสารในการเงิน')}</Link>
            <span className="grow"></span>
            {selected.delivery && <Link className="link" to={`/backoffice/integrations/accounting/queue?q=${selected.delivery.id}`}>{tx('เปิดคิวส่งข้อมูล')}</Link>}
          </>}>
            <p>{outcomeChip(selected.outcome)}</p>
            <h3>{tx('สูตร')}</h3>
            <p className="secondary">{tx(RECON_FORMULA)}</p>
            <h3>{tx('ต้นทาง')}</h3>
            {selected.event
              ? <dl className="data-grid"><dt>{tx('เวลาเหตุการณ์')}</dt><dd>{selected.event.at}</dd><dt>{tx('ยอดต้นทาง')}</dt><dd>{baht(selected.event.amount)}</dd></dl>
              : <p className="secondary">{tx('ไม่พบเหตุการณ์ต้นทางของรายการส่งนี้')}</p>}
            <h3>{tx('รายการส่ง')}</h3>
            {selected.delivery ? (
              <dl className="data-grid">
                <dt>{tx('รหัสส่ง')}</dt><dd>{selected.delivery.id}</dd>
                <dt>{tx('สถานะการส่ง')}</dt><dd>{`${tx(EXPORT_STATUS[selected.delivery.status].label)} · ${tx('ครั้งที่')} ${selected.delivery.attempts}`}</dd>
                <dt>{tx('ยอดที่ส่ง')}</dt><dd>{baht(selected.delivery.amount)}</dd>
                <dt>{tx('เลขอ้างอิงระบบบัญชี')}</dt><dd>{selected.delivery.externalRef ?? '—'}</dd>
              </dl>
            ) : <p className="secondary">{tx('ไม่พบรายการส่งหลังเวลาตัดยอด')}</p>}
          </Drawer>
        )}
      </div>
    </bo-delivery-reconciliation>
  );
}
