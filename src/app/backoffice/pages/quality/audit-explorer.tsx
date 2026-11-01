/* The audit explorer: one of three indexed shapes in a bounded window, the immutable events, and one event's protected detail (GOV-AUD-01, M13 · /audit/v1/events) */
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeStore, useBackofficeStore } from '../../backoffice.store';
import { accessLog, type AuditQuery, queryEvents, queryProblem, RANGE_DAYS, RELAY, RESULT, RISK, RISKS, SHAPE, SHAPES } from '../../data/governance';
import type { AuditEvent } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const RESULTS = Object.keys(RESULT) as AuditEvent['result'][];
const rangeLabel = (days: number) => (days === 1 ? 'วันนี้' : '{n} วันล่าสุด');

export function AuditExplorerComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const hn = params.get('hn');
  const start: AuditQuery = { shape: hn ? 'patient' : 'tenant', value: hn ?? '', days: 30, action: '', risk: '', result: '' };
  /* What is being typed, and the query last run: a patient query runs only on Search, as it is itself audited */
  const [draft, setDraft] = useState<AuditQuery>(start);
  const [query, setQuery] = useState<AuditQuery>(start);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const audited = useRef(false);
  useEffect(() => {
    if (hn && !audited.current) {
      audited.current = true;
      backofficeStore.queryPatient(hn);
    }
  }, [hn]);

  const d = store.data;
  const problem = queryProblem(draft);
  const rows = queryEvents(d, query);
  const actions = [...new Set(d.auditEvents.map(e => e.action))].sort();
  const selected = d.auditEvents.find(e => e.id === selectedId) ?? null;

  const set = <K extends keyof AuditQuery>(key: K, value: AuditQuery[K]) => setDraft({ ...draft, [key]: value, ...(key === 'shape' ? { value: '' } : {}) } as AuditQuery);
  const run = () => {
    if (draft.shape === 'patient') {
      backofficeStore.queryPatient(draft.value);
    }
    setQuery({ ...draft });
    setSelectedId(null);
  };
  const pick = (id: string) => setSelectedId(selectedId === id ? null : id);

  return (
    <bo-audit-explorer className="page">
      <PageHead heading="ค้นประวัติ Audit" source="GOV-AUD-01 · M13 · GET /audit/v1/events · ค้นได้ 3 รูปแบบตาม index · เหตุการณ์แก้หรือลบไม่ได้ · ระดับความเสี่ยงจาก backend · ไม่มีคอลัมน์ IP" freshness={tx('นำเข้าล่าสุด {at}', { at: RELAY.lastIngest })} />
      <p className="notice info">{tx('ข้อมูล audit อาจยังไม่ครบ (อยู่ระหว่างนำเข้า) · relay ล่าช้าประมาณ {n} นาที', { n: RELAY.lagMinutes })}</p>

      <div className="panel">
        <div className="filter-bar audit-query">
          <div className="segmented" role="group" aria-label={tx('รูปแบบการค้น')}>
            {SHAPES.map(s => <button key={s} type="button" className={cx(draft.shape === s && 'active')} aria-pressed={draft.shape === s} onClick={() => set('shape', s)}>{tx(SHAPE[s])}</button>)}
          </div>
          {draft.shape !== 'tenant' && (
            <input className="ui-input" aria-label={tx(draft.shape === 'patient' ? 'HN' : 'ผู้ใช้งาน')} placeholder={tx(draft.shape === 'patient' ? 'เช่น HN-180533' : 'ชื่อผู้ใช้งาน')} value={draft.value} onChange={event => set('value', event.target.value)} />
          )}
          <select className="ui-input" aria-label={tx('ช่วงเวลา')} value={draft.days} onChange={event => set('days', +event.target.value)}>
            {RANGE_DAYS.map(n => <option key={n} value={n}>{tx(rangeLabel(n), { n })}</option>)}
          </select>
          <select className="ui-input" aria-label={tx('การกระทำ')} value={draft.action} onChange={event => set('action', event.target.value)}>
            <option value="">{tx('ทุกการกระทำ')}</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="ui-input" aria-label={tx('ระดับความเสี่ยง')} value={draft.risk} onChange={event => set('risk', event.target.value as AuditQuery['risk'])}>
            <option value="">{tx('ทุกระดับความเสี่ยง')}</option>
            {RISKS.map(r => <option key={r} value={r}>{tx(RISK[r].label)}</option>)}
          </select>
          <select className="ui-input" aria-label={tx('ผลลัพธ์')} value={draft.result} onChange={event => set('result', event.target.value as AuditQuery['result'])}>
            <option value="">{tx('ทุกผลลัพธ์')}</option>
            {RESULTS.map(r => <option key={r} value={r}>{tx(RESULT[r].label)}</option>)}
          </select>
          <UiButton size="sm" type="button" disabled={!!problem} onClick={run}>{tx('ค้นหา')}</UiButton>
        </div>
        {problem && <p className="secondary foot-note">{tx(problem)}</p>}
        <div className="filter-bar">
          <span className="secondary grow">{tx('{n} เหตุการณ์ · {shape}{value} · {range}', { n: rows.length, shape: tx(SHAPE[query.shape]), value: query.value ? ` ${query.value}` : '', range: tx(rangeLabel(query.days), { n: query.days }) })}</span>
          {query.shape === 'patient' && <span className="secondary">{tx('การค้นตามผู้ป่วยถูกบันทึกในบันทึกตรวจสอบ')}</span>}
          <Link className="link" to="/backoffice/quality/audit-exports">{tx('ขอส่งออก')}</Link>
        </div>
      </div>

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="table-wrap">
            <table className="bo-table audit">
              <thead><tr>
                <th scope="col" className="w-at">{tx('เวลา')}</th>
                <th scope="col" className="w-owner">{tx('ผู้กระทำ / บทบาท')}</th>
                <th scope="col">{tx('การกระทำ')}</th>
                <th scope="col">{tx('รายการ (ประเภท/รหัส)')}</th>
                <th scope="col" className="w-kind">{tx('ผลลัพธ์')}</th>
                <th scope="col" className="w-kind">{tx('ระดับความเสี่ยง')}</th>
              </tr></thead>
              <tbody>
                {rows.map(e => (
                  <tr key={e.id} tabIndex={0} className={cx(e.id === selectedId && 'selected')} aria-selected={e.id === selectedId} onClick={() => pick(e.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(e.id); } }}>
                    <td className="num">{e.occurredAt}</td>
                    <td>{tx(e.actor)}<div className="secondary">{e.actorRole}</div></td>
                    <td><code>{e.action}</code></td>
                    <td>{e.entityType} · {e.entityId}{e.patientId && <div className="secondary">{tx('ข้อมูลผู้ป่วย {hn}', { hn: e.patientId })}</div>}</td>
                    <td><span className={`chip ${RESULT[e.result].cls}`}>{tx(RESULT[e.result].label)}</span></td>
                    <td><span className={`chip ${RISK[e.riskLevel].cls}`}>{tx(RISK[e.riskLevel].label)}</span></td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx('ไม่มีเหตุการณ์ในขอบเขตนี้ ซึ่งไม่ได้แปลว่าไม่มีเหตุผิดปกติ')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <Drawer heading={selected.action} sub={`${selected.id} · ${selected.occurredAt}`} onClosed={() => setSelectedId(null)}>
            <dl className="data-grid">
              <dt>{tx('ผู้กระทำ')}</dt><dd>{tx(selected.actor)} · {selected.actorRole}</dd>
              <dt>{tx('รายการที่ถูกกระทำ')}</dt><dd>{selected.entityType} · {selected.entityId}</dd>
              <dt>{tx('ผลลัพธ์')}</dt><dd><span className={`chip ${RESULT[selected.result].cls}`}>{tx(RESULT[selected.result].label)}</span></dd>
              <dt>{tx('ระดับความเสี่ยง')}</dt><dd><span className={`chip ${RISK[selected.riskLevel].cls}`}>{tx(RISK[selected.riskLevel].label)}</span></dd>
              <dt>request_id</dt><dd><code>{selected.requestId}</code></dd>
              <dt>event_hash</dt><dd><code>{selected.eventHash}</code> · {tx(selected.hashCheck === 'verified' ? 'ตรวจแล้วถูกต้อง' : 'ไม่ตรงกับ hash')}</dd>
              <dt>{tx('ผู้ป่วย')}</dt><dd>{selected.patientId ?? tx('ไม่เกี่ยวกับผู้ป่วย')}</dd>
            </dl>
            {selected.patientId && <>
              <div className="section-title">{tx('ประวัติการเข้าถึงของ {hn}', { hn: selected.patientId })}</div>
              <ul className="timeline compact">
                {accessLog(d, [selected.patientId]).map(x => <li key={x.id} className="tl"><b>{x.action}</b> · {tx(x.actor)}<div className="secondary">{x.occurredAt} · {tx(RESULT[x.result].label)}</div></li>)}
              </ul>
            </>}
            <p className="secondary">{tx('เหตุการณ์ใน audit แก้ ลบ หรือปิดไม่ได้')}</p>
          </Drawer>
        )}
      </div>
    </bo-audit-explorer>
  );
}
