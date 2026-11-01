/* Retention: each dataset's policy, what is past its window, and what is held on purpose; purging is the backend's and not enforced yet (GOV-RET-01 quality.retention, M31 · GATED) */
import { Link } from 'react-router';

import { cx } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

export function RetentionComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const rows = store.data.retention;
  const past = rows.reduce((n, d) => n + d.pastWindow, 0);
  const held = rows.filter(d => d.hold).length;

  return (
    <bo-retention className="page">
      <PageHead heading="นโยบายการเก็บรักษาข้อมูล" source="GOV-RET-01 · M31 · สถานะการเก็บต่อชุดข้อมูล (อ่านอย่างเดียว) · นโยบายตั้งที่ settings/11 · auto-purge เป็นงานของ backend · สัญญาการออกแบบ (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />
      <p className="notice warn">{tx('การบังคับนโยบายการเก็บยังไม่เปิดใช้งาน: ข้อมูลที่เกินระยะเก็บยังไม่ถูกลบอัตโนมัติ ตัวเลขด้านล่างเป็นข้อมูลตัวอย่าง')}</p>

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{rows.length}</span><span className="kpi-label">{tx('ชุดข้อมูล')}</span></div>
        <div className={cx('kpi', past > 0 && 'warn')} role="listitem"><span className="kpi-value">{past.toLocaleString('en-US')}</span><span className="kpi-label">{tx('เกินระยะเก็บ รอ auto-purge')}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{held}</span><span className="kpi-label">{tx('ชุดข้อมูลที่ถูกระงับการลบ')}</span></div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="bo-table retention">
            <thead><tr>
              <th scope="col">{tx('ชุดข้อมูล')}</th>
              <th scope="col" className="w-owner">{tx('นโยบายการเก็บ')}</th>
              <th scope="col" className="w-owner">{tx('ฐานทางกฎหมาย')}</th>
              <th scope="col" className="num w-kind">{tx('จำนวน')}</th>
              <th scope="col" className="num w-kind">{tx('เกินระยะเก็บ')}</th>
              <th scope="col" className="w-status">{tx('สถานะการลบ')}</th>
            </tr></thead>
            <tbody>
              {rows.map(d => (
                <tr key={d.id} className="static">
                  <td><b>{tx(d.dataset)}</b><div className="secondary">{tx(d.module)}{d.hold && <> · <span className="text-danger">{tx('ระงับการลบ: {why}', { why: tx(d.hold) })}</span></>}</div></td>
                  <td>{tx(d.policy)}</td>
                  <td>{tx(d.basis)}</td>
                  <td className="num">{d.records.toLocaleString('en-US')}</td>
                  <td className={cx('num', d.pastWindow > 0 && 'text-danger')}>{d.pastWindow.toLocaleString('en-US')}</td>
                  <td><span className="chip quiet">GATED</span><div className="secondary">{tx(d.pastWindow ? 'รอ auto-purge' : 'ไม่มีที่ต้องลบ')}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="secondary foot-note">{tx('แก้นโยบายที่ ตั้งค่าระบบ > นโยบายการเก็บรักษา (settings/11) · บันทึกตรวจสอบเก็บ 7 ปีตามกฎหมาย ดูที่')} <Link className="link" to="/backoffice/quality/audit-integrity">{tx('ตรวจความถูกต้อง Audit')}</Link></p>
      </div>
    </bo-retention>
  );
}
