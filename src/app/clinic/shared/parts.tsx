/* Small building blocks shared by the workspace's pages and sheets (the design's components/ui.tsx). Their look is in
   clinic.scss, under .clinic. */
import type { KeyboardEvent, ReactNode } from 'react';

import { lucideCheck, lucideChevronRight, lucideCircleHelp, lucideMapPin, lucideUserRound } from '../../icons';
import { cx, NgIcon } from '../../user-management/ui';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import {
  ALERT_META, ALERT_ORDER, locOf, STAGE_SLA, STAGES, stageIndex, stageKey, stageMinutes, stageState, stateChipCls, statusOf,
} from '../data/model';
import type { ClinicalAlert, Patient, PetKind } from '../data/types';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { ALERT_ICONS, PET_ICONS } from './icons';

/** The pet's picture: a dog or cat drawing */
export function PetIcon({ kind, size = 'md' }: { kind: PetKind; size?: 'md' | 'lg' }) {
  const { tx } = useClinicI18n();
  return (
    <cl-pet-icon className="contents">
      <span role="img" className={cx('pet-fallback', `sp-${kind}`, size === 'lg' && 'pet-lg')} aria-label={tx(kind === 'dog' ? 'สุนัข' : kind === 'cat' ? 'แมว' : 'อื่นๆ')}>
        <NgIcon svg={PET_ICONS[kind]} aria-hidden="true" />
      </span>
    </cl-pet-icon>
  );
}

const UNKNOWN_ALLERGY = 'ยังไม่ทบทวนประวัติแพ้ยา — ระบบไม่ถือว่า "ไม่รู้" คือ "ไม่แพ้"';

/** A pet's clinical alerts as small icons, most severe first; the whole alert is the icon's name and tooltip */
export function MiniAlerts({ patient, blank = false }: { patient: Patient; blank?: boolean }) {
  const { tx } = useClinicI18n();
  const unknown = !patient.allergyReview;
  const sorted = [...patient.alerts].sort((a, b) => ALERT_ORDER[ALERT_META[a.type].cls] - ALERT_ORDER[ALERT_META[b.type].cls]);
  const text = (alert: ClinicalAlert) => tx(alert.label) + (alert.detail ? ' — ' + tx(alert.detail) : '');
  return (
    <cl-mini-alerts className="contents">
      {unknown || sorted.length ? (
        <span className="mini-alerts">
          {unknown && (
            <span role="img" className="mini warn" aria-label={tx(UNKNOWN_ALLERGY)} title={tx(UNKNOWN_ALLERGY)}>
              <NgIcon svg={lucideCircleHelp} aria-hidden="true" />
            </span>
          )}
          {sorted.map((alert, index) => (
            <span key={index} role="img" className={`mini ${ALERT_META[alert.type].cls}`} aria-label={text(alert)} title={text(alert)}>
              <NgIcon svg={ALERT_ICONS[alert.type]} aria-hidden="true" />
            </span>
          ))}
        </span>
      ) : !blank && <span className="muted" aria-hidden="true">—</span>}
    </cl-mini-alerts>
  );
}

/** Five short bars for the visit's stages: done, skipped, the current one in its SLA colour, and those to come */
export function MiniStepper({ patient }: { patient: Patient }) {
  const current = stageIndex(patient);
  const cls = (k: number) => k < current ? (patient.stages[k].at ? 'on' : 'skip') : k === current ? 'cur ' + stageState(patient) : '';
  return (
    <cl-mini-stepper className="contents">
      <div className="ms" aria-hidden="true">
        {STAGES.map((stage, k) => <i key={stage.key} className={cls(k)}></i>)}
      </div>
    </cl-mini-stepper>
  );
}

/** The visit's stages one under another, with who and where, and how long in the current one */
export function VStepper({ patient }: { patient: Patient }) {
  const { tx } = useClinicI18n();
  const current = stageIndex(patient);
  const state = stageState(patient);
  const cls = (k: number) => k < current ? (patient.stages[k].at ? 'done' : 'skip') : k === current ? 'cur ' + state : 'todo';
  const when = (k: number) => {
    const s = patient.stages[k];
    if (s.at) {
      return [s.at, s.by && tx(s.by), s.loc && tx(s.loc)].filter(Boolean).join(' · ');
    }
    return tx(k < current ? 'ข้ามขั้นตอนนี้' : 'ยังไม่ถึงขั้นตอนนี้');
  };
  return (
    <cl-vstepper className="contents">
      <ol className="vstep">
        {STAGES.map((stage, k) => (
          <li key={stage.key} className={cls(k)}>
            <b>{tx(stage.label)}</b>
            {k === current && (
              <span className={`chip ${stateChipCls(state)}`}>
                {` ${tx('อยู่มา {m} น.', { m: stageMinutes(patient) })}`}
                {state !== 'ok' && ` · ${tx('เกณฑ์ {sla} น.', { sla: STAGE_SLA[stageKey(patient)] })}`}
              </span>
            )}
            <div className="secondary">{when(k)}</div>
          </li>
        ))}
      </ol>
    </cl-vstepper>
  );
}

/** Where the pet is now and for how long, in the colour of its SLA */
export function StageChip({ patient }: { patient: Patient }) {
  const { tx } = useClinicI18n();
  const st = stageState(patient);
  const cls = st === 'late' ? 'danger' : st === 'warn' ? 'warn' : 'quiet';
  return (
    <cl-stage-chip className="contents">
      <span className={`chip ${cls}`}>
        <NgIcon svg={lucideMapPin} aria-hidden="true" />{`${tx(locOf(patient))} · ${stageMinutes(patient)} ${tx('น.')} `}
      </span>
    </cl-stage-chip>
  );
}

/** The visit's status: waiting, checked in, in room… */
export function StatusBadge({ patient }: { patient: Patient }) {
  const { tx } = useClinicI18n();
  const badge = statusOf(patient);
  return <cl-status className="contents"><span className={`status ${badge.cls}`}>{tx(badge.text)}</span></cl-status>;
}

/** A pet's clinical alerts as chips that carry their text, on the patient banner */
export function SafetyChips({ patient, onOpened }: { patient: Patient; onOpened: () => void }) {
  const { tx } = useClinicI18n();
  return (
    <cl-safety-chips className="contents">
      {!patient.alerts.length && patient.allergyReview && (
        <span className="chip ok"><NgIcon svg={lucideCheck} aria-hidden="true" />{tx('ไม่มี clinical alert')}</span>
      )}
      {!patient.allergyReview && (
        <button type="button" className="chip warn" onClick={onOpened}><NgIcon svg={lucideCircleHelp} aria-hidden="true" />{tx('ยังไม่ทบทวนประวัติแพ้ยา')}</button>
      )}
      {patient.alerts.map((alert, index) => (
        <button key={index} type="button" className={`chip ${ALERT_META[alert.type].cls}`} title={alert.detail ? tx(alert.detail) : undefined} onClick={onOpened}>
          <NgIcon svg={ALERT_ICONS[alert.type]} aria-hidden="true" />{`${tx(alert.label)} `}
        </button>
      ))}
    </cl-safety-chips>
  );
}

/** A column of a board, with its count; an empty one says so */
export function BoardColumn({ name, count, empty = '', children }: { name: string; count: number; empty?: string; children?: ReactNode }) {
  const { tx } = useClinicI18n();
  return (
    <cl-column className="contents">
      <section className="column" aria-label={tx(name)}>
        <h3>{tx(name)}<span className="count">{count}</span></h3>
        {count === 0 && <p className="col-empty">{tx(empty || 'ไม่มีรายการใน {name}', { name: tx(name) })}</p>}
        {children}
      </section>
    </cl-column>
  );
}

export interface TaskCardProps {
  title: string;
  line1?: string;
  line2?: string;
  status?: { text: string; cls: string } | null;
  onOpened: () => void;
  children?: ReactNode;
}

/** A card on a board: its title, a status chip, two lines about it, and safety icons at the end of the last line */
export function TaskCard({ title, line1 = '', line2 = '', status = null, onOpened, children }: TaskCardProps) {
  const { tx } = useClinicI18n();
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpened();
    }
  };
  return (
    <cl-task className="contents">
      <div className="task" role="button" tabIndex={0} onClick={onOpened} onKeyDown={key}>
        <div className="task-head">
          <h4>{title}</h4>
          {status && <span className={`chip ${status.cls}`}>{tx(status.text)}</span>}
        </div>
        <div className="task-meta">
          <div className="task-meta-text">{line1}<br />{line2}</div>
          <div className="task-alerts">{children}</div>
        </div>
      </div>
    </cl-task>
  );
}

/**
 * The bar at the top of a page: its title and what it is for, then its controls. The subtitle is an element marked as
 * one (<span subtitle>), as the Angular app projects it.
 */
export function Toolbar({ heading, subtitle, children }: { heading: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <cl-toolbar className="contents">
      <div className="toolbar">
        <div className="title-block">
          <h1>{heading}</h1>
          <div className="subtitle">{subtitle}</div>
        </div>
        {children}
      </div>
    </cl-toolbar>
  );
}

/** The attribute that marks a toolbar's subtitle: <span {...SUBTITLE}> */
export const SUBTITLE = { subtitle: '' } as const;

/** Who the pet is and what must never be missed about it, always in view on the encounter (L1) */
export function PatientBanner() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const p = store.selected;
  const o = store.owner(p);
  return (
    <cl-patient-banner className="contents">
      <div className="patient-banner">
        <button type="button" className="pat-btn" title={tx('เปิด Patient sheet')} onClick={() => clinicUi.openSheet('patient', { tab: 'overview' })}>
          <PetIcon kind={p.kind} size="lg" />
          <span className="pat-text">
            <span className="pat-name">
              {` ${p.pet}`}<span className="hn">{`${p.hn} · ${p.code}`}</span>
              <StatusBadge patient={p} />
              <StageChip patient={p} />
              {p.triage !== 'Routine' && <span className={`chip ${p.triageCls}`}>{tx(p.triage)}</span>}
            </span>
            <span className="secondary">
              {` ${tx(p.species)} · ${p.breed} · ${tx(p.sex)} · ${tx(p.age)} · `}<b>{p.weight}</b>
              <span className="weighed">{` (${tx('ชั่ง')} ${p.weightAt})`}</span>
            </span>
          </span>
          <NgIcon className="caret" svg={lucideChevronRight} aria-hidden="true" />
        </button>
        <div className="safety-strip">
          <SafetyChips patient={p} onOpened={() => clinicUi.openSheet('patient', { tab: 'alerts' })} />
        </div>
        <button type="button" className="owner-btn" title={tx('เปิด Owner sheet')} onClick={() => clinicUi.openSheet('owner')}>
          <span className="circle"><NgIcon svg={lucideUserRound} aria-hidden="true" /></span>
          <span className="owner-text">
            <span className="owner-line">
              {` ${o.name} `}
              {o.badges.map(badge => <span key={badge} className="chip quiet">{tx(badge)}</span>)}
            </span>
            <span className="secondary">{`${o.phone} · ${o.pets.length} ${tx('สัตว์')}`}</span>
          </span>
          <NgIcon className="caret" svg={lucideChevronRight} aria-hidden="true" />
        </button>
      </div>
    </cl-patient-banner>
  );
}
