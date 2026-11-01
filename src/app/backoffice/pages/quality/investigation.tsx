/* Complaint investigation: the cases being looked into, what was found and what it rests on, the RCA it may open in M12, the answer and its sign-off, and the trail (quality.investigation, M28 P2) */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  awaitingSignOff, CHANNEL, complainantOf, COMPLAINT_SEVERITY, COMPLAINT_STATUS, escalateBlock, INCIDENT_STATUS, NEAR_MISS_STATUS, RCA_STATUS, responseBlock, responseDue, SLA_STATE,
  signOffBlock, slaState,
} from '../../data/quality';
import type { BackofficeData, Complaint } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const SEVERITY_RANK = { severe: 0, moderate: 1, low: 2 };

/** What the complaint is linked to in M12, with where each stands */
function linksOf(d: BackofficeData, x: Complaint) {
  return x.links.map(id => {
    const n = d.nearMisses.find(r => r.id === id);
    if (n) {
      return { id, path: '/backoffice/quality/near-miss', ...NEAR_MISS_STATUS[n.status] };
    }
    const i = d.incidents.find(r => r.id === id);
    if (i) {
      return { id, path: '/backoffice/quality/incidents', ...INCIDENT_STATUS[i.status] };
    }
    const r = d.rcas.find(a => a.id === id);
    return { id, path: '/backoffice/quality/rca', ...(r ? RCA_STATUS[r.status] : { label: '—', cls: 'quiet' }) };
  });
}

export function InvestigationComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [picked, setPicked] = useState<string | null>(params.get('id'));

  const d = store.data;
  /* Triaged and not yet answered, and the one asked for by its number whatever its state */
  const rows = d.complaints.filter(x => ((x.status === 'triaged' || x.status === 'investigating') && x.severity) || x.id === picked)
    .sort((a, b) => SEVERITY_RANK[a.severity ?? 'low'] - SEVERITY_RANK[b.severity ?? 'low'] || (responseDue(a) ?? '').localeCompare(responseDue(b) ?? ''));
  const selected = d.complaints.find(x => x.id === picked) ?? rows[0] ?? null;

  return (
    <bo-investigation className="page">
      <PageHead heading="การสอบสวนข้อร้องเรียน" source="M28 P2 · สอบสวนเป็นขั้นตอนพร้อมบันทึกตรวจสอบ · เชื่อม RCA ของ M12 · ข้อร้องเรียนรุนแรงผู้อำนวยการลงนามคำตอบ ผู้ร่างลงนามเองไม่ได้ · ต้นแบบก่อนสัญญาหน้าของ M28 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar"><b>{tx('อยู่ระหว่างสอบสวน')}</b><span className="secondary grow">{tx('{n} รายการ · รุนแรงและใกล้ครบกำหนดก่อน', { n: rows.length })}</span></div>
            <div className="table-wrap">
              <table className="bo-table complaints">
                <thead>
                  <tr>
                    <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                    <th scope="col">{tx('เรื่อง')}</th>
                    <th scope="col" className="w-kind">{tx('ความรุนแรง')}</th>
                    <th scope="col" className="w-status">{tx('ผลสอบสวน')}</th>
                    <th scope="col" className="w-due">{tx('ตอบภายใน')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(x => {
                    const sla = slaState(x);
                    return (
                      <tr key={x.id} tabIndex={0} className={cx(x.id === selected?.id && 'selected')} aria-selected={x.id === selected?.id} onClick={() => setPicked(x.id)} onKeyDown={event => { if (event.key === 'Enter') { setPicked(x.id); } }}>
                        <td><b>{x.id}</b><div className="secondary">{tx(x.handler ?? '')}</div></td>
                        <td>{tx(x.subject)}<div className="secondary">{tx(complainantOf(x))}{x.links.length > 0 && <> · {x.links.join(', ')}</>}</div></td>
                        <td>{x.severity && <span className={`chip ${COMPLAINT_SEVERITY[x.severity].cls}`}>{tx(COMPLAINT_SEVERITY[x.severity].label)}</span>}</td>
                        <td>{tx(awaitingSignOff(x) ? 'รอลงนาม' : x.findings ? 'บันทึกผลแล้ว' : 'ยังไม่บันทึก')}</td>
                        <td className="num"><span className={`chip ${SLA_STATE[sla].cls}`}>{tx(SLA_STATE[sla].label)}</span><div className="secondary">{responseDue(x) ?? '—'}</div></td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีข้อร้องเรียนที่อยู่ระหว่างสอบสวน')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="record-rail">
          {selected ? (() => {
            const x = selected;
            const pending = awaitingSignOff(x);
            const respondIssue = responseBlock(x);
            const signIssue = signOffBlock(x, store.userName);
            const escalateIssue = escalateBlock(x);
            const links = linksOf(d, x);
            const hasRca = x.links.some(l => l.startsWith('RCA-'));
            return (
              <div className="panel action-card">
                <b>{x.id} · {tx(x.subject)}</b>
                <span className="secondary">{tx(complainantOf(x))}{x.pet && <> · {x.pet}</>} · {tx(CHANNEL[x.channel])} · {tx(COMPLAINT_STATUS[x.status].label)}</span>

                <div className="section-title">{tx('1. สิ่งที่ผู้ร้องเรียนแจ้ง')}</div>
                <p>{tx(x.description)}</p>

                <div className="section-title">{tx('2. ผลสอบสวน')}</div>
                <p className={cx(!x.findings && 'secondary')}>{tx(x.findings ?? 'ยังไม่บันทึกผลสอบสวน')}</p>
                {!x.response?.sentAt && <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.recordFindings(x)}>{tx(x.findings ? 'แก้ผลสอบสวน' : 'บันทึกผลสอบสวน')}</UiButton>}

                <div className="section-title">{tx('3. เชื่อมโยงความปลอดภัย (M12)')}</div>
                {links.map(l => (
                  <div key={l.id} className="sum-row"><Link className="link" to={`${l.path}?id=${l.id}`}>{l.id}</Link><span className={`chip ${l.cls}`}>{tx(l.label)}</span></div>
                ))}
                {!links.length && <p className="secondary">{tx('ยังไม่เชื่อมกับเหตุเกือบพลาด อุบัติการณ์ หรือ RCA')}</p>}
                {!hasRca && <>
                  <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.openRca(x.id, x.subject)}>{tx('เปิด RCA')}</UiButton>
                  {x.severity === 'severe' && <p className="secondary">{tx('ข้อร้องเรียนรุนแรงขออนุมัติเปิด RCA ได้ที่รายการอนุมัติ หรือเปิดที่นี่')}</p>}
                </>}

                <div className="section-title">{tx('4. คำตอบ')}</div>
                {x.response && <>
                  <p>{tx(x.response.text)}</p>
                  <div className="sum-row"><span>{tx('ร่างโดย')}</span><span>{tx(x.response.draftedBy)} · {x.response.draftedAt}</span></div>
                  {x.response.signedOffBy && <div className="sum-row"><span>{tx('ลงนามโดย')}</span><span>{tx(x.response.signedOffBy)} · {x.response.signedOffAt}</span></div>}
                  {x.response.sentAt && <div className="sum-row"><span>{tx('ส่งคำตอบเมื่อ')}</span><span>{x.response.sentAt}</span></div>}
                </>}
                {pending ? <>
                  {signIssue && <p className="secondary">{tx(signIssue)}</p>}
                  <div className="two">
                    <UiButton variant="secondary" size="sm" type="button" disabled={!!signIssue} onClick={() => backofficeActions.signOff(x, false)}>{tx('ส่งกลับไปแก้')}</UiButton>
                    <UiButton size="sm" type="button" disabled={!!signIssue} onClick={() => backofficeActions.signOff(x, true)}>{tx('ลงนามและส่ง')}</UiButton>
                  </div>
                </> : !x.response && <>
                  {respondIssue && <p className="secondary">{tx(respondIssue)}</p>}
                  <UiButton size="sm" type="button" disabled={!!respondIssue} onClick={() => backofficeActions.respond(x)}>{tx(x.severity === 'severe' ? 'ร่างคำตอบ' : 'ตอบกลับ')}</UiButton>
                </>}

                <div className="section-title">{tx('5. หน่วยงานกำกับ')}</div>
                {x.escalation ? (
                  <p>{tx('ส่งถึง{body}เมื่อ {at}', { body: tx(x.escalation.body), at: x.escalation.at })}<span className="secondary"> · {tx(x.escalation.reason)}</span></p>
                ) : <>
                  <UiButton variant="secondary" size="sm" type="button" disabled={!!escalateIssue} onClick={() => backofficeActions.escalateComplaint(x)}>{tx('ส่งหน่วยงานกำกับ')}</UiButton>
                  {escalateIssue && <p className="secondary">{tx(escalateIssue)}</p>}
                </>}

                <div className="section-title">{tx('บันทึกตรวจสอบการสอบสวน')}</div>
                <ul className="timeline compact">
                  {x.history.map((h, n) => <li key={n} className="tl"><b>{tx(h[2])}</b> · {tx(h[1])}<div className="secondary">{h[0]} · {tx(h[3])}</div></li>)}
                </ul>
              </div>
            );
          })() : (
            <div className="panel action-card"><p className="secondary">{tx('เลือกข้อร้องเรียนในตารางเพื่อสอบสวน')}</p></div>
          )}
        </aside>
      </div>
    </bo-investigation>
  );
}
