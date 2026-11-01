/* Calibration: each device against its frequency, the log with its certificates, and the lapses in it (assets.calibration, M22 P2) */
import { useState } from 'react';
import { Link } from 'react-router';

import { TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  addMonths, CALIBRATION_RESULT, CALIBRATION_STATE, calibrationCompliance, calibrationProblems, type CalibrationInput, type CalibrationState, equipmentOf,
} from '../../data/assets';
import { daysUntil } from '../../data/home';
import type { BackofficeData, CalibrationRecord } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';

const STRIP: CalibrationState[] = ['overdue', 'failed', 'due30', 'scheduled'];
const RESULTS = Object.keys(CALIBRATION_RESULT) as CalibrationRecord['result'][];

function blank(d: BackofficeData, equipmentId: string): CalibrationInput {
  const months = equipmentOf(d, equipmentId)?.calibrationMonths ?? 12;
  return { equipmentId, date: TODAY, by: 'บจก. เมดิแคร์ เวท เอ็นจิเนียริ่ง', result: 'pass', certificate: '', reading: '', nextDue: addMonths(TODAY, months) };
}

export function CalibrationComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const d = store.data;
  const [filter, setFilter] = useState<CalibrationState | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CalibrationInput>(() => blank(d, 'EQ-ICU-MON-03'));

  const c = calibrationCompliance(d);
  const devices = c.rows.filter(r => !filter || r.state === filter).sort((a, b) => (a.last?.nextDue ?? '').localeCompare(b.last?.nextDue ?? ''));
  const ledger = d.calibrations.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const selected = d.calibrations.find(x => x.id === selectedId) ?? null;
  const problems = calibrationProblems(d, form);

  const count = (s: CalibrationState) => c.rows.filter(r => r.state === s).length;
  const name = (r: CalibrationRecord) => equipmentOf(d, r.equipmentId)?.name ?? r.equipmentId;
  const lapsesOf = (r: CalibrationRecord) => c.rows.find(x => x.equipment.id === r.equipmentId)?.lapses ?? [];
  const toggle = (s: CalibrationState) => setFilter(filter === s ? '' : s);
  const pick = (id: string) => { setCreating(false); setSelectedId(selectedId === id ? null : id); };
  const openCreate = () => { setSelectedId(null); setCreating(true); };
  const startFor = (equipmentId: string) => { setForm(blank(d, equipmentId)); openCreate(); };
  const set = <K extends keyof CalibrationInput>(key: K, value: CalibrationInput[K]) => setForm({ ...form, [key]: value });
  // A new date moves the next due date a full cycle on
  const pickDate = (date: string) => {
    const months = equipmentOf(d, form.equipmentId)?.calibrationMonths ?? 12;
    setForm({ ...form, date, nextDue: /^\d{4}-\d{2}-\d{2}$/.test(date) ? addMonths(date, months) : '' });
  };
  const create = () => backofficeActions.addCalibration(form, r => {
    setCreating(false);
    setFilter('');
    setSelectedId(r.id);
  });

  return (
    <bo-calibration className="page">
      <PageHead heading="การสอบเทียบอุปกรณ์" source="M22 P2 · ความถี่ตามที่กำหนดต่ออุปกรณ์ (TAHSA-11) · ผลที่ผ่านต้องมีใบรับรอง · สอบเทียบไม่ผ่านจะหยุดใช้อุปกรณ์ · ต้นแบบก่อนสัญญาหน้าของ M22 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={openCreate}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('บันทึกผลสอบเทียบ')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{c.percent}%</span><span className="kpi-label">{tx('ไม่เกินกำหนด {a} จาก {b} เครื่อง', { a: c.inDate, b: c.required })}</span></div>
        {STRIP.map(s => (
          <button key={s} type="button" role="listitem" onClick={() => toggle(s)}
            className={cx('kpi', filter === s && 'active', (s === 'overdue' || s === 'failed') && count(s) > 0 && 'danger', s === 'due30' && count(s) > 0 && 'warn')}>
            <span className="kpi-value">{count(s)}</span><span className="kpi-label">{tx(CALIBRATION_STATE[s].label)}</span>
          </button>
        ))}
        <div className={cx('kpi', c.lapsed > 0 && 'warn')} role="listitem"><span className="kpi-value">{c.lapsed}</span><span className="kpi-label">{tx('เครื่องที่ประวัติเคยขาดช่วง')}</span></div>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('อุปกรณ์ที่ต้องสอบเทียบ')}</b><span className="secondary grow">{tx('เรียงตามวันครบกำหนด')}</span></div>
        <div className="table-wrap">
          <table className="bo-table calibration">
            <thead>
              <tr>
                <th scope="col">{tx('อุปกรณ์')}</th>
                <th scope="col">{tx('ความถี่')}</th>
                <th scope="col" className="w-due">{tx('ครั้งล่าสุด')}</th>
                <th scope="col" className="w-due">{tx('ครบกำหนด')}</th>
                <th scope="col" className="w-status">{tx('สถานะ')}</th>
                <th scope="col" className="w-kind">{tx('ประวัติ')}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(r => {
                const open = () => (r.last ? pick(r.last.id) : startFor(r.equipment.id));
                return (
                  <tr key={r.equipment.id} tabIndex={0} className={cx(r.last && r.last.id === selectedId && 'selected')} onClick={open} onKeyDown={event => { if (event.key === 'Enter') { open(); } }}>
                    <td><b>{tx(r.equipment.name)}</b><div className="secondary">{r.equipment.id} · {tx(r.equipment.location)}</div></td>
                    <td>{tx('ทุก {n} เดือน', { n: r.equipment.calibrationMonths! })}</td>
                    <td className="num">{r.last?.date ?? '—'}</td>
                    <td className={cx('num', r.state === 'overdue' && 'text-danger')}>{r.last?.nextDue ?? '—'}{r.last && r.state === 'overdue' && <div className="secondary">{tx('เกินกำหนด {n} วัน', { n: -daysUntil(r.last.nextDue) })}</div>}</td>
                    <td><span className={`chip ${CALIBRATION_STATE[r.state].cls}`}>{tx(CALIBRATION_STATE[r.state].label)}</span></td>
                    <td>{r.lapses.length ? <span className="text-danger">{tx('ขาดช่วง {n} ครั้ง', { n: r.lapses.length })}</span> : <span className="secondary">{tx('ครบตามความถี่')}</span>}</td>
                  </tr>
                );
              })}
              {!devices.length && <tr className="static"><td colSpan={6} className="empty">{tx('ไม่มีอุปกรณ์ในสถานะนี้')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cx('split', (selected || creating) && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar"><b>{tx('บันทึกการสอบเทียบ')}</b><span className="secondary grow">{tx('ล่าสุดก่อน')}</span></div>
          <div className="table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col" className="w-due">{tx('วันที่')}</th>
                  <th scope="col">{tx('อุปกรณ์')}</th>
                  <th scope="col" className="w-owner">{tx('ผู้สอบเทียบ')}</th>
                  <th scope="col" className="w-status">{tx('ผล')}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map(r => (
                  <tr key={r.id} tabIndex={0} className={cx(r.id === selectedId && 'selected')} aria-selected={r.id === selectedId} onClick={() => pick(r.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(r.id); } }}>
                    <td><b>{r.id}</b></td>
                    <td className="num">{r.date}</td>
                    <td>{tx(name(r))}<div className="secondary">{r.equipmentId}</div></td>
                    <td>{tx(r.by)}</td>
                    <td><span className={`chip ${CALIBRATION_RESULT[r.result].cls}`}>{tx(CALIBRATION_RESULT[r.result].label)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {creating ? (
          <Drawer heading="บันทึกผลสอบเทียบ" sub="ผลที่ผ่านต้องแนบใบรับรอง" onClosed={() => setCreating(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setCreating(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={create}>{tx('บันทึกผล')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('อุปกรณ์')}
                <select className="ui-input" value={form.equipmentId} onChange={event => setForm({ ...blank(d, event.target.value), date: form.date, by: form.by })}>
                  {c.rows.map(r => <option key={r.equipment.id} value={r.equipment.id}>{`${tx(r.equipment.name)} · ${r.equipment.id}`}</option>)}
                </select>
              </label>
              <label>{tx('วันที่สอบเทียบ')}<input className="ui-input" type="date" value={form.date} onChange={event => pickDate(event.target.value)} /></label>
              <label>{tx('ผล')}
                <select className="ui-input" value={form.result} onChange={event => set('result', event.target.value as CalibrationRecord['result'])}>
                  {RESULTS.map(k => <option key={k} value={k}>{tx(CALIBRATION_RESULT[k].label)}</option>)}
                </select>
              </label>
              <label className="full">{tx('ผู้สอบเทียบ')}<input className="ui-input" value={form.by} onChange={event => set('by', event.target.value)} /></label>
              <label>{tx('ใบรับรอง (ไฟล์)')}<input className="ui-input" placeholder={tx('เช่น CAL-MON03.pdf')} value={form.certificate} onChange={event => set('certificate', event.target.value)} /></label>
              <label>{tx('ครั้งถัดไป')}<input className="ui-input" type="date" value={form.nextDue} onChange={event => set('nextDue', event.target.value)} /></label>
              <label className="full">{tx('ค่าที่วัดได้ / หมายเหตุ')}<input className="ui-input" value={form.reading} onChange={event => set('reading', event.target.value)} /></label>
            </div>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        ) : selected ? (
          <Drawer heading={selected.id} sub={`${tx(name(selected))} · ${selected.date}`} onClosed={() => setSelectedId(null)} foot={<>
            <Link className="link" to={`/backoffice/assets/equipment/${selected.equipmentId}`}>{tx('เปิดรายละเอียดอุปกรณ์')}</Link>
            <span className="grow"></span>
            <UiButton size="sm" type="button" onClick={() => startFor(selected.equipmentId)}>{tx('บันทึกผลครั้งใหม่')}</UiButton>
          </>}>
            <dl className="data-grid">
              <dt>{tx('ผู้สอบเทียบ')}</dt><dd>{tx(selected.by)}</dd>
              <dt>{tx('ผล')}</dt><dd><span className={`chip ${CALIBRATION_RESULT[selected.result].cls}`}>{tx(CALIBRATION_RESULT[selected.result].label)}</span></dd>
              <dt>{tx('ใบรับรอง')}</dt><dd>{selected.certificate ?? tx('ไม่มี')}</dd>
              {selected.reading && <><dt>{tx('ค่าที่วัดได้')}</dt><dd>{tx(selected.reading)}</dd></>}
              <dt>{tx('ครั้งถัดไป')}</dt><dd>{selected.nextDue}</dd>
              <dt>{tx('บันทึกโดย')}</dt><dd>{tx(selected.enteredBy)}</dd>
            </dl>
            {lapsesOf(selected).length > 0 && <>
              <div className="section-title">{tx('ช่วงที่เกินกำหนด')}</div>
              <ul className="checks">{lapsesOf(selected).map(l => <li key={l[0]}>{l[0]} → {l[1]} · {tx('{n} วัน', { n: l[2] })}</li>)}</ul>
            </>}
          </Drawer>
        ) : null}
      </div>
    </bo-calibration>
  );
}
