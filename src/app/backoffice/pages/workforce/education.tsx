/* Continuing education: the CE ledger, each person's hours against the hospital's target, and the certificates behind them (workforce.education, M24 P2) */
import { useState, type ChangeEvent } from 'react';

import { TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import type { CeCategory, CeRecord } from '../../data/types';
import { APPROVED_COURSES, catalogCourse, CE_CATEGORY, CE_STATUS, ceProblems, ceReviewBlock, ceSummary, type CeInput, staffOf } from '../../data/workforce';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const CATEGORIES = Object.keys(CE_CATEGORY) as CeCategory[];
const YEAR = TODAY.slice(0, 4);
const blank = (): CeInput => ({ staffId: 'S03', course: '', provider: '', date: TODAY, hours: 0, category: 'clinical' });
const fileName = (event: ChangeEvent<HTMLInputElement>) => event.target.files?.[0]?.name ?? '';

export function EducationComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CeInput>(blank);

  const d = store.data;
  const records = d.ce.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const pending = d.ce.filter(c => c.status === 'pending').length;
  const selected = d.ce.find(c => c.id === selectedId) ?? null;
  const people = ceSummary(d);
  const listed = catalogCourse(form.course.trim());
  const problems = ceProblems(d, listed ? { ...form, hours: listed.hours } : form);
  const name = (c: CeRecord) => staffOf(d, c.staffId)?.name ?? '—';
  const block = (c: CeRecord) => ceReviewBlock(d, c, store.userName);
  const set = <K extends keyof CeInput>(key: K, value: CeInput[K]) => setForm({ ...form, [key]: value });
  const pick = (id: string) => { setCreating(false); setSelectedId(selectedId === id ? null : id); };
  const openCreate = () => { setSelectedId(null); setCreating(true); };
  const create = () => backofficeActions.addCe(listed ? { ...form, hours: listed.hours } : form, record => { setCreating(false); setForm(blank()); setSelectedId(record.id); });

  return (
    <bo-education className="page">
      <PageHead heading="การศึกษาต่อเนื่องและการอบรม" source="M24 P2 · หลักสูตรในรายการที่โรงพยาบาลรับรองนับชั่วโมงทันที · หลักสูตรอื่นรอผู้ตรวจที่ไม่ใช่ผู้เข้าอบรมพร้อมใบรับรอง · ต้นแบบก่อนสัญญาหน้าของ M24 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={openCreate}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('บันทึก CE')}</UiButton>
      </PageHead>

      <div className="panel ce-summary">
        <div className="filter-bar"><b>{tx('ชั่วโมงปีนี้เทียบเป้าหมาย')}</b><span className="secondary grow">{tx('เป้าหมายเป็นของโรงพยาบาล · สัตวแพทย์ 20 · เภสัชกร 15 · พยาบาล 12 ชม./ปี · คนที่เริ่มงานไม่ถึง 3 เดือนยังไม่นับว่าช้า')}</span></div>
        <ul className="ce-progress">
          {people.map(s => (
            <li key={s.staff.id}>
              <div className="sum-row"><span>{tx(s.staff.name)}</span><span className={cx(s.behind && 'text-danger')}>{s.approved} / {s.target} {tx('ชม.')}</span></div>
              <div className="bar" role="img" aria-label={tx('{a} จาก {b} ชั่วโมง', { a: s.approved, b: s.target })}><span className={cx(s.behind && 'behind')} style={{ width: `${s.percent}%` }}></span></div>
              {(s.pending > 0 || s.behind) && (
                <div className="secondary">
                  {s.pending > 0 && tx('รอตรวจ {n} ชม.', { n: s.pending })}
                  {s.pending > 0 && s.behind && ' · '}
                  {s.behind && <span className="text-danger">{tx('ช้ากว่ากำหนดของปี')}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className={cx('split', (selected || creating) && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar"><b>{tx('บันทึก CE')}</b><span className="secondary grow">{tx('ปี {y} · ล่าสุดก่อน · รอตรวจ {n}', { y: YEAR, n: pending })}</span></div>
          <div className="table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th scope="col" className="w-due">{tx('วันที่')}</th>
                  <th scope="col" className="w-owner">{tx('ผู้เข้าอบรม')}</th>
                  <th scope="col">{tx('หลักสูตร / ผู้จัด')}</th>
                  <th scope="col" className="w-amount num">{tx('ชั่วโมง')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map(c => (
                  <tr key={c.id} tabIndex={0} className={cx(c.id === selectedId && 'selected')} aria-selected={c.id === selectedId} onClick={() => pick(c.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(c.id); } }}>
                    <td className="num">{c.date}</td>
                    <td>{tx(name(c))}</td>
                    <td>{tx(c.course)}<div className="secondary">{`${tx(c.provider)} · ${tx(CE_CATEGORY[c.category])}`}{!c.certificate && <> · <span className="text-danger">{tx('ไม่มีใบรับรอง')}</span></>}</div></td>
                    <td className="num">{c.hours}</td>
                    <td><span className={`chip ${CE_STATUS[c.status].cls}`}>{tx(CE_STATUS[c.status].label)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {creating ? (
          <Drawer heading="บันทึก CE" sub="หลักสูตรในรายการนับทันที" onClosed={() => setCreating(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setCreating(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={create}>{tx('บันทึก CE')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('ผู้เข้าอบรม')}
                <select className="ui-input" value={form.staffId} onChange={event => set('staffId', event.target.value)}>
                  {people.map(s => <option key={s.staff.id} value={s.staff.id}>{tx(s.staff.name)}</option>)}
                </select>
              </label>
              <label className="full">{tx('หลักสูตร')}
                <input className="ui-input" list="ce-courses" value={form.course} onChange={event => set('course', event.target.value)} />
                <datalist id="ce-courses">{APPROVED_COURSES.map(c => <option key={c.course} value={c.course}>{c.provider}</option>)}</datalist>
              </label>
              {listed ? (
                <p className="notice ok full">{tx('ในรายการที่รับรอง · {p} · {h} ชม.', { p: tx(listed.provider), h: listed.hours })}</p>
              ) : <>
                <label className="full">{tx('ผู้จัด')}<input className="ui-input" value={form.provider} onChange={event => set('provider', event.target.value)} /></label>
                <label>{tx('ชั่วโมง')}<input className="ui-input" type="number" min="0" step="0.5" value={form.hours || ''} onChange={event => set('hours', Number(event.target.value))} /></label>
                <label>{tx('หมวด')}
                  <select className="ui-input" value={form.category} onChange={event => set('category', event.target.value as CeCategory)}>
                    {CATEGORIES.map(k => <option key={k} value={k}>{tx(CE_CATEGORY[k])}</option>)}
                  </select>
                </label>
              </>}
              <label>{tx('วันที่อบรม')}<input className="ui-input" type="date" value={form.date} onChange={event => set('date', event.target.value)} /></label>
              <label>{tx('ใบรับรอง')}<input className="ui-input" type="file" accept=".pdf,image/*" onChange={event => set('certificate', fileName(event))} /></label>
            </div>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        ) : selected ? (
          <Drawer heading={selected.id} sub={`${tx(name(selected))} · ${tx(CE_STATUS[selected.status].label)}`} onClosed={() => setSelectedId(null)} foot={selected.status === 'pending' ? <>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.reviewCe(selected, 'rejected')}>{tx('ไม่นับชั่วโมง')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={!!block(selected)} onClick={() => backofficeActions.reviewCe(selected, 'approved')}>{tx('นับชั่วโมง')}</UiButton>
          </> : undefined}>
            <dl className="data-grid">
              <dt>{tx('หลักสูตร')}</dt><dd>{tx(selected.course)}</dd>
              <dt>{tx('ผู้จัด')}</dt><dd>{tx(selected.provider)}</dd>
              <dt>{tx('วันที่')}</dt><dd>{`${selected.date} · ${selected.hours} ${tx('ชม.')} · ${tx(CE_CATEGORY[selected.category])}`}</dd>
              <dt>{tx('ใบรับรอง')}</dt><dd>{selected.certificate ?? tx('ยังไม่ได้แนบ')}</dd>
              <dt>{tx('บันทึกโดย')}</dt><dd>{`${tx(selected.enteredBy)} · ${selected.enteredAt}`}</dd>
              {selected.reviewedBy && <><dt>{tx('ตรวจโดย')}</dt><dd>{`${tx(selected.reviewedBy)} · ${selected.reviewedAt}`}{selected.note && ` — ${tx(selected.note)}`}</dd></>}
            </dl>
            {selected.status === 'pending' && !selected.certificate && (
              <label className="field">{tx('แนบใบรับรอง')}<input className="ui-input" type="file" accept=".pdf,image/*" onChange={event => { const f = fileName(event); if (f) { backofficeActions.attachCertificate(selected, f); } }} /></label>
            )}
            {selected.status === 'pending' && block(selected) && <p className="notice warn">{tx(block(selected)!)}</p>}
          </Drawer>
        ) : null}
      </div>
    </bo-education>
  );
}
