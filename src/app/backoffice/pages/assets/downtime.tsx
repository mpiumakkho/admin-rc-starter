/* Downtime: what is out now, MTBF/MTTR and availability over the year, a month-by-month view, and each incident opened and closed (assets.downtime, M22 P2) */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { TODAY } from '../../../clinic/data/model';
import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { active, addMonths, CRITICALITY, DOWNTIME_KIND, downtimeHours, downtimeProblems, type DowntimeInput, equipmentOf, hoursBetween, reliability } from '../../data/assets';
import type { Downtime } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const hours = (n: number | null) => (n === null ? '—' : n >= 100 ? Math.round(n).toLocaleString('en-US') : Number.isInteger(n) ? String(n) : n.toFixed(1));
/** The twelve months to this one: 2025-10 … 2026-09 */
const MONTHS = Array.from({ length: 12 }, (_, i) => addMonths(`${TODAY.slice(0, 7)}-01`, i - 11).slice(0, 7));
const BLANK: DowntimeInput = { equipmentId: 'EQ-ICU-MON-02', kind: 'failure', problem: '', impact: '' };

export function DowntimeComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const d = store.data;
  // A report started from a device's own page
  const report = params.get('report');
  const reported = !!report && !!equipmentOf(d, report);
  const [view, setView] = useState<'open' | 'all'>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(reported);
  const [form, setForm] = useState<DowntimeInput>(reported ? { ...BLANK, equipmentId: report } : { ...BLANK });

  const rows = d.downtime.filter(x => view === 'all' || !x.to).sort((a, b) => b.from.localeCompare(a.from));
  const selected = d.downtime.find(x => x.id === selectedId) ?? null;
  const devices = active(d);
  const ids = devices.map(e => e.id);
  const open = d.downtime.filter(x => !x.to);
  const k = {
    open: open.length, criticalOpen: open.filter(x => equipmentOf(d, x.equipmentId)?.criticality === 'critical').length,
    all: reliability(d, ids), critical: reliability(d, ids.filter(id => equipmentOf(d, id)!.criticality === 'critical')),
  };
  // Each device with downtime this year: its hours out, month by month
  const now = `${TODAY} 23:59`;
  const timeline = [...new Set(d.downtime.filter(x => (x.to ?? now).slice(0, 7) >= MONTHS[0]).map(x => x.equipmentId))].map(id => {
    const cells = MONTHS.map(m => {
      const start = `${m}-01 00:00`;
      const end = `${addMonths(`${m}-01`, 1)} 00:00`;
      const hits = d.downtime.filter(x => x.equipmentId === id).map(x => ({ x, from: x.from > start ? x.from : start, to: (x.to ?? now) < end ? (x.to ?? now) : end }))
        .filter(y => y.to > y.from);
      const h = hits.reduce((n, y) => n + hoursBetween(y.from, y.to), 0);
      const failure = hits.some(y => y.x.kind === 'failure');
      const cls = failure ? (hits.some(y => !y.x.to) ? 'failure open' : 'failure') : hits.length ? 'planned' : '';
      return { h: Math.round(h * 10) / 10, cls };
    });
    return { id, name: equipmentOf(d, id)!.name, cells, rel: reliability(d, [id]) };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const problems = downtimeProblems(d, form);

  const eq = (x: Downtime) => equipmentOf(d, x.equipmentId)!;
  const pick = (id: string) => { setCreating(false); setSelectedId(selectedId === id ? null : id); };
  const openCreate = () => { setSelectedId(null); setCreating(true); };
  const set = <K extends keyof DowntimeInput>(key: K, value: DowntimeInput[K]) => setForm({ ...form, [key]: value });
  const create = () => backofficeActions.openDowntime(form, x => {
    setCreating(false);
    setForm({ ...form, problem: '', impact: '' });
    setView('open');
    setSelectedId(x.id);
  });

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-downtime className="page">
      <PageHead heading="การขัดข้องและหยุดใช้งาน" source="M22 P2 · MTBF ชั่วโมงที่ใช้งานได้ระหว่างการขัดข้อง · MTTR ชั่วโมงเฉลี่ยที่ใช้ซ่อม · คิดย้อนหลัง 12 เดือน · กลับมาใช้ได้เมื่อทดสอบแล้ว · ต้นแบบก่อนสัญญาหน้าของ M22 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton variant="danger" size="sm" type="button" onClick={openCreate}>{tx('แจ้งขัดข้อง')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list">
        <div className={cx('kpi', k.open > 0 && 'danger')} role="listitem"><span className="kpi-value">{k.open}</span><span className="kpi-label">{tx('หยุดใช้อยู่ตอนนี้')}</span></div>
        <div className={cx('kpi', k.criticalOpen > 0 && 'danger')} role="listitem"><span className="kpi-value">{k.criticalOpen}</span><span className="kpi-label">{tx('อุปกรณ์ critical ที่หยุดใช้')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{hours(k.all.mtbf)}</span><span className="kpi-label">{tx('MTBF ทั้งหมด (ชม.)')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{hours(k.all.mttr)}</span><span className="kpi-label">{tx('MTTR ทั้งหมด (ชม.)')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{(k.critical.availability * 100).toFixed(2)}%</span><span className="kpi-label">{tx('ความพร้อมใช้ของอุปกรณ์ critical')}</span></div>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('12 เดือนที่ผ่านมา')}</b><span className="secondary grow">{tx('ชั่วโมงที่หยุดใช้ต่อเดือน · แดงคือขัดข้อง เทาคือหยุดตามแผน')}</span></div>
        <div className="table-wrap">
          <table className="bo-table dt-months">
            <thead>
              <tr>
                <th scope="col">{tx('อุปกรณ์')}</th>
                {MONTHS.map(m => <th key={m} scope="col" className="num">{m.slice(5)}/{m.slice(2, 4)}</th>)}
                <th scope="col" className="num">{tx('MTBF')}</th>
                <th scope="col" className="num">{tx('MTTR')}</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map(row => (
                <tr key={row.id} className="static">
                  <th scope="row"><Link className="link" to={`/backoffice/assets/equipment/${row.id}`}>{tx(row.name)}</Link></th>
                  {row.cells.map((cell, i) => <td key={i} className={cx('num', cell.cls)}>{cell.h ? hours(cell.h) : ''}</td>)}
                  <td className="num">{hours(row.rel.mtbf)}</td>
                  <td className="num">{hours(row.rel.mttr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cx('split', (selected || creating) && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <div className="segmented" role="group" aria-label={tx('มุมมอง')}>
              <button type="button" className={cx(view === 'open' && 'active')} aria-pressed={view === 'open'} onClick={() => setView('open')}>{tx('ยังไม่ปิด')}</button>
              <button type="button" className={cx(view === 'all' && 'active')} aria-pressed={view === 'all'} onClick={() => setView('all')}>{tx('ทั้งหมด')}</button>
            </div>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table">
              <thead>
                <tr>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col">{tx('อุปกรณ์')}</th>
                  <th scope="col">{tx('อาการ')}</th>
                  <th scope="col" className="w-at">{tx('เริ่ม')}</th>
                  <th scope="col" className="w-amount num">{tx('ชั่วโมง')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(x => {
                  const e = eq(x);
                  return (
                    <tr key={x.id} tabIndex={0} className={cx(x.id === selectedId && 'selected', !x.to && 'open')} aria-selected={x.id === selectedId} onClick={() => pick(x.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(x.id); } }}>
                      <td><b>{x.id}</b><div className="secondary">{tx(DOWNTIME_KIND[x.kind])}</div></td>
                      <td>{tx(e.name)}<div className="secondary"><span className={`chip ${CRITICALITY[e.criticality].cls}`}>{tx(CRITICALITY[e.criticality].label)}</span></div></td>
                      <td>{tx(x.problem)}{x.impact && <div className="secondary">{tx(x.impact)}</div>}</td>
                      <td className="num">{x.from}<div className="secondary">{x.to ?? tx('ยังไม่ปิด')}</div></td>
                      <td className="num">{hours(downtimeHours(x))}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีอุปกรณ์ที่หยุดใช้อยู่')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {creating ? (
          <Drawer heading="แจ้งขัดข้อง" sub="อุปกรณ์หยุดใช้ตั้งแต่ตอนนี้จนกว่าจะปิดรายการ" onClosed={() => setCreating(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setCreating(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton variant="danger" size="sm" type="button" disabled={problems.length > 0} onClick={create}>{tx('แจ้งขัดข้อง')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('อุปกรณ์')}
                <select className="ui-input" value={form.equipmentId} onChange={event => set('equipmentId', event.target.value)}>
                  {devices.map(e => <option key={e.id} value={e.id}>{`${tx(e.name)} · ${e.id}`}</option>)}
                </select>
              </label>
              <label className="full">{tx('ประเภท')}
                <select className="ui-input" value={form.kind} onChange={event => set('kind', event.target.value as Downtime['kind'])}>
                  <option value="failure">{tx(DOWNTIME_KIND.failure)}</option>
                  <option value="planned">{tx(DOWNTIME_KIND.planned)}</option>
                </select>
              </label>
              <label className="full">{tx('อาการ')}<textarea className="ui-input" rows={2} value={form.problem} onChange={event => set('problem', event.target.value)}></textarea></label>
              <label className="full">{tx('ผลกระทบ')}<input className="ui-input" placeholder={tx('เช่น ย้ายเคสไปห้องผ่าตัด 2')} value={form.impact} onChange={event => set('impact', event.target.value)} /></label>
            </div>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        ) : selected ? (
          <Drawer heading={selected.id} sub={`${tx(eq(selected).name)} · ${tx(DOWNTIME_KIND[selected.kind])}`} onClosed={() => setSelectedId(null)} foot={<>
            <Link className="link" to={`/backoffice/assets/equipment/${selected.equipmentId}`}>{tx('เปิดรายละเอียดอุปกรณ์')}</Link>
            <span className="grow"></span>
            {!selected.to && <UiButton size="sm" type="button" onClick={() => backofficeActions.closeDowntime(selected)}>{tx('กลับมาใช้งาน')}</UiButton>}
          </>}>
            <dl className="data-grid">
              <dt>{tx('อาการ')}</dt><dd>{tx(selected.problem)}</dd>
              <dt>{tx('ผลกระทบ')}</dt><dd>{tx(selected.impact || '—')}</dd>
              <dt>{tx('แจ้งโดย')}</dt><dd>{tx(selected.reportedBy)} · {selected.from}</dd>
              <dt>{tx('หยุดใช้')}</dt><dd>{tx('{n} ชม.', { n: hours(downtimeHours(selected)) })}</dd>
              {selected.to && <>
                <dt>{tx('การแก้ไข')}</dt><dd>{tx(selected.fix ?? '')}</dd>
                <dt>{tx('ปิดโดย')}</dt><dd>{tx(selected.closedBy ?? '')} · {selected.to}</dd>
              </>}
            </dl>
          </Drawer>
        ) : null}
      </div>
    </bo-downtime>
  );
}
