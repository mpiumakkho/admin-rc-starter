/* One breach: assessed, the notices its severity needs sent within 72 hours, and closed — a high one by the Director (GOV-BRC-02, M31 · GATED) */
import { Link, useParams } from 'react-router';

import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { BREACH_SEVERITY, BREACH_STATUS, BREACH_STEPS, breachFlag, closeBreachBlock, DUE_FLAG, notified, notifyBlock, NOTIFY_TO, owedNotices } from '../../data/governance';
import { hoursLeft } from '../../data/quality';
import type { Breach } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

const ORDER: Breach['status'][] = ['open', 'assessed', 'notified', 'closed'];
const TARGETS: ('pdpc' | 'subjects')[] = ['pdpc', 'subjects'];
const reached = (b: Breach, step: Breach['status']) => ORDER.indexOf(step) < ORDER.indexOf(b.status) || (b.status === 'closed' && step === 'closed');

export function BreachDetailComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const { id = '' } = useParams();
  const b = store.data.breaches.find(x => x.id === id);
  if (!b) {
    return (
      <bo-breach-detail className="page">
        <PageHead heading="รายละเอียดเหตุละเมิด" />
        <p className="notice">{tx('ไม่พบเหตุนี้')} <Link className="link" to="/backoffice/quality/breach">{tx('กลับไปรายการเหตุ')}</Link></p>
      </bo-breach-detail>
    );
  }
  const f = breachFlag(b);
  const hours = Math.max(0, Math.floor(hoursLeft(b.statutoryDue)));
  const closeIssue = closeBreachBlock(b, store.userName);

  return (
    <bo-breach-detail className="page">
      <PageHead heading="รายละเอียดเหตุละเมิด" source={`${b.id} · GOV-BRC-02 · M31 · แจ้งก่อนปิดตามระดับความรุนแรง · เหตุรุนแรงผู้อำนวยการลงนามปิด · สัญญาการออกแบบ (GATED)`}>
        <Link className="link back" to="/backoffice/quality/breach">{tx('กลับไปรายการเหตุ')}</Link>
      </PageHead>
      <p className="notice warn">{tx('ระบบ PDPA (M31) ยังไม่พร้อม หน้านี้เป็นสัญญาการออกแบบ')}</p>
      {f === 'overdue' && <p className="notice danger">{tx('เกิน 72 ชม. แล้วและยังแจ้งไม่ครบ')}</p>}
      {f === 'near' && <p className="notice danger">{tx('เหลือ {n} ชม. ก่อนครบ 72 ชม.', { n: hours })}</p>}

      <div className="record">
        <div className="record-main">
          <div className="panel summary">
            <div className="sum-row"><span>{tx('เหตุ')}</span><b>{tx(b.title)}</b></div>
            <div className="sum-row"><span>{tx('พบเมื่อ')}</span><span>{b.discoveredAt} · {tx(b.reportedBy)} · {tx(b.source)}</span></div>
            <div className="sum-row"><span>{tx('ครบกำหนดแจ้ง (72 ชม.)')}</span><b className={cx(f && f !== 'ok' && 'text-danger')}>{b.statutoryDue}{f && <> · {tx(DUE_FLAG[f].label)}</>}</b></div>
            <div className="sum-row"><span>{tx('ความรุนแรง')}</span>{b.severity ? <span className={`chip ${BREACH_SEVERITY[b.severity].cls}`}>{tx(BREACH_SEVERITY[b.severity].label)}</span> : <span className="secondary">{tx('ยังไม่ประเมิน')}</span>}</div>
            <p>{tx(b.description)}</p>
            {b.assessment && <p className="secondary">{tx('DPIA: {t}', { t: tx(b.assessment.dpia) })} · {tx(b.assessment.by)} · {b.assessment.at}</p>}
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('ขั้นตอน')}</b><span className={`chip ${BREACH_STATUS[b.status].cls}`}>{tx(BREACH_STATUS[b.status].label)}</span></div>
            <ol className="steps" aria-label={tx('ขั้นตอน')}>
              {BREACH_STEPS.map(s => <li key={s[0]} className={cx(reached(b, s[0]) && 'done', b.status === s[0] && 'current')} aria-current={b.status === s[0] ? 'step' : undefined}>{tx(s[1])}</li>)}
            </ol>
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('ผู้ได้รับผลกระทบ (เท่าที่จำเป็น)')}</b></div>
            <div className="summary">
              <div className="sum-row"><span>{tx('จำนวนคน')}</span><b>{tx('{n} คน', { n: b.affected.count })}</b></div>
              <div className="sum-row"><span>{tx('ประเภทข้อมูล')}</span><span>{tx(b.affected.kinds.join(', ') || '—')}</span></div>
              <p className="secondary">{tx('รายชื่อเจ้าของข้อมูลไม่แสดงที่นี่ เปิดได้เฉพาะผู้มีสิทธิ์ pii:full')}</p>
            </div>
          </div>

          <div className="panel">
            <div className="filter-bar"><b>{tx('ประวัติ')}</b></div>
            <ul className="timeline">
              {[...b.history].reverse().map((h, n) => <li key={n} className="tl"><b>{tx(h[2])}</b> · {tx(h[1])}<div className="secondary">{h[0]} · {tx(h[3])}</div></li>)}
            </ul>
          </div>
        </div>

        <aside className="record-rail">
          <div className="panel action-card">
            <b>{tx('การดำเนินการ')}</b>
            {b.status === 'open' && <UiButton size="sm" type="button" onClick={() => backofficeActions.assessBreach(b)}>{tx('ประเมินความรุนแรง')}</UiButton>}
            <div className="section-title">{tx('การแจ้งเหตุ')}</div>
            {TARGETS.map(to => {
              const sent = notified(b, to) ? b.notifications.find(n => n[0] === to) : undefined;
              return (
                <div key={to} className="sum-row">
                  <span>{tx(NOTIFY_TO[to])}</span>
                  {sent ? <span className="chip ok">{tx('แจ้งแล้ว {at}', { at: sent[1] })}</span>
                    : owedNotices(b).includes(to) ? <UiButton variant="secondary" size="sm" type="button" disabled={!!notifyBlock(b, to)} onClick={() => backofficeActions.notifyBreach(b, to)}>{tx('แจ้งเหตุ')}</UiButton>
                    : <span className="secondary">{tx(b.severity ? 'ไม่ต้องแจ้ง' : 'รอประเมิน')}</span>}
                </div>
              );
            })}
            {b.status !== 'closed' ? <>
              {closeIssue && <p className="secondary">{tx(closeIssue)}</p>}
              <UiButton size="sm" type="button" disabled={!!closeIssue} onClick={() => backofficeActions.closeBreach(b)}>{tx(b.severity === 'high' ? 'ลงนามปิดเหตุ' : 'ปิดเหตุ')}</UiButton>
            </> : <>
              <div className="sum-row"><span>{tx('ปิดเมื่อ')}</span><b>{b.closedAt}</b></div>
              {b.signOff && <div className="sum-row"><span>{tx('ลงนามโดย')}</span><b>{tx(b.signOff.by)}</b></div>}
              <p className="secondary">{tx(b.outcome)}</p>
            </>}
          </div>
        </aside>
      </div>
    </bo-breach-detail>
  );
}
