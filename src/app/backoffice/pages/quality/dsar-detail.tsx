/* One data subject request: identity first, the data gathered to its scope, delivered and closed, with who touched the record (GOV-DSAR-02, M31 · GATED; access log M13) */
import { Link, useParams } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  accessLog, daysLeft, DSAR_RIGHT, DSAR_SOURCES, DSAR_STATUS, DSAR_STEPS, dsarFlag, DUE_FLAG, EXPORT_STATUS, fulfilBlock, isActive, RESULT, RISK,
} from '../../data/governance';
import { CHANNEL } from '../../data/quality';
import type { DsarRequest } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const ORDER: DsarRequest['status'][] = ['intake', 'verified', 'collecting', 'delivered', 'closed'];
const reached = (r: DsarRequest, step: DsarRequest['status']) =>
  ORDER.indexOf(step) < ORDER.indexOf(r.status === 'rejected' ? 'intake' : r.status) || (r.status === 'closed' && step === 'closed');

export function DsarDetailComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const { id = '' } = useParams();
  const d = store.data;
  const r = d.dsars.find(x => x.id === id);
  if (!r) {
    return (
      <bo-dsar-detail className="page">
        <PageHead heading="รายละเอียดคำขอ DSAR" />
        <p className="notice">{tx('ไม่พบคำขอนี้')} <Link className="link" to="/backoffice/quality/dsar">{tx('กลับไปรายการคำขอ')}</Link></p>
      </bo-dsar-detail>
    );
  }
  const f = dsarFlag(r);
  const block = fulfilBlock(r);
  const x = r.exportId ? d.auditExports.find(e => e.id === r.exportId) : undefined;
  const canCollect = isActive(r) && r.status !== 'intake';
  const log = accessLog(d, r.hns);

  return (
    <bo-dsar-detail className="page">
      <PageHead heading="รายละเอียดคำขอ DSAR" source={`${r.id} · GOV-DSAR-02 · M31 · ส่งมอบได้เมื่อยืนยันตัวตนแล้วเท่านั้น · สัญญาการออกแบบ (GATED)`}>
        <Link className="link back" to="/backoffice/quality/dsar">{tx('กลับไปรายการคำขอ')}</Link>
      </PageHead>
      <p className="notice warn">{tx('ระบบ PDPA (M31) ยังไม่พร้อม หน้านี้เป็นสัญญาการออกแบบ')}</p>
      {f === 'overdue' && <p className="notice danger">{tx('เกินกำหนด 30 วันแล้ว')}</p>}

      <div className="record">
        <div className="record-main">
          <div className="panel summary">
            <div className="sum-row"><span>{tx('สิทธิ์ที่ขอ')}</span><b>{tx(DSAR_RIGHT[r.right])}</b></div>
            <div className="sum-row"><span>{tx('ผู้ขอ')}</span><span>{tx(r.requester)}{r.ownerKey && <> · {tx('เจ้าของในทะเบียน')} {r.ownerKey}</>}</span></div>
            <div className="sum-row"><span>{tx('ข้อมูลของ')}</span><span>{r.pets.join(', ') || '—'}{r.hns.length > 0 && <> · {r.hns.join(', ')}</>}</span></div>
            <div className="sum-row"><span>{tx('ช่องทางรับเรื่อง')}</span><span>{tx(CHANNEL[r.channel])} · {r.receivedAt}</span></div>
            <div className="sum-row"><span>{tx('ครบกำหนด (30 วัน)')}</span>
              <b className={cx(f && f !== 'ok' && 'text-danger')}>{r.statutoryDue}{f && <> · {tx(DUE_FLAG[f].label)} · {tx('เหลือ {n} วัน', { n: daysLeft(r) })}</>}</b></div>
            <div className="sum-row"><span>{tx('ขอบเขต')}</span><span>{tx(r.scope)}</span></div>
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('ขั้นตอน')}</b><span className={`chip ${DSAR_STATUS[r.status].cls}`}>{tx(DSAR_STATUS[r.status].label)}</span></div>
            <ol className="steps" aria-label={tx('ขั้นตอน')}>
              {DSAR_STEPS.map(s => (
                <li key={s[0]} className={cx(reached(r, s[0]) && 'done', r.status === s[0] && 'current')} aria-current={r.status === s[0] ? 'step' : undefined}>{tx(s[1])}</li>
              ))}
            </ol>
            {r.identity
              ? <p className="secondary step-note">{tx('ยืนยันตัวตนแล้ว: {m} · {by} · {at}', { m: tx(r.identity.method), by: tx(r.identity.by), at: r.identity.at })}</p>
              : isActive(r) && <p className="notice warn step-note">{tx('ต้องยืนยันตัวตนก่อนส่งมอบข้อมูล')}</p>}
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('ข้อมูลตามขอบเขต (เท่าที่จำเป็น)')}</b><span className="secondary grow">{tx('รวบรวมแล้ว {n} จาก {all} แหล่ง', { n: r.collected.length, all: DSAR_SOURCES.length })}</span></div>
            <div className="table-wrap">
              <table className="bo-table">
                <thead><tr><th scope="col">{tx('แหล่งข้อมูล')}</th><th scope="col" className="w-actions">{tx('สถานะ')}</th></tr></thead>
                <tbody>
                  {DSAR_SOURCES.map(s => (
                    <tr key={s} className="static">
                      <td>{tx(s)}</td>
                      <td>
                        {r.collected.includes(s) ? <span className="chip ok">{tx('รวบรวมแล้ว')}</span>
                          : s === 'ประวัติการเข้าถึง' && x ? <span className={`chip ${EXPORT_STATUS[x.status].cls}`}>{x.id} · {tx(EXPORT_STATUS[x.status].label)}</span>
                          : canCollect ? <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.collectDsar(r, s)}>{tx('รวบรวม')}</UiButton>
                          : <span className="secondary">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.delivery && <p className="secondary foot-note">{tx('ส่งมอบแล้ว: {m} · {file} · หมดอายุ {exp}', { m: tx(r.delivery.method), file: r.delivery.artifact, exp: r.delivery.expires })}</p>}
            {r.outcome && <p className="foot-note">{tx(r.outcome)}</p>}
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('ประวัติ')}</b></div>
            <ul className="timeline">
              {[...r.history].reverse().map((h, n) => <li key={n} className="tl"><b>{tx(h[2])}</b> · {tx(h[1])}<div className="secondary">{h[0]} · {tx(h[3])}</div></li>)}
            </ul>
          </div>
        </div>

        <aside className="record-rail">
          <div className="panel action-card">
            <b>{tx('การดำเนินการ')}</b>
            {r.status === 'intake' && <UiButton size="sm" type="button" onClick={() => backofficeActions.verifyIdentity(r)}>{tx('ยืนยันตัวตน')}</UiButton>}
            {isActive(r) ? <>
              {block && <p className="secondary">{tx(block)}</p>}
              <UiButton size="sm" type="button" disabled={!!block} onClick={() => backofficeActions.fulfilDsar(r)}>{tx('ส่งมอบข้อมูล')}</UiButton>
              <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.closeDsar(r, true)}>{tx('ปฏิเสธคำขอนี้')}</UiButton>
            </> : r.status === 'delivered'
              ? <UiButton size="sm" type="button" onClick={() => backofficeActions.closeDsar(r, false)}>{tx('ปิดคำขอ')}</UiButton>
              : <p className="secondary">{tx('คำขอนี้ปิดแล้ว')}</p>}
          </div>
          <div className="panel action-card">
            <b>{tx('ประวัติการเข้าถึงข้อมูล')}</b>
            <span className="secondary">{tx('จาก /audit/v1/patients/{hn}/access-log', { hn: r.hns.join(', ') || '—' })}</span>
            {log.map(e => (
              <div key={e.id} className="sum-row access"><span>{e.occurredAt}<br />{tx(e.actor)} · {e.action}</span>
                <span className={`chip ${e.result === 'success' ? RISK[e.riskLevel].cls : RESULT[e.result].cls}`}>{tx(e.result === 'success' ? RISK[e.riskLevel].label : RESULT[e.result].label)}</span></div>
            ))}
            {!log.length && <p className="secondary">{tx('ไม่มีการเข้าถึงที่บันทึกไว้')}</p>}
            {r.hns.length > 0 && <Link className="link" to={`/backoffice/quality/audit?hn=${r.hns[0]}`}>{tx('เปิดใน Audit Explorer')}</Link>}
          </div>
        </aside>
      </div>
    </bo-dsar-detail>
  );
}
