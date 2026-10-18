import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { cx } from '../../user-management/ui';
import { clinicActions } from '../clinic-actions';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import { formatDate, locOf, NOW, STAGES, stageKey, stageMinutes, stageState, statusOf, TODAY, VETS } from '../data/model';
import type { Patient, StageKey } from '../data/types';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { MiniAlerts, MiniStepper, PetIcon, SUBTITLE, Toolbar } from '../shared/parts';

const stageLabel = (key: StageKey) => STAGES.find(s => s.key === key)?.label ?? '';

/**
 * Today's queue: where each pet is in its visit and for how long, with the stages above as filters. A click opens the
 * quick view; a double click, or the quick view's Start encounter, opens the encounter.
 */
export function QueueComponent() {
  const store = useClinicStore();
  const { tx, lang } = useClinicI18n();
  const [query, setQuery] = useState('');
  const [vet, setVet] = useState('');
  const [stage, setStage] = useState<StageKey | null>(null);

  const today = formatDate(TODAY, 'long', lang);
  const d = store.data;
  const needle = query.trim().toLowerCase();
  const list = d.patients.filter(p => {
    const owner = d.owners[p.ownerKey];
    return (!needle || [p.pet, p.code, p.hn, owner.name, owner.phone, p.reason, p.vet].join(' ').toLowerCase().includes(needle))
      && (!vet || p.vet === vet)
      && (!stage || stageKey(p) === stage);
  });
  const funnel = STAGES.map(s => {
    const inStage = d.patients.filter(p => stageKey(p) === s.key);
    return { key: s.key, label: s.label, count: inStage.length, stuck: inStage.filter(p => stageState(p) !== 'ok').length };
  });
  const emptyText = tx(stage ? 'ไม่มีผู้ป่วยในขั้นตอน {stage}' : 'ไม่พบรายการที่ตรงกับคำค้น', { stage: stage ? tx(stageLabel(stage)) : '' });
  const selectedId = store.selected.id;

  // A click opens the quick view a moment later, so a double click opens only the encounter
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(clickTimer.current), []);
  const open = (p: Patient) => {
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      store.select(p);
      clinicUi.openSheet('visit');
    }, 170);
  };
  const encounter = (p: Patient) => {
    clearTimeout(clickTimer.current);
    clinicActions.startEncounter(p);
  };
  const rowKey = (event: KeyboardEvent, p: Patient) => {
    if (event.key === 'Enter') {
      open(p);
    } else if (event.key === ' ') {
      event.preventDefault();
      open(p);
    }
  };
  const nowLine = (p: Patient) => `${tx(statusOf(p).text)} · ${stageMinutes(p)} ${tx('น.')}`;

  return (
    <app-clinic-queue className="workspace">
      <Toolbar heading={tx('คิววันนี้')} subtitle={
        <span {...SUBTITLE}>
          {stage ? (
            <>
              {` ${tx('กรองเฉพาะขั้นตอน')} `}<b>{tx(stageLabel(stage))}</b>{' · '}
              <button type="button" className="link" onClick={() => setStage(null)}>{tx('ล้างตัวกรอง')}</button>
            </>
          ) : ` ${today} · ${tx('ข้อมูล ณ เวลา {now} · คลิกแถวเพื่อดู Quick view', { now: NOW })} · ${tx('ดับเบิลคลิกเพื่อเปิด Encounter')} `}
        </span>
      }>
        <input className="ui-input input search" type="search" aria-label={tx('ค้นหาในคิววันนี้')} placeholder={tx('ค้นหาในคิววันนี้')}
          value={query} onChange={event => setQuery(event.target.value)} />
        <select className="ui-input select" aria-label={tx('กรองตามสัตวแพทย์')} value={vet} onChange={event => setVet(event.target.value)}>
          <option value="">{tx('สัตวแพทย์ทุกคน')}</option>
          {VETS.map(name => <option key={name} value={name}>{tx(name)}</option>)}
        </select>
      </Toolbar>

      {/* The stages, counted from the queue; each one filters the table */}
      <div className="steps" role="group" aria-label={tx('กรองตามขั้นตอน')}>
        {funnel.map((step, i) => (
          <button key={step.key} type="button" className={cx(stage === step.key && 'on')} aria-pressed={stage === step.key}
            onClick={() => setStage(stage === step.key ? null : step.key)}>
            <b>{`${i + 1} · ${tx(step.label)}`}</b>{`${tx('{n} ราย', { n: step.count })} `}
            {step.stuck > 0 && <>{' · '}<span className="stuck">{tx('ค้างเกินเกณฑ์ {n}', { n: step.stuck })}</span></>}
          </button>
        ))}
      </div>

      {/* Desktop and tablet: the table */}
      <div className="table-wrap queue-table" tabIndex={0} aria-label={tx('คิววันนี้')} role="region">
        <table>
          <thead>
            <tr>
              <th scope="col" className="col-no">#</th>
              <th scope="col" className="col-time">{tx('เวลานัด')}</th>
              <th scope="col" className="col-stage">{tx('ขั้นตอน / ตำแหน่ง')}</th>
              <th scope="col" className="col-patient">{tx('ผู้ป่วย')}</th>
              <th scope="col" className="col-owner">{tx('เจ้าของ')}</th>
              <th scope="col">{tx('เหตุผลที่มา')}</th>
              <th scope="col" className="col-vet">{tx('สัตวแพทย์')}</th>
              <th scope="col" className="col-safety">{tx('Safety')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map(p => {
              const reason = p.reason.split(' · ');
              const owner = store.owner(p);
              return (
                <tr key={p.id} className={cx(p.id === selectedId && 'selected')} tabIndex={0}
                  aria-label={tx('{pet} · {owner} — Enter เปิด Quick view', { pet: p.pet, owner: owner.name })}
                  onClick={() => open(p)} onDoubleClick={() => encounter(p)} onKeyDown={event => rowKey(event, p)}>
                  <td>{p.id}</td>
                  <td><b>{p.time}</b><div className="secondary">{`${tx('มาถึง')} ${p.stages[0].at || '—'}`}</div></td>
                  <td>
                    <MiniStepper patient={p} />
                    <div className={`ms-now ${stageState(p)}`}>{nowLine(p)}</div>
                    <div className="secondary ellipsis">{tx(locOf(p))}</div>
                  </td>
                  <td>
                    <div className="patient-cell">
                      <PetIcon kind={p.kind} />
                      <span className="cell-text"><span className="primary-text ellipsis">{p.pet}</span><div className="secondary ellipsis">{`${p.code} · ${p.breed}`}</div></span>
                    </div>
                  </td>
                  <td><div className="ellipsis">{owner.name}</div><div className="secondary">{owner.phone}</div></td>
                  <td><div className="ellipsis">{tx(reason[0])}</div><div className="secondary ellipsis">{tx(reason[1] || p.chief)}</div></td>
                  <td><div className="ellipsis">{tx(p.vet)}</div><div className="secondary ellipsis">{tx(p.nurse)}</div></td>
                  <td><MiniAlerts patient={p} /></td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={8} className="muted empty-row">{emptyText}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Phones: cards */}
      <div className="queue-cards">
        {list.map(p => {
          const reason = p.reason.split(' · ');
          return (
            <button key={p.id} type="button" className={cx('q-card', p.id === selectedId && 'selected')} onClick={() => open(p)}>
              <span className="q-card-top">
                <PetIcon kind={p.kind} />
                <span className="grow"><span className="primary-text">{p.pet}</span><span className="muted">{`#${p.id}`}</span><span className="secondary ellipsis">{`${p.code} · ${p.breed}`}</span></span>
                <span className="q-time">{p.time}</span>
              </span>
              <MiniStepper patient={p} />
              <span className={`ms-now ${stageState(p)}`}>{`${nowLine(p)} · `}<span className="muted">{tx(locOf(p))}</span></span>
              <span className="q-card-foot">
                <span className="grow secondary ellipsis">{`${tx(reason[0])} · ${store.owner(p).name} · ${tx(p.vet)}`}</span>
                <MiniAlerts patient={p} blank />
              </span>
            </button>
          );
        })}
        {!list.length && <p className="muted empty-row">{emptyText}</p>}
      </div>
    </app-clinic-queue>
  );
}
