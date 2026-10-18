/* The three boards of the clinical work: orders, results and dispense (the design's pages/Orders, Results, Dispense) */
import { useState } from 'react';

import { lucidePlus } from '../../icons';
import { NgIcon, UiButton } from '../../user-management/ui';
import { clinicActions } from '../clinic-actions';
import { clinicUi } from '../clinic-ui';
import { useClinicStore } from '../clinic.store';
import { minutesSince, timeOf } from '../data/model';
import { useClinicI18n } from '../i18n/clinic-i18n';
import { BoardColumn, MiniAlerts, SUBTITLE, TaskCard, Toolbar } from '../shared/parts';

/** Orders between departments: Draft > Accepted > In progress > Completed, and verbal orders to co-sign above them */
export function OrdersComponent() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const pending = store.pendingCosign;
  const orders = store.data.orders;
  const columns = ['Draft', 'Accepted', 'In progress', 'Completed'].map(name => ({ name, list: orders.filter(o => o.col === name) }));

  return (
    <app-clinic-orders className="workspace">
      <Toolbar heading={tx('Orders')} subtitle={<span {...SUBTITLE}>{tx('คำสั่งตรวจและรักษาระหว่างแผนก · คลิกการ์ดเพื่อดู Order summary')}</span>}>
        <UiButton size="sm" type="button" onClick={() => clinicUi.openSheet('newOrder')}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('New order')}</UiButton>
      </Toolbar>

      {/* Verbal medication orders a nurse took: not in force until a vet co-signs them */}
      <section className="cosign-panel" aria-label={tx('คำสั่งวาจา · รอเซ็นกำกับ')}>
        <div className="section-title">
          <h2>{tx('คำสั่งวาจา · รอเซ็นกำกับ')}<span className="count">{pending.length}</span></h2>
          <span className="secondary">{tx('คำสั่งที่พยาบาลรับทางวาจาไว้ ยังไม่มีผลจนกว่าสัตวแพทย์จะเซ็น')}</span>
        </div>
        {pending.length ? (
          <div className="table-wrap cosign-wrap">
            <table className="cosign-table">
              <thead>
                <tr>
                  <th scope="col">{tx('สัตว์ป่วย')}</th><th scope="col">{tx('คำสั่ง')}</th><th scope="col">{tx('พยาบาลรับไว้')}</th>
                  <th scope="col">{tx('รอมาแล้ว')}</th><th scope="col">CDS</th><th scope="col">{tx('การทำงาน')}</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(rx => (
                  <tr key={rx.id} className="static">
                    <td><b>{rx.pet}</b><div className="secondary">{rx.owner}</div></td>
                    <td><b>{rx.drug}</b><div className="secondary">{`${tx(rx.dose)} · ${tx(rx.freq)} · ${tx(rx.days)} · ${rx.code}`}</div></td>
                    <td>{tx(rx.by)}<div className="secondary">{rx.orderedAt}</div></td>
                    <td>{tx('{n} นาที', { n: minutesSince(rx.orderedAt ?? '') })}</td>
                    <td><span className="chip ok">{tx('CDS ผ่าน')}</span></td>
                    <td>
                      <UiButton size="sm" type="button" onClick={() => clinicActions.cosign(rx)}>{tx('เซ็นกำกับ')}</UiButton>
                      <button type="button" className="link" onClick={() => clinicUi.openSheet('prescription', { id: rx.id })}>{tx('รายละเอียด')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{tx('ไม่มีคำสั่งวาจาที่รอเซ็นกำกับ')}</p>
        )}
      </section>

      <div className="board">
        <div className="board-grid">
          {columns.map(column => (
            <BoardColumn key={column.name} name={column.name} count={column.list.length}>
              {column.list.map(o => (
                <TaskCard key={o.id} title={o.pet + ' · ' + tx(o.name)} line1={tx(o.kind) + ' · ' + timeOf(o.time)} line2={o.code}
                  status={o.priority === 'Urgent' ? { text: 'Urgent', cls: 'danger' } : null} onOpened={() => clinicUi.openSheet('order', { id: o.id })} />
              ))}
            </BoardColumn>
          ))}
        </div>
      </div>
    </app-clinic-orders>
  );
}

/** New results to acknowledge and take back into the encounter: Critical, New, Reviewed, Sent to owner */
export function ResultsComponent() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const [sort, setSort] = useState<'unread' | 'critical'>('unread');
  const results = store.data.results.slice().sort((a, b) =>
    sort === 'unread' ? Number(a.ack) - Number(b.ack) : Number(b.flag === 'critical') - Number(a.flag === 'critical'));
  const columns = ['Critical', 'New', 'Reviewed', 'Sent to owner'].map(name => ({ name, list: results.filter(r => r.col === name) }));

  return (
    <app-clinic-results className="workspace">
      <Toolbar heading={tx('Results Inbox')} subtitle={<span {...SUBTITLE}>{tx('ผลตรวจใหม่ที่ต้องรับทราบและส่งกลับ Encounter')}</span>}>
        <select className="ui-input select" aria-label={tx('เรียงลำดับ')} value={sort} onChange={event => setSort(event.target.value as 'unread' | 'critical')}>
          <option value="unread">{tx('Unread first')}</option>
          <option value="critical">{tx('Critical first')}</option>
        </select>
      </Toolbar>
      <div className="board">
        <div className="board-grid">
          {columns.map(column => (
            <BoardColumn key={column.name} name={column.name} count={column.list.length}>
              {column.list.map(r => (
                <TaskCard key={r.id} title={r.pet + ' · ' + tx(r.name)} line1={tx(r.status) + ' · ' + timeOf(r.time)} line2={tx('สั่งโดย') + ' ' + tx(r.by)}
                  status={r.flag === 'critical' && !r.ack ? { text: 'Critical', cls: 'danger' } : null} onOpened={() => clinicUi.openSheet('result', { id: r.id })} />
              ))}
            </BoardColumn>
          ))}
        </div>
      </div>
    </app-clinic-results>
  );
}

/** Prescriptions on their way to the owner: Verify, Prepare, Counsel, Ready. The pharmacy dispenses; the vet follows. */
export function DispenseComponent() {
  const store = useClinicStore();
  const { tx } = useClinicI18n();
  const prescriptions = store.data.prescriptions.filter(rx => !rx.verbal);
  const columns = ['Verify', 'Prepare', 'Counsel', 'Ready'].map(name => ({ name, list: prescriptions.filter(rx => rx.col === name) }));

  return (
    <app-clinic-dispense className="workspace">
      <Toolbar heading={tx('Dispense')}
        subtitle={<span {...SUBTITLE}>{tx('ตรวจสอบใบสั่งยา สต็อก และคำแนะนำก่อนส่งมอบ · ยืนยันการจ่ายยาใช้ confirmation dialog')}</span>} />
      <div className="board">
        <div className="board-grid">
          {columns.map(column => (
            <BoardColumn key={column.name} name={column.name} count={column.list.length}>
              {column.list.map(rx => {
                const p = store.patientByPet(rx.pet);
                return (
                  <TaskCard key={rx.id} title={rx.pet + ' · ' + rx.code} line1={rx.drug} line2={tx(rx.qty) + ' · ' + rx.owner}
                    onOpened={() => clinicUi.openSheet('prescription', { id: rx.id })}>
                    {p && p.alerts.length > 0 && <MiniAlerts patient={p} blank />}
                  </TaskCard>
                );
              })}
            </BoardColumn>
          ))}
        </div>
      </div>
    </app-clinic-dispense>
  );
}
