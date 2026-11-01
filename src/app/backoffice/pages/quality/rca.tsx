/* Root cause analysis: five whys at least, the cause they reach, actions with owners and dates, approved by someone outside the team (quality.rca, M12 P2) */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { TODAY } from '../../../clinic/data/model';
import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { actionProblems, approveBlock, NOTE_MIN, RCA_STATUS, rcaSource, submitProblems, WHY_MIN, whyProblem } from '../../data/quality';
import type { Rca, RcaAction } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const BLANK_ACTION = { text: '', owner: '', due: '' };
const RANK: Record<Rca['status'], number> = { review: 0, open: 1, approved: 2 };

export function RcaComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [picked, setPicked] = useState<string | null>(params.get('id'));
  const [why, setWhy] = useState('');
  const [root, setRoot] = useState<string | null>(null);
  const [action, setAction] = useState({ ...BLANK_ACTION });

  const d = store.data;
  const rcas = [...d.rcas].sort((a, b) => RANK[a.status] - RANK[b.status] || b.openedAt.localeCompare(a.openedAt));
  const selected = d.rcas.find(r => r.id === picked) ?? rcas[0] ?? null;
  const whyIssue = whyProblem(why);
  const actionTouched = Object.values(action).some(v => v);
  const actionIssues = actionProblems(action);

  const isLate = (a: RcaAction) => !a.doneAt && a.due < TODAY;
  const late = (r: Rca) => (r.status === 'approved' ? r.actions.filter(isLate) : []);
  const rootChanged = (r: Rca) => root !== null && root.trim() !== r.rootCause && root.trim().length >= NOTE_MIN;
  const pick = (id: string) => { setPicked(id); setWhy(''); setRoot(null); setAction({ ...BLANK_ACTION }); };
  const setA = (key: keyof typeof BLANK_ACTION, value: string) => setAction({ ...action, [key]: value });

  return (
    <bo-rca className="page">
      <PageHead heading="การวิเคราะห์สาเหตุราก" source="M12 P2 · ถามทำไมอย่างน้อย 5 ข้อ · มาตรการต้องมีผู้รับผิดชอบและกำหนดเสร็จ · ผู้อนุมัติต้องไม่ใช่ทีมวิเคราะห์ · ต้นแบบก่อนสัญญาหน้าของ M12 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="panel">
        <div className="table-wrap">
          <table className="bo-table rca-list">
            <thead>
              <tr>
                <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                <th scope="col">{tx('เรื่อง')}</th>
                <th scope="col" className="w-kind num">{tx('ทำไม')}</th>
                <th scope="col" className="w-kind num">{tx('มาตรการ')}</th>
                <th scope="col" className="w-status">{tx('สถานะ')}</th>
              </tr>
            </thead>
            <tbody>
              {rcas.map(r => (
                <tr key={r.id} tabIndex={0} className={cx(r.id === selected?.id && 'selected')} aria-selected={r.id === selected?.id} onClick={() => pick(r.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(r.id); } }}>
                  <td><b>{r.id}</b><div className="secondary">{r.source}</div></td>
                  <td>{tx(r.title)}<div className="secondary">{tx(r.team.join(', '))}</div></td>
                  <td className={cx('num', r.whys.length < WHY_MIN && 'text-danger')}>{r.whys.length}/{WHY_MIN}</td>
                  <td className="num">{r.actions.filter(a => a.doneAt).length}/{r.actions.length}{late(r).length > 0 && <div className="secondary text-danger">{tx('เกินกำหนด {n}', { n: late(r).length })}</div>}</td>
                  <td><span className={`chip ${RCA_STATUS[r.status].cls}`}>{tx(RCA_STATUS[r.status].label)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (() => {
        const r = selected;
        const src = rcaSource(d, r.source);
        const open = r.status === 'open';
        const missing = submitProblems(r);
        const approveIssue = approveBlock(r, store.userName);
        return (
          <div className="record">
            <div className="record-main">
              <div className="panel rca-work">
                <div className="filter-bar">
                  <b>{r.id} · {tx(r.title)}</b>
                  <span className="grow"></span>
                  {src && <Link className="link" to={`${src.link}?id=${r.source}`}>{tx(src.kind)} {r.source}</Link>}
                </div>
                {src && <p className="secondary rca-source">{tx(src.title)}</p>}
                {r.note && open && <p className="notice warn">{tx('ผู้อนุมัติส่งกลับ: {note}', { note: tx(r.note) })}</p>}

                <div className="section-title">{tx('ทำไม (อย่างน้อย {n} ข้อ)', { n: WHY_MIN })}</div>
                <ol className="whys">
                  {r.whys.map((w, n) => <li key={n}><span className="why-n">{tx('ทำไมข้อ {n}', { n: n + 1 })}</span>{tx(w)}</li>)}
                </ol>
                {open && (
                  <div className="rca-add">
                    <input className="ui-input grow" aria-label={tx('ทำไมข้อ {n}', { n: r.whys.length + 1 })} placeholder={tx('ทำไมข้อ {n} — ตอบว่าทำไมข้อก่อนหน้าจึงเกิด', { n: r.whys.length + 1 })} value={why} onChange={event => setWhy(event.target.value)} />
                    <UiButton variant="secondary" size="sm" type="button" disabled={!!whyIssue} onClick={() => { store.addWhy(r, why); setWhy(''); }}>{tx('เพิ่ม')}</UiButton>
                  </div>
                )}

                <div className="section-title">{tx('สาเหตุราก')}</div>
                {open ? <>
                  <textarea className="ui-input" rows={2} aria-label={tx('สาเหตุราก')} value={root ?? r.rootCause} onChange={event => setRoot(event.target.value)}></textarea>
                  <div className="rca-add"><span className="secondary grow">{tx('สาเหตุที่แก้แล้วจะไม่เกิดซ้ำ ไม่ใช่ตัวบุคคล')}</span>
                    <UiButton variant="secondary" size="sm" type="button" disabled={!rootChanged(r)} onClick={() => { store.setRootCause(r, root!); setRoot(null); }}>{tx('บันทึกสาเหตุราก')}</UiButton></div>
                </> : <p>{tx(r.rootCause)}</p>}

                <div className="section-title">{tx('มาตรการ')}</div>
                <div className="table-wrap">
                  <table className="bo-table">
                    <thead><tr><th scope="col">{tx('มาตรการ')}</th><th scope="col" className="w-owner">{tx('ผู้รับผิดชอบ')}</th><th scope="col" className="w-due">{tx('กำหนดเสร็จ')}</th><th scope="col" className="w-status">{tx('สถานะ')}</th></tr></thead>
                    <tbody>
                      {r.actions.map((a, n) => (
                        <tr key={n} className="static">
                          <td>{tx(a.text)}</td>
                          <td>{tx(a.owner)}</td>
                          <td className={cx('num', isLate(a) && 'text-danger')}>{a.due}</td>
                          <td>
                            {a.doneAt ? <span className="chip ok">{tx('เสร็จ {date}', { date: a.doneAt })}</span>
                              : r.status === 'approved' ? <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.completeRcaAction(r, a)}>{tx('บันทึกว่าเสร็จ')}</UiButton>
                                : <span className="chip quiet">{tx('รออนุมัติ RCA')}</span>}
                          </td>
                        </tr>
                      ))}
                      {!r.actions.length && <tr className="static"><td colSpan={4} className="empty">{tx('ยังไม่มีมาตรการ')}</td></tr>}
                    </tbody>
                  </table>
                </div>
                {open && <>
                  <div className="form-grid rca-action">
                    <label className="full">{tx('มาตรการใหม่')}<input className="ui-input" value={action.text} onChange={event => setA('text', event.target.value)} /></label>
                    <label>{tx('ผู้รับผิดชอบ')}<input className="ui-input" value={action.owner} onChange={event => setA('owner', event.target.value)} /></label>
                    <label>{tx('กำหนดเสร็จ')}<input className="ui-input" type="date" min={TODAY} value={action.due} onChange={event => setA('due', event.target.value)} /></label>
                  </div>
                  {actionTouched && actionIssues.length > 0 && <ul className="problems">{actionIssues.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
                  <div className="rca-add"><span className="grow"></span><UiButton variant="secondary" size="sm" type="button" disabled={actionIssues.length > 0} onClick={() => { store.addRcaAction(r, action); setAction({ ...BLANK_ACTION }); }}>{tx('เพิ่มมาตรการ')}</UiButton></div>
                </>}
              </div>
            </div>

            <aside className="record-rail">
              <div className="panel action-card">
                <div className="sum-row"><b>{tx('สถานะ')}</b><span className={`chip ${RCA_STATUS[r.status].cls}`}>{tx(RCA_STATUS[r.status].label)}</span></div>
                <div className="sum-row"><span>{tx('ทีมวิเคราะห์')}</span><span>{tx(r.team.join(', '))}</span></div>
                <div className="sum-row"><span>{tx('เปิดโดย')}</span><span>{tx(r.openedBy)} · {r.openedAt}</span></div>
                {r.submittedBy && <div className="sum-row"><span>{tx('ส่งโดย')}</span><span>{tx(r.submittedBy)} · {r.submittedAt}</span></div>}
                {r.approvedBy && <div className="sum-row"><span>{tx('อนุมัติโดย')}</span><span>{tx(r.approvedBy)} · {r.approvedAt}</span></div>}
                {open ? <>
                  {missing.length > 0 && <ul className="checks">{missing.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
                  <UiButton size="sm" type="button" disabled={missing.length > 0} onClick={() => backofficeActions.submitRca(r)}>{tx('ส่งอนุมัติ')}</UiButton>
                </> : r.status === 'review' ? <>
                  {approveIssue && <p className="secondary">{tx(approveIssue)}</p>}
                  <div className="two">
                    <UiButton variant="secondary" size="sm" type="button" disabled={!!approveIssue} onClick={() => backofficeActions.decideRca(r, false)}>{tx('ส่งกลับ')}</UiButton>
                    <UiButton size="sm" type="button" disabled={!!approveIssue} onClick={() => backofficeActions.decideRca(r, true)}>{tx('อนุมัติ')}</UiButton>
                  </div>
                </> : r.note && <p className="secondary">{tx(r.note)}</p>}
                <div className="section-title">{tx('ประวัติ')}</div>
                <ul className="timeline compact">
                  {[...r.history].reverse().map((h, n) => <li key={n} className="tl"><b>{tx(h[2])}</b> · {tx(h[1])}<div className="secondary">{h[0]} · {tx(h[3])}</div></li>)}
                </ul>
              </div>
            </aside>
          </div>
        );
      })()}
    </bo-rca>
  );
}
