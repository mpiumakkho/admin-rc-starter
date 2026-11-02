/* Resolution and trends: the answered complaints to close and follow up, half a year by category, the topics that come back, and how satisfied owners were (quality.resolution, M28 P2) */
import { cx, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import {
  complainantOf, COMPLAINT_CATEGORIES, COMPLAINT_CATEGORY, complaintTrend, RECURRING_MIN, recurring, REMEDY, responseCompliance, satisfaction, satisfactionBlock,
} from '../../data/quality';
import { useBoI18n } from '../../i18n/bo-i18n';
import { PageHead } from '../../shared/parts';

export function ResolutionComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();

  const d = store.data;
  const r = responseCompliance(d);
  const s = satisfaction(d);
  const trend = complaintTrend(d);
  const topics = recurring(d);
  const toClose = d.complaints.filter(x => x.status === 'responded');
  /* Answered and waiting to be closed, then closed and waiting for the owner's view */
  const followUps = [...toClose, ...d.complaints.filter(x => !satisfactionBlock(x))];

  return (
    <bo-resolution className="page">
      <PageHead heading="ผลการแก้ไขและแนวโน้มข้อร้องเรียน" source="M28 P2 · ปิดเรื่องหลังตอบกลับ · ติดตามความพึงพอใจหลังปิดเรื่อง · หัวข้อที่เกิดซ้ำ 3 ครั้งขึ้นไปใน 90 วัน · ต้นแบบก่อนสัญญาหน้าของ M28 (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32" />

      <div className="kpi-strip" role="list">
        <div className={cx('kpi', r.percent < 90 && 'warn')} role="listitem"><span className="kpi-value">{r.percent}%</span><span className="kpi-label">{tx('ตอบทันกำหนด')}</span><span className="kpi-sub">{tx('{met} จาก {n} คำตอบ', { met: r.met, n: r.sent })}</span></div>
        <div className="kpi" role="listitem"><span className="kpi-value">{s.mean}<small>/5</small></span><span className="kpi-label">{tx('ความพึงพอใจเฉลี่ย')}</span><span className="kpi-sub">{tx('{n} ราย', { n: s.count })}</span></div>
        <div className={cx('kpi', toClose.length > 0 && 'warn')} role="listitem"><span className="kpi-value">{toClose.length}</span><span className="kpi-label">{tx('ตอบแล้ว รอปิดเรื่อง')}</span></div>
        <div className={cx('kpi', s.awaiting > 0 && 'warn')} role="listitem"><span className="kpi-value">{s.awaiting}</span><span className="kpi-label">{tx('รอติดตามความพึงพอใจ')}</span></div>
      </div>

      <div className="panel">
        <div className="filter-bar"><b>{tx('รอปิดเรื่องหรือติดตาม')}</b><span className="secondary grow">{tx('{n} รายการ', { n: followUps.length })}</span></div>
        <div className="table-wrap">
          <table className="bo-table complaints">
            <thead><tr>
              <th scope="col" className="w-ref">{tx('เลขที่')}</th>
              <th scope="col">{tx('เรื่อง')}</th>
              <th scope="col" className="w-at">{tx('ตอบเมื่อ')}</th>
              <th scope="col" className="w-actions">{tx('ขั้นต่อไป')}</th>
            </tr></thead>
            <tbody>
              {followUps.map(x => (
                <tr key={x.id} className="static">
                  <td><b>{x.id}</b><div className="secondary">{x.receivedAt}</div></td>
                  <td>{tx(x.subject)}<div className="secondary">{tx(complainantOf(x))} · {tx(COMPLAINT_CATEGORY[x.category])}{x.resolution && <> · {tx(REMEDY[x.resolution.remedy])}</>}</div></td>
                  <td className="num">{x.response?.sentAt}</td>
                  <td>
                    {x.status === 'responded'
                      ? <UiButton size="sm" type="button" onClick={() => backofficeActions.resolveComplaint(x)}>{tx('ปิดเรื่องร้องเรียน')}</UiButton>
                      : <UiButton variant="secondary" size="sm" type="button" onClick={() => backofficeActions.recordSatisfaction(x)}>{tx('ติดตามความพึงพอใจ')}</UiButton>}
                  </td>
                </tr>
              ))}
              {!followUps.length && <tr className="static"><td colSpan={4} className="empty ok-text">{tx('ไม่มีเรื่องรอปิดหรือติดตาม')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="split pair">
        <div className="panel">
          <div className="filter-bar"><b>{tx('ข้อร้องเรียน 6 เดือนตามประเภท')}</b><span className="secondary grow">{tx('นับตามเดือนที่รับเรื่อง')}</span></div>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={tx('ข้อร้องเรียน 6 เดือนตามประเภท')}>
            <table className="bo-table dt-months">
              <thead><tr><th scope="col">{tx('ประเภท')}</th>{trend.map(m => <th key={m.month} scope="col" className="num">{m.month.slice(2).replace('-', '/')}</th>)}</tr></thead>
              <tbody>
                {COMPLAINT_CATEGORIES.map(k => (
                  <tr key={k} className="static"><th scope="row">{tx(COMPLAINT_CATEGORY[k])}</th>{trend.map(m => <td key={m.month} className={cx('num', m[k] > 0 && 'planned')}>{m[k]}</td>)}</tr>
                ))}
                <tr className="static"><th scope="row"><b>{tx('รวม')}</b></th>{trend.map(m => <td key={m.month} className="num"><b>{m.total}</b></td>)}</tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="filter-bar"><b>{tx('หัวข้อที่เกิดซ้ำ (90 วัน)')}</b><span className="secondary grow">{tx('ตั้งแต่ {n} ครั้งขึ้นไป', { n: RECURRING_MIN })}</span></div>
          <div className="table-wrap">
            <table className="bo-table">
              <thead><tr><th scope="col">{tx('หัวข้อ')}</th><th scope="col" className="num w-kind">{tx('จำนวน')}</th><th scope="col" className="w-due">{tx('ล่าสุด')}</th></tr></thead>
              <tbody>
                {topics.map(t => (
                  <tr key={t.topic} className="static">
                    <td>{tx(t.topic)}{t.recurring && <> <span className="chip warn">{tx('เกิดซ้ำ')}</span></>}</td>
                    <td className="num"><b className={cx(t.recurring && 'text-danger')}>{t.count}</b></td>
                    <td className="num">{t.latest.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="legend">
            {s.spread.map(x => <span key={x[0]}>{tx('{n} คะแนน: {c} ราย', { n: x[0], c: x[1] })}</span>)}
          </div>
        </div>
      </div>
    </bo-resolution>
  );
}
