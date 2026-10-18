import { useState, type ReactNode } from 'react';

import {
  lucideArrowRight, lucideCheck, lucideChevronRight, lucideCopy, lucideFileText, lucideLock, lucidePenLine, lucidePlus, lucideSparkles,
} from '../../icons';
import { cx, NgIcon, UiButton, UiDialog } from '../../user-management/ui';
import { clinicActions, clinicNavigate } from '../clinic-actions';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import {
  ENCOUNTER_ORDERS, ENCOUNTER_STEPS, HANDOFF, locOf, OPTIONS, SIGNED_STEPS, STAGES, stageIndex, stageMinutes, suggestTemplate, TEMPLATE_FIELD_LABELS,
  TEMPLATES, TRIAGE, type NoteTemplate,
} from '../data/model';
import type { EncounterNote } from '../data/types';
import { clinicI18n, useClinicI18n } from '../i18n/clinic-i18n';
import { PatientBanner } from '../shared/parts';
import { SafetyAlert } from '../sheets/patient-sheets';
import './encounter.scss';

type TextField = Exclude<keyof EncounterNote, 'ros' | 'templates' | 'savedAt' | 'status' | 'signedBy' | 'signedAt' | 'closedBy' | 'closedAt'>;

/** A list in the AI summary, or a dash when it is empty */
function SummaryList({ items, translate }: { items: string[]; translate?: (text: string) => string }) {
  return items.length ? <ul>{items.map((x, index) => <li key={index}>{translate ? translate(x) : x}</li>)}</ul> : <p>—</p>;
}

/**
 * The encounter of the selected patient (L2): the patient banner, the note step by step on the left, and along the
 * bottom what the visit still has to hand over. A signature locks S/O/A/P; closing the encounter locks all of it.
 */
export function EncounterComponent() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  // Typing writes into the note without telling the rest of the workspace, so this page draws again on its own
  const [, setTyped] = useState(0);

  const [step, setStep] = useState(2);
  const [soapTab, setSoapTab] = useState(0);

  const p = store.selected;
  const n = store.noteFor(p);
  const signed = n.status === 'signed';
  const closed = !!n.closedAt;
  const canEdit = !closed && !(signed && SIGNED_STEPS.has(step));
  const last = step === ENCOUNTER_STEPS.length - 1;
  const where = { location: locOf(p), stage: STAGES[stageIndex(p)].label, minutes: stageMinutes(p) };
  const suggested = suggestTemplate(p);
  const handoffDone = HANDOFF.filter(h => p.handoff[h.key].state === 'done').length;

  /* Orders step */
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(ENCOUNTER_ORDERS.filter(o => o.checked).map(o => o.name)));
  const orderState = (name: string) => store.data.orders.find(o => o.pet === p.pet && o.name === name && o.col !== 'Cancelled')?.state;

  /* Medication step */
  const prescriptions = store.data.prescriptions.filter(rx => rx.pet === p.pet);
  const olderMeds = p.meds.filter(m => !prescriptions.some(rx => rx.drug === m[0]));
  const drugAlerts = p.alerts.filter(a => a.type === 'allergy' || a.type === 'drug');

  /* Templates and the AI summary */
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const template = TEMPLATES.find(t => t.id === templateId) ?? suggested ?? TEMPLATES[0];
  const [summaryOpen, setSummaryOpen] = useState(false);

  const value = (key: TextField): string => n[key];

  /** Typing writes into the note; leaving the field tells everyone (commit) */
  const write = (key: TextField, text: string) => {
    n[key] = text;
    setTyped(count => count + 1);
  };
  const commit = () => store.mutate(() => undefined);
  const choose = (key: TextField, text: string) => {
    n[key] = text;
    commit();
  };
  const toggleRos = (system: string, on: boolean) => {
    n.ros = on ? [...n.ros, system] : n.ros.filter(r => r !== system);
    commit();
  };

  const save = () => {
    store.saveNote(p);
    clinicUi.toast('บันทึก Encounter ของ {pet} แล้ว', { pet: p.pet });
  };

  /** Saves, then the next step; from the last one the visit goes on to the pharmacy */
  const next = () => {
    if (canEdit) {
      store.saveNote(p);
    }
    if (!last) {
      setStep(s => s + 1);
      clinicUi.toast('บันทึกและไปขั้นตอนถัดไป');
    } else {
      void clinicNavigate('/clinic/dispense');
      clinicUi.toast('ส่งต่อไปยัง Dispense แล้ว');
    }
  };

  const sendOrders = () => {
    const { sent, skipped } = store.sendEncounterOrders(p, [...picked]);
    const parts = [sent && clinicI18n.t('ส่ง {0} รายการ', { 0: sent }), skipped && clinicI18n.t('ข้าม {0} รายการที่ส่งแล้ว', { 0: skipped })].filter(Boolean);
    clinicUi.toast(parts.length ? `${p.pet} · ${parts.join(' · ')}` : 'ไม่มีรายการที่เลือก');
  };

  const toggleOrder = (name: string) => setPicked(current => {
    const nextSet = new Set(current);
    if (!nextSet.delete(name)) {
      nextSet.add(name);
    }
    return nextSet;
  });

  const openTemplates = () => {
    setTemplateId(suggested?.id ?? TEMPLATES[0].id);
    setTemplatesOpen(true);
  };

  const templateFields = (tpl: NoteTemplate): [string, string][] => (Object.entries(tpl.fields) as [keyof EncounterNote, unknown][]).map(([k, v]) => [
    TEMPLATE_FIELD_LABELS[k] ?? k,
    Array.isArray(v) ? (v.length ? v.map(s => clinicI18n.t(String(s))).join(', ') : clinicI18n.t('(ล้างค่า)')) : clinicI18n.t(String(v)),
  ]);

  const applyTemplate = (mode: 'replace' | 'fill') => {
    const changed = store.applyToNote(p, template.fields, mode, template.name);
    setTemplatesOpen(false);
    clinicUi.toast(changed ? 'ใช้เทมเพลต "{0}" · {1} ช่อง' : 'ทุกช่องมีข้อมูลแล้ว ไม่ได้เติมเพิ่ม', { 0: clinicI18n.t(template.name), 1: changed });
  };

  /* The AI summary: put together from the record and the note, no model is called */
  const results = store.resultsFor(p);
  const summary = {
    alerts: p.alerts.map(a => a.label),
    problems: p.problems.filter(x => x[2] !== 'ok').map(x => x[0]),
    meds: p.meds.map(m => m[0]),
    abnormal: results.flatMap(r => r.values.filter(v => v[3]).map(v => `${r.name}: ${v[0]} ${v[1]} (${v[2]})`)),
    vaccines: p.vaccines.filter(v => v[2] !== 'ok').map(v => `${v[0]} · ${v[1]}`),
    visits: p.visits.slice(0, 3).map(v => `${v[0]} · ${v[1]}`),
    soap: [
      ['S', [n.chief, n.hpi].filter(Boolean).join(' · ')],
      ['O', [n.general, n.msk, n.cardio].filter(Boolean).join(' · ') || [n.temp && `T ${n.temp} °C`, n.hr && `HR ${n.hr}`, n.rr && `RR ${n.rr}`].filter(Boolean).join(' · ')],
      ['A', n.dx || p.problems.filter(x => x[2] !== 'ok').map(x => x[0]).join(', ')],
      ['P', n.plan],
    ] as [string, string][],
  };

  const acceptAssessment = () => {
    const changed = store.applyToNote(p, { dx: summary.soap[2][1], ddx: summary.problems.join('\n') }, 'fill');
    setSummaryOpen(false);
    clinicUi.toast(changed ? 'เติม Assessment จากสรุป {0} ช่อง' : 'ทุกช่องมีข้อมูลแล้ว ไม่ได้เติมเพิ่ม', { 0: changed });
  };

  const copySummary = async () => {
    const t = (x: string) => clinicI18n.t(x);
    const text = [
      `${p.pet} · ${p.hn}`,
      `${t('Clinical alerts')}: ${summary.alerts.map(t).join(', ') || '—'}`,
      `${t('Problem list')}: ${summary.problems.map(t).join(', ') || '—'}`,
      `${t('Medications')}: ${summary.meds.join(', ') || '—'}`,
      `${t('ผลตรวจผิดปกติ')}: ${summary.abnormal.join(', ') || '—'}`,
      ...summary.soap.map(([k, v]) => `${k}: ${t(v) || '—'}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      clinicUi.toast('คัดลอกสรุปแล้ว');
    } catch {
      clinicUi.toast('คัดลอกไม่ได้ — เบราว์เซอร์ไม่อนุญาต', undefined, 'error');
    }
  };

  const share = () => {
    const o = store.owner(p);
    clinicActions.sendMessage(p, 'เอกสารจำหน่าย', `เรียนคุณ ${o.name}\n${p.pet}: ${n.summary || n.dx || '—'}\n${n.home}\n${n.followup}`, () => store.mutate(() => {
      p.handoff.discharge = { state: 'done', note: 'ส่งเอกสารจำหน่ายแล้ว' };
    }));
  };

  /* Fields bound to the note: typing writes into it, leaving the field saves it */
  const area = (key: TextField, label: string, full = false) => (
    <div className={cx('field', full && 'full')}>
      <label htmlFor={`enc-${key}`}>{tx(label)}</label>
      <textarea className="ui-input" id={`enc-${key}`} rows={3} value={value(key)} onChange={event => write(key, event.target.value)} onBlur={commit}></textarea>
    </div>
  );
  const line = (key: TextField, label: string) => (
    <div className="field short">
      <label htmlFor={`enc-${key}`}>{tx(label)}</label>
      <input className="ui-input" id={`enc-${key}`} value={value(key)} onChange={event => write(key, event.target.value)} onBlur={commit} />
    </div>
  );
  const choice = (key: TextField, label: string, choices: readonly string[]) => (
    <div className="field short">
      <label htmlFor={`enc-${key}`}>{tx(label)}</label>
      <select className="ui-input" id={`enc-${key}`} value={value(key)} onChange={event => choose(key, event.target.value)}>
        {!choices.includes(value(key)) && <option value={value(key)}>{value(key) ? tx(value(key)) : tx('— เลือก —')}</option>}
        {choices.map(option => <option key={option} value={option}>{tx(option)}</option>)}
      </select>
    </div>
  );

  const stepBody = (): ReactNode => {
    switch (step) {
      case 0:
        return (
          <div className="form-12">
            {area('reason', 'Reason for visit')}
            {area('ownerObs', 'Owner observation')}
            {choice('appetite', 'Appetite', OPTIONS.appetite)}
            {choice('energy', 'Energy', OPTIONS.energy)}
            <div className="field short">
              <label htmlFor="enc-triage">{tx('Triage')}</label>
              <select className="ui-input" id="enc-triage" value={p.triage} onChange={event => clinicActions.setTriage(p, event.target.value)}>
                {TRIAGE.map(level => <option key={level.value} value={level.value}>{tx(level.value)}</option>)}
              </select>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="form-12">
            {line('weight', 'Weight (kg)')}
            {line('temp', 'Temperature (°C)')}
            {line('hr', 'Heart rate')}
            {line('rr', 'Respiratory rate')}
            {line('mm', 'Mucous membrane / CRT')}
            {choice('bcs', 'Body condition score', OPTIONS.bcs)}
            <div className="field full">
              <label htmlFor="enc-pain">{`${tx('Pain score (0–10)')}: `}<b>{n.pain}</b></label>
              {/* Dragging writes into the note; letting go saves it (the input's change event) */}
              <input id="enc-pain" className="pain-range" type="range" min="0" max="10" value={n.pain} onChange={event => write('pain', event.target.value)}
                ref={element => { if (element) { element.onchange = commit; } }} />
            </div>
          </div>
        );
      case 2:
        return (
          <>
            <div className="form-tabs" role="group" aria-label={tx('SOAP')}>
              {['Subjective', 'Objective'].map((tab, i) => (
                <button key={tab} type="button" className={cx(i === soapTab && 'active')} aria-pressed={i === soapTab} onClick={() => setSoapTab(i)}>{tx(tab)}</button>
              ))}
            </div>
            {soapTab === 0 ? (
              <div className="form-12">
                {area('chief', 'Chief complaint')}
                {area('hpi', 'History of present illness')}
                {choice('duration', 'Duration', OPTIONS.duration)}
                {choice('progression', 'Progression', OPTIONS.progression)}
                <div className="field full" role="group" aria-label={tx('Review of systems')}>
                  <span className="field-label">{tx('Review of systems')}</span>
                  <div className="check-grid">
                    {OPTIONS.ros.map(system => (
                      <label key={system} className="check">
                        <input type="checkbox" checked={n.ros.includes(system)} onChange={event => toggleRos(system, event.target.checked)} />{tx(system)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-12">
                {area('general', 'General appearance', true)}
                {area('msk', 'Musculoskeletal')}
                {area('cardio', 'Cardiopulmonary')}
                {area('remark', 'หมายเหตุ', true)}
              </div>
            )}
          </>
        );
      case 3:
        return (
          <div className="form-12">
            <div className="field full">
              <span className="field-label">{tx('Problem list')}</span>
              <div className="kv-list">
                {p.problems.map(problem => (
                  <div key={problem[0]} className="row-card">
                    <span className="grow"><b>{tx(problem[0])}</b><div className="secondary">{tx(problem[1])}</div></span>
                    <span className={`chip ${problem[2]}`}>{tx(problem[2] === 'ok' ? 'Resolved' : 'Active')}</span>
                  </div>
                ))}
                {!p.problems.length && <p className="muted">{tx('ยังไม่มี problem')}</p>}
              </div>
            </div>
            {area('ddx', 'Differential diagnosis')}
            {area('dx', 'Working diagnosis')}
            {area('plan', 'Treatment plan', true)}
          </div>
        );
      case 4:
        return (
          <>
            <div className="kv-list" role="group" aria-label={tx('Orders')}>
              {ENCOUNTER_ORDERS.map(order => {
                const state = orderState(order.name);
                return (
                  <label key={order.name} className={cx('row-card pick', picked.has(order.name) && 'on')}>
                    <input type="checkbox" checked={picked.has(order.name)} onChange={() => toggleOrder(order.name)} />
                    <span className="grow"><b>{tx(order.name)}</b><div className="secondary">{tx(order.note)}</div></span>
                    {state && <span className={`chip ${state === 'Draft' ? 'quiet' : state === 'Completed' ? 'ok' : 'info'}`}>{tx(state)}</span>}
                  </label>
                );
              })}
            </div>
            <div className="step-actions">
              <UiButton size="sm" type="button" disabled={!picked.size} onClick={sendOrders}>{tx('ส่ง order ที่เลือก')}</UiButton>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicUi.openSheet('newOrder')}>
                {tx('เพิ่ม order อื่น')}<NgIcon svg={lucideChevronRight} aria-hidden="true" />
              </UiButton>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicUi.openSheet('results')}>
                {tx('ดูผลตรวจล่าสุด')}<NgIcon svg={lucideChevronRight} aria-hidden="true" />
              </UiButton>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicUi.openSheet('estimate')}>
                {tx('Estimate')}<NgIcon svg={lucideChevronRight} aria-hidden="true" />
              </UiButton>
            </div>
          </>
        );
      case 5:
        return (
          <>
            {drugAlerts.map((alert, index) => <SafetyAlert key={index} alert={alert} />)}
            <div className="kv-list">
              {prescriptions.map(rx => {
                const draft = rx.verbal && !rx.cosignedBy;
                return (
                  <div key={rx.id} className={cx('row-card', draft && 'blocked')}>
                    <span className="grow">
                      <b>{rx.drug}</b>
                      <div className="secondary">
                        {`${tx(rx.dose)} · ${tx(rx.freq)} · ${tx(rx.days)} · ${tx(rx.qty)} · ${rx.code} · ${tx(draft ? 'รับไว้โดย' : 'สั่งโดย')} ${tx(rx.by)}`}
                      </div>
                    </span>
                    {draft ? (
                      <UiButton size="sm" type="button" onClick={() => clinicActions.cosign(rx)}>{tx('ลงนามกำกับ')}</UiButton>
                    ) : (
                      <>
                        <span className={`chip ${rx.col === 'Ready' ? 'ok' : 'info'}`}>{tx(rx.state)}</span>
                        <UiButton variant="secondary" size="sm" type="button" onClick={() => clinicUi.openSheet('prescription', { id: rx.id })}>{tx('ดูใบสั่งยา')}</UiButton>
                      </>
                    )}
                  </div>
                );
              })}
              {olderMeds.map(med => (
                <div key={med[0]} className="row-card">
                  <span className="grow"><b>{tx(med[0])}</b><div className="secondary">{tx(med[1])}</div></span>
                  <span className="chip quiet">{tx('ยาเดิม')}</span>
                </div>
              ))}
              {!prescriptions.length && !olderMeds.length && <p className="muted">{tx('ยังไม่มียาใน visit นี้')}</p>}
            </div>
            <div className="step-actions">
              <UiButton size="sm" type="button" onClick={() => clinicActions.prescribe(p)}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('สั่งยาใหม่')}</UiButton>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => void clinicNavigate('/clinic/dispense')}>
                {tx('Dispense board')}<NgIcon svg={lucideChevronRight} aria-hidden="true" />
              </UiButton>
            </div>
            <p className="secondary">
              {tx('ต้องตรวจ CDS ก่อนสั่งยาทุกครั้ง · ยาที่ถูกบล็อกต้องให้สัตวแพทย์ override พร้อมเหตุผล (≥10 ตัวอักษร) · คำสั่งวาจาไม่มีผลจนกว่าสัตวแพทย์จะลงนามกำกับ')}
            </p>
          </>
        );
      default:
        return (
          <>
            <div className="form-12">
              {area('summary', 'Diagnosis summary', true)}
              {area('home', 'Home instructions', true)}
              {choice('followup', 'Follow-up', OPTIONS.followup)}
              <div className="field short">
                <label htmlFor="enc-channel">{tx('ช่องทางส่งเอกสาร')}</label>
                <select className="ui-input" id="enc-channel"><option>{`${tx(store.owner(p).prefer)} ${tx('+ เอกสารพิมพ์')}`}</option></select>
              </div>
            </div>
            <div className="step-actions">
              <UiButton variant="secondary" size="sm" type="button" onClick={share}>{tx('แชร์พร้อมไฟล์แนบ')}<NgIcon svg={lucideChevronRight} aria-hidden="true" /></UiButton>
            </div>
          </>
        );
    }
  };

  const s = summary;
  return (
    <app-clinic-encounter className="workspace encounter-ws">
      {/* L1 · who the pet is, always in view */}
      <PatientBanner />

      <div className="encounter-layout">
        {/* The note, step by step */}
        <nav className="step-rail" aria-label={tx('ขั้นตอนการบันทึก')}>
          {ENCOUNTER_STEPS.map((label, i) => (
            <button key={label} type="button" className={cx('step-btn', i === step && 'active')} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
              <span className="step-no">{i + 1}</span>
              <span className="step-text">
                <span className="step-label">{tx(label)}</span>
                <span className="secondary">{tx(i < step ? 'Complete' : i === step ? 'In progress' : 'Not started')}</span>
              </span>
            </button>
          ))}
        </nav>

        <section className="clinical" aria-labelledby="encounter-step-title">
          <div className="clinical-head">
            <div>
              <h1 id="encounter-step-title">{tx(ENCOUNTER_STEPS[step])}</h1>
              <div className="secondary">
                {` ${tx('Encounter E-260924-05 ·')} ${tx(where.location)} · ${tx(p.vet)} ${tx('· ขั้นตอน')} ${tx(where.stage)} (${where.minutes} ${tx('น.)')} `}
                {n.savedAt && ` ${tx('· บันทึกล่าสุด')} ${tx(n.savedAt)} `}
              </div>
            </div>
            <div className="actions">
              {!signed && !closed && (
                <UiButton variant="secondary" size="sm" type="button" onClick={openTemplates}>
                  <NgIcon svg={lucideFileText} aria-hidden="true" />{`${tx('Templates')} `}
                  {suggested && !n.templates.length && <span className="dot-badge" title={tx('มีเทมเพลตที่แนะนำสำหรับ visit นี้')}></span>}
                </UiButton>
              )}
              <UiButton variant="secondary" size="sm" type="button" onClick={() => setSummaryOpen(true)}>
                <NgIcon svg={lucideSparkles} aria-hidden="true" />{tx('AI summary')}
              </UiButton>
              <UiButton variant="secondary" size="sm" type="button" disabled={signed} onClick={() => clinicActions.signNote(p)}
                title={signed ? tx('ลงนามแล้ว · {0} {1}', { 0: tx(n.signedBy ?? ''), 1: n.signedAt ?? '' }) : tx('ล็อก S/O/A/P')}>
                <NgIcon svg={lucidePenLine} aria-hidden="true" />{`${tx(signed ? 'ลงนาม SOAP แล้ว' : 'ลงนาม SOAP')} `}
              </UiButton>
              <UiButton variant="secondary" size="sm" type="button" disabled={closed || !signed} onClick={() => clinicActions.closeEncounter(p)}
                title={tx(closed ? 'ปิด encounter แล้ว' : signed ? 'ล็อกเวชระเบียนทั้ง visit' : 'ต้องลงนาม SOAP ก่อน')}>
                <NgIcon svg={lucideLock} aria-hidden="true" />{`${tx(closed ? 'ปิด encounter แล้ว' : 'ปิด encounter')} `}
              </UiButton>
            </div>
          </div>

          {closed ? (
            <div className="readonly-banner">
              <NgIcon svg={lucideLock} aria-hidden="true" />{`${tx('ปิด encounter แล้ว ·')} ${tx(n.closedBy ?? '')} ${n.closedAt} ${tx('— เวชระเบียนของ visit นี้ล็อกทั้งชุด')}`}
            </div>
          ) : signed && !canEdit && (
            <div className="readonly-banner">
              <NgIcon svg={lucideLock} aria-hidden="true" />{`${tx('ลงนาม SOAP แล้ว ·')} ${tx(n.signedBy ?? '')} ${n.signedAt} ${tx('— S/O/A/P ถูกล็อก การแก้ไขภายหลังต้องทำเป็น addendum')}`}
            </div>
          )}

          <div className="form-panel">
            {/* A new fieldset for each step, so it fades in where the last one was */}
            <fieldset key={step} className="plain ui-enter-fade" disabled={!canEdit}>
              {stepBody()}
            </fieldset>
          </div>
        </section>
      </div>

      {/* What the visit has to hand over, and the step's own buttons */}
      <div className="handoff">
        <div className="handoff-title"><b>{tx('Encounter handoff')}</b><div className="secondary">{`${tx('เสร็จแล้ว')} ${handoffDone}/${HANDOFF.length}`}</div></div>
        <ol className="handoff-flow" aria-label={tx('Encounter handoff')}>
          {HANDOFF.map((h, i) => {
            const state = p.handoff[h.key];
            return (
              <li key={h.key} className={cx('hand-node', state.state === 'done' && 'done', state.state === 'active' && 'active')}>
                <span className="hand-circle">
                  {state.state === 'done'
                    ? <><NgIcon svg={lucideCheck} aria-hidden="true" /><span className="visually-hidden">{tx('เสร็จแล้ว')}</span></>
                    : ` ${i + 1} `}
                </span>
                <span className="hand-text"><b>{tx(h.label)}</b><br />{tx(state.note)}</span>
              </li>
            );
          })}
        </ol>
        <UiButton variant="secondary" size="sm" type="button" disabled={!canEdit} onClick={save}>{tx('Save')}</UiButton>
        <UiButton size="sm" type="button" disabled={!canEdit && !last} onClick={next}>
          {` ${tx(last ? 'ส่งต่อ Dispense' : 'Complete step')}`}<NgIcon svg={lucideArrowRight} aria-hidden="true" />
        </UiButton>
      </div>

      {/* Templates: S/O/A/P, plan and discharge text for common visits; the one that fits the visit is suggested */}
      <UiDialog open={templatesOpen} onOpenChange={setTemplatesOpen} title={tx('เลือกเทมเพลตบันทึก · {0}', { 0: p.pet })} size="lg" closeLabel={tx('ปิด')}
        footer={<>
          <span className="secondary dialog-note">{`${tx('ใช้แล้ว:')} ${n.templates.length ? n.templates.join(', ') : '—'}`}</span>
          <UiButton variant="secondary" type="button" onClick={() => applyTemplate('fill')}>{tx('เติมเฉพาะช่องที่ว่าง')}</UiButton>
          <UiButton type="button" onClick={() => applyTemplate('replace')}><NgIcon svg={lucideCheck} aria-hidden="true" />{tx('ใช้เทมเพลต')}</UiButton>
        </>}>
        {templatesOpen && (
          <div className="tpl-layout">
            <div className="tpl-list" role="listbox" aria-label={tx('เทมเพลต')}>
              {TEMPLATES.map(tpl => (
                <button key={tpl.id} type="button" role="option" className={cx('tpl-item', tpl.id === template.id && 'on')} aria-selected={tpl.id === template.id}
                  onClick={() => setTemplateId(tpl.id)}>
                  <NgIcon svg={lucideFileText} aria-hidden="true" />
                  <span className="tpl-text"><b>{tx(tpl.name)}</b><small>{tx(tpl.desc)}</small></span>
                  {tpl === suggested && <span className="chip info"><NgIcon svg={lucideSparkles} aria-hidden="true" />{tx('แนะนำ')}</span>}
                </button>
              ))}
            </div>
            <div className="tpl-preview">
              <p className="secondary">{tx('ช่องที่เทมเพลตนี้จะเติม — ข้อความ "…" คือจุดที่ต้องกรอกเอง')}</p>
              {templateFields(template).map(field => <div key={field[0]} className="compare-sec"><b>{tx(field[0])}</b><span className="pre">{field[1]}</span></div>)}
            </div>
          </div>
        )}
      </UiDialog>

      {/* The AI summary: put together from the record and the note */}
      <UiDialog open={summaryOpen} onOpenChange={setSummaryOpen} title={tx('AI summary · {0}', { 0: p.pet })} size="lg" closeLabel={tx('ปิด')}
        footer={<>
          <UiButton variant="secondary" type="button" onClick={() => void copySummary()}><NgIcon svg={lucideCopy} aria-hidden="true" />{tx('คัดลอกสรุป')}</UiButton>
          <UiButton type="button" disabled={signed || closed} onClick={acceptAssessment}>{tx('เติมการประเมินลงบันทึก')}</UiButton>
        </>}>
        {summaryOpen && (
          <>
            <p className="ai-note"><NgIcon svg={lucideSparkles} aria-hidden="true" />{tx('สรุปจากเวชระเบียนและบันทึกของ visit นี้ ไม่ได้เรียกโมเดล — ตรวจสอบก่อนใช้ทุกครั้ง')}</p>
            <div className="sum-card">
              <div className="sum-head"><b>{`${p.pet} · ${p.hn}`}</b><span className="secondary">{`${tx(p.species)} · ${p.breed} · ${tx(p.age)} · ${p.weight}`}</span></div>
              <div className="sum-grid">
                <div className="sum-block"><h4>{tx('Clinical alerts')}</h4><SummaryList items={s.alerts} translate={x => tx(x)} /></div>
                <div className="sum-block"><h4>{tx('Problem list')}</h4><SummaryList items={s.problems} translate={x => tx(x)} /></div>
                <div className="sum-block"><h4>{tx('Medications')}</h4><SummaryList items={s.meds} /></div>
                <div className="sum-block"><h4>{tx('ผลตรวจผิดปกติ')}</h4><SummaryList items={s.abnormal} translate={x => tx(x)} /></div>
                <div className="sum-block"><h4>{tx('Vaccines / reminders')}</h4><SummaryList items={s.vaccines} translate={x => tx(x)} /></div>
                <div className="sum-block"><h4>{tx('Visit history')}</h4><SummaryList items={s.visits} translate={x => tx(x)} /></div>
              </div>
            </div>
            <div className="sum-card soap-draft">
              <div className="sum-head"><b>{tx('ร่าง SOAP')}</b></div>
              {s.soap.map(part => <div key={part[0]} className="compare-sec"><b>{part[0]}</b><span className="pre">{part[1] ? tx(part[1]) : '—'}</span></div>)}
            </div>
          </>
        )}
      </UiDialog>
    </app-clinic-encounter>
  );
}
