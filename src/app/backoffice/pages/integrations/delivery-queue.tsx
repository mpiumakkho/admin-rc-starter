/* The accounting delivery queue, the integration side of Finance's records: adapter, tries, error class and the accounting system's reference, one record in two views (INT-ACC-02) */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { baht } from '../../../clinic/data/rail';
import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { DOC_TYPE, EXPORT_STATUS, INVOICE_STATUS, statusOf } from '../../data/finance';
import { attemptsOf, ERROR_CLASS, type ErrorClass, errorClassOf, payloadMeta } from '../../data/integrations';
import type { AccountingExport } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const STATUS_KEYS = Object.keys(EXPORT_STATUS) as AccountingExport['status'][];
const DOC_TYPES = Object.keys(DOC_TYPE) as AccountingExport['docType'][];
const ERROR_CLASSES = Object.keys(ERROR_CLASS) as ErrorClass[];

export function DeliveryQueueComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<AccountingExport['status'] | ''>('');
  const [docType, setDocType] = useState<AccountingExport['docType'] | ''>('');
  const [errorClass, setErrorClass] = useState<ErrorClass | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const all = store.data.accountingExports.slice().sort((a, b) => b.lastAt.localeCompare(a.lastAt) || b.id.localeCompare(a.id));
  const counts: Record<AccountingExport['status'], number> = { queued: 0, delivered: 0, failed: 0 };
  all.forEach(x => counts[x.status]++);
  const needle = q.trim().toLowerCase();
  const rows = all.filter(x => (!status || x.status === status) && (!docType || x.docType === docType) && (!errorClass || errorClassOf(x.errorCode) === errorClass)
    && (!needle || `${x.id} ${x.document} ${x.externalRef ?? ''}`.toLowerCase().includes(needle)));
  const selected = all.find(x => x.id === selectedId) ?? null;
  const invoice = selected ? store.clinic.data.invoices.find(i => i.id === selected.invoiceId) : undefined;
  const meta = selected ? payloadMeta(selected) : null;
  const pick = (x: AccountingExport) => setSelectedId(selectedId === x.id ? null : x.id);
  const chip = (x: AccountingExport) => <span className={`chip ${EXPORT_STATUS[x.status].cls}`}>{tx(EXPORT_STATUS[x.status].label)}</span>;

  return (
    <bo-delivery-queue className="page">
      <PageHead heading="คิวส่งข้อมูลบัญชี" source="INT-ACC-02 · M11 accounting_export_log · record ชุดเดียวกับการเงิน > ส่งข้อมูลบัญชี · สถานะส่งแล้วไม่ใช่ผล e-Tax" freshness="รอบส่งล่าสุด 06:00" />

      <div className="kpi-strip" role="list">
        {STATUS_KEYS.map(s => (
          <button key={s} type="button" className={cx('kpi', counts[s] > 0 && EXPORT_STATUS[s].cls, status === s && 'active')} role="listitem" onClick={() => setStatus(status === s ? '' : s)}>
            <span className="kpi-value">{counts[s]}</span><span className="kpi-label">{tx(EXPORT_STATUS[s].label)}</span>
          </button>
        ))}
      </div>

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <input className="ui-input search" type="search" placeholder={tx('ค้นหาเอกสาร รหัสส่ง หรือเลขอ้างอิง')} aria-label={tx('ค้นหา')} value={q} onChange={event => setQ(event.target.value)} />
            <select className="ui-input" aria-label={tx('ประเภทเอกสาร')} value={docType} onChange={event => setDocType(event.target.value as AccountingExport['docType'] | '')}>
              <option value="">{tx('ทุกประเภท')}</option>
              {DOC_TYPES.map(d => <option key={d} value={d}>{tx(DOC_TYPE[d])}</option>)}
            </select>
            <select className="ui-input" aria-label={tx('ประเภทข้อผิดพลาด')} value={errorClass} onChange={event => setErrorClass(event.target.value as ErrorClass | '')}>
              <option value="">{tx('ทุกข้อผิดพลาด')}</option>
              {ERROR_CLASSES.map(e => <option key={e} value={e}>{tx(ERROR_CLASS[e])}</option>)}
            </select>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table delivery-queue">
              <thead><tr>
                <th scope="col">{tx('เอกสารต้นทาง')}</th>
                <th scope="col" className="w-due">{tx('วันทำการ')}</th>
                <th scope="col" className="w-amount num">{tx('จำนวนเงิน')}</th>
                <th scope="col" className="w-kind">Adapter</th>
                <th scope="col" className="w-status">{tx('สถานะการส่ง')}</th>
                <th scope="col" className="w-priority num">{tx('ครั้ง')}</th>
                <th scope="col" className="w-at">{tx('ส่งล่าสุด')}</th>
                <th scope="col" className="w-ref">{tx('เลขอ้างอิงระบบบัญชี')}</th>
                <th scope="col" className="w-kind">{tx('ประเภทข้อผิดพลาด')}</th>
              </tr></thead>
              <tbody>
                {rows.map(x => {
                  const e = errorClassOf(x.errorCode);
                  return (
                    <tr key={x.id} className={cx(x.id === selectedId && 'selected')} tabIndex={0} onClick={() => pick(x)} onKeyDown={event => { if (event.key === 'Enter') { pick(x); } }} aria-selected={x.id === selectedId} aria-label={`${x.id} ${x.document}`}>
                      <td><b>{x.document}</b><div className="secondary">{`${x.id} · ${tx(DOC_TYPE[x.docType])}`}</div></td>
                      <td className="num">{x.businessDate}</td>
                      <td className="num">{baht(x.amount)}</td>
                      <td>{x.adapter}<div className="secondary">API</div></td>
                      <td>{chip(x)}</td>
                      <td className="num">{x.attempts}</td>
                      <td className="num">{x.attempts ? x.lastAt : '—'}</td>
                      <td>{x.externalRef ?? '—'}</td>
                      <td>{e ? <><span className="text-danger">{tx(ERROR_CLASS[e])}</span><div className="secondary">{x.errorCode}</div></> : <span className="secondary">—</span>}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr className="static"><td colSpan={9} className="empty">{tx('ไม่มีรายการที่ตรงกับตัวกรอง')}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="secondary foot-note">{tx('วันทำการเป็นวันของเอกสาร เวลาส่งเป็นเวลาของ adapter')}</p>
        </div>

        {selected && (
          <Drawer heading={selected.document} sub={`${selected.id} · ${DOC_TYPE[selected.docType]}`} onClosed={() => setSelectedId(null)} foot={<>
            <Link className="link" to={`/backoffice/finance/invoices/${selected.invoiceId}`}>{tx('เปิดเอกสารในการเงิน')}</Link>
            <span className="grow"></span>
            {selected.status === 'failed' && selected.retryable && <UiButton size="sm" type="button" onClick={() => backofficeActions.retryExport(selected)}>{tx('ลองส่งใหม่')}</UiButton>}
          </>}>
            <h3>{tx('เอกสารธุรกิจ')}</h3>
            <dl className="data-grid">
              {invoice && <><dt>{tx('สถานะเอกสาร')}</dt><dd><span className={`chip ${INVOICE_STATUS[statusOf(invoice)].cls}`}>{tx(INVOICE_STATUS[statusOf(invoice)].label)}</span></dd></>}
              <dt>{tx('จำนวนเงิน')}</dt><dd>{`${baht(selected.amount)} · ${tx('วันทำการ')} ${selected.businessDate}`}</dd>
            </dl>
            <h3>{tx('การส่ง')}</h3>
            <dl className="data-grid">
              <dt>{tx('สถานะการส่ง')}</dt><dd>{chip(selected)}{selected.retryable && selected.status === 'failed' && ` · ${tx('ส่งใหม่ได้')}`}</dd>
              {selected.errorCode && <><dt>{tx('ข้อผิดพลาด')}</dt><dd className="text-danger">{`${selected.errorCode} · ${tx(selected.errorText ?? '')}`}</dd></>}
              {selected.externalRef && <><dt>{tx('เลขอ้างอิงระบบบัญชี')}</dt><dd>{`${selected.externalRef} · ${selected.deliveredAt ?? ''}`}</dd></>}
              <dt>Idempotency</dt><dd>{selected.idempotencyKey}</dd>
            </dl>
            {selected.status === 'delivered' && <p className="notice info">{tx('ส่งข้อมูลถึง PEAK แล้ว ไม่ใช่ผล e-Tax')}</p>}
            <h3>{tx('การส่งแต่ละครั้ง')}</h3>
            <ol className="attempts">
              {attemptsOf(selected).map(t => <li key={t.n}><b>{tx('ครั้งที่ {n}', { n: t.n })}</b> {`${t.at} · ${tx(t.result)}`}{t.code && ` · ${t.code}`}</li>)}
              {!selected.attempts && <li className="secondary">{tx('ยังไม่ได้ส่ง')}</li>}
            </ol>
            <h3>{tx('ข้อมูลกำกับ Payload')}</h3>
            {meta && (
              <dl className="data-grid">
                <dt>Schema</dt><dd>{meta.schema}</dd>
                <dt>Mapping</dt><dd>{meta.mapping}</dd>
                <dt>{tx('ขนาด')}</dt><dd>{`${meta.contentType} · ${meta.size}`}</dd>
                <dt>Checksum</dt><dd>{meta.checksum}</dd>
              </dl>
            )}
            <p className="secondary">{tx('ไม่แสดง payload เต็ม · ความลับของ adapter ไม่อยู่ในหน้านี้ · การประมวลผลเหตุการณ์ใหม่ (replay) รอสัญญา')}</p>
          </Drawer>
        )}
      </div>
    </bo-delivery-queue>
  );
}
