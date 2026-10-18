/* The selected patient's sheets: quick view, patient, owner, notes, results, estimate (the design's sheets/index.tsx) */
import { useState } from 'react';

import { lucideCheck, lucideChevronRight, lucideUserRound } from '../../icons';
import { cx, NgIcon, UiButton } from '../../user-management/ui';
import { clinicActions, clinicNavigate } from '../clinic-actions';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import { ALERT_META, locOf, STAGES, stageIndex, stageMinutes, statusOf, timeOf } from '../data/model';
import type { ClinicalAlert, Patient } from '../data/types';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { ALERT_ICONS } from '../shared/icons';
import { PetIcon, VStepper } from '../shared/parts';
import { SheetHead } from './sheet-head';

/** The patient's sections, in the order of the context rail */
export const PATIENT_TABS = [
  { id: 'alerts', label: 'Clinical alerts' }, { id: 'overview', label: 'Patient summary' }, { id: 'problems', label: 'Problem list' },
  { id: 'meds', label: 'Medications' }, { id: 'vaccines', label: 'Vaccines / reminders' }, { id: 'visits', label: 'Visit history' },
  { id: 'docs', label: 'Documents' },
];

/** One clinical alert, as the sheets show it */
export function SafetyAlert({ alert }: { alert: ClinicalAlert }) {
  const { tx } = useClinicI18n();
  return (
    <div className={cx('safety', ALERT_META[alert.type].cls === 'warn' && 'warn')}>
      <b><NgIcon svg={ALERT_ICONS[alert.type]} aria-hidden="true" />{tx(alert.label)}</b>
      {alert.detail && <div className="secondary">{tx(alert.detail)}</div>}
    </div>
  );
}

/* ---- Queue: the visit at a glance ---- */
export function VisitSheet() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const o = store.owner(p);
  const stage = STAGES[stageIndex(p)].label;
  return (
    <cl-visit-sheet className="contents">
      <SheetHead heading={'Quick view · ' + p.pet} status={statusOf(p)}
        sub={tx('{code} · เวลานัด {time} · อยู่ขั้นตอน {stage} มาแล้ว {m} นาที', { code: p.code, time: p.time, stage: tx(stage), m: stageMinutes(p) })} />
      <div className="sheet-body">
        <div className="section">
          <div className="section-title">
            <h3>{tx('Clinical alerts')}</h3>
            {p.alerts.length > 0 && <button type="button" className="link" onClick={() => clinicUi.openSheet('patient', { tab: 'alerts' })}>{tx('ดูทั้งหมด')}</button>}
          </div>
          {p.alerts.map((alert, index) => <SafetyAlert key={index} alert={alert} />)}
          {!p.alerts.length && (
            <div className="safety ok">
              <b><NgIcon svg={lucideCheck} aria-hidden="true" />{tx('ไม่มี clinical alert')}</b>
              <div className="secondary">{tx('ไม่มีประวัติแพ้ที่บันทึก · ทบทวน {0} {1}', { 0: p.allergyReview?.at ?? '—', 1: tx(p.allergyReview?.by ?? '') })}</div>
            </div>
          )}
        </div>
        <div className="section">
          <div className="section-title">
            <h3>{tx('ผู้ป่วยและเจ้าของ')}</h3>
            <button type="button" className="link" onClick={() => clinicUi.openSheet('owner')}>
              {`${tx('Owner sheet')} `}<NgIcon svg={lucideChevronRight} aria-hidden="true" />
            </button>
          </div>
          <div className="person">
            <PetIcon kind={p.kind} size="lg" />
            <div>
              <b>{p.pet}</b><span className="muted">{`· ${p.hn}`}</span>
              <div className="secondary">{`${tx(p.species)} · ${p.breed} · ${tx(p.sex)} · ${tx(p.age)} · ${p.weight}`}</div>
            </div>
          </div>
          <div className="person">
            <span className="circle"><NgIcon svg={lucideUserRound} aria-hidden="true" /></span>
            <div><b>{o.name}</b><div className="secondary">{`${o.phone} · ${tx(o.prefer)}`}</div></div>
          </div>
        </div>
        <div className="section">
          <div className="section-title">
            <h3>{tx('ขั้นตอนและตำแหน่ง')}</h3>
            <button type="button" className="link" onClick={() => clinicActions.moveStage(p)}>{tx('ย้ายขั้นตอน')}</button>
          </div>
          <VStepper patient={p} />
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('Visit')}</h3></div>
          <dl className="data-grid">
            <dt>{tx('Chief complaint')}</dt><dd>{tx(p.chief)}</dd>
            <dt>{tx('Triage')}</dt><dd><span className={`chip ${p.triageCls}`}>{tx(p.triage)}</span></dd>
            <dt>{tx('เวลานัด')}</dt><dd>{p.time}</dd>
            <dt>{tx('ตำแหน่งปัจจุบัน')}</dt><dd>{tx(locOf(p))}</dd>
            <dt>{tx('สัตวแพทย์')}</dt><dd>{tx(p.vet)}</dd>
            <dt>{tx('พยาบาล')}</dt><dd>{tx(p.nurse)}</dd>
          </dl>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('Pending tasks')}</h3></div>
          <div className="kv-list">
            {p.tasks.map(task => (
              <label key={task} className="check">
                <input type="checkbox" checked={p.tasksDone.includes(task)} onChange={event => store.toggleTask(p, task, event.target.checked)} />
                {` ${tx(task)}`}
              </label>
            ))}
            {!p.tasks.length && <p className="muted">{tx('ไม่มีงานค้าง')}</p>}
          </div>
        </div>
      </div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.callOwner(p)}>{tx('โทรหาเจ้าของ')}</UiButton>
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.assign(p)}>{tx('Assign')}</UiButton>
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.moveStage(p)}>{tx('ย้ายขั้นตอน')}</UiButton>
        <span className="grow"></span>
        {stageIndex(p) > 0 && <UiButton size="sm" type="button" onClick={() => clinicActions.startEncounter(p)}>{tx('Start encounter')}</UiButton>}
      </div>
    </cl-visit-sheet>
  );
}

/** A row of a list in a sheet: a name and a line under it, then what is at its end */
function RowCard({ name, detail, children }: { name: string; detail: string; children?: React.ReactNode }) {
  return (
    <div className="row-card">
      <span className="grow"><b>{name}</b><div className="secondary">{detail}</div></span>
      {children}
    </div>
  );
}

/* ---- The patient's record, by section ---- */
export function PatientSheet({ tab = 'overview' }: { tab?: string }) {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;

  const body = (() => {
    switch (tab) {
      case 'alerts':
        return (
          <div className="section">
            <div className="section-title"><h3>{`${tx('Clinical alerts')} (${p.alerts.length})`}</h3></div>
            {p.alerts.map((alert, index) => [
              <SafetyAlert key={`a${index}`} alert={alert} />,
              alert.type === 'allergy' && (
                <div key={`m${index}`} className="secondary alert-meta">
                  {alert.recordedBy && <span>{`${tx('บันทึกโดย')} ${tx(alert.recordedBy)}`}</span>}
                  {alert.verifiedBy && (
                    <span className="chip ok">
                      <NgIcon svg={lucideCheck} aria-hidden="true" />{`${tx('ยืนยันแล้ว ·')} ${tx(alert.verifiedBy)} ${alert.verifiedAt ?? ''}`}
                    </span>
                  )}
                </div>
              ),
            ])}
            {!p.alerts.length && (
              <div className="safety ok">
                <b><NgIcon svg={lucideCheck} aria-hidden="true" />{tx('ไม่มี clinical alert')}</b>
                <div className="secondary">{tx('ยังไม่พบ handling precaution, DNR หรือ isolation')}</div>
              </div>
            )}
            <p className="secondary">{tx('Alert เหล่านี้แสดงถาวรบน patient banner และในแถวคิว ไม่ถูกซ่อนไว้ใน sheet เท่านั้น')}</p>
          </div>
        );
      case 'overview':
        return (
          <>
            <div className="section">
              <div className="section-title"><h3>{tx('ตัวตนผู้ป่วย')}</h3></div>
              <dl className="data-grid">
                <dt>{tx('Species')}</dt><dd>{tx(p.species)}</dd>
                <dt>{tx('Breed')}</dt><dd>{p.breed}</dd>
                <dt>{tx('Sex')}</dt><dd>{tx(p.sex)}</dd>
                <dt>{tx('Age')}</dt><dd>{tx(p.age)}</dd>
                <dt>{tx('น้ำหนักล่าสุด')}</dt><dd><b>{p.weight}</b><span className="muted">{`${tx('(ชั่ง')} ${p.weightAt})`}</span></dd>
                <dt>{tx('Microchip')}</dt><dd>{tx(p.microchip)}</dd>
                <dt>{tx('Blood type')}</dt><dd>{tx(p.blood)}</dd>
              </dl>
            </div>
            <div className="section">
              <div className="section-title"><h3>{tx('Visit ปัจจุบัน')}</h3></div>
              <dl className="data-grid">
                <dt>{tx('เหตุผลที่มา')}</dt><dd>{tx(p.reason)}</dd>
                <dt>{tx('Triage')}</dt><dd><span className={`chip ${p.triageCls}`}>{tx(p.triage)}</span></dd>
                <dt>{tx('ตำแหน่งปัจจุบัน')}</dt><dd>{tx(locOf(p))}</dd>
                <dt>{tx('สัตวแพทย์')}</dt><dd>{tx(p.vet)}</dd>
              </dl>
            </div>
            <div className="section">
              <div className="section-title">
                <h3>{tx('Patient note')}</h3>
                <button type="button" className="link" onClick={() => clinicUi.openSheet('notes')}>{tx('แก้ไข')}</button>
              </div>
              <p className="sheet-text">{p.note === '—' ? tx('ไม่มีโน้ต') : tx(p.note)}</p>
            </div>
          </>
        );
      case 'problems':
        return (
          <div className="section">
            <div className="section-title"><h3>{tx('Problem list')}</h3></div>
            <div className="kv-list">
              {p.problems.map(problem => (
                <RowCard key={problem[0]} name={tx(problem[0])} detail={tx(problem[1])}>
                  <span className={`chip ${problem[2]}`}>{tx(problem[2] === 'ok' ? 'Resolved' : problem[2] === 'danger' ? 'Critical' : 'Active')}</span>
                </RowCard>
              ))}
              {!p.problems.length && <p className="muted">{tx('ยังไม่มี problem ที่บันทึกไว้')}</p>}
            </div>
          </div>
        );
      case 'meds':
        return (
          <div className="section">
            <div className="section-title"><h3>{tx('Medications')}</h3></div>
            <div className="kv-list">
              {p.meds.map(med => <RowCard key={med[0]} name={tx(med[0])} detail={tx(med[1])} />)}
              {!p.meds.length && <p className="muted">{tx('ไม่มียาที่กำลังใช้')}</p>}
            </div>
          </div>
        );
      case 'vaccines':
        return (
          <div className="section">
            <div className="section-title"><h3>{tx('Vaccines / reminders')}</h3></div>
            <div className="kv-list">
              {p.vaccines.map(vaccine => (
                <RowCard key={vaccine[0]} name={vaccine[0]} detail={tx(vaccine[1])}>
                  <span className={`chip ${vaccine[2]}`}>{tx(vaccine[2] === 'ok' ? 'Current' : 'Due')}</span>
                </RowCard>
              ))}
            </div>
          </div>
        );
      case 'visits':
        return (
          <div className="section">
            <div className="section-title"><h3>{tx('Visit history')}</h3></div>
            <div className="timeline">
              {p.visits.map((visit, index) => <div key={index} className="tl"><b>{visit[0]}</b><div className="secondary">{tx(visit[1])}</div></div>)}
            </div>
          </div>
        );
      default:
        return (
          <div className="section">
            <div className="section-title"><h3>{tx('Documents')}</h3></div>
            <div className="kv-list">
              {p.docs.map(doc => <RowCard key={doc[0]} name={tx(doc[0])} detail={tx(doc[1])} />)}
              {!p.docs.length && <p className="muted">{tx('ยังไม่มีเอกสาร')}</p>}
            </div>
          </div>
        );
    }
  })();

  return (
    <cl-patient-sheet className="contents">
      <SheetHead heading={p.pet + ' · ' + p.hn} status={statusOf(p)} sub={tx(p.species) + ' · ' + p.breed + ' · ' + tx(p.sex) + ' · ' + tx(p.age)}
        tabs={PATIENT_TABS} activeTab={tab} />
      <div className="sheet-body">{body}</div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.addAlert(p)}>{tx('เพิ่ม alert')}</UiButton>
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.addProblem(p)}>{tx('เพิ่ม problem')}</UiButton>
        <span className="grow"></span>
        <UiButton size="sm" type="button" onClick={() => clinicActions.recordWeight(p)}>{tx('บันทึกน้ำหนัก')}</UiButton>
      </div>
    </cl-patient-sheet>
  );
}

const OWNER_TABS = [
  { id: 'contact', label: 'ติดต่อ' }, { id: 'pets', label: 'สัตว์' }, { id: 'history', label: 'นัดหมาย' }, { id: 'consent', label: 'Consent / PDPA' },
];

/* ---- The owner ---- */
export function OwnerSheet({ tab = 'contact' }: { tab?: string }) {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const o = store.owner(p);

  const patientFor = (pet: string) => {
    const code = (pet.split('·').pop() || '').trim();
    return store.data.patients.find(item => item.code === code);
  };
  const openPet = (today: Patient) => {
    store.select(today);
    clinicUi.openSheet('patient', { tab: 'overview' });
  };
  const message = () => clinicActions.sendMessage(p, 'ข้อความจากโรงพยาบาล', `เรียนคุณ ${o.name}\n`);

  const section = (title: string, text: string) => (
    <div className="section">
      <div className="section-title"><h3>{tx(title)}</h3></div>
      <p className="sheet-text">{text}</p>
    </div>
  );

  const body = (() => {
    switch (tab) {
      case 'contact':
        return (
          <>
            <div className="section">
              <div className="section-title"><h3>{tx('ข้อมูลติดต่อ')}</h3></div>
              <dl className="data-grid">
                <dt>{tx('เบอร์หลัก')}</dt><dd>{o.phone}</dd>
                <dt>{tx('เบอร์สำรอง')}</dt><dd>{o.phone2}</dd>
                <dt>{tx('อีเมล')}</dt><dd>{o.email}</dd>
                <dt>LINE</dt><dd>{o.line}</dd>
                <dt>{tx('ช่องทางที่ต้องการ')}</dt><dd><span className="chip quiet">{tx(o.prefer)}</span></dd>
              </dl>
            </div>
            {section('Co-owner / ผู้มีสิทธิ์ตัดสินใจ', o.coOwner === '—' ? tx('ไม่ได้บันทึก') : tx(o.coOwner))}
            {section('ที่อยู่', o.address)}
            <div className="section">
              <div className="section-title"><h3>{tx('Client notes')}</h3></div>
              {o.note === '—'
                ? <p className="muted">{tx('ไม่มีโน้ต')}</p>
                : <div className="safety warn"><b>{tx('โน้ตเจ้าของ')}</b><div className="secondary">{tx(o.note)}</div></div>}
            </div>
          </>
        );
      case 'pets':
        return (
          <div className="section">
            <div className="section-title"><h3>{tx('สัตว์ในครอบครัว')}</h3></div>
            <div className="kv-list">
              {o.pets.map(pet => {
                const today = patientFor(pet);
                return (
                  <RowCard key={pet} name={pet.split('·')[0].trim()} detail={tx(pet)}>
                    {today
                      ? <UiButton variant="secondary" size="sm" type="button" onClick={() => openPet(today)}>{tx('เปิด')}</UiButton>
                      : <span className="chip none">{tx('ไม่ได้มาวันนี้')}</span>}
                  </RowCard>
                );
              })}
            </div>
          </div>
        );
      case 'history':
        return (
          <div className="section">
            <div className="section-title"><h3>{tx('ประวัติการนัดหมาย')}</h3></div>
            <div className="timeline">
              {o.appts.map((appt, index) => (
                <div key={index} className="tl"><b>{`${appt[0]} — ${tx(appt[1])}`}</b><div className="secondary">{tx(appt[2])}</div></div>
              ))}
              {!o.appts.length && <p className="muted">{tx('ยังไม่มีนัดหมาย')}</p>}
            </div>
          </div>
        );
      default:
        return (
          <>
            {section('Consent', tx(o.consent))}
            {section('PDPA', tx(o.pdpa))}
            {section('ประกัน', tx(o.insurance))}
          </>
        );
    }
  })();

  return (
    <cl-owner-sheet className="contents">
      <SheetHead heading={tx('เจ้าของ') + ' · ' + o.name}
        sub={tx('{0} สัตว์ในครอบครัว · {1}', { 0: o.pets.length, 1: o.badges.length ? o.badges.join(' · ') : tx('ไม่มี badge') })}
        tabs={OWNER_TABS} activeTab={tab} />
      <div className="sheet-body">{body}</div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicActions.callOwner(p)}>{tx('โทร')}</UiButton>
        <span className="grow"></span>
        <UiButton size="sm" type="button" onClick={message}>{tx('ส่งข้อความ')}</UiButton>
      </div>
    </cl-owner-sheet>
  );
}

/* ---- Notes ---- */
export function NotesSheet() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const o = store.owner(p);
  const savedPatient = p.note === '—' ? '' : p.note;
  const savedClient = o.note === '—' ? '' : o.note;

  // What is typed, starting again from the saved notes whenever they change (another patient, or saved)
  const [patientNote, setPatientNote] = useState(savedPatient);
  const [clientNote, setClientNote] = useState(savedClient);
  const [source, setSource] = useState({ savedPatient, savedClient });
  if (source.savedPatient !== savedPatient || source.savedClient !== savedClient) {
    setSource({ savedPatient, savedClient });
    setPatientNote(savedPatient);
    setClientNote(savedClient);
  }

  const save = () => {
    store.saveNotes(p, patientNote, clientNote);
    clinicUi.toast('บันทึกโน้ตของ {pet} แล้ว', { pet: p.pet });
  };

  return (
    <cl-notes-sheet className="contents">
      <SheetHead heading={'Notes · ' + p.pet} sub={tx('Patient note และ Client note ของ {0}', { 0: o.name })} />
      <div className="sheet-body">
        <div className="section">
          <div className="section-title"><h3><label htmlFor="clinic-patient-note">{tx('Patient note')}</label></h3></div>
          <textarea className="ui-input" id="clinic-patient-note" rows={4} value={patientNote} onChange={event => setPatientNote(event.target.value)}></textarea>
        </div>
        <div className="section">
          <div className="section-title"><h3><label htmlFor="clinic-client-note">{tx('Client note')}</label></h3></div>
          <textarea className="ui-input" id="clinic-client-note" rows={4} value={clientNote} onChange={event => setClientNote(event.target.value)}></textarea>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('บันทึกล่าสุด')}</h3></div>
          <div className="timeline">
            <div className="tl"><b>2026-09-24 10:12</b><div className="secondary">{tx('พ.ส. ณิชา — เจ้าของแจ้งว่าอาการแย่ลงหลังเดินขึ้นบันได')}</div></div>
            <div className="tl"><b>2026-09-11</b><div className="secondary">{tx('น.สพ. นรินทร์ — นัดติดตามอาการขาหลัง')}</div></div>
          </div>
        </div>
      </div>
      <div className="sheet-foot">
        <span className="grow"></span>
        <UiButton size="sm" type="button" onClick={save}>{tx('บันทึกโน้ต')}</UiButton>
      </div>
    </cl-notes-sheet>
  );
}

/* ---- The patient's results in this visit ---- */
export function ResultsPreviewSheet() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const results = store.resultsFor(p);

  const inbox = () => {
    clinicUi.closeSheet();
    void clinicNavigate('/clinic/results');
  };

  return (
    <cl-results-preview-sheet className="contents">
      <SheetHead heading={tx('ผลตรวจ') + ' · ' + p.pet} sub={tx('{0} รายการใน visit ปัจจุบัน', { 0: results.length })} />
      <div className="sheet-body">
        <div className="section">
          <div className="section-title"><h3>{tx('ผลตรวจใน visit นี้')}</h3></div>
          <div className="kv-list">
            {results.map(r => (
              <div key={r.id} className={cx('row-card', r.flag === 'critical' && !r.ack && 'blocked')}>
                <span className="grow">
                  <b>{tx(r.name)}</b>
                  <div className="secondary">
                    {`${tx(r.status)} · ${timeOf(r.time)}`}
                    {r.flag === 'critical' && <>{' · '}<b className="text-danger">{tx('Critical')}</b></>}
                  </div>
                </span>
                <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicUi.openSheet('result', { id: r.id })}>{tx('เปิด')}</UiButton>
              </div>
            ))}
            {!results.length && <p className="muted">{tx('ยังไม่มีผลตรวจใน visit นี้')}</p>}
          </div>
        </div>
      </div>
      <div className="sheet-foot">
        <span className="grow"></span>
        <UiButton size="sm" type="button" onClick={inbox}>{tx('เปิด Results inbox')}</UiButton>
      </div>
    </cl-results-preview-sheet>
  );
}

const ESTIMATE_LINES = [
  ['Consultation — General', 1, '฿450', '฿450'], ['CBC + Blood chemistry', 1, '฿1,250', '฿1,250'],
  ['Right hind limb X-ray (2 views)', 1, '฿900', '฿1,200'], ['Carprofen 25 mg', 10, '฿320', '฿320'],
] as const;

/* ---- The estimate the owner approves before treatment ---- */
export function EstimateSheet() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const o = store.owner(p);
  const approved = p.handoff.estimate.state === 'done';

  const approve = () => {
    store.approveEstimate(p);
    clinicUi.toast('บันทึกการอนุมัติประมาณการแล้ว');
  };

  const send = () => {
    clinicActions.sendMessage(p, 'ประมาณการค่าใช้จ่าย',
      `เรียนคุณ ${o.name}\nประมาณการค่าใช้จ่ายของ ${p.pet} อยู่ที่ ฿2,920 – ฿3,220 (มีอายุ 7 วัน)\nกรุณาตรวจสอบและยืนยันการอนุมัติกับเจ้าหน้าที่`,
      channel => store.mutate(() => {
        if (p.handoff.estimate.state !== 'done') {
          p.handoff.estimate = { state: 'active', note: `ส่งทาง ${channel} แล้ว` };
        }
      }));
  };

  return (
    <cl-estimate-sheet className="contents">
      <SheetHead heading={'Estimate · ' + p.pet} status={approved ? { text: 'อนุมัติแล้ว', cls: 'checked' } : { text: 'รออนุมัติ', cls: 'waiting' }}
        sub={tx('EST-260924-05 · {0} · ต้องอนุมัติก่อนเริ่มหัตถการ', { 0: o.name })} />
      <div className="sheet-body">
        <div className="section">
          <div className="section-title"><h3>{tx('รายการประมาณการ')}</h3></div>
          <table className="mini-table">
            <thead>
              <tr>
                <th scope="col">{tx('รายการ')}</th><th scope="col" className="num">{tx('จำนวน')}</th><th scope="col" className="num">{tx('ต่ำสุด')}</th>
                <th scope="col" className="num">{tx('สูงสุด')}</th>
              </tr>
            </thead>
            <tbody>
              {ESTIMATE_LINES.map(line => (
                <tr key={line[0]}><td>{tx(line[0])}</td><td className="num">{line[1]}</td><td className="num">{line[2]}</td><td className="num">{line[3]}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="summary-line total"><span>{tx('รวม')}</span><span>฿2,920 – ฿3,220</span></div>
        </div>
        <div className="section">
          <div className="section-title"><h3>{tx('เงื่อนไข')}</h3></div>
          <dl className="data-grid">
            <dt>{tx('ผู้อนุมัติ')}</dt><dd>{o.name}</dd>
            <dt>{tx('ช่องทางส่ง')}</dt><dd>{tx(o.prefer)}</dd>
            <dt>{tx('อายุประมาณการ')}</dt><dd>{tx('7 วัน')}</dd>
          </dl>
        </div>
      </div>
      <div className="sheet-foot">
        <UiButton variant="secondary" size="sm" type="button" onClick={send}>{tx('ส่งให้เจ้าของ')}</UiButton>
        <span className="grow"></span>
        <UiButton size="sm" type="button" disabled={approved} onClick={approve}>{tx('อนุมัติ')}</UiButton>
      </div>
    </cl-estimate-sheet>
  );
}
