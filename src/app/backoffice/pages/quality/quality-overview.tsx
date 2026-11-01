/* The quality dashboard: what waits in patient safety, a year of events by month, the KPIs off their target, and the open events (quality.overview, M12 P2) */
import { Link, useNavigate } from 'react-router';

import { cx } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import {
  CATCH_POINT, complaintCounts, HARM, INCIDENT_STATUS, KPI_DOMAIN, kpiNow, NEAR_MISS_STATUS, qualityCounts, reporterOf, SAFETY_CATEGORY, safetyTrend, triageLate,
} from '../../data/quality';
import type { Incident, NearMiss } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

type Row = { kind: 'incident'; at: string; item: Incident } | { kind: 'near-miss'; at: string; item: NearMiss };

export function QualityOverviewComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const navigate = useNavigate();

  const d = store.data;
  const q = qualityCounts(d);
  const c = complaintCounts(d);
  const trend = safetyTrend(d);
  const offTarget = d.kpis.map(def => ({ def, now: kpiNow(d, def) })).filter(k => !k.now.met);
  const open: Row[] = [
    ...d.incidents.filter(i => i.status !== 'closed').map(item => ({ kind: 'incident' as const, at: item.at, item })),
    ...d.nearMisses.filter(n => n.status === 'open').map(item => ({ kind: 'near-miss' as const, at: item.at, item })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const go = (r: Row) => navigate(`${r.kind === 'incident' ? '/backoffice/quality/incidents' : '/backoffice/quality/near-miss'}?id=${r.item.id}`);

  return (
    <bo-quality-overview className="page">
      <PageHead heading="ภาพรวมคุณภาพและความปลอดภัย" source="M12 P2 · อุบัติการณ์ เหตุเกือบพลาด RCA และตัวชี้วัดเทียบ TAHSA/AAHA · ข้อร้องเรียนจาก M28 · ต้นแบบก่อนสัญญาหน้าของ M12 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <Link className={cx('kpi', q.awaitingTriage > 0 && 'warn')} role="listitem" to="/backoffice/quality/incidents">
          <span className="kpi-value">{q.awaitingTriage}</span><span className="kpi-label">{tx('อุบัติการณ์รอคัดกรอง')}</span>
          {q.triageLate > 0 && <span className="kpi-sub text-danger">{tx('เกินกำหนดคัดกรอง {n}', { n: q.triageLate })}</span>}
        </Link>
        <Link className={cx('kpi', q.severeOpen > 0 && 'danger')} role="listitem" to="/backoffice/quality/incidents">
          <span className="kpi-value">{q.severeOpen}</span><span className="kpi-label">{tx('อันตรายรุนแรงที่ยังไม่ปิด')}</span>
        </Link>
        <Link className="kpi" role="listitem" to="/backoffice/quality/near-miss">
          <span className="kpi-value">{q.nearMiss30}</span><span className="kpi-label">{tx('เหตุเกือบพลาด 30 วัน')}</span>
          {q.nearMissOpen > 0 && <span className="kpi-sub">{tx('รอมาตรการ {n}', { n: q.nearMissOpen })}</span>}
        </Link>
        <Link className={cx('kpi', q.rcaReview > 0 && 'warn')} role="listitem" to="/backoffice/quality/rca">
          <span className="kpi-value">{q.rcaOpen}</span><span className="kpi-label">{tx('RCA ที่ยังไม่อนุมัติ')}</span>
          {q.rcaReview > 0 && <span className="kpi-sub">{tx('รออนุมัติ {n}', { n: q.rcaReview })}</span>}
        </Link>
        <Link className={cx('kpi', q.actionsLate > 0 && 'danger')} role="listitem" to="/backoffice/quality/rca">
          <span className="kpi-value">{q.actionsLate}</span><span className="kpi-label">{tx('มาตรการ RCA เกินกำหนด')}</span>
        </Link>
        <Link className={cx('kpi', (c.dueSoon > 0 || c.breached > 0) && 'warn')} role="listitem" to="/backoffice/quality/complaints">
          <span className="kpi-value">{c.open}</span><span className="kpi-label">{tx('ข้อร้องเรียนที่ยังไม่ตอบ')}</span>
          {c.dueSoon > 0 && <span className="kpi-sub">{tx('ใกล้ครบกำหนด {n}', { n: c.dueSoon })}</span>}
        </Link>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('เหตุการณ์ 12 เดือน')}</b><span className="secondary grow">{tx('นับตามเดือนที่เกิดเหตุ · เดือนนี้ถึงวันนี้')}</span></div>
        <div className="table-wrap">
          <table className="bo-table dt-months qps-months">
            <thead><tr><th scope="col">{tx('ประจำเดือน')}</th>{trend.map(m => <th key={m.month} scope="col" className="num">{m.month.slice(2).replace('-', '/')}</th>)}</tr></thead>
            <tbody>
              <tr className="static"><th scope="row">{tx('อุบัติการณ์')}</th>{trend.map(m => <td key={m.month} className="num">{m.incidents}</td>)}</tr>
              <tr className="static"><th scope="row">{tx('อันตรายรุนแรงขึ้นไป')}</th>{trend.map(m => <td key={m.month} className={cx('num', m.severe > 0 && 'failure')}>{m.severe || ''}</td>)}</tr>
              <tr className="static"><th scope="row">{tx('เหตุเกือบพลาด')}</th>{trend.map(m => <td key={m.month} className={cx('num', m.nearMisses > 0 && 'planned')}>{m.nearMisses}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="secondary foot-note">{tx('เหตุเกือบพลาดที่รายงานมากกว่าอุบัติการณ์ คือสัญญาณว่าการรายงานทำงาน ไม่ใช่ว่าเกิดความผิดพลาดมากขึ้น')}</p>
      </div>

      <div className="split pair">
        <div className="panel">
          <div className="filter-bar"><b>{tx('ตัวชี้วัดที่ไม่ถึงเป้า')}</b><span className="secondary grow">{tx('{n} จาก {all} ตัว', { n: offTarget.length, all: d.kpis.length })}</span><Link className="link" to="/backoffice/quality/kpi">{tx('คลังตัวชี้วัด')}</Link></div>
          <div className="table-wrap">
            <table className="bo-table">
              <thead><tr><th scope="col">{tx('ตัวชี้วัด')}</th><th scope="col" className="num w-kind">{tx('ล่าสุด')}</th><th scope="col" className="num w-kind">{tx('เป้าหมาย')}</th><th scope="col" className="w-status">{tx('แนวโน้ม')}</th></tr></thead>
              <tbody>
                {offTarget.map(k => (
                  <tr key={k.def.id} className="static">
                    <td>{tx(k.def.name)}<div className="secondary">{tx(KPI_DOMAIN[k.def.domain])} · {tx(k.def.unit)}{k.now.live && <> · {tx('คำนวณตอนนี้')}</>}</div></td>
                    <td className="num text-danger"><b>{k.now.value}</b></td>
                    <td className="num">{k.def.better === 'higher' ? '≥' : '≤'} {k.def.target}</td>
                    <td>{tx(k.now.improving === null ? 'คงที่' : k.now.improving ? 'ดีขึ้น' : 'แย่ลง')}<div className="secondary">{tx('เดือนก่อน {v}', { v: k.now.previous ?? '—' })}</div></td>
                  </tr>
                ))}
                {!offTarget.length && <tr className="static"><td colSpan={4} className="empty ok-text">{tx('ทุกตัวชี้วัดถึงเป้า')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="filter-bar"><b>{tx('เหตุการณ์ที่ยังเปิด')}</b><span className="secondary grow">{tx('{n} รายการ · ล่าสุดก่อน', { n: open.length })}</span></div>
          <div className="table-wrap">
            <table className="bo-table qps-open">
              <thead><tr><th scope="col" className="w-ref">{tx('เลขที่')}</th><th scope="col">{tx('เหตุการณ์')}</th><th scope="col" className="w-status">{tx('สถานะ')}</th></tr></thead>
              <tbody>
                {open.map(r => (
                  <tr key={r.item.id} tabIndex={0} onClick={() => go(r)} onKeyDown={event => { if (event.key === 'Enter') { go(r); } }}>
                    <td><b>{r.item.id}</b><div className="secondary">{r.at}</div></td>
                    {r.kind === 'incident' ? <>
                      <td>{tx(r.item.description)}<div className="secondary">{tx(SAFETY_CATEGORY[r.item.category])} · {tx(r.item.location)} · {tx(reporterOf(r.item))}</div></td>
                      <td>
                        <span className={`chip ${HARM[r.item.harm].cls}`}>{tx(HARM[r.item.harm].label)}</span>
                        <div className={cx('secondary', triageLate(r.item) && 'text-danger')}>{tx(triageLate(r.item) ? 'เกินกำหนดคัดกรอง' : INCIDENT_STATUS[r.item.status].label)}</div>
                      </td>
                    </> : <>
                      <td>{tx(r.item.description)}<div className="secondary">{tx('เหตุเกือบพลาด')} · {tx(CATCH_POINT[r.item.caughtAt])} · {tx(r.item.location)}</div></td>
                      <td><span className={`chip ${NEAR_MISS_STATUS[r.item.status].cls}`}>{tx(NEAR_MISS_STATUS[r.item.status].label)}</span></td>
                    </>}
                  </tr>
                ))}
                {!open.length && <tr className="static"><td colSpan={3} className="empty">{tx('ไม่มีเหตุการณ์ที่เปิดอยู่')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </bo-quality-overview>
  );
}
