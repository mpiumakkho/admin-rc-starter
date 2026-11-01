/* Critical equipment: what is down or cannot be relied on, why, the beds and units it touches, and what stands in (assets.critical, M22 P2) */
import { Link } from 'react-router';

import { inpatients } from '../../../clinic/data/ward';
import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { criticalBoard, EQUIPMENT_CLASS, openDowntimeOf, READINESS, type Readiness } from '../../data/assets';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const STATES: Readiness[] = ['down', 'attention', 'due', 'ready'];

/** Where the first reason is settled */
function next(reasons: string[]) {
  const r = reasons[0] ?? '';
  return r.startsWith('PM') ? '/backoffice/assets/pm' : r.startsWith('สอบเทียบ') ? '/backoffice/assets/calibration' : '/backoffice/assets/contracts';
}

export function CriticalComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const d = store.data;
  const board = criticalBoard(d);
  const counts = { down: 0, attention: 0, due: 0, ready: 0 };
  for (const r of board) {
    counts[r.state]++;
  }
  const places = new Map<string, { location: string; total: number; ready: number }>();
  for (const r of board) {
    const row = places.get(r.equipment.location) ?? { location: r.equipment.location, total: 0, ready: 0 };
    row.total++;
    row.ready += r.state === 'ready' || r.state === 'due' ? 1 : 0;
    places.set(r.equipment.location, row);
  }
  // The critical kinds with nothing to stand in if the one that works goes down
  const single = [...new Set(board.map(r => r.equipment.cls))].filter(k => board.filter(r => r.equipment.cls === k && r.state !== 'down').length < 2).map(k => EQUIPMENT_CLASS[k].label);
  const occupied = new Map(inpatients(store.clinic.data).map(p => [p.admission!.bed, p.pet]));

  return (
    <bo-critical className="page">
      <PageHead heading="สถานะอุปกรณ์สำคัญ" source="M22 P2 · อุปกรณ์ critical ตลอด 24 ชม. · ขัดข้อง PM หรือสอบเทียบเกินกำหนด และไม่มีสัญญาซ่อม ขึ้นก่อน · แก้ไขที่หน้าของแต่ละเรื่อง · ต้นแบบก่อนสัญญาหน้าของ M22 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="record ledger">
        <div className="record-main">
          <div className="panel">
            <div className="filter-bar"><b>{tx('ต้องดำเนินการ')}</b><span className="secondary grow">{tx('{n} จาก {m} เครื่องไม่พร้อม', { n: counts.down + counts.attention, m: board.length })}</span></div>
            <div className="table-wrap">
              <table className="bo-table critical">
                <thead>
                  <tr>
                    <th scope="col">{tx('อุปกรณ์')}</th>
                    <th scope="col" className="w-status">{tx('ความพร้อม')}</th>
                    <th scope="col">{tx('เหตุผล')}</th>
                    <th scope="col" className="w-owner">{tx('เครื่องที่ใช้แทนได้')}</th>
                    <th scope="col" className="w-kind">{tx('การทำงาน')}</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map(r => {
                    const e = r.equipment;
                    const pet = e.bed ? occupied.get(e.bed) ?? null : null;
                    const down = openDowntimeOf(d, e.id);
                    return (
                      <tr key={e.id} className={cx('static', r.state === 'down' && 'open')}>
                        <td>
                          <Link className="link" to={`/backoffice/assets/equipment/${e.id}`}><b>{tx(e.name)}</b></Link>
                          <div className="secondary">{e.id} · {tx(e.location)}{e.bed && <> · {tx('เตียง {bed}', { bed: e.bed })}</>}</div>
                          {pet && <div className="text-danger">{tx('มีสัตว์ป่วยที่เตียง: {pet}', { pet })}</div>}
                        </td>
                        <td><span className={`chip ${READINESS[r.state].cls}`}>{tx(READINESS[r.state].label)}</span></td>
                        <td>{r.reasons.length ? <ul className="checks">{r.reasons.map(x => <li key={x}>{tx(x)}</li>)}</ul> : <span className="secondary ok-text">{tx('ไม่มีรายการค้าง')}</span>}</td>
                        <td>{r.backups.length ? r.backups.map(b => <div key={b.id}>{tx(b.name)}</div>) : <span className="text-danger">{tx('ไม่มี')}</span>}</td>
                        <td>
                          {down ? <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.closeDowntime(down)}>{tx('กลับมาใช้งาน')}</UiButton>
                            : r.state === 'attention' ? <Link className="link" to={next(r.reasons)}>{tx('ไปแก้ไข')}</Link> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="record-rail">
          <div className="panel action-card">
            <b>{tx('ความพร้อมตอนนี้')}</b>
            {STATES.map(s => <div key={s} className="sum-row"><span className={`chip ${READINESS[s].cls}`}>{tx(READINESS[s].label)}</span><b>{counts[s]}</b></div>)}
          </div>
          <div className="panel action-card">
            <b>{tx('ตามจุดที่ตั้ง')}</b>
            {[...places.values()].map(l => (
              <div key={l.location} className="sum-row"><span>{tx(l.location)}</span><span className={cx(l.ready < l.total && 'text-danger')}>{tx('{a} / {b} พร้อม', { a: l.ready, b: l.total })}</span></div>
            ))}
          </div>
          <div className="panel action-card">
            <b>{tx('ชนิดที่ไม่มีเครื่องสำรอง')}</b>
            {single.length ? single.map(c => <span key={c} className="text-danger">{tx(c)}</span>) : <span className="secondary ok-text">{tx('ทุกชนิดมีเครื่องสำรอง')}</span>}
          </div>
        </aside>
      </div>
    </bo-critical>
  );
}
