/* The KPI library: each definition with its formula and source, its value against target and the sample benchmark, and twelve months of it (quality.kpi, M12 P2) */
import { useState } from 'react';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { KPI_DOMAIN, kpiNow, kpiSeries, onTarget } from '../../data/quality';
import type { KpiDefinition } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

type Domain = KpiDefinition['domain'];
const DOMAINS = Object.keys(KPI_DOMAIN) as Domain[];
const abs = (n: number) => Math.round(Math.abs(n) * 10) / 10;
const trendText = (now: ReturnType<typeof kpiNow>) =>
  (now.improving === null ? 'คงที่จากเดือนก่อน' : now.improving ? 'ดีขึ้น {v} จากเดือนก่อน' : 'แย่ลง {v} จากเดือนก่อน');

export function KpiComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const [domain, setDomain] = useState<Domain | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const d = store.data;
  const rows = d.kpis.filter(k => !domain || k.domain === domain).map(def => ({ def, now: kpiNow(d, def) }));
  const off = rows.filter(r => !r.now.met).length;
  const selected = d.kpis.find(k => k.id === selectedId) ?? null;
  const pick = (id: string) => setSelectedId(selectedId === id ? null : id);

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-kpi-library className="page">
      <PageHead heading="คลังตัวชี้วัดคุณภาพ" source="M12 P2 · kpi_definition และ kpi_snapshot รายเดือน · ตัวที่คำนวณตอนนี้อ่านจากโมดูลต้นทาง · ค่าเทียบมาตรฐานเป็นตัวอย่างจนกว่าจะได้เกณฑ์ TAHSA/AAHA ฉบับจริง · ต้นแบบก่อนสัญญาหน้าของ M12 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className={cx('split', selected && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <div className="segmented" role="group" aria-label={tx('หมวด')}>
              <button type="button" className={cx(!domain && 'active')} aria-pressed={!domain} onClick={() => setDomain('')}>{tx('ทั้งหมด')}</button>
              {DOMAINS.map(k => <button key={k} type="button" className={cx(domain === k && 'active')} aria-pressed={domain === k} onClick={() => setDomain(k)}>{tx(KPI_DOMAIN[k])}</button>)}
            </div>
            <span className="secondary grow">{tx('{n} ตัว · ไม่ถึงเป้า {off}', { n: rows.length, off })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table kpis">
              <thead>
                <tr>
                  <th scope="col">{tx('ตัวชี้วัด')}</th>
                  <th scope="col" className="num w-kind">{tx('ล่าสุด')}</th>
                  <th scope="col" className="num w-kind">{tx('เป้าหมาย')}</th>
                  <th scope="col" className="num w-owner">{tx('ค่าเทียบมาตรฐาน')}</th>
                  <th scope="col" className="w-status">{tx('เทียบเป้า')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(r => (
                  <tr key={r.def.id} tabIndex={0} className={cx(r.def.id === selectedId && 'selected')} aria-selected={r.def.id === selectedId} onClick={() => pick(r.def.id)} onKeyDown={event => { if (event.key === 'Enter') { pick(r.def.id); } }}>
                    <td><b>{tx(r.def.name)}</b><div className="secondary">{r.def.id} · {tx(KPI_DOMAIN[r.def.domain])} · {tx(r.def.unit)}{r.now.live && <> · {tx('คำนวณตอนนี้')}</>}</div></td>
                    <td className="num"><b className={cx(!r.now.met && 'text-danger')}>{r.now.value}</b>
                      <div className="secondary">{tx(trendText(r.now), { v: abs(r.now.change) })}</div></td>
                    <td className="num">{r.def.better === 'higher' ? '≥' : '≤'} {r.def.target}</td>
                    <td className="num">{r.def.benchmark ? <><span>{r.def.benchmark[1]}</span><div className="secondary">{tx(r.def.benchmark[0])}</div></> : '—'}</td>
                    <td><span className={`chip ${r.now.met ? 'ok' : 'danger'}`}>{tx(r.now.met ? 'ถึงเป้า' : 'ไม่ถึงเป้า')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {selected && (() => {
          const k = selected;
          const now = kpiNow(d, k);
          return (
            <Drawer heading={tx(k.name)} sub={`${k.id} · ${tx(KPI_DOMAIN[k.domain])}`} onClosed={() => setSelectedId(null)} foot={<>
              <span className="grow"></span>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.setKpiTarget(k)}>{tx('เปลี่ยนเป้าหมาย')}</UiButton>
            </>}>
              <dl className="data-grid">
                <dt>{tx('สูตร')}</dt><dd>{tx(k.formula)}</dd>
                <dt>{tx('แหล่งข้อมูล')}</dt><dd>{tx(k.source)}</dd>
                <dt>{tx('หน่วย')}</dt><dd>{tx(k.unit)}</dd>
                <dt>{tx('ทิศทางที่ดี')}</dt><dd>{tx(k.better === 'higher' ? 'ยิ่งสูงยิ่งดี' : 'ยิ่งต่ำยิ่งดี')}</dd>
                <dt>{tx('เป้าหมาย')}</dt><dd>{k.better === 'higher' ? '≥' : '≤'} {k.target}</dd>
                <dt>{tx('ค่าเทียบมาตรฐาน')}</dt><dd>{k.benchmark ? <span>{k.benchmark[1]} · {tx(k.benchmark[0])}</span> : <span>{tx('ไม่มี')}</span>}</dd>
                <dt>{tx('ผู้รับผิดชอบ')}</dt><dd>{tx(k.owner)}</dd>
              </dl>
              {now.live && <p className="notice info">{tx('เดือนนี้คำนวณจากข้อมูลของโมดูลต้นทางตอนเปิดหน้า เดือนก่อนหน้าเป็นค่าที่บันทึกไว้')}</p>}
              <div className="section-title">{tx('12 เดือน')}</div>
              <div className="table-wrap">
                <table className="bo-table kpi-months">
                  <thead><tr><th scope="col">{tx('ประจำเดือน')}</th><th scope="col" className="num">{tx('ค่า')}</th><th scope="col">{tx('เทียบเป้า')}</th></tr></thead>
                  <tbody>
                    {[...kpiSeries(d, k)].reverse().map(s => (
                      <tr key={s[0]} className="static"><td>{s[0]}</td><td className={cx('num', !onTarget(k, s[1]) && 'text-danger')}>{s[1]}</td><td>{tx(onTarget(k, s[1]) ? 'ถึงเป้า' : 'ไม่ถึงเป้า')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="section-title">{tx('ประวัติ')}</div>
              <ul className="timeline compact">
                {k.history.map((h, n) => <li key={n} className="tl"><b>{tx(h[2])}</b> · {tx(h[1])}<div className="secondary">{h[0]} · {tx(h[3])}</div></li>)}
              </ul>
            </Drawer>
          );
        })()}
      </div>
    </bo-kpi-library>
  );
}
