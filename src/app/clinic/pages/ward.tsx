/*
 * The ward: the bed map, and the treatment sheet of the pet picked from it: its drugs against their times, with each
 * dose recorded at the cage, its drips, its obs and the log of what was given (seph1-fe screens/WardMARQueue.tsx
 * ScreenWardBedMap, ScreenMAR, LiveMARBoard, LiveInfusionPanel).
 */
import { lucideBedDouble, lucideCheck, lucideDroplets, lucidePause, lucidePlay, lucidePlus, lucidePrinter, lucideSquare } from '../../icons';
import { cx, NgIcon, UiButton } from '../../user-management/ui';
import { clinicActions } from '../clinic-actions';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import { isControlled } from '../data/dispense';
import { NOW, timeOf, toMin } from '../data/model';
import { outOfRange } from '../data/record';
import type { Patient, Prescription } from '../data/types';
import {
  bedsOf, canGive, DOSE_OUTCOMES, doseLog, dosesWaiting, DUE_WINDOW, infusedTotal, INFUSION_STATUS, inpatients, inWard, marOrders, nextObs,
  sheetTimes, slotState, stayDay, stayLine, wardLoad, WARDS,
} from '../data/ward';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { PetIcon, SafetyChips, SUBTITLE, Toolbar } from '../shared/parts';

const outcomeLabel = (outcome: string) => DOSE_OUTCOMES.find(o => o.value === outcome)?.label ?? outcome;
const outcomeTone = (outcome: string) => DOSE_OUTCOMES.find(o => o.value === outcome)?.tone ?? 'quiet';
const isNow = (time: string) => Math.abs(toMin(time) - toMin(NOW)) <= DUE_WINDOW;

export function WardComponent() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const d = store.data;
  const patients = inpatients(d);
  const load = wardLoad(d);
  const wards = WARDS.map(w => {
    const beds = bedsOf(d, w);
    return { name: w.name, rate: w.rate, beds, taken: beds.filter(b => b.state === 'taken').length };
  });
  /* The sheet shown: the selected pet when it is in a bed, else the first in a bed */
  const sheet: Patient | null = inWard(store.selected) ? store.selected : patients[0] ?? null;
  const orders = sheet ? marOrders(d, sheet) : [];
  const times = sheetTimes(orders);
  const log = sheet ? doseLog(d, sheet) : [];
  const obs = sheet ? nextObs(sheet) : null;
  /* The obs taken since the pet came in, newest first */
  const vitals = sheet ? (sheet.vitals ?? []).filter(v => v.at >= sheet.admission!.at).slice().reverse() : [];

  const waiting = (p: Patient) => {
    const list = dosesWaiting(d, p);
    const late = list.filter(x => x.state === 'late').length;
    return list.length ? { due: list.length - late, late } : null;
  };
  const controlled = (rx: Prescription) => isControlled(rx.drug);

  return (
    <app-clinic-ward className="workspace">
      <Toolbar heading={tx('Ward')} subtitle={(
        <span {...SUBTITLE}>
          {tx('ผู้ป่วยใน {n} ราย', { n: patients.length })}
          {!!load.due && <span className="chip info">{tx('{n} ถึงเวลาให้ยา', { n: load.due })}</span>}
          {!!load.late && <span className="chip danger">{tx('{n} ช้า', { n: load.late })}</span>}
        </span>
      )}>
        <UiButton size="sm" type="button" onClick={() => clinicActions.admit()}><NgIcon svg={lucideBedDouble} aria-hidden="true" />{tx('รับเข้าวอร์ด')}</UiButton>
      </Toolbar>

      <div className="ward-layout">
        {/* The bed map: a press on a bed brings its pet's sheet up */}
        <section className="bed-map" aria-label={tx('ผังเตียง')}>
          {wards.map(ward => (
            <div key={ward.name} className="ward-block">
              <div className="section-title">
                <h2>{tx(ward.name)}<span className="count">{`${ward.taken}/${ward.beds.length}`}</span></h2>
                <span className="secondary">{tx('฿{n}/วัน', { n: ward.rate })}</span>
              </div>
              <div className="beds">
                {ward.beds.map(b => {
                  if (b.state === 'taken') {
                    const w = waiting(b.patient);
                    const active = b.patient.id === sheet?.id;
                    return (
                      <button key={b.bed} type="button" className={cx('bed taken', b.patient.triageCls, active && 'active')} aria-pressed={active} onClick={() => store.select(b.patient)}>
                        <span className="bed-no">{b.bed}</span>
                        <span className="bed-pet"><PetIcon kind={b.patient.kind} /><b>{b.patient.pet}</b></span>
                        <span className="secondary">{tx(b.patient.admission!.reason)}</span>
                        <span className="bed-foot">
                          <span className="secondary">{tx('วันที่ {n}', { n: stayDay(b.patient.admission!) })}</span>
                          {w && <span className={cx('chip', w.late ? 'danger' : 'info')}>{tx(w.late ? '{n} ช้า' : '{n} ถึงเวลา', { n: w.late || w.due })}</span>}
                        </span>
                      </button>
                    );
                  }
                  if (b.state === 'cleaning') {
                    return (
                      <div key={b.bed} className="bed cleaning">
                        <span className="bed-no">{b.bed}</span>
                        <span className="secondary">{tx('รอทำความสะอาด')}</span>
                        <button type="button" className="link" onClick={() => clinicActions.bedCleaned(b.bed)}>{tx('ทำความสะอาดแล้ว')}</button>
                      </div>
                    );
                  }
                  return <div key={b.bed} className="bed free"><span className="bed-no">{b.bed}</span><span className="muted">{tx('ว่าง')}</span></div>;
                })}
              </div>
            </div>
          ))}
        </section>

        {sheet ? (
          <section className="treatment-sheet" aria-labelledby="ward-sheet-title">
            <div className="section-title">
              <h2 id="ward-sheet-title">{`${tx('ตารางให้ยาและการรักษา')} · ${sheet.pet}`}</h2>
              <span className="secondary">{`${tx(stayLine(sheet.admission!))} · ${tx('รับไว้')} ${sheet.admission!.at} · HN ${sheet.hn} · ${sheet.weight}`}</span>
            </div>
            <SafetyChips patient={sheet} onOpened={() => clinicUi.openSheet('patient', { tab: 'alerts' })} />
            <div className="step-actions">
              <UiButton size="sm" type="button" onClick={() => clinicActions.verbalOrder(sheet)}>{tx('รับคำสั่งวาจา')}</UiButton>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.prescribe(sheet)}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('สั่งยาใหม่')}</UiButton>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.printTreatmentSheet(sheet)}><NgIcon svg={lucidePrinter} aria-hidden="true" />{tx('พิมพ์ MAR')}</UiButton>
              <span className="grow"></span>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.leaveWard(sheet)}>{tx('ออกจากวอร์ด')}</UiButton>
            </div>

            {/* Each drug against its times */}
            <div className="section-title">
              <h3>{tx('ยา')}</h3>
              <span className="secondary">{tx('กดช่องที่ถึงเวลาเพื่อบันทึกการให้ยา · ช่วงให้ยา ±{n} นาที', { n: DUE_WINDOW })}</span>
            </div>
            <div className="table-wrap">
              <table className="mini-table mar-table">
                <thead>
                  <tr>
                    <th scope="col">{tx('ยา')}</th>
                    {times.map(time => <th key={time} scope="col" className={cx('num', isNow(time) && 'now')}>{time}</th>)}
                    <th scope="col"><span className="visually-hidden">{tx('การทำงาน')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(rx => (
                    <tr key={rx.id}>
                      <td>
                        <b>{rx.drug}</b>
                        {controlled(rx) && <span className="chip danger">CTRL</span>}
                        {!canGive(rx) && <span className="chip warn">{tx('รอห้องยาตรวจสอบ')}</span>}
                        <div className="secondary">{`${tx(rx.dose)} · ${tx(rx.route)} · ${tx(rx.freq)}`}</div>
                      </td>
                      {times.map(time => {
                        const dose = rx.doses?.find(x => x.slot === time);
                        const state = rx.marTimes?.includes(time) ? slotState(rx, time) : null;
                        return (
                          <td key={time} className={cx('num', isNow(time) && 'now')}>
                            {state === null && <span className="muted" aria-hidden="true">—</span>}
                            {state === 'done' && <span className="chip ok" title={`${dose?.at} · ${tx(dose?.by ?? '')}`}><NgIcon svg={lucideCheck} aria-hidden="true" />{dose?.at}</span>}
                            {state === 'upcoming' && <span className="muted">{time}</span>}
                            {state === 'due' && <button type="button" className="chip info" onClick={() => clinicActions.recordDose(rx, time)}>{tx('ให้ยา')}</button>}
                            {state === 'late' && <button type="button" className="chip danger" onClick={() => clinicActions.recordDose(rx, time)}>{tx('ช้า {n} นาที', { n: toMin(NOW) - toMin(time) })}</button>}
                            {(state === 'held' || state === 'refused' || state === 'missed') && (
                              <span className={`chip ${outcomeTone(dose!.outcome)}`} title={dose?.reason ? tx(dose.reason) : undefined}>{tx(outcomeLabel(dose!.outcome))}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="row-actions">
                        <button type="button" className="link" onClick={() => clinicUi.openSheet('prescription', { id: rx.id })}>{tx('รายละเอียด')}</button>
                        <button type="button" className="link" onClick={() => clinicActions.stopOrder(rx)}>{tx('หยุดยา')}</button>
                      </td>
                    </tr>
                  ))}
                  {!orders.length && <tr><td colSpan={times.length + 2} className="muted">{tx('ยังไม่มีคำสั่งยาในวอร์ด — สั่งยาใหม่หรือรับคำสั่งวาจา')}</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Drips */}
            <div className="section-title">
              <h3><NgIcon svg={lucideDroplets} aria-hidden="true" />{tx('สายน้ำเกลือ (IV / CRI)')}</h3>
              <span className="secondary">{tx('{n} สายที่ให้อยู่', { n: sheet.admission!.lines.filter(l => l.status !== 'stopped').length })}</span>
            </div>
            <div className="table-wrap">
              <table className="mini-table lines-table">
                <thead>
                  <tr>
                    <th scope="col">{tx('สารน้ำ')}</th><th scope="col">{tx('ทาง')}</th><th scope="col" className="num">mL/hr</th>
                    <th scope="col" className="num">{tx('ให้แล้ว (mL)')}</th><th scope="col">{tx('สถานะ')}</th>
                    <th scope="col"><span className="visually-hidden">{tx('การทำงาน')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.admission!.lines.map(line => {
                    const total = infusedTotal(line);
                    return (
                      <tr key={line.id}>
                        <td><b>{line.fluid}</b><div className="secondary">{`${tx('เริ่ม')} ${line.events[0][0]} · ${tx(line.events[0][3])}`}</div></td>
                        <td>{line.route}</td>
                        <td className="num">{line.status === 'stopped' ? '—' : line.rate}</td>
                        <td className="num">{total}</td>
                        <td><span className={`chip ${INFUSION_STATUS[line.status].cls}`}>{tx(INFUSION_STATUS[line.status].label)}</span></td>
                        <td className="row-actions">
                          {line.status !== 'stopped' && (
                            <>
                              <button type="button" className="link" onClick={() => clinicActions.changeRate(line)}>{tx('ปรับอัตรา')}</button>
                              <button type="button" className="link" onClick={() => clinicActions.pauseLine(line)}>
                                <NgIcon svg={line.status === 'paused' ? lucidePlay : lucidePause} aria-hidden="true" />{tx(line.status === 'paused' ? 'ให้ต่อ' : 'พัก')}
                              </button>
                              <button type="button" className="link" onClick={() => clinicActions.stopLine(line, total)}><NgIcon svg={lucideSquare} aria-hidden="true" />{tx('หยุด')}</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!sheet.admission!.lines.length && <tr><td colSpan={6} className="muted">{tx('ยังไม่มีสายน้ำเกลือ')}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="step-actions">
              <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.startInfusion(sheet)}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('เริ่มสายน้ำเกลือ')}</UiButton>
            </div>

            {/* Obs */}
            <div className="section-title">
              <h3>{tx('สัญญาณชีพ')}</h3>
              <span className="secondary">
                {tx('วัดทุก {n} ชม.', { n: sheet.admission!.obsEvery })}
                {obs && <>{` · ${tx('ครั้งถัดไป')} ${obs.at} `}{obs.late && <span className="chip danger">{tx('เลยเวลา')}</span>}</>}
              </span>
            </div>
            <div className="table-wrap">
              <table className="mini-table obs-table">
                <thead>
                  <tr>
                    <th scope="col">{tx('เวลา')}</th><th scope="col" className="num">T (°C)</th><th scope="col" className="num">HR</th>
                    <th scope="col" className="num">RR</th><th scope="col" className="num">{tx('ปวด')}</th><th scope="col">{tx('โดย')}</th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map(v => (
                    <tr key={v.at}>
                      <td>{timeOf(v.at)}</td>
                      <td className={cx('num', outOfRange(sheet, 'temp', v.temp) && 'text-danger')}>{v.temp || '—'}</td>
                      <td className={cx('num', outOfRange(sheet, 'hr', v.hr) && 'text-danger')}>{v.hr || '—'}</td>
                      <td className={cx('num', outOfRange(sheet, 'rr', v.rr) && 'text-danger')}>{v.rr || '—'}</td>
                      <td className="num">{v.pain || '—'}</td>
                      <td>{tx(v.by)}</td>
                    </tr>
                  ))}
                  {!vitals.length && <tr><td colSpan={6} className="muted">{tx('ยังไม่ได้วัดตั้งแต่รับเข้าวอร์ด')}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="step-actions">
              <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.takeObs(sheet)}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('บันทึกสัญญาณชีพ')}</UiButton>
            </div>

            {/* What was given */}
            <div className="section-title"><h3>{tx('บันทึกการให้ยา')}</h3><span className="secondary">{tx('{n} รายการ', { n: log.length })}</span></div>
            <div className="table-wrap">
              <table className="mini-table dose-log">
                <thead>
                  <tr>
                    <th scope="col">{tx('เวลา')}</th><th scope="col">{tx('ยา')}</th><th scope="col">{tx('ผล')}</th>
                    <th scope="col">{tx('เหตุผล')}</th><th scope="col">{tx('โดย')}</th><th scope="col">{tx('พยาน')}</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((x, index) => (
                    <tr key={index}>
                      <td>{x.dose.at}<div className="secondary">{`${tx('กำหนด')} ${x.dose.slot}`}</div></td>
                      <td>{x.rx.drug} {controlled(x.rx) && <span className="chip danger">CTRL</span>}</td>
                      <td><span className={`chip ${outcomeTone(x.dose.outcome)}`}>{tx(outcomeLabel(x.dose.outcome))}</span></td>
                      <td>{x.dose.reason ? tx(x.dose.reason) : '—'}</td>
                      <td>{tx(x.dose.by)}</td>
                      <td>{x.dose.witness ? tx(x.dose.witness) : '—'}</td>
                    </tr>
                  ))}
                  {!log.length && <tr><td colSpan={6} className="muted">{tx('ยังไม่มีการบันทึก')}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="treatment-sheet empty">
            <p className="muted">{tx('ไม่มีสัตว์ป่วยในวอร์ด — กด รับเข้าวอร์ด เพื่อรับสัตว์จากคิวเข้าเตียง')}</p>
          </section>
        )}
      </div>
    </app-clinic-ward>
  );
}
