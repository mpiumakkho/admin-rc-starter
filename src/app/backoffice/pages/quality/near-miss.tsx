/* Near misses: errors caught before they reached the patient, where in the process they were caught, and what stops them coming back (quality.nearMiss, M12 P2) */
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { NOW, TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  CATCH_POINT, CATCH_POINTS, CATEGORIES, monthsBack, NEAR_MISS_STATUS, nearMissProblems, type NearMissInput, reporterOf, SAFETY_CATEGORY, SAFETY_PLACES,
} from '../../data/quality';
import type { CatchPoint, SafetyCategory } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

type View = 'open' | 'all';
const VIEWS: [View, string][] = [['open', 'รอมาตรการ'], ['all', 'ทั้งหมด']];
const BLANK: NearMissInput = { at: `${TODAY}T${NOW}`, category: '', location: '', description: '', caughtAt: '', caughtBy: '', anonymous: false };

export function NearMissComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [params] = useSearchParams();
  const [view, setView] = useState<View>('open');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'));
  const [recording, setRecording] = useState(false);
  const [form, setForm] = useState<NearMissInput>({ ...BLANK });

  const d = store.data;
  const rows = d.nearMisses.filter(n => view === 'all' || n.status === 'open' || n.id === selectedId);
  const selected = d.nearMisses.find(n => n.id === selectedId) ?? null;
  /* Where in the process errors were caught over the year: the checks that work */
  const from = monthsBack(12)[0];
  const year = d.nearMisses.filter(n => n.at.slice(0, 7) >= from);
  const byPoint = CATCH_POINTS.map(point => ({ point, count: year.filter(n => n.caughtAt === point).length }));
  const problems = nearMissProblems(form);

  const pick = (id: string) => { setRecording(false); setSelectedId(selectedId === id ? null : id); };
  const startRecord = () => { setSelectedId(null); setForm({ ...BLANK }); setRecording(true); };
  const set = <K extends keyof NearMissInput>(key: K, value: NearMissInput[K]) => setForm({ ...form, [key]: value });
  const record = () => backofficeActions.recordNearMiss(form, n => { setRecording(false); setView('open'); setSelectedId(n.id); });

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-near-miss className="page">
      <PageHead heading="เหตุเกือบพลาด" source="M12 P2 · ความผิดพลาดที่จับได้ก่อนถึงตัวผู้ป่วย · ทุกรายการต้องมีมาตรการป้องกัน · ยกระดับเป็นอุบัติการณ์ได้เมื่อพบว่าถึงตัวผู้ป่วยหรือเกิดซ้ำ · ต้นแบบก่อนสัญญาหน้าของ M12 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={startRecord}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('บันทึกเหตุเกือบพลาด')}</UiButton>
      </PageHead>

      <div className="kpi-strip" role="list" aria-label={tx('จับได้ที่ขั้นตอนใด (12 เดือน)')}>
        {byPoint.map(p => <div key={p.point} className="kpi" role="listitem"><span className="kpi-value">{p.count}</span><span className="kpi-label">{tx(CATCH_POINT[p.point])}</span></div>)}
      </div>

      <div className={cx('split', (selected || recording) && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <div className="segmented" role="group" aria-label={tx('มุมมอง')}>
              {VIEWS.map(v => <button key={v[0]} type="button" className={cx(view === v[0] && 'active')} aria-pressed={view === v[0]} onClick={() => setView(v[0])}>{tx(v[1])}</button>)}
            </div>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table near-miss">
              <thead>
                <tr>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col">{tx('เหตุการณ์')}</th>
                  <th scope="col" className="w-kind">{tx('จับได้ที่')}</th>
                  <th scope="col" className="w-owner">{tx('ผู้ที่จับได้')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(n => (
                  <tr key={n.id} tabIndex={0} className={cx(n.id === selectedId && 'selected')} aria-selected={n.id === selectedId} onClick={() => pick(n.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(n.id); } }}>
                    <td><b>{n.id}</b><div className="secondary">{n.at}</div></td>
                    <td>{tx(n.description)}<div className="secondary">{tx(SAFETY_CATEGORY[n.category])} · {tx(n.location)}</div></td>
                    <td>{tx(CATCH_POINT[n.caughtAt])}</td>
                    <td>{tx(n.caughtBy)}</td>
                    <td><span className={`chip ${NEAR_MISS_STATUS[n.status].cls}`}>{tx(NEAR_MISS_STATUS[n.status].label)}</span>{n.incidentId && <div className="secondary">{n.incidentId}</div>}</td>
                  </tr>
                ))}
                {!rows.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีเหตุเกือบพลาดในมุมมองนี้')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {recording ? (
          <Drawer heading="บันทึกเหตุเกือบพลาด" sub="ความผิดพลาดที่จับได้ก่อนถึงตัวผู้ป่วย" onClosed={() => setRecording(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setRecording(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={record}>{tx('บันทึก')}</UiButton>
          </>}>
            <div className="form-grid">
              <label>{tx('พบเมื่อ')}<input className="ui-input" type="datetime-local" value={form.at} onChange={event => set('at', event.target.value)} /></label>
              <label>{tx('ประเภท')}
                <select className="ui-input" value={form.category} onChange={event => set('category', event.target.value as SafetyCategory | '')}>
                  <option value="">{tx('เลือก')}</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{tx(SAFETY_CATEGORY[c])}</option>)}
                </select>
              </label>
              <label>{tx('สถานที่')}
                <select className="ui-input" value={form.location} onChange={event => set('location', event.target.value)}>
                  <option value="">{tx('เลือก')}</option>
                  {SAFETY_PLACES.map(p => <option key={p} value={p}>{tx(p)}</option>)}
                </select>
              </label>
              <label>{tx('จับได้ที่')}
                <select className="ui-input" value={form.caughtAt} onChange={event => set('caughtAt', event.target.value as CatchPoint | '')}>
                  <option value="">{tx('เลือก')}</option>
                  {CATCH_POINTS.map(p => <option key={p} value={p}>{tx(CATCH_POINT[p])}</option>)}
                </select>
              </label>
              <label className="full">{tx('ผู้ที่จับได้')}<input className="ui-input" value={form.caughtBy} onChange={event => set('caughtBy', event.target.value)} /></label>
              <label className="full">{tx('เกิดอะไรขึ้น')}<textarea className="ui-input" rows={3} value={form.description} onChange={event => set('description', event.target.value)}></textarea></label>
            </div>
            <label className="check"><input type="checkbox" checked={form.anonymous} onChange={event => set('anonymous', event.target.checked)} />{tx('ไม่ระบุชื่อผู้รายงาน')}</label>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        ) : selected ? (() => {
          const n = selected;
          return (
            <Drawer heading={n.id} sub={`${tx(CATCH_POINT[n.caughtAt])} · ${tx(n.location)}`} onClosed={() => setSelectedId(null)} foot={n.status === 'open' ? <>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.escalateNearMiss(n)}>{tx('ยกระดับเป็นอุบัติการณ์ใหม่')}</UiButton>
              <span className="grow"></span>
              <UiButton size="sm" type="button" onClick={() => backofficeActions.preventNearMiss(n)}>{tx('บันทึกมาตรการป้องกัน')}</UiButton>
            </> : <>
              <span className="grow"></span>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.openRca(n.id, n.description)}>{tx('เปิด RCA')}</UiButton>
            </>}>
              <p>{tx(n.description)}</p>
              <dl className="data-grid">
                <dt>{tx('พบเมื่อ')}</dt><dd>{n.at}</dd>
                <dt>{tx('ประเภท')}</dt><dd>{tx(SAFETY_CATEGORY[n.category])}</dd>
                <dt>{tx('ผู้ที่จับได้')}</dt><dd>{tx(n.caughtBy)}</dd>
                <dt>{tx('ผู้รายงาน')}</dt><dd>{tx(reporterOf(n))}</dd>
                <dt>{tx('สถานะ')}</dt><dd><span className={`chip ${NEAR_MISS_STATUS[n.status].cls}`}>{tx(NEAR_MISS_STATUS[n.status].label)}</span></dd>
                <dt>{tx('มาตรการป้องกัน')}</dt><dd>{tx(n.prevention ?? 'ยังไม่มี')}</dd>
                {n.incidentId && <><dt>{tx('อุบัติการณ์')}</dt><dd>{n.incidentId}</dd></>}
              </dl>
              <div className="section-title">{tx('ประวัติ')}</div>
              <ul className="timeline compact">
                {n.history.map((h, k) => <li key={k} className="tl"><b>{tx(h[2])}</b> · {tx(h[1])}<div className="secondary">{h[0]} · {tx(h[3])}</div></li>)}
              </ul>
            </Drawer>
          );
        })() : null}
      </div>
    </bo-near-miss>
  );
}
