/* The estimate the owner approves before treatment, and the consent they sign against it (data/estimate.ts) */
import { useState } from 'react';

import { lucideCheck, lucideTriangleAlert } from '../../icons';
import { NgIcon, UiButton } from '../../user-management/ui';
import { clinicActions } from '../clinic-actions';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import { consentItems, estimateFor, isDnr, needsReapproval, SIGNER_RELATIONS } from '../data/estimate';
import { NOW, NURSES, VETS } from '../data/model';
import { baht } from '../data/rail';
import type { Badge } from '../data/types';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { SignaturePad } from '../shared/signature-pad';
import { SheetHead } from './sheet-head';

const range = (min: number, max: number) => (min === max ? baht(min) : `${baht(min)} – ${baht(max)}`);

/* ---- The estimate, worked out from the visit; approved once, approved again when the visit grows past it ---- */
export function EstimateSheet() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const o = store.owner(p);
  const e = estimateFor(store.data, p);
  const approved = p.estimate;
  const reapprove = needsReapproval(p, e);
  const status: Badge = reapprove ? { text: 'ต้องอนุมัติใหม่', cls: 'late' } : approved ? { text: 'อนุมัติแล้ว', cls: 'checked' } : { text: 'รออนุมัติ', cls: 'waiting' };

  const send = () => clinicActions.sendMessage(p, 'ประมาณการค่าใช้จ่าย',
    `เรียนคุณ ${o.name}\nประมาณการค่าใช้จ่ายของ ${p.pet} (${e.no}) อยู่ที่ ${range(e.min, e.max)} (มีอายุ 7 วัน)\nกรุณาตรวจสอบและยืนยันการอนุมัติกับเจ้าหน้าที่`,
    channel => store.mutate(() => {
      if (p.handoff.estimate.state !== 'done') {
        p.handoff.estimate = { state: 'active', note: `ส่งทาง ${channel} แล้ว` };
      }
    }));

  return (
    <cl-estimate-sheet className="contents">
      <SheetHead heading={`Estimate · ${p.pet}`} status={status} sub={tx('{0} · {1} · ต้องอนุมัติก่อนเริ่มหัตถการ', { 0: e.no, 1: o.name })} />
      <div className="sheet-body">
        {reapprove && approved && (
          <div className="safety warn">
            <b><NgIcon svg={lucideTriangleAlert} aria-hidden="true" />{tx('ค่าใช้จ่ายเกินที่เจ้าของอนุมัติไว้')}</b>
            <div className="secondary">{tx('อนุมัติไว้ {0} · ตอนนี้ {1} — ขอให้เจ้าของอนุมัติใหม่ก่อนทำต่อ', { 0: baht(approved.max), 1: baht(e.max) })}</div>
          </div>
        )}
        <div className="section">
          <div className="section-title"><h3>{tx('รายการประมาณการ')}</h3><span className="secondary">{tx('จากคำสั่งตรวจและยาของ visit นี้')}</span></div>
          <table className="mini-table">
            <thead><tr><th scope="col">{tx('รายการ')}</th><th scope="col" className="num">{tx('จำนวน')}</th><th scope="col" className="num">{tx('ต่ำสุด')}</th><th scope="col" className="num">{tx('สูงสุด')}</th></tr></thead>
            <tbody>
              {e.lines.map((line, index) => (
                <tr key={index}><td>{tx(line[0])}</td><td className="num">{tx(line[1])}</td><td className="num">{baht(line[2])}</td><td className="num">{baht(line[3])}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="summary-line total"><span>{tx('รวม')}</span><span>{range(e.min, e.max)}</span></div>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('การอนุมัติ')}</h3></div>
          {approved ? (
            <dl className="data-grid">
              <dt>{tx('ผู้อนุมัติ')}</dt><dd>{approved.approvedBy}</dd>
              <dt>{tx('เมื่อ')}</dt><dd>{`${approved.approvedAt} · ${tx(approved.via)}`}</dd>
              <dt>{tx('ช่วงที่อนุมัติ')}</dt><dd>{range(approved.min, approved.max)}</dd>
            </dl>
          ) : (
            <dl className="data-grid">
              <dt>{tx('ผู้อนุมัติ')}</dt><dd>{o.name}</dd>
              <dt>{tx('ช่องทางส่ง')}</dt><dd>{tx(o.prefer)}</dd>
              <dt>{tx('อายุประมาณการ')}</dt><dd>{tx('7 วัน')}</dd>
            </dl>
          )}
        </div>
      </div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={send}>{tx('ส่งให้เจ้าของ')}</UiButton>
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.printEstimate(p)}>{tx('พิมพ์')}</UiButton>
        <span className="grow"></span>
        {approved && !reapprove ? (
          <UiButton size="sm" type="button" onClick={() => clinicUi.openSheet('consent')}>{tx(p.consentForm ? 'ดูใบยินยอม' : 'ลงนามใบยินยอม')}</UiButton>
        ) : (
          <UiButton size="sm" type="button" onClick={() => clinicActions.approveEstimate(p)}>{tx(reapprove ? 'ขออนุมัติใหม่' : 'อนุมัติ')}</UiButton>
        )}
      </div>
    </cl-estimate-sheet>
  );
}

/* ---- The owner's consent to today's treatment: what it covers, the risks, resuscitation, a signature and a witness ---- */
export function ConsentSheet() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const o = store.owner(p);
  const signed = p.consentForm;
  const dnr = isDnr(p);
  const reapprove = needsReapproval(p, estimateFor(store.data, p));
  const items = consentItems(p.estimate ?? { lines: [] });
  const [risks, setRisks] = useState(false);
  const [costs, setCosts] = useState(false);
  const [cpr, setCpr] = useState(!dnr);
  const [signer, setSigner] = useState(o.name);
  const [relation, setRelation] = useState(SIGNER_RELATIONS[0]);
  const [signature, setSignature] = useState('');
  const [paper, setPaper] = useState(false);
  const [witness, setWitness] = useState('');
  const valid = risks && costs && !!signer.trim() && !!witness && (paper || !!signature);

  const sign = () => {
    const e = p.estimate;
    if (!e || !valid) {
      return;
    }
    store.signConsent(p, {
      at: NOW, signer: signer.trim(), relation, witness, signature: paper ? undefined : signature, cpr,
      estimateNo: e.no, min: e.min, max: e.max, items,
    });
    clinicUi.toast('บันทึกใบยินยอมของ {pet} แล้ว · ลงนามโดย {signer}', { pet: p.pet, signer: signer.trim() });
  };

  return (
    <cl-consent-sheet className="contents">
      <SheetHead heading={`${tx('ใบยินยอมการรักษา')} · ${p.pet}`} status={signed ? { text: 'ลงนามแล้ว', cls: 'checked' } : { text: 'รอลงนาม', cls: 'waiting' }}
        sub={`${o.name} · ${p.hn} · ${p.estimate?.no ?? tx('ยังไม่มีประมาณการที่อนุมัติ')}`} />
      <div className="sheet-body">
        {signed ? (
          <>
            <div className="safety ok">
              <b><NgIcon svg={lucideCheck} aria-hidden="true" />{tx('ลงนามแล้ว {0} · {1} ({2}) · พยาน {3}', { 0: signed.at, 1: signed.signer, 2: tx(signed.relation), 3: tx(signed.witness) })}</b>
            </div>
            <div className="section">
              <div className="section-title"><h3>{tx('การรักษาที่ยินยอม')}</h3></div>
              <ul className="plain-list">{signed.items.map((item, index) => <li key={index}>{tx(item)}</li>)}</ul>
              <p className="sheet-text">{tx('ประมาณการ {0} · {1}', { 0: signed.estimateNo, 1: range(signed.min, signed.max) })}</p>
              <p className="sheet-text">{tx(signed.cpr ? 'ยินยอมให้ช่วยชีวิตเมื่อหัวใจหยุดเต้น (CPR)' : 'ไม่ทำ CPR (DNR)')}</p>
            </div>
            <div className="section">
              <div className="section-title"><h3>{tx('ลายเซ็น')}</h3></div>
              {signed.signature
                ? <img className="sig-image" src={signed.signature} alt={tx('ลายเซ็นของ {0}', { 0: signed.signer })} />
                : <p className="sheet-text">{tx('ลงนามบนกระดาษ — เก็บฉบับจริงในแฟ้ม')}</p>}
            </div>
          </>
        ) : !p.estimate || reapprove ? (
          <div className="safety warn">
            <b><NgIcon svg={lucideTriangleAlert} aria-hidden="true" />{tx(reapprove ? 'ค่าใช้จ่ายเกินที่เจ้าของอนุมัติไว้' : 'ยังไม่ได้อนุมัติประมาณการ')}</b>
            <div className="secondary">{tx('เจ้าของต้องอนุมัติประมาณการก่อนลงนามใบยินยอม')}</div>
          </div>
        ) : (
          <>
            <div className="section">
              <div className="section-title"><h3>{tx('การรักษาที่ขอความยินยอม')}</h3></div>
              <ul className="plain-list">
                {items.map((item, index) => <li key={index}>{tx(item)}</li>)}
                {!items.length && <li>{tx('ตรวจรักษาทั่วไป')}</li>}
              </ul>
              <p className="sheet-text">{tx('ประมาณการ {0} · {1}', { 0: p.estimate.no, 1: range(p.estimate.min, p.estimate.max) })}</p>
            </div>
            <div className="section">
              <div className="section-title"><h3>{tx('ข้อตกลง')}</h3></div>
              <label className="check"><input type="checkbox" checked={risks} onChange={event => setRisks(event.target.checked)} />
                {tx('สัตวแพทย์อธิบายวิธีรักษา ทางเลือก และความเสี่ยง รวมถึงความเสี่ยงของยาซึมและยาสลบแล้ว')}</label>
              <label className="check"><input type="checkbox" checked={costs} onChange={event => setCosts(event.target.checked)} />
                {tx('รับทราบค่าใช้จ่ายตามประมาณการ และโรงพยาบาลจะแจ้งก่อนหากเกิน')}</label>
              <div className="field">
                <label htmlFor="consent-cpr">{tx('เมื่อหัวใจหยุดเต้น')}</label>
                <select className="ui-input" id="consent-cpr" value={cpr ? 'yes' : 'no'} onChange={event => setCpr(event.target.value === 'yes')}>
                  <option value="yes">{tx('ยินยอมให้ช่วยชีวิตเมื่อหัวใจหยุดเต้น (CPR)')}</option>
                  <option value="no">{tx('ไม่ทำ CPR (DNR)')}</option>
                </select>
                {dnr && cpr && <p className="field-error" role="alert">{tx('สัตว์ตัวนี้มี alert DNR — ตรวจกับเจ้าของอีกครั้ง')}</p>}
              </div>
            </div>
            <div className="section">
              <div className="section-title"><h3>{tx('ผู้ลงนาม')}</h3></div>
              <div className="form-12">
                <div className="field">
                  <label htmlFor="consent-signer">{tx('ชื่อผู้ลงนาม')}</label>
                  <input className="ui-input" id="consent-signer" value={signer} onChange={event => setSigner(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="consent-relation">{tx('ความเกี่ยวข้อง')}</label>
                  <select className="ui-input" id="consent-relation" value={relation} onChange={event => setRelation(event.target.value)}>
                    {SIGNER_RELATIONS.map(r => <option key={r} value={r}>{tx(r)}</option>)}
                  </select>
                </div>
                <div className="field full">
                  <span className="field-label">{tx('ลายเซ็น')}</span>
                  {!paper && <SignaturePad label={tx('ช่องลงลายมือชื่อ')} onSigned={setSignature} />}
                  <label className="check"><input type="checkbox" checked={paper} onChange={event => setPaper(event.target.checked)} />
                    {tx('ลงนามบนกระดาษแทน (เก็บฉบับจริงในแฟ้ม)')}</label>
                </div>
                <div className="field">
                  <label htmlFor="consent-witness">{tx('พยาน (เจ้าหน้าที่)')}</label>
                  <select className="ui-input" id="consent-witness" value={witness} onChange={event => setWitness(event.target.value)}>
                    <option value="">{tx('เลือกพยาน')}</option>
                    {[...VETS, ...NURSES].map(w => <option key={w} value={w}>{tx(w)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="sheet-foot">
        {signed ? (
          <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.printConsent(p)}>{tx('พิมพ์ใบยินยอม')}</UiButton>
        ) : !p.estimate || reapprove ? (
          <>
            <span className="grow"></span>
            <UiButton size="sm" type="button" onClick={() => clinicUi.openSheet('estimate')}>{tx('เปิด Estimate')}</UiButton>
          </>
        ) : (
          <>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={!valid} onClick={sign}>{tx('บันทึกการลงนาม')}</UiButton>
          </>
        )}
      </div>
    </cl-consent-sheet>
  );
}
