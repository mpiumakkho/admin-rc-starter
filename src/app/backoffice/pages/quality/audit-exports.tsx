/* Audit export requests: an export needs a purpose from the approved list and someone else's approval; the server makes the file and audits it (GOV-AUD-02, M13) */
import { useState } from 'react';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { EXPORT_PURPOSES, EXPORT_STATUS, exportDecideBlock, exportProblems, type ExportInput, RANGE_DAYS, SHAPE, SHAPES } from '../../data/governance';
import type { AuditShape } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const BLANK: ExportInput = { shape: 'patient', value: '', days: 30, purpose: '', reference: '' };

export function AuditExportsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ExportInput>({ ...BLANK });

  const rows = store.data.auditExports;
  const selected = rows.find(x => x.id === selectedId) ?? null;
  const problems = exportProblems(form);
  const pick = (id: string) => setSelectedId(selectedId === id ? null : id);
  const set = <K extends keyof ExportInput>(key: K, value: ExportInput[K]) => setForm({ ...form, [key]: value });
  const submit = () => backofficeActions.requestExport(form, x => { setForm({ ...BLANK }); setSelectedId(x.id); });

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-audit-exports className="page">
      <PageHead heading="คำขอส่งออก Audit" source="GOV-AUD-02 · M13 · GET /audit/v1/events/export พร้อม purpose และ approval_id · การดูไม่ใช่การส่งออก · ผู้ขออนุมัติตัวเองไม่ได้ · ทุกการส่งออกบันทึก audit.export.performed" freshness="ข้อมูล ณ วันนี้ 11:32" />
      <p className="notice warn">{tx('การส่งออกต้องมีวัตถุประสงค์และการอนุมัติก่อน · backend ยังไม่บังคับ purpose/approval_id จึงยังไม่พร้อมใช้งานจริง')}</p>

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar"><b>{tx('ประวัติคำขอส่งออก')}</b><span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span></div>
            <div className="table-wrap">
              <table className="bo-table exports">
                <thead><tr>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col">{tx('ขอบเขต')}</th>
                  <th scope="col">{tx('วัตถุประสงค์')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  <th scope="col" className="w-owner">{tx('ไฟล์ / หมดอายุ')}</th>
                </tr></thead>
                <tbody>
                  {pager.rows.map(x => (
                    <tr key={x.id} tabIndex={0} className={cx(x.id === selectedId && 'selected')} aria-selected={x.id === selectedId} onClick={() => pick(x.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(x.id); } }}>
                      <td><b>{x.id}</b><div className="secondary">{x.requestedAt}</div></td>
                      <td>{tx(SHAPE[x.shape])}{x.value && <> · {tx(x.value)}</>}<div className="secondary">{x.from} → {x.to} · {tx(x.requestedBy)}</div></td>
                      <td>{tx(x.purpose)}<div className="secondary">{x.reference}</div></td>
                      <td><span className={`chip ${EXPORT_STATUS[x.status].cls}`}>{tx(EXPORT_STATUS[x.status].label)}</span>{x.decidedBy && <div className="secondary">{tx(x.decidedBy)}</div>}</td>
                      <td>{x.artifact ? <><span>{x.artifact}</span><div className="secondary">{tx('หมดอายุ {d}', { d: x.expires! })}</div></> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PagerFoot pager={pager} />
          </div>
        </div>

        <aside className="record-rail">
          {selected ? (() => {
            const x = selected;
            const issue = exportDecideBlock(x, store.userName);
            return (
              <div className="panel action-card">
                <b>{x.id} · {tx(x.purpose)}</b>
                <span className="secondary">{tx('ขอโดย {who} · {at}', { who: tx(x.requestedBy), at: x.requestedAt })}</span>
                <div className="sum-row"><span>{tx('ขอบเขต')}</span><span>{tx(SHAPE[x.shape])}{x.value && <> · {tx(x.value)}</>}</span></div>
                <div className="sum-row"><span>{tx('ช่วงเวลา')}</span><span>{x.from} → {x.to}</span></div>
                <div className="sum-row"><span>{tx('อ้างอิง')}</span><b>{x.reference}</b></div>
                <div className="sum-row"><span>{tx('สถานะ')}</span><span className={`chip ${EXPORT_STATUS[x.status].cls}`}>{tx(EXPORT_STATUS[x.status].label)}</span></div>
                {x.decision && <p className="secondary">{tx(x.decidedBy)} · {x.decidedAt} — {tx(x.decision)}</p>}
                {x.status === 'pending' && <>
                  {issue && <p className="secondary">{tx(issue)}</p>}
                  <div className="two">
                    <UiButton variant="secondary" size="sm" type="button" disabled={!!issue} onClick={() => backofficeActions.decideExport(x, false)}>{tx('ปฏิเสธการส่งออก')}</UiButton>
                    <UiButton size="sm" type="button" disabled={!!issue} onClick={() => backofficeActions.decideExport(x, true)}>{tx('อนุมัติการส่งออก')}</UiButton>
                  </div>
                </>}
                {x.status === 'approved' && <UiButton size="sm" type="button" onClick={() => backofficeActions.performExport(x)}>{tx('ส่งออก')}</UiButton>}
                {x.status === 'ready' && <>
                  <div className="sum-row"><span>{tx('ไฟล์')}</span><b>{x.artifact}</b></div>
                  <div className="sum-row"><span>{tx('แถว')}</span><span>{x.rows}</span></div>
                  <p className="secondary">{tx('ไฟล์สร้างโดย server และบันทึก audit.export.performed แล้ว ดาวน์โหลดได้จนถึง {d}', { d: x.expires! })}</p>
                </>}
                {x.status === 'expired' && <p className="secondary">{tx('ไฟล์หมดอายุแล้ว ต้องยื่นคำขอใหม่')}</p>}
                <UiButton variant="ghost" size="sm" type="button" onClick={() => setSelectedId(null)}>{tx('ยื่นคำขอใหม่')}</UiButton>
              </div>
            );
          })() : (
            <div className="panel action-card">
              <b>{tx('ยื่นคำขอส่งออก')}</b>
              <label className="field">{tx('รูปแบบการค้น')}
                <select className="ui-input" value={form.shape} onChange={event => set('shape', event.target.value as AuditShape)}>
                  {SHAPES.map(s => <option key={s} value={s}>{tx(SHAPE[s])}</option>)}
                </select>
              </label>
              {form.shape !== 'tenant' && (
                <label className="field">{tx(form.shape === 'patient' ? 'HN' : 'ผู้ใช้งาน')}<input className="ui-input" value={form.value} onChange={event => set('value', event.target.value)} /></label>
              )}
              <label className="field">{tx('ช่วงเวลา')}
                <select className="ui-input" value={form.days} onChange={event => set('days', +event.target.value)}>
                  {RANGE_DAYS.map(n => <option key={n} value={n}>{tx(n === 1 ? 'วันนี้' : '{n} วันล่าสุด', { n })}</option>)}
                </select>
              </label>
              <label className="field">{tx('วัตถุประสงค์')}
                <select className="ui-input" value={form.purpose} onChange={event => set('purpose', event.target.value)}>
                  <option value="">{tx('เลือก')}</option>
                  {EXPORT_PURPOSES.map(p => <option key={p} value={p}>{tx(p)}</option>)}
                </select>
              </label>
              <label className="field">{tx('เลขอ้างอิงของวัตถุประสงค์')}<input className="ui-input" placeholder={tx('เช่น DSAR-2609-004')} value={form.reference} onChange={event => set('reference', event.target.value)} /></label>
              {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
              <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={submit}>{tx('ยื่นคำขอ')}</UiButton>
            </div>
          )}
        </aside>
      </div>
    </bo-audit-exports>
  );
}
