/* Accounting delivery: every bill, receipt and credit note on its way to the accounting system, and another try when one failed (INT-ACC-02, finance projection) */
import { useState } from 'react';
import { Link } from 'react-router';

import { baht } from '../../../clinic/data/rail';
import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { DOC_TYPE, EXPORT_STATUS } from '../../data/finance';
import type { AccountingExport } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const STATUS_KEYS = Object.keys(EXPORT_STATUS) as AccountingExport['status'][];
const DOC_TYPES = Object.keys(DOC_TYPE) as AccountingExport['docType'][];

export function ExportsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AccountingExport['status'] | ''>('');
  const [docType, setDocType] = useState<AccountingExport['docType'] | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const all = store.data.accountingExports.slice().sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const counts: Record<AccountingExport['status'], number> = { queued: 0, delivered: 0, failed: 0 };
  all.forEach(x => counts[x.status]++);
  const needle = q.trim().toLowerCase();
  const rows = all.filter(x => (!status || x.status === status) && (!docType || x.docType === docType) && (!needle || `${x.id} ${x.document} ${x.externalRef ?? ''}`.toLowerCase().includes(needle)));
  const selected = all.find(x => x.id === selectedId) ?? null;
  const pick = (x: AccountingExport) => setSelectedId(selectedId === x.id ? null : x.id);

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-exports className="page">
      <PageHead heading="ส่งข้อมูลบัญชี" source="M11 · คิวส่งไป PEAK ชุดเดียวกับ Integration Center · สถานะส่งแล้วคือระบบบัญชีรับข้อมูล ไม่ใช่ e-Tax" freshness="รอบส่งล่าสุด 06:00" />

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
            <input className="ui-input search" type="search" placeholder={tx('ค้นหาเอกสารหรือเลขอ้างอิง')} aria-label={tx('ค้นหา')} value={q} onChange={event => setQ(event.target.value)} />
            <select className="ui-input" aria-label={tx('ประเภทเอกสาร')} value={docType} onChange={event => setDocType(event.target.value as AccountingExport['docType'] | '')}>
              <option value="">{tx('ทุกประเภท')}</option>
              {DOC_TYPES.map(d => <option key={d} value={d}>{tx(DOC_TYPE[d])}</option>)}
            </select>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th scope="col" className="w-ref">{tx('รหัสส่ง')}</th>
                  <th scope="col">{tx('เอกสาร')}</th>
                  <th scope="col" className="w-amount num">{tx('จำนวนเงิน')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  <th scope="col" className="w-priority num">{tx('ครั้ง')}</th>
                  <th scope="col" className="w-at">{tx('ล่าสุด')}</th>
                  <th scope="col" className="w-ref">{tx('อ้างอิง PEAK')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(x => (
                  <tr key={x.id} className={cx(x.id === selectedId && 'selected')} tabIndex={0} onClick={() => pick(x)} onKeyDown={event => { if (event.key === 'Enter') { pick(x); } }} aria-selected={x.id === selectedId}>
                    <td><b>{x.id}</b></td>
                    <td>{x.document}<div className="secondary">{`${tx(DOC_TYPE[x.docType])} · ${tx('วันทำการ')} ${x.businessDate}`}</div></td>
                    <td className="num">{baht(x.amount)}</td>
                    <td><span className={`chip ${EXPORT_STATUS[x.status].cls}`}>{tx(EXPORT_STATUS[x.status].label)}</span></td>
                    <td className="num">{x.attempts}</td>
                    <td className="num">{x.lastAt}</td>
                    <td>{x.externalRef ?? '—'}</td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={7} className="empty">{tx('ไม่มีรายการที่ตรงกับตัวกรอง')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {selected && (
          <Drawer heading={selected.document} sub={`${selected.id} · ${DOC_TYPE[selected.docType]}`} onClosed={() => setSelectedId(null)} foot={<>
            <Link className="link" to={`/backoffice/finance/invoices/${selected.invoiceId}`}>{tx('เปิดใบแจ้งหนี้')}</Link>
            <span className="grow"></span>
            {selected.status !== 'delivered' && selected.retryable && <UiButton size="sm" type="button" onClick={() => backofficeActions.retryExport(selected)}>{tx('ส่งใหม่')}</UiButton>}
          </>}>
            <dl className="data-grid">
              <dt>{tx('สถานะ')}</dt><dd><span className={`chip ${EXPORT_STATUS[selected.status].cls}`}>{tx(EXPORT_STATUS[selected.status].label)}</span></dd>
              <dt>{tx('จำนวนเงิน')}</dt><dd>{`${baht(selected.amount)} · ${tx('วันทำการ')} ${selected.businessDate}`}</dd>
              <dt>Adapter</dt><dd>{selected.adapter}</dd>
              <dt>{tx('ส่งครั้งแรก')}</dt><dd>{selected.firstAt}</dd>
              <dt>{tx('ล่าสุด')}</dt><dd>{`${selected.lastAt} · ${tx('ครั้งที่')} ${selected.attempts}`}</dd>
              {selected.deliveredAt && <><dt>{tx('ส่งสำเร็จ')}</dt><dd>{`${selected.deliveredAt} · ${selected.externalRef}`}</dd></>}
              {selected.errorCode && <><dt>{tx('ข้อผิดพลาด')}</dt><dd className="text-danger">{`${selected.errorCode} · ${tx(selected.errorText ?? '')}`}</dd></>}
              <dt>Idempotency</dt><dd>{selected.idempotencyKey}</dd>
            </dl>
            <p className="secondary">{tx('ไม่แสดง payload เต็ม · ความลับของ adapter ไม่อยู่ในหน้านี้')}</p>
          </Drawer>
        )}
      </div>
    </bo-exports>
  );
}
