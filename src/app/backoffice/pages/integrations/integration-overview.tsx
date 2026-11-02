/* The connectors at a glance: health, backlog and when each was last heard from, the failed deliveries first, and a way into each (INT-OVW-01, COMPOSED) */
import { Link } from 'react-router';

import { baht } from '../../../clinic/data/rail';
import { cx } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { DOC_TYPE } from '../../data/finance';
import { accountingHealth, connectors, ERROR_CLASS, errorClassOf, HEALTH } from '../../data/integrations';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

export function IntegrationOverviewComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const a = accountingHealth(store.data);
  const rows = connectors(store.data);
  const failed = store.data.accountingExports.filter(x => x.status === 'failed').sort((x, y) => x.firstAt.localeCompare(y.firstAt));
  const days = a.oldestFailedHours >= 48;

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-integration-overview className="page">
      <PageHead heading="ภาพรวมการเชื่อมต่อระบบ" source="INT-OVW-01 · COMPOSED · สถานะจากบันทึกการส่งและผลทดสอบของแต่ละ connector · ไม่มีการแก้ไขที่หน้านี้" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <Link className={cx('kpi', a.failed > 0 && 'danger')} role="listitem" to="/backoffice/integrations/accounting/queue">
          <span className="kpi-value">{a.failed}</span><span className="kpi-label">{tx('รายการส่งบัญชีที่ล้มเหลว')}</span>
          {a.failed > 0 && <span className="kpi-sub">{tx(days ? 'ค้างนานสุด {n} วัน' : 'ค้างนานสุด {n} ชม.', { n: days ? Math.floor(a.oldestFailedHours / 24) : a.oldestFailedHours })}</span>}
        </Link>
        <Link className="kpi" role="listitem" to="/backoffice/integrations/accounting/queue"><span className="kpi-value">{a.queued}</span><span className="kpi-label">{tx('รอส่ง')}</span></Link>
        <Link className={cx('kpi', a.lastTest?.result === 'auth-failed' && 'danger')} role="listitem" to="/backoffice/integrations/accounting/config">
          <span className="kpi-value">{a.lastTest?.at.slice(11) ?? '—'}</span><span className="kpi-label">{tx('ทดสอบการเชื่อมต่อล่าสุด')}</span>
          {a.lastTest && <span className="kpi-sub">{tx(a.lastTest.result === 'passed' ? 'ผ่าน' : 'ยืนยันตัวตนไม่ผ่าน')}</span>}
        </Link>
        <div className="kpi" role="listitem"><span className="kpi-value">{a.lastSuccess?.slice(11) ?? '—'}</span><span className="kpi-label">{tx('ส่งสำเร็จล่าสุด')}</span><span className="kpi-sub">{a.lastSuccess?.slice(0, 10)}</span></div>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('Connector ที่มีสัญญา')}</b><span className="secondary grow">{tx('ตั้งค่าแล้วไม่ได้แปลว่าทำงานปกติ · ทดสอบผ่านไม่ได้แปลว่าการจับคู่ข้อมูลถูกต้อง')}</span></div>
        <div className="table-wrap">
          <table className="bo-table connectors">
            <thead><tr>
              <th scope="col">Connector</th>
              <th scope="col" className="w-kind">{tx('ประเภท')}</th>
              <th scope="col" className="w-status">{tx('สถานะ')}</th>
              <th scope="col" className="w-kind">{tx('งานค้าง/ล้มเหลว')}</th>
              <th scope="col" className="w-at">{tx('ล่าสุด')}</th>
              <th scope="col" className="w-owner">{tx('ความพร้อม')}</th>
            </tr></thead>
            <tbody>
              {pager.rows.map(c => (
                <tr key={c.key} className="static">
                  <td><Link className="link" to={c.link} aria-label={`${tx('เปิดการเชื่อมต่อ')} ${c.name}`}>{c.name}</Link></td>
                  <td>{tx(c.kind)}</td>
                  <td><span className={`chip ${HEALTH[c.health].cls}`}>{tx(HEALTH[c.health].label)}</span></td>
                  <td>
                    {c.backlog.failed > 0 && <span className="text-danger">{tx('ล้มเหลว {n}', { n: c.backlog.failed })}</span>}
                    {c.backlog.queued > 0 && <div className="secondary">{tx('ในคิว {n}', { n: c.backlog.queued })}</div>}
                    {!c.backlog.failed && !c.backlog.queued && <span className="secondary">—</span>}
                  </td>
                  <td className="num">{c.observed ?? '—'}</td>
                  <td>{tx(c.readiness)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PagerFoot pager={pager} />
        <p className="secondary foot-note">{tx('การเชื่อมต่อบางประเภทยังไม่อยู่ในขอบเขต')}</p>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('การส่งข้อมูลบัญชีที่ไม่สำเร็จ')}</b><span className="secondary grow">{tx('เก่าสุดก่อน · ส่งใหม่ที่คิวส่งข้อมูลบัญชี')}</span></div>
        <div className="table-wrap">
          <table className="bo-table">
            <thead><tr>
              <th scope="col" className="w-ref">{tx('รหัสส่ง')}</th>
              <th scope="col">{tx('เอกสารต้นทาง')}</th>
              <th scope="col" className="w-amount num">{tx('จำนวนเงิน')}</th>
              <th scope="col" className="w-kind">{tx('ประเภทข้อผิดพลาด')}</th>
              <th scope="col" className="w-at">{tx('ส่งครั้งแรก')}</th>
            </tr></thead>
            <tbody>
              {failed.map(x => (
                <tr key={x.id} className="static">
                  <td><Link className="link" to={`/backoffice/integrations/accounting/queue?q=${x.id}`}>{x.id}</Link></td>
                  <td>{x.document}<div className="secondary">{tx(DOC_TYPE[x.docType])}</div></td>
                  <td className="num">{baht(x.amount)}</td>
                  <td>{tx(ERROR_CLASS[errorClassOf(x.errorCode) ?? 'other'])}<div className="secondary">{x.errorCode}</div></td>
                  <td className="num">{x.firstAt}</td>
                </tr>
              ))}
              {!failed.length && <tr className="static"><td colSpan={5} className="empty">{tx('ไม่มีการส่งที่ล้มเหลว')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </bo-integration-overview>
  );
}
