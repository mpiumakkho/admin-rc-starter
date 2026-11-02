/* Safety culture and M&M: the hospital-wide survey by dimension against the round before, and the mortality and morbidity reviews (quality.culture, M12 P2) */
import { useState } from 'react';

import { TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { dimensionChange, MM_OUTCOME, mmBlock, mmProblems, type MmInput, responseRate, SURVEY_MIN_RATE, surveyBlock } from '../../data/quality';
import type { MmReview } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const BLANK: MmInput = { pet: '', outcome: 'complication', eventDate: TODAY, summary: '', presenter: '', reviewDate: TODAY, incidentId: '' };
const OUTCOMES = Object.keys(MM_OUTCOME) as MmReview['outcome'][];

export function CultureComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [form, setForm] = useState<MmInput>({ ...BLANK });

  const d = store.data;
  const survey = d.surveys[0] ?? null;
  const previous = d.surveys[1];
  const mm = [...d.mm].sort((a, b) => Number(a.status === 'reviewed') - Number(b.status === 'reviewed') || b.reviewDate.localeCompare(a.reviewDate));
  const scheduled = mm.filter(m => m.status === 'scheduled').length;
  const selected = d.mm.find(m => m.id === selectedId) ?? null;
  const problems = mmProblems(d, form);

  const before = (name: string) => previous?.dimensions.find(x => x[0] === name)?.[1];
  const pick = (id: string) => { setScheduling(false); setSelectedId(selectedId === id ? null : id); };
  const startMm = () => { setSelectedId(null); setForm({ ...BLANK }); setScheduling(true); };
  const set = <K extends keyof MmInput>(key: K, value: MmInput[K]) => setForm({ ...form, [key]: value });

  /** The table's pages */
  const pager = usePager(mm);
  return (
    <bo-safety-culture className="page">
      <PageHead heading="วัฒนธรรมความปลอดภัยและ M&M" source="M12 P2 · safety_culture_survey ทั้งโรงพยาบาล ร้อยละคำตอบเชิงบวกต่อมิติ · ทบทวนการเสียชีวิตและภาวะแทรกซ้อน · รายละเอียดแบบสำรวจรอสัญญาของ M12 · ต้นแบบก่อนสัญญาหน้าของ M12 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={startMm}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('นัดทบทวน M&M')}</UiButton>
      </PageHead>

      <div className={cx('split', (scheduling || selected) && 'with-drawer')}>
        <div className="groups">
          {survey && (() => {
            const s = survey;
            const rate = responseRate(s);
            return (
              <div className="panel">
                <div className="filter-bar">
                  <b>{tx('แบบสำรวจรอบ {round}', { round: s.round })}</b>
                  <span className={`chip ${s.status === 'open' ? 'info' : 'quiet'}`}>{tx(s.status === 'open' ? 'เปิดรับคำตอบ' : 'ปิดแล้ว')}</span>
                  <span className="secondary grow">{s.from} → {s.to}</span>
                  {s.status === 'open' && <UiButton variant="secondary" size="sm" type="button" disabled={!!surveyBlock(s)} onClick={() => backofficeActions.closeSurvey(s)}>{tx('ปิดรอบสำรวจ')}</UiButton>}
                </div>
                <div className="ce-progress">
                  <div className="sum-row"><span>{tx('ตอบแล้ว {n}/{all} คน', { n: s.responded, all: s.invited })}</span><b>{rate}%</b></div>
                  <div className="bar" role="img" aria-label={tx('อัตราการตอบ {n}%', { n: rate })}><span className={cx(rate < SURVEY_MIN_RATE && 'behind')} style={{ width: `${rate}%` }}></span></div>
                  <span className="secondary">{tx('ปิดรอบได้เมื่อตอบถึง {n}%', { n: SURVEY_MIN_RATE })}</span>
                </div>
                <div className="table-wrap">
                  <table className="bo-table culture">
                    <thead><tr>
                      <th scope="col">{tx('มิติ')}</th>
                      <th scope="col" className="num w-kind">{tx('เชิงบวก')}</th>
                      <th scope="col" className="num w-kind">{tx('รอบก่อน')}</th>
                      <th scope="col" className="w-status">{tx('เปลี่ยนแปลง')}</th>
                    </tr></thead>
                    <tbody>
                      {s.dimensions.map(x => {
                        const ch = dimensionChange(s, previous, x[0]);
                        const was = before(x[0]);
                        return (
                          <tr key={x[0]} className="static">
                            <th scope="row">{tx(x[0])}<div className="bar"><span className={cx(x[1] < 50 && 'behind')} style={{ width: `${x[1]}%` }}></span></div></th>
                            <td className="num"><b className={cx(x[1] < 50 && 'text-danger')}>{x[1]}%</b></td>
                            <td className="num">{was ?? '—'}{was !== undefined && '%'}</td>
                            <td className={cx(ch !== null && ch < 0 && 'text-danger')}>{ch === null ? '—' : <span>{tx(ch > 0 ? 'เพิ่มขึ้น {n} จุด' : ch < 0 ? 'ลดลง {n} จุด' : 'เท่าเดิม', { n: Math.abs(ch) })}</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="secondary foot-note">{tx('ต่ำกว่า 50% คือมิติที่ต้องปรับปรุง · ผลยังไม่ใช่ข้อสรุปจนกว่าจะปิดรอบ')}</p>
              </div>
            );
          })()}

          <div className="panel">
            <div className="filter-bar"><b>{tx('การทบทวน M&M')}</b><span className="secondary grow">{tx('นัดแล้ว {n} · ทบทวนแล้ว {done}', { n: scheduled, done: mm.length - scheduled })}</span></div>
            <div className="table-wrap">
              <table className="bo-table mm">
                <thead><tr>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col">{tx('เคส')}</th>
                  <th scope="col" className="w-kind">{tx('ผล')}</th>
                  <th scope="col" className="w-due">{tx('วันประชุม')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                </tr></thead>
                <tbody>
                  {pager.rows.map(m => (
                    <tr key={m.id} tabIndex={0} className={cx(m.id === selectedId && 'selected')} aria-selected={m.id === selectedId} onClick={() => pick(m.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(m.id); } }}>
                      <td><b>{m.id}</b><div className="secondary">{m.eventDate}</div></td>
                      <td><b>{m.pet}</b> · {tx(m.summary)}<div className="secondary">{tx('ผู้นำเสนอ {who}', { who: tx(m.presenter) })}{m.incidentId && <> · {m.incidentId}</>}</div></td>
                      <td><span className={`chip ${MM_OUTCOME[m.outcome].cls}`}>{tx(MM_OUTCOME[m.outcome].label)}</span></td>
                      <td className="num">{m.reviewDate}</td>
                      <td><span className={`chip ${m.status === 'reviewed' ? 'ok' : m.reviewDate <= TODAY ? 'warn' : 'info'}`}>{tx(m.status === 'reviewed' ? 'ทบทวนแล้ว' : m.reviewDate <= TODAY ? 'ถึงวันประชุม' : 'นัดแล้ว')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PagerFoot pager={pager} />
          </div>
        </div>

        {scheduling ? (
          <Drawer heading="นัดทบทวน M&M" sub="การเสียชีวิต ภาวะแทรกซ้อน หรือการกลับมารักษาซ้ำ" onClosed={() => setScheduling(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setScheduling(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={() => backofficeActions.scheduleMm(form, () => setScheduling(false))}>{tx('นัดทบทวน')}</UiButton>
          </>}>
            <div className="form-grid">
              <label>{tx('ผู้ป่วย')}<input className="ui-input" value={form.pet} onChange={event => set('pet', event.target.value)} /></label>
              <label>{tx('ผล')}
                <select className="ui-input" value={form.outcome} onChange={event => set('outcome', event.target.value as MmReview['outcome'])}>
                  {OUTCOMES.map(o => <option key={o} value={o}>{tx(MM_OUTCOME[o].label)}</option>)}
                </select>
              </label>
              <label>{tx('วันที่เกิดเหตุ')}<input className="ui-input" type="date" value={form.eventDate} onChange={event => set('eventDate', event.target.value)} /></label>
              <label>{tx('วันประชุม')}<input className="ui-input" type="date" value={form.reviewDate} onChange={event => set('reviewDate', event.target.value)} /></label>
              <label>{tx('ผู้นำเสนอ')}<input className="ui-input" value={form.presenter} onChange={event => set('presenter', event.target.value)} /></label>
              <label>{tx('อุบัติการณ์ (ถ้ามี)')}<input className="ui-input" placeholder={tx('เช่น INC-2609-002')} value={form.incidentId} onChange={event => set('incidentId', event.target.value.trim().toUpperCase())} /></label>
              <label className="full">{tx('สรุปเคส')}<textarea className="ui-input" rows={3} value={form.summary} onChange={event => set('summary', event.target.value)}></textarea></label>
            </div>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        ) : selected ? (() => {
          const m = selected;
          const block = mmBlock(m);
          return (
            <Drawer heading={`${m.id} · ${m.pet}`} sub={tx(MM_OUTCOME[m.outcome].label)} onClosed={() => setSelectedId(null)} foot={<>
              <span className="grow"></span>
              {m.status === 'scheduled' && <UiButton size="sm" type="button" disabled={!!block} onClick={() => backofficeActions.recordMm(m)}>{tx('บันทึกผลทบทวน')}</UiButton>}
            </>}>
              <p>{tx(m.summary)}</p>
              <dl className="data-grid">
                <dt>{tx('วันที่เกิดเหตุ')}</dt><dd>{m.eventDate}</dd>
                <dt>{tx('ผู้นำเสนอ')}</dt><dd>{tx(m.presenter)}</dd>
                <dt>{tx('วันประชุม')}</dt><dd>{m.reviewDate}</dd>
                {m.incidentId && <><dt>{tx('อุบัติการณ์')}</dt><dd>{m.incidentId}</dd></>}
                {m.status === 'reviewed' && <>
                  <dt>{tx('ผู้เข้าประชุม')}</dt><dd>{tx('{n} คน', { n: m.attendees ?? 0 })}</dd>
                  <dt>{tx('สิ่งที่เรียนรู้')}</dt><dd>{tx(m.learning ?? '')}</dd>
                </>}
              </dl>
              {m.status === 'scheduled' && block && <p className="secondary">{tx(block)}</p>}
            </Drawer>
          );
        })() : null}
      </div>
    </bo-safety-culture>
  );
}
