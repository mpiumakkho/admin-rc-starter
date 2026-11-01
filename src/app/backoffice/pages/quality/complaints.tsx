/* All complaints: the queue by its answer clock, taken from any channel, triaged, talked through and answered (quality.complaints, M28 P2, TAHSA-13) */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  awaitingSignOff, CHANNEL, CHANNELS, complainantOf, COMPLAINT_CATEGORIES, COMPLAINT_CATEGORY, COMPLAINT_SEVERITY, COMPLAINT_STATUS, complaintCounts, complaintProblems,
  complaintTriageDue, type ComplaintInput, isOpen, responseBlock, responseDue, SLA_STATE, slaState, TOPICS,
} from '../../data/quality';
import type { Complaint, ComplaintCategory, ComplaintChannel } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

type View = 'open' | 'all' | 'resolved';
const VIEWS: [View, string][] = [['open', 'ยังไม่ตอบ'], ['all', 'ทั้งหมด'], ['resolved', 'ตอบแล้ว']];
const BLANK: ComplaintInput = { channel: 'line', ownerKey: '', pet: '', anonymous: false, category: 'operational', topic: '', subject: '', description: '' };
const RANK: Record<string, number> = { breached: 0, 'due-soon': 1, triage: 2, 'on-track': 3, met: 4 };
const due = (x: Complaint) => responseDue(x) ?? complaintTriageDue(x);

export function ComplaintsComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [view, setView] = useState<View>('open');
  const [category, setCategory] = useState<ComplaintCategory | ''>('');
  const [channel, setChannel] = useState<ComplaintChannel | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'));
  const [form, setForm] = useState<ComplaintInput>({ ...BLANK });

  const d = store.data;
  const c = complaintCounts(d);
  const rows = d.complaints
    .filter(x => (view === 'all' || (view === 'open') === isOpen(x)) && (!category || x.category === category) && (!channel || x.channel === channel))
    .sort((a, b) => (view === 'open' ? RANK[slaState(a)] - RANK[slaState(b)] : 0) || b.receivedAt.localeCompare(a.receivedAt));
  const selected = d.complaints.find(x => x.id === selectedId) ?? null;
  /* The owners the clinic knows, and their pets, to take a complaint from */
  const owners = Object.keys(store.clinic.data.owners).sort();
  const pets = (store.clinic.data.owners[form.ownerKey]?.pets ?? []).map(p => p.split(' · ')[0]);
  const problems = complaintProblems(form);

  const pick = (id: string) => setSelectedId(selectedId === id ? null : id);
  const set = <K extends keyof ComplaintInput>(key: K, value: ComplaintInput[K]) => setForm({ ...form, [key]: value });
  const receive = () => backofficeActions.receiveComplaint(form, x => { setForm({ ...BLANK }); setView('open'); setSelectedId(x.id); });

  return (
    <bo-complaints className="page">
      <PageHead heading="ข้อร้องเรียนทั้งหมด" source="M28 P2 · TAHSA-13 · รับทุกช่องทาง · คัดกรองภายใน 4 ชม. · ตอบกลับ รุนแรง 24 ชม. ปานกลาง 72 ชม. ต่ำ 7 วัน · ข้อร้องเรียนรุนแรงผู้อำนวยการลงนาม · ต้นแบบก่อนสัญญาหน้าของ M28 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{c.open}</span><span className="kpi-label">{tx('ยังไม่ตอบ')}</span></div>
        <div className={cx('kpi', c.new > 0 && 'warn')} role="listitem"><span className="kpi-value">{c.new}</span><span className="kpi-label">{tx('รอคัดกรอง')}</span></div>
        <div className={cx('kpi', c.dueSoon > 0 && 'warn')} role="listitem"><span className="kpi-value">{c.dueSoon}</span><span className="kpi-label">{tx('ใกล้ครบกำหนดตอบ')}</span></div>
        <div className={cx('kpi', c.breached > 0 && 'danger')} role="listitem"><span className="kpi-value">{c.breached}</span><span className="kpi-label">{tx('เกินกำหนดตอบ')}</span></div>
        <div className={cx('kpi', c.severe > 0 && 'danger')} role="listitem"><span className="kpi-value">{c.severe}</span><span className="kpi-label">{tx('ระดับรุนแรง')}</span></div>
        <div className={cx('kpi', c.signOff > 0 && 'warn')} role="listitem"><span className="kpi-value">{c.signOff}</span><span className="kpi-label">{tx('รอผู้อำนวยการลงนาม')}</span></div>
      </div>

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar">
              <div className="segmented" role="group" aria-label={tx('มุมมอง')}>
                {VIEWS.map(v => <button key={v[0]} type="button" className={cx(view === v[0] && 'active')} aria-pressed={view === v[0]} onClick={() => setView(v[0])}>{tx(v[1])}</button>)}
              </div>
              <select className="ui-input" aria-label={tx('ประเภท')} value={category} onChange={event => setCategory(event.target.value as ComplaintCategory | '')}>
                <option value="">{tx('ทุกประเภท')}</option>
                {COMPLAINT_CATEGORIES.map(k => <option key={k} value={k}>{tx(COMPLAINT_CATEGORY[k])}</option>)}
              </select>
              <select className="ui-input" aria-label={tx('ช่องทางรับเรื่อง')} value={channel} onChange={event => setChannel(event.target.value as ComplaintChannel | '')}>
                <option value="">{tx('ทุกช่องทางรับเรื่อง')}</option>
                {CHANNELS.map(k => <option key={k} value={k}>{tx(CHANNEL[k])}</option>)}
              </select>
              <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
            </div>
            <div className="table-wrap">
              <table className="bo-table complaints">
                <thead>
                  <tr>
                    <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                    <th scope="col">{tx('เรื่อง')}</th>
                    <th scope="col" className="w-kind">{tx('ความรุนแรง')}</th>
                    <th scope="col" className="w-due">{tx('ตอบภายใน')}</th>
                    <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(x => {
                    const sla = slaState(x);
                    return (
                      <tr key={x.id} tabIndex={0} className={cx(x.id === selectedId && 'selected')} aria-selected={x.id === selectedId} onClick={() => pick(x.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(x.id); } }}>
                        <td><b>{x.id}</b><div className="secondary">{x.receivedAt}</div></td>
                        <td>{tx(x.subject)}<div className="secondary">{tx(complainantOf(x))}{x.pet && <> · {x.pet}</>} · {tx(CHANNEL[x.channel])} · {tx(COMPLAINT_CATEGORY[x.category])}</div></td>
                        <td>{x.severity ? <span className={`chip ${COMPLAINT_SEVERITY[x.severity].cls}`}>{tx(COMPLAINT_SEVERITY[x.severity].label)}</span> : <span className="secondary">—</span>}</td>
                        <td className="num">
                          <span className={`chip ${SLA_STATE[sla].cls}`}>{tx(SLA_STATE[sla].label)}</span>
                          <div className="secondary">{x.response?.sentAt ?? due(x)}</div>
                        </td>
                        <td><span className={`chip ${COMPLAINT_STATUS[x.status].cls}`}>{tx(COMPLAINT_STATUS[x.status].label)}</span>{x.handler && <div className="secondary">{tx(x.handler)}</div>}</td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีข้อร้องเรียนในมุมมองนี้')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="record-rail">
          {selected ? (() => {
            const x = selected;
            const sla = slaState(x);
            const pending = awaitingSignOff(x);
            const respondIssue = responseBlock(x);
            return (
              <div className="panel action-card">
                <b>{x.id} · {tx(x.subject)}</b>
                <span className="secondary">{tx(complainantOf(x))}{x.pet && <> · {x.pet}</>} · {tx(CHANNEL[x.channel])} · {x.receivedAt}</span>
                <div className="sum-row"><span>{tx('ประเภท / หัวข้อ')}</span><span>{tx(COMPLAINT_CATEGORY[x.category])} · {tx(x.topic)}</span></div>
                {x.severity && <>
                  <div className="sum-row"><span>{tx('ความรุนแรง')}</span><span className={`chip ${COMPLAINT_SEVERITY[x.severity].cls}`}>{tx(COMPLAINT_SEVERITY[x.severity].label)}</span></div>
                  <div className="sum-row"><span>{tx('ผู้รับผิดชอบ')}</span><b>{tx(x.handler ?? '')}</b></div>
                </>}
                <div className="sum-row"><span>{tx(x.severity ? 'ตอบภายใน' : 'คัดกรองภายใน')}</span><b className={cx(sla === 'breached' && 'text-danger')}>{due(x)}</b></div>
                {pending && <p className="notice warn">{tx('คำตอบรอผู้อำนวยการลงนาม')}</p>}

                <div className="section-title">{tx('การติดต่อ')}</div>
                <ul className="timeline compact">
                  {x.communications.map((m, n) => (
                    <li key={n} className="tl"><b>{tx(m[2] === 'in' ? 'ผู้ร้องเรียน' : 'โรงพยาบาล')}</b> · {tx(m[1])} · {tx(CHANNEL[m[3]])}<div className="secondary">{m[0]}</div><div>{tx(m[4])}</div></li>
                  ))}
                </ul>

                {x.status === 'new' ? (
                  <UiButton size="sm" type="button" onClick={() => backofficeActions.triageComplaint(x)}>{tx('คัดกรอง')}</UiButton>
                ) : isOpen(x) && <>
                  <div className="two">
                    <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.logContact(x)}>{tx('บันทึกการติดต่อ')}</UiButton>
                    {pending
                      ? <UiButton size="sm" type="button" onClick={() => backofficeActions.signOff(x, true)}>{tx('ลงนามคำตอบ')}</UiButton>
                      : <UiButton size="sm" type="button" disabled={!!respondIssue} onClick={() => backofficeActions.respond(x)}>{tx(x.severity === 'severe' ? 'ร่างคำตอบ' : 'ตอบกลับ')}</UiButton>}
                  </div>
                  {respondIssue && !pending && <p className="secondary">{tx(respondIssue)}</p>}
                </>}
                <Link className="link" to={`/backoffice/quality/investigation?id=${x.id}`}>{tx('ไปที่การสอบสวน')}</Link>
              </div>
            );
          })() : (
            <div className="panel action-card">
              <b>{tx('รับข้อร้องเรียน')}</b>
              <div className="two">
                <label className="field">{tx('ช่องทางรับเรื่อง')}
                  <select className="ui-input" value={form.channel} onChange={event => set('channel', event.target.value as ComplaintChannel)}>
                    {CHANNELS.map(k => <option key={k} value={k}>{tx(CHANNEL[k])}</option>)}
                  </select>
                </label>
                <label className="field">{tx('ประเภท')}
                  <select className="ui-input" value={form.category} onChange={event => set('category', event.target.value as ComplaintCategory)}>
                    {COMPLAINT_CATEGORIES.map(k => <option key={k} value={k}>{tx(COMPLAINT_CATEGORY[k])}</option>)}
                  </select>
                </label>
              </div>
              <label className="check"><input type="checkbox" checked={form.anonymous} onChange={event => set('anonymous', event.target.checked)} />{tx('บุคลากรร้องเรียนโดยไม่ระบุตัวตน')}</label>
              {!form.anonymous && (
                <div className="two">
                  <label className="field">{tx('ผู้ร้องเรียน')}
                    <select className="ui-input" value={form.ownerKey} onChange={event => setForm({ ...form, ownerKey: event.target.value, pet: '' })}>
                      <option value="">{tx('เลือก')}</option>
                      {owners.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                  <label className="field">{tx('สัตว์เลี้ยง')}
                    <select className="ui-input" disabled={!pets.length} value={form.pet} onChange={event => set('pet', event.target.value)}>
                      <option value="">{tx('ไม่ระบุ')}</option>
                      {pets.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                </div>
              )}
              <label className="field">{tx('หัวข้อ')}
                <select className="ui-input" value={form.topic} onChange={event => set('topic', event.target.value)}>
                  <option value="">{tx('เลือก')}</option>
                  {TOPICS.map(t => <option key={t} value={t}>{tx(t)}</option>)}
                </select>
              </label>
              <label className="field">{tx('เรื่อง')}<input className="ui-input" value={form.subject} onChange={event => set('subject', event.target.value)} /></label>
              <label className="field">{tx('รายละเอียดตามที่ผู้ร้องเรียนแจ้ง')}<textarea className="ui-input" rows={3} value={form.description} onChange={event => set('description', event.target.value)}></textarea></label>
              {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
              <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={receive}>{tx('รับเรื่อง')}</UiButton>
            </div>
          )}
        </aside>
      </div>
    </bo-complaints>
  );
}
