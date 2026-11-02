/* Data breaches: each against its seventy-two hours to notify, recorded here and worked on its own page (GOV-BRC-01, M31 · GATED) */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { NOW, TODAY } from '../../../clinic/data/model';
import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { BREACH_SEVERITY, BREACH_STATUS, breachFlag, breachProblems, type BreachInput, DUE_FLAG, notified, owedNotices } from '../../data/governance';
import { hoursLeft } from '../../data/quality';
import type { Breach } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const BLANK: BreachInput = { title: '', discoveredAt: `${TODAY}T${NOW}`, source: '', description: '', count: '', kinds: '' };
const hours = (b: Breach) => Math.max(0, Math.floor(hoursLeft(b.statutoryDue)));

export function BreachComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const navigate = useNavigate();
  const [nearOnly, setNearOnly] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [form, setForm] = useState<BreachInput>({ ...BLANK });

  const d = store.data;
  const open = d.breaches.filter(b => b.status !== 'closed');
  const near = open.filter(b => (breachFlag(b) ?? 'ok') !== 'ok').length;
  const unnotified = open.filter(b => owedNotices(b).includes('pdpc')).length;
  const rows = d.breaches.filter(b => !nearOnly || (breachFlag(b) ?? 'ok') !== 'ok')
    .sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed') || a.statutoryDue.localeCompare(b.statutoryDue));
  const problems = breachProblems(form);

  const go = (b: Breach) => navigate(`/backoffice/quality/breach/${b.id}`);
  const set = <K extends keyof BreachInput>(key: K, value: BreachInput[K]) => setForm({ ...form, [key]: value });
  const report = () => backofficeActions.reportBreach(form, b => { setReporting(false); setForm({ ...BLANK }); go(b); });

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-breach className="page">
      <PageHead heading="เหตุละเมิดข้อมูล" source="GOV-BRC-01 · M31 · แจ้ง สคส. ภายใน 72 ชม. นับจากพบเหตุ (เส้นตายจาก backend) · ระดับความรุนแรงกำหนดว่าต้องแจ้งใคร · สัญญาการออกแบบ (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={() => setReporting(true)}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('บันทึกเหตุใหม่')}</UiButton>
      </PageHead>
      <p className="notice warn">{tx('ระบบ PDPA (M31) ยังไม่พร้อม หน้านี้เป็นสัญญาการออกแบบ')}</p>

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{open.length}</span><span className="kpi-label">{tx('เปิดค้าง')}</span></div>
        <div className={cx('kpi', near > 0 && 'danger')} role="listitem"><span className="kpi-value">{near}</span><span className="kpi-label">{tx('ใกล้ครบ 72 ชม.')}</span></div>
        <div className={cx('kpi', unnotified > 0 && 'warn')} role="listitem"><span className="kpi-value">{unnotified}</span><span className="kpi-label">{tx('ยังไม่แจ้ง สคส.')}</span></div>
      </div>

      <div className={cx('split', reporting && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <label className="check"><input type="checkbox" checked={nearOnly} onChange={event => setNearOnly(event.target.checked)} />{tx('เฉพาะใกล้ครบกำหนด')}</label>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table breaches">
              <thead><tr>
                <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                <th scope="col">{tx('เหตุ')}</th>
                <th scope="col" className="w-kind">{tx('ความรุนแรง')}</th>
                <th scope="col" className="w-status">{tx('สถานะ')}</th>
                <th scope="col" className="w-due">{tx('ครบกำหนดแจ้ง (72 ชม.)')}</th>
                <th scope="col" className="w-kind">{tx('แจ้ง สคส. แล้ว')}</th>
              </tr></thead>
              <tbody>
                {pager.rows.map(b => {
                  const f = breachFlag(b);
                  return (
                    <tr key={b.id} tabIndex={0} onClick={() => go(b)} onKeyDown={event => { if (event.key === 'Enter') { go(b); } }}>
                      <td><b>{b.id}</b><div className="secondary">{b.discoveredAt}</div></td>
                      <td>{tx(b.title)}<div className="secondary">{tx('กระทบ {n} ราย', { n: b.affected.count })} · {tx(b.source)}</div></td>
                      <td>{b.severity ? <span className={`chip ${BREACH_SEVERITY[b.severity].cls}`}>{tx(BREACH_SEVERITY[b.severity].label)}</span> : <span className="secondary">{tx('ยังไม่ประเมิน')}</span>}</td>
                      <td><span className={`chip ${BREACH_STATUS[b.status].cls}`}>{tx(BREACH_STATUS[b.status].label)}</span></td>
                      <td className="num">{b.statutoryDue}{f && <div className={cx('secondary', f !== 'ok' && 'text-danger')}>{f !== 'ok' && <span aria-hidden="true">⚠ </span>}{tx(DUE_FLAG[f].label)} · {tx('เหลือ {n} ชม.', { n: hours(b) })}</div>}</td>
                      <td>{tx(notified(b, 'pdpc') ? 'แจ้งแล้ว' : b.severity === 'low' ? 'ไม่ต้องแจ้ง' : 'ยังไม่แจ้ง')}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr className="static"><td colSpan={6} className="empty">{tx(nearOnly ? 'ไม่มีเหตุที่ใกล้ครบกำหนด' : 'ยังไม่มีเหตุที่บันทึกไว้ ซึ่งไม่ได้แปลว่าไม่มีความเสี่ยง')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {reporting && (
          <Drawer heading="บันทึกเหตุใหม่" sub="นับ 72 ชม. ตั้งแต่พบเหตุ" onClosed={() => setReporting(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setReporting(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={report}>{tx('บันทึกเหตุ')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('ชื่อเหตุ')}<input className="ui-input" value={form.title} onChange={event => set('title', event.target.value)} /></label>
              <label>{tx('พบเมื่อ')}<input className="ui-input" type="datetime-local" value={form.discoveredAt} onChange={event => set('discoveredAt', event.target.value)} /></label>
              <label>{tx('แหล่งที่พบ')}<input className="ui-input" value={form.source} onChange={event => set('source', event.target.value)} /></label>
              <label>{tx('ผู้ได้รับผลกระทบ (ประมาณ)')}<input className="ui-input" inputMode="numeric" value={form.count} onChange={event => set('count', event.target.value)} /></label>
              <label>{tx('ประเภทข้อมูล (คั่นด้วย ,)')}<input className="ui-input" value={form.kinds} onChange={event => set('kinds', event.target.value)} /></label>
              <label className="full">{tx('เกิดอะไรขึ้น')}<textarea className="ui-input" rows={3} value={form.description} onChange={event => set('description', event.target.value)}></textarea></label>
            </div>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        )}
      </div>
    </bo-breach>
  );
}
