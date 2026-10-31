/* Writing a prescription with the drug safety check beside it (seph1-fe screens/CDS.tsx, Chart.tsx LiveOrderEntry) */
import { useState } from 'react';

import { lucideCheck, lucideTriangleAlert } from '../../icons';
import { cx, NgIcon, UiButton } from '../../user-management/ui';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import { checkPrescription, overrideNeeded, parseUnits, quantityFor } from '../data/cds';
import { FORMULARY, REASON_MIN, RX_DAYS, RX_FREQS, VETS } from '../data/model';
import { inWard, marTimes } from '../data/ward';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { SheetHead } from './sheet-head';

const round = (n: number) => String(Math.round(n * 100) / 100);
const SEVERITY_LABEL = { block: 'ห้ามใช้ · ต้องให้สัตวแพทย์อาวุโสอนุมัติ', major: 'คำเตือนสำคัญ · ต้องระบุเหตุผล', minor: 'ข้อควรระวัง' };
const fill = (text: string, vars?: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? ''));

/**
 * A new prescription for the selected patient. The dose starts at the middle of the range for the pet's species and
 * weight; every change runs the safety check again. A finding that is major needs a reason to go ahead, a block also a
 * senior vet's sign-off; both go on the prescription for the pharmacy to see.
 */
export function PrescribeSheet() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const [drugName, setDrugName] = useState('');
  const [doseText, setDoseText] = useState('');
  const [freq, setFreq] = useState('วันละ 2 ครั้ง');
  const [days, setDays] = useState('5 วัน');
  /** What was typed into the quantity; empty follows the dose */
  const [qtyText, setQtyText] = useState('');
  const [advice, setAdvice] = useState('');
  const [reason, setReason] = useState('');
  const [senior, setSenior] = useState('');
  const [approved, setApproved] = useState(false);
  /* For a pet in a bed: the ward gives it, from the treatment sheet */
  const [inpatient, setInpatient] = useState(true);
  const admitted = inWard(p);

  const drug = FORMULARY.find(d => d.name === drugName);
  const units = parseUnits(doseText);
  const closed = !!store.noteFor(p).closedAt;
  // Drugs written for this pet today, which a new one may clash with
  const current = store.data.prescriptions.filter(rx => rx.pet === p.pet && rx.owner === store.owner(p).name).map(rx => rx.drug);
  const c = drug ? checkPrescription(p, drug, units, current) : null;
  const need = overrideNeeded(c?.worst ?? null);
  const autoQty = drug && units !== null ? quantityFor(units, freq, days, drug.unit) : '';
  const qty = qtyText || autoQty;
  const seniors = VETS.filter(v => v !== store.userName);
  const dose = c?.findings.find(f => f.kind === 'dose');
  const doseTone = !dose ? 'ok' : dose.severity === 'minor' ? 'warn' : 'danger';
  const doseLabel = !dose ? 'อยู่ในช่วงอ้างอิง' : dose.severity === 'minor' ? 'ต่ำกว่าช่วง' : dose.severity === 'major' ? 'สูงกว่าช่วง' : 'สูงเกิน 2 เท่า';
  const valid = !!drug && !closed && (units !== null || (drug.unit === 'หยด' && !!doseText.trim())) && !!qty.trim()
    && (need === 'none' || reason.trim().length >= REASON_MIN)
    && (need !== 'senior' || (!!senior && approved));

  /** A new drug starts at the middle of its range for this pet */
  const pick = (name: string) => {
    setDrugName(name);
    setQtyText('');
    const next = FORMULARY.find(d => d.name === name);
    const suggested = next ? checkPrescription(p, next, null, current).calc.suggested : null;
    setDoseText(suggested !== null ? round(suggested) : '');
  };

  const submit = () => {
    if (!drug || !c || !valid) {
      return;
    }
    const rx = store.prescribe(p, {
      drug: drug.name, route: drug.route, freq, days, qty: qty.trim(), advice: advice.trim(),
      dose: `${units !== null ? round(units) : doseText.trim()} ${drug.unit}`,
      inpatient: admitted && inpatient,
      mgPerKg: c.calc.askedMgKg !== null ? Math.round(c.calc.askedMgKg * 100) / 100 : undefined,
      cds: c.findings.length
        ? {
          findings: c.findings.map(f => fill(f.text, f.vars)),
          override: need !== 'none' ? reason.trim() : undefined,
          approvedBy: need === 'senior' ? senior : undefined,
        }
        : undefined,
    });
    clinicUi.closeSheet();
    clinicUi.toast(need === 'none' ? 'สั่ง {drug} ให้ {pet} แล้ว · {code} ส่งห้องยาตรวจสอบ' : 'Override CDS และสั่ง {drug} ให้ {pet} แล้ว · {code}',
      { drug: drug.name, pet: p.pet, code: rx.code });
  };

  return (
    <cl-prescribe-sheet className="contents">
      <SheetHead heading={`${tx('สั่งยาใหม่')} · ${p.pet}`} sub={`${tx(p.species)} · ${p.breed} · ${p.weight} · ${tx('ชั่งเมื่อ')} ${p.weightAt}`} />
      <div className="sheet-body">
        {closed && <div className="safety"><b><NgIcon svg={lucideTriangleAlert} aria-hidden="true" />{tx('ปิด encounter แล้ว — สั่งยาเพิ่มไม่ได้')}</b></div>}
        <div className="section">
          <div className="form-12">
            <div className="field full">
              <label htmlFor="rx-drug">{tx('ยา')}</label>
              <select className="ui-input" id="rx-drug" value={drugName} onChange={event => pick(event.target.value)}>
                <option value="">{tx('เลือกยา')}</option>
                {FORMULARY.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            {drug && c && (
              <>
                <div className="field">
                  <label htmlFor="rx-dose">{tx('ขนาดต่อครั้ง ({unit})', { unit: tx(drug.unit) })}</label>
                  <input className="ui-input" id="rx-dose" value={doseText} onChange={event => setDoseText(event.target.value)}
                    placeholder={tx('เช่น 1 หรือ 1/2')} inputMode="decimal" />
                </div>
                <div className="field">
                  <label htmlFor="rx-route">{tx('วิธีให้')}</label>
                  <input className="ui-input" id="rx-route" value={tx(drug.route)} readOnly />
                </div>
                {c.calc.range && c.calc.mg && c.calc.units && (
                  <div className="dose-calc full" role="status">
                    <div>
                      {`${tx('ขนาดอ้างอิง ({0}): {1}–{2} mg/kg', { 0: tx(p.species), 1: c.calc.range[0], 2: c.calc.range[1] })} · `}
                      {tx('{0} kg = {1}–{2} mg = {3}–{4} {5}', {
                        0: c.calc.kg ?? '', 1: round(c.calc.mg[0]), 2: round(c.calc.mg[1]), 3: round(c.calc.units[0]), 4: round(c.calc.units[1]), 5: tx(drug.unit),
                      })}
                    </div>
                    {c.calc.askedMgKg !== null && (
                      <div>
                        {tx('ที่สั่ง: {0} mg = {1} mg/kg', { 0: round(c.calc.askedMg ?? 0), 1: round(c.calc.askedMgKg) })}
                        <span className={`chip ${doseTone}`}>{tx(doseLabel)}</span>
                      </div>
                    )}
                    {c.calc.suggested !== null && c.calc.suggested !== units && (
                      <button type="button" className="link" onClick={() => setDoseText(round(c.calc.suggested!))}>
                        {tx('ใช้ขนาดแนะนำ {0} {1}', { 0: round(c.calc.suggested), 1: tx(drug.unit) })}
                      </button>
                    )}
                  </div>
                )}
                <div className="field short">
                  <label htmlFor="rx-freq">{tx('ความถี่')}</label>
                  <select className="ui-input" id="rx-freq" value={freq} onChange={event => setFreq(event.target.value)}>
                    {RX_FREQS.map(f => <option key={f} value={f}>{tx(f)}</option>)}
                  </select>
                </div>
                <div className="field short">
                  <label htmlFor="rx-days">{tx('ระยะเวลา')}</label>
                  <select className="ui-input" id="rx-days" value={days} onChange={event => setDays(event.target.value)}>
                    {RX_DAYS.map(x => <option key={x} value={x}>{tx(x)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="rx-qty">{tx('จำนวนจ่าย')}</label>
                  <input className="ui-input" id="rx-qty" value={qtyText || tx(autoQty)} onChange={event => setQtyText(event.target.value)} placeholder={tx('เช่น 10 เม็ด')} />
                </div>
                <div className="field full">
                  <label htmlFor="rx-advice">{`${tx('คำแนะนำสำหรับเจ้าของ')} `}<span className="muted">{tx('(ไม่บังคับ)')}</span></label>
                  <textarea className="ui-input" id="rx-advice" rows={2} value={advice} onChange={event => setAdvice(event.target.value)}></textarea>
                </div>
                {admitted && (
                  <label className="check full">
                    <input type="checkbox" checked={inpatient} onChange={event => setInpatient(event.target.checked)} />
                    {tx('ให้ในโรงพยาบาล — ขึ้นตารางให้ยาของวอร์ด เวลา {0}', { 0: marTimes(freq).join(', ') })}
                  </label>
                )}
              </>
            )}
          </div>
        </div>

        {drug && c && (
          <div className="section" aria-live="polite">
            <div className="section-title"><h3>{tx('ผลตรวจความปลอดภัยของยา (CDS)')}</h3></div>
            {c.findings.map((f, index) => (
              <div key={index} className={cx('safety', f.severity === 'minor' && 'warn')}>
                <b><NgIcon svg={lucideTriangleAlert} aria-hidden="true" />{tx(SEVERITY_LABEL[f.severity])}</b>
                <div className="secondary">{tx(f.text, f.vars)}</div>
              </div>
            ))}
            {!c.findings.length && <div className="safety ok"><b><NgIcon svg={lucideCheck} aria-hidden="true" />{tx('ผ่านการตรวจ CDS')}</b></div>}
            {need !== 'none' && (
              <div className="form-12 override">
                <div className="field full">
                  <label htmlFor="rx-reason">{tx('เหตุผลที่ override (≥{n} ตัวอักษร)', { n: REASON_MIN })}</label>
                  <textarea className="ui-input" id="rx-reason" rows={2} value={reason} onChange={event => setReason(event.target.value)}
                    placeholder={tx('เช่น ประโยชน์มากกว่าความเสี่ยง เจ้าของรับทราบแล้ว')}></textarea>
                </div>
                {need === 'senior' && (
                  <>
                    <div className="field">
                      <label htmlFor="rx-senior">{tx('สัตวแพทย์อาวุโสผู้อนุมัติ')}</label>
                      <select className="ui-input" id="rx-senior" value={senior} onChange={event => setSenior(event.target.value)}>
                        <option value="">{tx('เลือกผู้อนุมัติ')}</option>
                        {seniors.map(v => <option key={v} value={v}>{tx(v)}</option>)}
                      </select>
                    </div>
                    <label className="check full">
                      <input type="checkbox" checked={approved} onChange={event => setApproved(event.target.checked)} />
                      {tx('ผู้อนุมัติตรวจทานผลตรวจ CDS และยืนยันการสั่งยานี้แล้ว')}
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicUi.closeSheet()}>{tx('ยกเลิก')}</UiButton>
        <span className="grow"></span>
        <UiButton size="sm" type="button" variant={need === 'none' ? 'primary' : 'danger'} disabled={!valid} onClick={submit}>
          {tx(need === 'none' ? 'สั่งยา' : 'Override และสั่งยา')}
        </UiButton>
      </div>
    </cl-prescribe-sheet>
  );
}
