/* Incident reports: the worklist by severity and triage clock, reported under a name or none, triaged, analysed and closed (quality.incidents, M12 P2) */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { NOW, TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  CATEGORIES, closeBlock, HARM, HARM_LEVELS, INCIDENT_STATUS, incidentProblems, type IncidentInput, needsRca, RCA_STATUS, rcaOf, reporterOf, SAFETY_CATEGORY, SAFETY_PLACES,
  triageDue, triageLate, triageProblems, type TriageInput,
} from '../../data/quality';
import type { SafetyCategory } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

type View = 'open' | 'all' | 'closed';
const VIEWS: [View, string][] = [['open', 'ยังไม่ปิด'], ['all', 'ทั้งหมด'], ['closed', 'ปิดแล้ว']];
const BLANK: IncidentInput = { at: `${TODAY}T${NOW}`, category: '', location: '', pet: '', description: '', immediateAction: '', harm: '1', anonymous: false };

export function IncidentsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [view, setView] = useState<View>('open');
  const [category, setCategory] = useState<SafetyCategory | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'));
  const [reporting, setReporting] = useState(false);
  const [form, setForm] = useState<IncidentInput>({ ...BLANK });
  const [triage, setTriage] = useState<TriageInput>({ harm: '1', owner: '', note: '' });

  const d = store.data;
  const rows = d.incidents.filter(i => (view === 'all' || (view === 'closed') === (i.status === 'closed')) && (!category || i.category === category))
    .sort((a, b) => Number(triageLate(b)) - Number(triageLate(a)) || b.harm - a.harm || b.at.localeCompare(a.at));
  const waiting = d.incidents.filter(i => i.status === 'reported').sort((a, b) => triageDue(a).localeCompare(triageDue(b)));
  const selected = d.incidents.find(i => i.id === selectedId) ?? null;
  const problems = incidentProblems(form);
  const triageIssues = selected ? triageProblems(selected, triage) : [];

  const pick = (id: string) => {
    setReporting(false);
    const i = d.incidents.find(x => x.id === id);
    setTriage({ harm: String(i?.harm ?? 1), owner: '', note: '' });
    setSelectedId(selectedId === id ? null : id);
  };
  const startReport = () => { setSelectedId(null); setForm({ ...BLANK }); setReporting(true); };
  const set = <K extends keyof IncidentInput>(key: K, value: IncidentInput[K]) => setForm({ ...form, [key]: value });
  const setT = <K extends keyof TriageInput>(key: K, value: TriageInput[K]) => setTriage({ ...triage, [key]: value });
  const report = () => backofficeActions.reportIncident(form, i => {
    setReporting(false);
    setView('open');
    setTriage({ harm: String(i.harm), owner: '', note: '' });
    setSelectedId(i.id);
  });

  return (
    <bo-incidents className="page">
      <PageHead heading="รายงานอุบัติการณ์" source="M12 P2 · รายงานได้โดยไม่ระบุตัวตน · คัดกรองภายใน 24 ชม. เมื่ออันตรายรุนแรงขึ้นไป 72 ชม. สำหรับระดับอื่น · อันตรายรุนแรงขึ้นไปต้องมี RCA ก่อนปิด · ต้นแบบก่อนสัญญาหน้าของ M12 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={startReport}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('แจ้งอุบัติการณ์')}</UiButton>
      </PageHead>

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar">
              <div className="segmented" role="group" aria-label={tx('มุมมอง')}>
                {VIEWS.map(v => <button key={v[0]} type="button" className={cx(view === v[0] && 'active')} aria-pressed={view === v[0]} onClick={() => setView(v[0])}>{tx(v[1])}</button>)}
              </div>
              <select className="ui-input" aria-label={tx('ประเภท')} value={category} onChange={event => setCategory(event.target.value as SafetyCategory | '')}>
                <option value="">{tx('ทุกประเภท')}</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{tx(SAFETY_CATEGORY[c])}</option>)}
              </select>
              <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
            </div>
            <div className="table-wrap">
              <table className="bo-table incidents">
                <thead>
                  <tr>
                    <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                    <th scope="col">{tx('เหตุการณ์')}</th>
                    <th scope="col" className="w-kind">{tx('ประเภท')}</th>
                    <th scope="col" className="w-status">{tx('ระดับอันตราย')}</th>
                    <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(i => (
                    <tr key={i.id} tabIndex={0} className={cx(i.id === selectedId && 'selected')} aria-selected={i.id === selectedId} onClick={() => pick(i.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(i.id); } }}>
                      <td><b>{i.id}</b><div className="secondary">{i.at}</div></td>
                      <td>{tx(i.description)}<div className="secondary">{tx(i.location)}{i.pet && <> · {i.pet}</>} · {tx(reporterOf(i))}</div></td>
                      <td>{tx(SAFETY_CATEGORY[i.category])}</td>
                      <td><span className={`chip ${HARM[i.harm].cls}`}>{tx(HARM[i.harm].label)}</span></td>
                      <td>
                        <span className={`chip ${INCIDENT_STATUS[i.status].cls}`}>{tx(INCIDENT_STATUS[i.status].label)}</span>
                        {i.status === 'reported'
                          ? <div className={cx('secondary', triageLate(i) && 'text-danger')}>{tx(triageLate(i) ? 'เกินกำหนดคัดกรอง' : 'คัดกรองภายใน {due}', { due: triageDue(i) })}</div>
                          : i.rcaId && <div className="secondary">{i.rcaId}</div>}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีอุบัติการณ์ในมุมมองนี้')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="record-rail">
          {reporting ? (
            <div className="panel action-card">
              <b>{tx('แจ้งอุบัติการณ์')}</b>
              <div className="two">
                <label className="field">{tx('เกิดเมื่อ')}<input className="ui-input" type="datetime-local" value={form.at} onChange={event => set('at', event.target.value)} /></label>
                <label className="field">{tx('ประเภท')}
                  <select className="ui-input" value={form.category} onChange={event => set('category', event.target.value as SafetyCategory | '')}>
                    <option value="">{tx('เลือก')}</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{tx(SAFETY_CATEGORY[c])}</option>)}
                  </select>
                </label>
              </div>
              <div className="two">
                <label className="field">{tx('สถานที่')}
                  <select className="ui-input" value={form.location} onChange={event => set('location', event.target.value)}>
                    <option value="">{tx('เลือก')}</option>
                    {SAFETY_PLACES.map(p => <option key={p} value={p}>{tx(p)}</option>)}
                  </select>
                </label>
                <label className="field">{tx('ผู้ป่วย (ถ้ามี)')}<input className="ui-input" value={form.pet} onChange={event => set('pet', event.target.value)} /></label>
              </div>
              <label className="field">{tx('เกิดอะไรขึ้น')}<textarea className="ui-input" rows={3} value={form.description} onChange={event => set('description', event.target.value)}></textarea></label>
              <label className="field">{tx('สิ่งที่ทำทันที')}<textarea className="ui-input" rows={2} value={form.immediateAction} onChange={event => set('immediateAction', event.target.value)}></textarea></label>
              <label className="field">{tx('ระดับอันตราย')}
                <select className="ui-input" value={form.harm} onChange={event => set('harm', event.target.value)}>
                  {HARM_LEVELS.map(h => <option key={h} value={String(h)}>{h} · {tx(HARM[h].label)}</option>)}
                </select>
              </label>
              <label className="check"><input type="checkbox" checked={form.anonymous} onChange={event => set('anonymous', event.target.checked)} />{tx('ไม่ระบุชื่อผู้รายงาน')}</label>
              {form.anonymous && <p className="secondary">{tx('ระบบไม่เก็บชื่อผู้รายงานไว้ทั้งในรายงานและบันทึกตรวจสอบ')}</p>}
              {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
              <div className="two">
                <UiButton variant="secondary" size="sm" type="button" onClick={() => setReporting(false)}>{tx('ยกเลิก')}</UiButton>
                <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={report}>{tx('ส่งรายงาน')}</UiButton>
              </div>
            </div>
          ) : selected ? (() => {
            const i = selected;
            const rca = rcaOf(d, i.rcaId);
            const block = closeBlock(d, i);
            const late = triageLate(i);
            return (
              <div className="panel action-card">
                <b>{i.id} · {tx(SAFETY_CATEGORY[i.category])}</b>
                <span className="secondary">{tx(i.location)}{i.pet && <> · {i.pet}</>} · {tx('เกิดเมื่อ {at}', { at: i.at })}</span>
                <p>{tx(i.description)}</p>
                <div className="sum-row"><span>{tx('สิ่งที่ทำทันที')}</span><span>{tx(i.immediateAction)}</span></div>
                <div className="sum-row"><span>{tx('ผู้รายงาน')}</span><b>{tx(reporterOf(i))}</b></div>
                <div className="sum-row"><span>{tx('ระดับอันตราย')}</span><span className={`chip ${HARM[i.harm].cls}`}>{tx(HARM[i.harm].label)}</span></div>
                {i.source && <div className="sum-row"><span>{tx('ที่มา')}</span><b>{i.source}</b></div>}
                {i.owner && <div className="sum-row"><span>{tx('ผู้รับผิดชอบ')}</span><b>{tx(i.owner)}</b></div>}

                {i.status === 'reported' ? <>
                  <div className="section-title">{tx('คัดกรอง')}</div>
                  <p className={cx('secondary', late && 'text-danger')}>{tx(late ? 'เกินกำหนดคัดกรอง ({due})' : 'คัดกรองภายใน {due}', { due: triageDue(i) })}</p>
                  <div className="two">
                    <label className="field">{tx('ระดับอันตราย')}
                      <select className="ui-input" value={triage.harm} onChange={event => setT('harm', event.target.value)}>
                        {HARM_LEVELS.map(h => <option key={h} value={String(h)}>{h} · {tx(HARM[h].label)}</option>)}
                      </select>
                    </label>
                    <label className="field">{tx('ผู้รับผิดชอบ')}<input className="ui-input" value={triage.owner} onChange={event => setT('owner', event.target.value)} /></label>
                  </div>
                  <label className="field">{tx('เหตุผลการคัดกรอง')}<textarea className="ui-input" rows={2} value={triage.note} onChange={event => setT('note', event.target.value)}></textarea></label>
                  {triageIssues.length > 0 && <ul className="problems">{triageIssues.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
                  <UiButton size="sm" type="button" disabled={triageIssues.length > 0} onClick={() => backofficeActions.triageIncident(i, triage)}>{tx('บันทึกการคัดกรอง')}</UiButton>
                </> : i.status === 'triaged' ? <>
                  <div className="section-title">{tx('RCA')}</div>
                  {rca ? (
                    <div className="sum-row"><Link className="link" to={`/backoffice/quality/rca?id=${rca.id}`}>{rca.id}</Link><span className={`chip ${RCA_STATUS[rca.status].cls}`}>{tx(RCA_STATUS[rca.status].label)}</span></div>
                  ) : <>
                    <p className={cx('secondary', needsRca(i) && 'text-danger')}>{tx(needsRca(i) ? 'อันตรายระดับรุนแรงขึ้นไปต้องมี RCA ก่อนปิด' : 'ยังไม่มี RCA')}</p>
                    <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.openRca(i.id, i.description)}>{tx('เปิด RCA')}</UiButton>
                  </>}
                  {block && <p className="secondary">{tx(block)}</p>}
                  <UiButton size="sm" type="button" disabled={!!block} onClick={() => backofficeActions.closeIncident(i)}>{tx('ปิดอุบัติการณ์')}</UiButton>
                </> : <>
                  <div className="sum-row"><span>{tx('ปิดเมื่อ')}</span><b>{i.closedAt}</b></div>
                  <p className="secondary">{tx(i.outcome ?? '')}</p>
                </>}

                <div className="section-title">{tx('ประวัติ')}</div>
                <ul className="timeline compact">
                  {i.history.map((h, n) => <li key={n} className="tl"><b>{tx(h[2])}</b> · {tx(h[1])}<div className="secondary">{h[0]} · {tx(h[3])}</div></li>)}
                </ul>
              </div>
            );
          })() : (
            <div className="panel action-card">
              <b>{tx('ต้องคัดกรองก่อน')}</b>
              {waiting.map(i => (
                <button key={i.id} type="button" className="sum-row link-row" onClick={() => pick(i.id)}><span>{i.id} · {tx(HARM[i.harm].label)}</span><span className={cx(triageLate(i) && 'text-danger')}>{tx(triageLate(i) ? 'เกินกำหนดคัดกรอง' : triageDue(i))}</span></button>
              ))}
              {!waiting.length && <p className="secondary ok-text">{tx('ไม่มีอุบัติการณ์รอคัดกรอง')}</p>}
              <p className="secondary">{tx('เลือกรายการในตารางเพื่อคัดกรอง เปิด RCA หรือปิด')}</p>
            </div>
          )}
        </aside>
      </div>
    </bo-incidents>
  );
}
