/* The DPO's dashboard: the statutory clocks of requests and breaches, the case queues, and how fresh the policies and records are (quality.pdpa, M31 P1 · GATED) */
import { Link, useNavigate } from 'react-router';

import { cx } from '../../../user-management/ui';
import { useBackofficeStore } from '../../backoffice.store';
import { BREACH_STATUS, breachFlag, CONSENT_VERSION, daysLeft, dpoCounts, DSAR_RIGHT, DSAR_STATUS, dsarFlag, DUE_FLAG, isActive, owedNotices } from '../../data/governance';
import { hoursLeft } from '../../data/quality';
import type { Breach, DsarRequest } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

type Case = { kind: 'dsar'; due: string; item: DsarRequest } | { kind: 'breach'; due: string; item: Breach };
const hours = (b: Breach) => Math.max(0, Math.floor(hoursLeft(b.statutoryDue)));

export function PdpaOverviewComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const navigate = useNavigate();

  const d = store.data;
  const c = dpoCounts(d);
  const cases: Case[] = [
    ...d.dsars.filter(isActive).map(item => ({ kind: 'dsar' as const, due: `${item.statutoryDue} 23:59`, item })),
    ...d.breaches.filter(b => b.status !== 'closed').map(item => ({ kind: 'breach' as const, due: item.statutoryDue, item })),
  ].sort((a, b) => a.due.localeCompare(b.due));
  const lastRopa = d.ropaExports[0];
  const pendingTransfers = d.crossBorder.filter(x => x.status === 'pending').length;
  const open = (x: Case) => navigate(`${x.kind === 'dsar' ? '/backoffice/quality/dsar' : '/backoffice/quality/breach'}/${x.item.id}`);

  return (
    <bo-pdpa-overview className="page">
      <PageHead heading="ภาพรวมการคุ้มครองข้อมูลส่วนบุคคล" source="M31 P1 · DSAR 30 วัน · เหตุละเมิด 72 ชม. · ความยินยอม การเก็บรักษา และ RoPA · เส้นตายกำหนดโดย backend · สัญญาการออกแบบ (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />
      <p className="notice warn">{tx('ระบบ PDPA (M31) ยังไม่พร้อม หน้านี้เป็นสัญญาการออกแบบ ตัวเลขทั้งหมดมาจากข้อมูลตัวอย่าง ไม่ใช่ /pdpa/v1/dashboard')}</p>

      <div className="kpi-strip" role="list">
        <Link className={cx('kpi', c.dsarNear > 0 && 'warn', c.dsarOverdue > 0 && 'danger')} role="listitem" to="/backoffice/quality/dsar">
          <span className="kpi-value">{c.dsarOpen}</span><span className="kpi-label">{tx('คำขอ DSAR ที่เปิดอยู่')}</span>
          {(c.dsarNear > 0 || c.dsarOverdue > 0) && <span className="kpi-sub">{tx('ใกล้ครบ 30 วัน {n} · เกินกำหนด {o}', { n: c.dsarNear, o: c.dsarOverdue })}</span>}
        </Link>
        <Link className={cx('kpi', c.breachNear > 0 && 'danger')} role="listitem" to="/backoffice/quality/breach">
          <span className="kpi-value">{c.breachOpen}</span><span className="kpi-label">{tx('เหตุละเมิดที่ยังไม่ปิด')}</span>
          {c.breachNear > 0 && <span className="kpi-sub text-danger">{tx('ใกล้ครบ 72 ชม. {n}', { n: c.breachNear })}</span>}
        </Link>
        <Link className={cx('kpi', c.unnotified > 0 && 'warn')} role="listitem" to="/backoffice/quality/breach">
          <span className="kpi-value">{c.unnotified}</span><span className="kpi-label">{tx('ยังไม่แจ้ง สคส.')}</span>
        </Link>
        <Link className="kpi" role="listitem" to="/backoffice/quality/consent">
          <span className="kpi-value">{c.withdrawn30}</span><span className="kpi-label">{tx('ถอนความยินยอม 30 วัน')}</span>
        </Link>
        <Link className={cx('kpi', c.exportsPending > 0 && 'warn')} role="listitem" to="/backoffice/quality/audit-exports">
          <span className="kpi-value">{c.exportsPending}</span><span className="kpi-label">{tx('คำขอส่งออก Audit รออนุมัติ')}</span>
        </Link>
      </div>

      <div className="split pair">
        <div className="panel">
          <div className="filter-bar"><b>{tx('คำขอและเหตุที่ต้องทำ')}</b><span className="secondary grow">{tx('{n} รายการ · ใกล้เส้นตายก่อน', { n: cases.length })}</span></div>
          <div className="table-wrap">
            <table className="bo-table dpo-cases">
              <thead><tr><th scope="col" className="w-ref">{tx('เลขที่')}</th><th scope="col">{tx('เรื่อง')}</th><th scope="col" className="w-due">{tx('เส้นตาย')}</th><th scope="col" className="w-status">{tx('สถานะ')}</th></tr></thead>
              <tbody>
                {cases.map(x => (
                  <tr key={x.item.id} tabIndex={0} onClick={() => open(x)} onKeyDown={event => { if (event.key === 'Enter') { open(x); } }}>
                    <td><b>{x.item.id}</b></td>
                    {x.kind === 'dsar' ? (() => {
                      const f = dsarFlag(x.item);
                      return <>
                        <td>{tx(DSAR_RIGHT[x.item.right])}<div className="secondary">{tx(x.item.requester)}</div></td>
                        <td className="num">{x.item.statutoryDue}<div className={cx('secondary', f !== 'ok' && 'text-danger')}>{tx('เหลือ {n} วัน', { n: daysLeft(x.item) })}</div></td>
                        <td><span className={`chip ${DSAR_STATUS[x.item.status].cls}`}>{tx(DSAR_STATUS[x.item.status].label)}</span>{f && f !== 'ok' && <div className="secondary text-danger">{tx(DUE_FLAG[f].label)}</div>}</td>
                      </>;
                    })() : (() => {
                      const f = breachFlag(x.item);
                      const owed = owedNotices(x.item).length;
                      return <>
                        <td>{tx(x.item.title)}<div className="secondary">{tx('เหตุละเมิด · กระทบ {n} ราย', { n: x.item.affected.count })}</div></td>
                        <td className="num">{x.item.statutoryDue}{f && <div className={cx('secondary', f !== 'ok' && 'text-danger')}>{tx('เหลือ {n} ชม.', { n: hours(x.item) })}</div>}</td>
                        <td><span className={`chip ${BREACH_STATUS[x.item.status].cls}`}>{tx(BREACH_STATUS[x.item.status].label)}</span>{owed > 0 && <div className="secondary">{tx('ต้องแจ้ง {n} ราย', { n: owed })}</div>}</td>
                      </>;
                    })()}
                  </tr>
                ))}
                {!cases.length && <tr className="static"><td colSpan={4} className="empty">{tx('ไม่มีคำขอหรือเหตุที่เปิดอยู่ในข้อมูลตัวอย่าง')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="filter-bar"><b>{tx('ความทันสมัยของนโยบายและบันทึก')}</b></div>
          <div className="table-wrap">
            <table className="bo-table">
              <thead><tr><th scope="col">{tx('รายการ')}</th><th scope="col" className="w-due">{tx('ล่าสุด')}</th><th scope="col" className="w-status">{tx('สถานะ')}</th></tr></thead>
              <tbody>
                <tr className="static"><td>{tx('แบบฟอร์มความยินยอม (settings/10)')}</td><td>{CONSENT_VERSION}</td><td><span className="chip quiet">GATED</span></td></tr>
                <tr className="static"><td>{tx('RoPA ที่สร้างล่าสุด')}</td><td>{lastRopa?.at ?? '—'}</td><td><Link className="link" to="/backoffice/quality/ropa">{tx('เปิด RoPA')}</Link></td></tr>
                <tr className="static"><td>{tx('กิจกรรมใน RoPA ที่ไม่ได้ทบทวนเกิน 1 ปี')}</td><td className="num">{c.ropaStale}</td>
                  <td><span className={`chip ${c.ropaStale ? 'warn' : 'ok'}`}>{tx(c.ropaStale ? 'ต้องทบทวน' : 'ทันสมัย')}</span></td></tr>
                <tr className="static"><td>{tx('ข้อมูลที่เกินระยะเก็บ (รอ auto-purge)')}</td><td className="num">{c.pastWindow.toLocaleString('en-US')}</td>
                  <td><Link className="link" to="/backoffice/quality/retention">{tx('การเก็บข้อมูล')}</Link></td></tr>
                <tr className="static"><td>{tx('การโอนข้ามประเทศที่รอประเมิน')}</td><td className="num">{pendingTransfers}</td>
                  <td><span className={`chip ${pendingTransfers ? 'warn' : 'ok'}`}>{tx(pendingTransfers ? 'รอประเมิน' : 'ประเมินแล้ว')}</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </bo-pdpa-overview>
  );
}
