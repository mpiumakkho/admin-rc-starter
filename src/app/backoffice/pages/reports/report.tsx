/* An executive report: its strip, one or two single-series charts, the ranked rows that lead back to their owning pages, and each figure's metric contract (reports.*, COMPOSED) */
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { cx } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { SEVERITY } from '../../data/home';
import { type Bar, CUTOFF, PERIODS, report, type ReportKey } from '../../data/reports';
import { useBoI18n } from '../../i18n/bo-i18n';
import { ModuleTag, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const KEYS: ReportKey[] = ['executive', 'revenue', 'inventory', 'workforce', 'assets', 'quality', 'compliance'];
const max = (list: Bar[]) => Math.max(0, ...list.map(b => b.value));

export function ReportComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const { report: param = 'executive' } = useParams();
  const key = (KEYS.includes(param as ReportKey) ? param : 'executive') as ReportKey;
  const [days, setDays] = useState(30);
  const r = report(key, store.clinic.data, store.data, days);

  /** The table's pages */
  const pager = usePager(r.rows);
  return (
    <bo-report className="page">
      <PageHead heading={r.title} source={r.source} freshness={tx('ตัดข้อมูล {at}', { at: CUTOFF })}>
        {r.periodic && (
          <div className="segmented" role="group" aria-label={tx('ช่วงเวลา')}>
            {PERIODS.map(([n, label]) => (
              <button key={n} type="button" className={cx(days === n && 'active')} aria-pressed={days === n} onClick={() => setDays(n)}>{tx(label)}</button>
            ))}
          </div>
        )}
      </PageHead>
      <p className="notice info">{tx('metric ต้นแบบ ไม่ใช่ตัวเลขทางการ: ทุกตัวเลขมีสูตร แหล่งข้อมูล และข้อจำกัดในส่วนสัญญาตัวชี้วัดด้านล่าง · รายงานไม่ใช่แหล่งบันทึกรายการ แก้ไขที่หน้าต้นทางเท่านั้น')}</p>

      <div className="kpi-strip" role="list">
        {r.tiles.map(t => (
          <Link key={t.label} className={cx('kpi', t.tone === 'danger' && 'danger', t.tone === 'warn' && 'warn')} role="listitem" to={t.link}>
            <span className="kpi-value">{t.value}</span><span className="kpi-label">{tx(t.label)}</span>
            {t.sub && <span className="kpi-sub">{tx(t.sub)}</span>}
          </Link>
        ))}
      </div>

      <div className={cx('split', r.charts.length > 1 && 'pair')}>
        {r.charts.map(c => {
          const top = max(c.bars);
          return (
            <figure key={c.title} className="panel report-chart">
              <figcaption className="filter-bar"><b>{tx(c.title)}</b><span className="secondary grow">{tx(c.note)}</span></figcaption>
              {top ? (
                <ul className="hbars">
                  {c.bars.map(b => (
                    <li key={b.label} title={`${tx(b.label)}: ${b.text}`}>
                      <span className="hbar-label">{tx(b.label)}</span>
                      <span className="hbar-track" aria-hidden="true"><span className="hbar-fill" style={{ width: `${(b.value / top) * 100}%` }} /></span>
                      <span className="hbar-value">{b.text}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="secondary foot-note">{tx('ไม่มีข้อมูลในช่วงนี้')}</p>}
            </figure>
          );
        })}
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx(r.rowsTitle)}</b><span className="secondary grow">{tx(r.rowsNote)} · {tx('{n} รายการ', { n: r.rows.length })}</span></div>
        <div className="table-wrap">
          <table className="bo-table report-rows">
            <thead><tr>
              <th scope="col" className="w-priority">{tx('ความเร่งด่วน')}</th>
              <th scope="col" className="w-module">{tx('โมดูล')}</th>
              <th scope="col" className="w-owner">{tx('ประเภท')}</th>
              <th scope="col">{tx('รายการ')}</th>
            </tr></thead>
            <tbody>
              {pager.rows.map((x, i) => (
                <tr key={i} className="static">
                  <td><span className={cx('chip', SEVERITY[x.severity].cls)}>{tx(SEVERITY[x.severity].label)}</span></td>
                  <td><ModuleTag code={x.module} /></td>
                  <td>{tx(x.kind)}</td>
                  <td><Link className="link" to={x.link}>{tx(x.ref)}</Link><div className="secondary">{tx(x.detail)}</div></td>
                </tr>
              ))}
              {!r.rows.length && <tr className="static"><td colSpan={4} className="empty">{tx('ไม่มีรายการที่ต้องตัดสินใจ ณ เวลาตัดข้อมูล')}</td></tr>}
            </tbody>
          </table>
        </div>
        <PagerFoot pager={pager} />
      </div>

      <details className="panel metric-contracts">
        <summary><b>{tx('สัญญาตัวชี้วัด (ต้นแบบ)')}</b> <span className="secondary">{tx('{n} ตัว · สูตร แหล่งข้อมูล เวลาตัดข้อมูล เจ้าของ และข้อจำกัด', { n: r.metrics.length })}</span></summary>
        <div className="table-wrap">
          <table className="bo-table">
            <thead><tr>
              <th scope="col">{tx('ตัวชี้วัด')}</th>
              <th scope="col">{tx('สูตร')}</th>
              <th scope="col" className="w-owner">{tx('แหล่งข้อมูล')}</th>
              <th scope="col" className="w-owner">{tx('เจ้าของ')}</th>
              <th scope="col">{tx('ข้อจำกัด')}</th>
            </tr></thead>
            <tbody>
              {r.metrics.map(m => (
                <tr key={m.label} className="static">
                  <td><b>{tx(m.label)}</b><div className="secondary">{tx(m.cutoff)}</div></td>
                  <td>{tx(m.formula)}</td>
                  <td>{tx(m.source)}</td>
                  <td>{tx(m.owner)}</td>
                  <td>{tx(m.limitation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </bo-report>
  );
}
