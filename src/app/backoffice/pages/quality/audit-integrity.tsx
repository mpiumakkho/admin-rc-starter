/* Audit integrity and retention: per-event hashes as the server checked them, relay gaps kept apart from tampering, chain and retention not enabled yet (GOV-AUD-03, M13 · P3 GATED) */
import { Link } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { integrity, integrityCounts } from '../../data/governance';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const ids = (events: { id: string }[]) => events.map(e => e.id).join(', ');

export function AuditIntegrityComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const rows = integrity(store.data);
  const c = integrityCounts(store.data);

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-audit-integrity className="page">
      <PageHead heading="ความถูกต้องและการเก็บ Audit" source="GOV-AUD-03 · M13 · event_hash ต่อเหตุการณ์ตรวจโดย server · การตรวจแบบลูกโซ่ (prev_hash) และการเก็บ 7 ปีแบ่งรายเดือนเป็น P3 · บันทึกแก้ ลบ หรือซ่อมไม่ได้" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{c.verified}</span><span className="kpi-label">{tx('hash ตรวจแล้วถูกต้อง')}</span></div>
        <div className={cx('kpi', c.mismatch > 0 && 'danger')} role="listitem"><span className="kpi-value">{c.mismatch}</span><span className="kpi-label">{tx('ไม่ตรงกับ hash')}</span>{c.open > 0 && <span className="kpi-sub text-danger">{tx('ยังไม่เปิด finding {n}', { n: c.open })}</span>}</div>
        <div className={cx('kpi', c.gaps > 0 && 'warn')} role="listitem"><span className="kpi-value">{c.gaps}</span><span className="kpi-label">{tx('ช่วงที่ relay ขาด')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">P3</span><span className="kpi-label">{tx('การตรวจแบบลูกโซ่ · การเก็บ 7 ปี')}</span></div>
      </div>
      <p className="notice info">{tx('การตรวจสอบแบบลูกโซ่ยังไม่เปิดใช้งาน: ยืนยันได้ว่าเนื้อหาแต่ละเหตุการณ์ไม่ถูกแก้ แต่ยังยืนยันไม่ได้ว่าไม่มีเหตุการณ์หายหรือสลับลำดับ')}</p>

      <div className="panel">
        <div className="filter-bar"><b>{tx('หลักฐานความถูกต้องรายเดือน')}</b><span className="secondary grow">{tx('ช่องว่างจาก relay คือข้อมูลยังไม่ครบ ไม่ใช่การแก้ไข')}</span></div>
        <div className="table-wrap">
          <table className="bo-table integrity">
            <thead><tr>
              <th scope="col" className="w-due">{tx('ช่วง')}</th>
              <th scope="col" className="num w-kind">{tx('จำนวนเหตุการณ์')}</th>
              <th scope="col" className="w-owner">event_hash</th>
              <th scope="col">{tx('ช่องว่างการนำเข้า')}</th>
              <th scope="col" className="w-at">{tx('ตรวจเมื่อ')}</th>
              <th scope="col" className="w-actions">finding</th>
            </tr></thead>
            <tbody>
              {pager.rows.map(p => (
                <tr key={p.period} className="static">
                  <td><b>{p.period}</b></td>
                  <td className="num">{p.events}</td>
                  <td>{p.mismatch.length > 0
                    ? <><span className="chip danger">{tx('ไม่ตรงกับ hash')} {p.mismatch.length}</span><div className="secondary">{ids(p.mismatch)}</div></>
                    : <span className="chip ok">{tx('ตรวจแล้วถูกต้อง')} {p.verified}</span>}</td>
                  <td>{p.gaps.map(g => <div key={g[0]}>{tx('{at} · {n} นาที', { at: g[0], n: g[1] })}</div>)}{!p.gaps.length && <span className="secondary">{tx('ไม่มี')}</span>}</td>
                  <td className="num">{p.checkedAt}</td>
                  <td>{p.finding
                    ? <><span className="chip warn">{tx('เปิดแล้ว')}</span><div className="secondary">{tx(p.finding.by)} · {tx(p.finding.note)}</div></>
                    : p.mismatch.length > 0 ? <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.recordFinding(p.source, ids(p.mismatch))}>{tx('เปิด finding')}</UiButton>
                    : <span className="secondary">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PagerFoot pager={pager} />
        <p className="secondary foot-note">{tx('hash ที่ไม่ตรงเปิดเป็น finding ให้ Security owner สอบสวน ไม่มีการแก้อัตโนมัติ')} <Link className="link" to="/backoffice/quality/audit">{tx('เปิดใน Audit Explorer')}</Link></p>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('การเก็บรักษา')}</b><span className="chip quiet">GATED</span></div>
        <p className="notice warn">{tx('การบังคับนโยบายการเก็บยังไม่เปิดใช้งาน: เป้าหมาย 7 ปีแบ่ง partition รายเดือน (P3) ยังไม่มีบันทึกการลบ นโยบายอยู่ที่ settings/11')}</p>
      </div>
    </bo-audit-integrity>
  );
}
