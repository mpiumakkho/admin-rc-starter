/* Sheets of one record: a result, an order, an appointment, a prescription, and a new order (the design's sheets) */
import { useState } from 'react';

import { lucideCheck, lucideTriangleAlert, lucideUserRound } from '../../icons';
import { cx, NgIcon, UiButton, UiSegmented } from '../../user-management/ui';
import { clinicActions } from '../clinic-actions';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import { ACK_METHODS, isOpenOrder, ORDER_CATALOG, ORDER_FLOW, timeOf } from '../data/model';
import type { Badge, LabResult } from '../data/types';
import { clinicI18n, useClinicI18n } from '../i18n/clinic-i18n';
import { PetIcon } from '../shared/parts';
import { SafetyAlert } from './patient-sheets';
import { SheetHead } from './sheet-head';

/** A list of label and value pairs */
function Timeline({ entries }: { entries: readonly (readonly [string, string])[] }) {
  const { tx } = useClinicI18n();
  return <>{entries.map((entry, index) => <div key={index} className="tl"><b>{entry[0]}</b><div className="secondary">{tx(entry[1])}</div></div>)}</>;
}

/* ---- One result ---- */
export function ResultSheet({ id }: { id: string }) {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const r = store.data.results.find(item => item.id === id);
  if (!r) {
    return <cl-result-sheet className="contents"></cl-result-sheet>;
  }
  const criticalOpen = r.flag === 'critical' && !r.ack;
  const status: Badge = { text: criticalOpen ? 'Critical' : r.ack ? 'Acknowledged' : 'New', cls: criticalOpen ? 'late' : r.ack ? 'checked' : 'waiting' };
  const ackText = (result: LabResult) => {
    const method = ACK_METHODS.find(m => m.value === result.ackMethod)?.label ?? '—';
    return [clinicI18n.t('รับทราบแล้ว'), clinicI18n.t(method), result.ackReadBack ? 'read-back' : '', result.ackAt ?? '', clinicI18n.t(result.ackBy ?? '')]
      .filter(Boolean).join(' · ');
  };
  return (
    <cl-result-sheet className="contents">
      <SheetHead heading={tx(r.name) + ' · ' + r.pet} status={status}
        sub={tx('{0} · รายงาน {1} · สั่งโดย {2}', { 0: tx(r.status), 1: timeOf(r.time), 2: tx(r.by) })} />
      <div className="sheet-body">
        {criticalOpen && (
          <div className="safety">
            <b><NgIcon svg={lucideTriangleAlert} aria-hidden="true" />{tx('CRITICAL VALUE — ต้องแจ้งแพทย์ตามนโยบาย')}</b>
            <div className="secondary">{tx('ค่าวิกฤตยังไม่รับทราบ · ต้องโทรศัพท์ + ยืนยัน read-back ภายใน 30 นาที (ห้าม LINE/SMS อย่างเดียว)')}</div>
          </div>
        )}
        <div className="section">
          <div className="section-title"><h3>{tx('ค่าที่ตรวจได้')}</h3></div>
          <table className="mini-table">
            <thead><tr><th scope="col">{tx('รายการ')}</th><th scope="col">{tx('ค่า')}</th><th scope="col">{tx('ช่วงอ้างอิง')}</th></tr></thead>
            <tbody>
              {r.values.map(value => (
                <tr key={value[0]}>
                  <td>{tx(value[0])}</td>
                  <td>
                    <b className={cx(!!value[3] && 'text-danger')}>{tx(value[1])}</b>
                    {!!value[3] && <span className="visually-hidden">{` ${tx('ผิดปกติ')}`}</span>}
                  </td>
                  <td className="muted">{tx(value[2])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('การแปลผล')}</h3></div>
          <p className="sheet-text">{r.interp ? tx(r.interp) : tx('ยังไม่มีการแปลผล')}</p>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('การรับทราบ (callback)')}</h3></div>
          {r.ack ? (
            <div className="safety ok">
              <b><NgIcon svg={lucideCheck} aria-hidden="true" />{ackText(r)}</b>
              <div className="secondary">{tx(r.ackNote || 'การรับทราบครั้งแรกถือเป็นหลักฐาน แก้ไขไม่ได้')}</div>
            </div>
          ) : (
            <p className="sheet-text">{tx('ยังไม่รับทราบ')}</p>
          )}
        </div>
      </div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.interpret(r)}>{tx(r.interp ? 'แก้การแปลผล' : 'เพิ่มการแปลผล')}</UiButton>
        <UiButton variant="secondary" size="sm" type="button" disabled={criticalOpen} onClick={() => clinicActions.notifyOwner(r)}
          title={criticalOpen ? tx('ค่าวิกฤตต้องรับทราบก่อนแจ้งเจ้าของ') : undefined}>{tx('แจ้งเจ้าของ')}</UiButton>
        <span className="grow"></span>
        <UiButton size="sm" type="button" disabled={r.ack} onClick={() => clinicActions.acknowledge(r)}>{tx(r.ack ? 'รับทราบแล้ว' : 'Acknowledge')}</UiButton>
      </div>
    </cl-result-sheet>
  );
}

/* ---- One order ---- */
export function OrderSheet({ id }: { id: string }) {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const o = store.data.orders.find(item => item.id === id);
  if (!o) {
    return <cl-order-sheet className="contents"></cl-order-sheet>;
  }
  const step = ORDER_FLOW[o.col];
  const encounter = (pet: string) => {
    const p = store.patientByPet(pet);
    if (p) {
      clinicActions.startEncounter(p);
    }
  };
  const status: Badge = {
    text: o.state, cls: o.state === 'Completed' ? 'checked' : o.state === 'Draft' ? 'waiting' : o.state === 'Cancelled' ? 'late' : 'room',
  };
  return (
    <cl-order-sheet className="contents">
      <SheetHead heading={'Order · ' + tx(o.name)} status={status} sub={tx('{0} · {1} · สั่งโดย {2}', { 0: o.pet, 1: o.code, 2: tx(o.by) })} />
      <div className="sheet-body">
        <div className="section">
          <div className="section-title"><h3>{tx('รายละเอียดคำสั่ง')}</h3></div>
          <dl className="data-grid">
            <dt>{tx('ประเภท')}</dt><dd>{tx(o.kind)}</dd>
            <dt>{tx('ความเร่งด่วน')}</dt><dd>{tx(o.priority)}</dd>
            <dt>{tx('แผนกที่รับ')}</dt><dd>{tx(o.dept)}</dd>
            <dt>{tx('เวลาสั่ง')}</dt><dd>{o.time}</dd>
            <dt>{tx('ราคาโดยประมาณ')}</dt><dd>{o.price}</dd>
          </dl>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('สถานะ')}</h3></div>
          <div className="timeline"><Timeline entries={o.trail} /></div>
        </div>
      </div>
      <div className="sheet-foot">
        {isOpenOrder(o) && <UiButton variant="danger-soft" size="sm" type="button" onClick={() => clinicActions.cancelOrder(o)}>{tx('ยกเลิก Order')}</UiButton>}
        <span className="grow"></span>
        {step ? (
          <>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => encounter(o.pet)}>{tx('เปิด Encounter')}</UiButton>
            <UiButton size="sm" type="button" onClick={() => clinicActions.advanceOrder(o)}>{tx(step.label)}</UiButton>
          </>
        ) : (
          <UiButton size="sm" type="button" onClick={() => encounter(o.pet)}>{tx('เปิด Encounter')}</UiButton>
        )}
      </div>
    </cl-order-sheet>
  );
}

const TODAY = '2026-09-24';

/* ---- One appointment ---- */
export function AppointmentSheet({ id }: { id: string }) {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const a = store.data.appointments.find(item => item.id === id);
  if (!a) {
    return <cl-appointment-sheet className="contents"></cl-appointment-sheet>;
  }
  const p = store.data.patients.find(item => item.pet === a.pet && item.ownerKey === a.owner);
  const status: Badge = {
    text: a.state, cls: a.state === 'Confirmed' ? 'checked' : a.state === 'Waitlist' ? 'waiting' : a.state === 'Completed' ? 'done' : 'room',
  };
  return (
    <cl-appointment-sheet className="contents">
      <SheetHead heading={tx('นัดหมาย') + ' · ' + a.pet} status={status} sub={a.date + ' ' + a.time + ' · ' + tx(a.type)} />
      <div className="sheet-body">
        {p && p.alerts.length > 0 && (
          <div className="section">
            {p.alerts.map((alert, index) => <SafetyAlert key={index} alert={alert} />)}
          </div>
        )}
        <div className="section">
          <div className="section-title"><h3>{tx('เจ้าของและสัตว์')}</h3></div>
          <div className="person"><PetIcon kind={a.kind} size="lg" /><div><b>{a.pet}</b><div className="secondary">{a.breed}</div></div></div>
          <div className="person">
            <span className="circle"><NgIcon svg={lucideUserRound} aria-hidden="true" /></span><div><b>{a.owner}</b><div className="secondary">{a.phone}</div></div>
          </div>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('รายละเอียดนัด')}</h3></div>
          <dl className="data-grid">
            <dt>{tx('ประเภท')}</dt><dd>{tx(a.type)}</dd>
            <dt>{tx('เหตุผล')}</dt><dd>{tx(a.reason)}</dd>
            <dt>{tx('ผู้ให้บริการ')}</dt><dd>{tx(a.provider)}</dd>
            <dt>{tx('ห้อง')}</dt><dd>{tx(a.room)}</dd>
            <dt>{tx('ระยะเวลา')}</dt><dd>{tx(a.dur)}</dd>
          </dl>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('การเงิน')}</h3></div>
          <dl className="data-grid">
            <dt>{tx('มัดจำ')}</dt><dd>{a.deposit}</dd>
            <dt>{tx('ประมาณการ')}</dt><dd>{a.est}</dd>
          </dl>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('Visit ก่อนหน้า')}</h3></div>
          {a.prev
            ? <div className="timeline"><div className="tl"><b>{a.prev[0]}</b><div className="secondary">{tx(a.prev[1])}</div></div></div>
            : <p className="muted">{tx('ยังไม่มีประวัติ')}</p>}
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('Reminders')}</h3></div>
          <div className="kv-list">
            {a.reminders.map(reminder => (
              <div key={reminder[0]} className="row-card">
                <span className="grow">{tx(reminder[0])}</span>
                <span className={`chip ${reminder[1]}`}>{tx(reminder[1] === 'ok' ? 'ส่งแล้ว' : 'รอส่ง')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {p && a.date === TODAY && (
        <div className="sheet-foot">
          <span className="grow"></span>
          <UiButton size="sm" type="button" onClick={() => clinicActions.startEncounter(p)}>{tx('เปิด Encounter')}</UiButton>
        </div>
      )}
    </cl-appointment-sheet>
  );
}

/* ---- One prescription; a vet reads it and co-signs a verbal order, the pharmacy dispenses it ---- */
export function PrescriptionSheet({ id }: { id: string }) {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const rx = store.data.prescriptions.find(item => item.id === id);
  if (!rx) {
    return <cl-prescription-sheet className="contents"></cl-prescription-sheet>;
  }
  const draft = rx.verbal && !rx.cosignedBy;
  const status: Badge = draft
    ? { text: 'Verbal · รอเซ็นกำกับ', cls: 'waiting' }
    : { text: rx.state, cls: rx.state === 'Ready' ? 'checked' : rx.state === 'Verify' ? 'waiting' : 'room' };
  const profile = (pet: string) => {
    const p = store.patientByPet(pet);
    if (p) {
      store.select(p);
      clinicUi.openSheet('patient', { tab: 'meds' });
    }
  };
  return (
    <cl-prescription-sheet className="contents">
      <SheetHead heading={tx('ใบสั่งยา') + ' · ' + rx.code} status={status} sub={rx.pet + ' · ' + rx.owner + ' · ' + tx(draft ? 'รับไว้โดย' : 'สั่งโดย') + ' ' + tx(rx.by)} />
      <div className="sheet-body">
        {draft && (
          <div className="safety warn">
            <b><NgIcon svg={lucideTriangleAlert} aria-hidden="true" />{tx('คำสั่งวาจา — ยังไม่มีผล')}</b>
            <div className="secondary">
              {`${tx('พยาบาลรับคำสั่งทางวาจาไว้')} ${rx.orderedAt ?? ''} ${tx('· ไม่ส่งเข้า Dispense และไม่เข้ารายการยาจนกว่าสัตวแพทย์จะเซ็นกำกับ')}`}
            </div>
          </div>
        )}
        <div className="section">
          <div className="section-title"><h3>{tx('รายละเอียดใบสั่งยา')}</h3></div>
          <dl className="data-grid">
            <dt>{tx('ยา')}</dt><dd><b>{rx.drug}</b></dd>
            <dt>{tx('ขนาด')}</dt><dd>{tx(rx.dose)}</dd>
            <dt>{tx('วิธีให้')}</dt><dd>{tx(rx.route)}</dd>
            <dt>{tx('ความถี่')}</dt><dd>{tx(rx.freq)}</dd>
            <dt>{tx('ระยะเวลา')}</dt><dd>{tx(rx.days)}</dd>
            <dt>{tx('จำนวนจ่าย')}</dt><dd>{tx(rx.qty)}</dd>
            <dt>{tx('คำแนะนำสำหรับเจ้าของ')}</dt><dd>{tx(rx.advice)}</dd>
          </dl>
          <p className="secondary">{tx('ห้องยาเป็นผู้ตรวจสอบและจ่ายยา · สัตวแพทย์ดูได้อย่างเดียว')}</p>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('สต็อกตาม batch')}</h3></div>
          <table className="mini-table">
            <thead><tr><th scope="col">Batch</th><th scope="col">{tx('หมดอายุ')}</th><th scope="col">{tx('คงเหลือ')}</th><th scope="col">{tx('ตำแหน่ง')}</th></tr></thead>
            <tbody>
              {rx.stock.map(batch => <tr key={batch[0]}><td>{batch[0]}</td><td>{batch[1]}</td><td>{tx(batch[2])}</td><td>{tx(batch[3])}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('ประวัติการจ่ายยาก่อนหน้า')}</h3></div>
          <div className="timeline">
            <Timeline entries={rx.history} />
            {!rx.history.length && <p className="muted">{tx('ยังไม่เคยจ่ายยานี้')}</p>}
          </div>
        </div>
      </div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={() => profile(rx.pet)}>{tx('Patient med profile')}</UiButton>
        <span className="grow"></span>
        {draft && <UiButton size="sm" type="button" onClick={() => clinicActions.cosign(rx)}>{tx('เซ็นกำกับ')}</UiButton>}
      </div>
    </cl-prescription-sheet>
  );
}

/* ---- A new order from the catalog: saved as a draft or sent ---- */
export function NewOrderSheet() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const [patientId, setPatientId] = useState(() => store.selected.id);
  const [priority, setPriority] = useState('Routine');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const priorities = ['Routine', 'Urgent', 'STAT'].map(value => ({ value, label: tx(value) }));

  const toggle = (itemId: string) => setPicked(current => {
    const next = new Set(current);
    if (!next.delete(itemId)) {
      next.add(itemId);
    }
    return next;
  });

  const save = (send: boolean) => {
    const p = store.data.patients.find(x => x.id === patientId);
    if (!p) {
      return;
    }
    const items = ORDER_CATALOG.filter(item => picked.has(item.id));
    const codes = store.createOrders(p, items, priority, send);
    clinicUi.closeSheet();
    clinicUi.toast(send ? 'ส่ง {n} คำสั่งของ {pet} แล้ว · {codes}' : 'บันทึกร่าง {n} คำสั่งของ {pet} แล้ว · {codes}', { n: codes.length, pet: p.pet, codes: codes.join(', ') });
  };

  return (
    <cl-new-order-sheet className="contents">
      <SheetHead heading={tx('New order')} sub={tx('เลือกผู้ป่วยและรายการตรวจ · บันทึกเป็นร่างหรือส่งคำสั่งทันที')} />
      <div className="sheet-body">
        <div className="section">
          <div className="field">
            <label htmlFor="new-order-patient">{tx('ผู้ป่วย')}</label>
            <select className="ui-input" id="new-order-patient" value={patientId} onChange={event => setPatientId(+event.target.value)}>
              {store.data.patients.map(p => <option key={p.id} value={p.id}>{`${p.pet} · ${p.code} · ${store.owner(p).name}`}</option>)}
            </select>
          </div>
        </div>
        <div className="section">
          <div className="field">
            <span className="field-label" id="new-order-priority">{tx('ความเร่งด่วน')}</span>
            <UiSegmented size="sm" options={priorities} value={priority} onValueChange={setPriority} ariaLabel={tx('ความเร่งด่วน')} />
          </div>
        </div>
        <div className="section">
          <div className="section-title"><h3>{`${tx('รายการตรวจ')} `}<span className="count">{picked.size}</span></h3></div>
          <div className="kv-list" role="group" aria-label={tx('รายการตรวจ')}>
            {ORDER_CATALOG.map(item => (
              <label key={item.id} className={cx('row-card pick', picked.has(item.id) && 'on')}>
                <input type="checkbox" checked={picked.has(item.id)} onChange={() => toggle(item.id)} />
                <span className="grow"><b>{tx(item.name)}</b><div className="secondary">{`${tx(item.kind)} · ${tx(item.dept)}`}</div></span>
                <span className="muted">{item.price}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" disabled={!picked.size} onClick={() => save(false)}>{tx('บันทึกร่าง')}</UiButton>
        <span className="grow"></span>
        <UiButton size="sm" type="button" disabled={!picked.size} onClick={() => save(true)}>{tx('ส่งคำสั่ง')}</UiButton>
      </div>
    </cl-new-order-sheet>
  );
}
