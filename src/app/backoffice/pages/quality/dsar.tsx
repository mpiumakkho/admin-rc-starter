/* Data subject requests: the worklist of the eight rights against their thirty days, taken in here and worked on their own page (GOV-DSAR-01, M31 · GATED) */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { lucidePlus } from '../../../icons';
import { cx, NgIcon, UiButton } from '../../../user-management/ui';
import { backofficeActions } from '../../backoffice-actions';
import { useBackofficeStore } from '../../backoffice.store';
import { daysLeft, DSAR_RIGHT, DSAR_STATUS, dsarFlag, dsarProblems, DUE_FLAG, type DsarInput, isActive, RIGHTS } from '../../data/governance';
import { CHANNEL, CHANNELS } from '../../data/quality';
import type { DsarRequest, DsarRight } from '../../data/types';
import { useBoI18n } from '../../i18n/bo-i18n';
import { Drawer, PageHead } from '../../shared/parts';
import { PagerFoot } from '../../shared/pager';
import { usePager } from '../../shared/use-pager';

const BLANK: DsarInput = { right: '', requester: '', ownerKey: '', pets: '', hns: '', channel: 'email', scope: '' };
const STATUSES = Object.keys(DSAR_STATUS) as DsarRequest['status'][];

export function DsarComponent() {
  const store = useBackofficeStore();
  const { tx } = useBoI18n();
  const navigate = useNavigate();
  const [right, setRight] = useState<DsarRight | ''>('');
  const [status, setStatus] = useState<DsarRequest['status'] | ''>('');
  const [nearOnly, setNearOnly] = useState(false);
  const [intake, setIntake] = useState(false);
  const [form, setForm] = useState<DsarInput>({ ...BLANK });

  const d = store.data;
  const filtered = !!(right || status || nearOnly);
  const open = d.dsars.filter(isActive);
  const near = open.filter(r => dsarFlag(r) === 'near').length;
  const overdue = open.filter(r => dsarFlag(r) === 'overdue').length;
  const rows = d.dsars
    .filter(r => (!right || r.right === right) && (!status || r.status === status) && (!nearOnly || (dsarFlag(r) ?? 'ok') !== 'ok'))
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || a.statutoryDue.localeCompare(b.statutoryDue));
  const problems = dsarProblems(form);
  const owners = Object.keys(store.clinic.data.owners).sort();

  const go = (r: DsarRequest) => navigate(`/backoffice/quality/dsar/${r.id}`);
  const set = <K extends keyof DsarInput>(key: K, value: DsarInput[K]) => setForm({ ...form, [key]: value });
  const take = () => backofficeActions.intakeDsar(form, r => { setIntake(false); setForm({ ...BLANK }); go(r); });

  /** The table's pages */
  const pager = usePager(rows);
  return (
    <bo-dsar className="page">
      <PageHead heading="คำขอใช้สิทธิ์เจ้าของข้อมูล" source="GOV-DSAR-01 · M31 · 8 สิทธิตาม PDPA · ตอบภายใน 30 วัน (เส้นตายจาก backend) · ยืนยันตัวตนก่อนส่งมอบ · สัญญาการออกแบบ (GATED)" freshness="ข้อมูล ณ วันนี้ 11:32">
        <UiButton size="sm" type="button" onClick={() => setIntake(true)}><NgIcon svg={lucidePlus} aria-hidden="true" />{tx('รับคำขอใหม่')}</UiButton>
      </PageHead>
      <p className="notice warn">{tx('ระบบ PDPA (M31) ยังไม่พร้อม หน้านี้เป็นสัญญาการออกแบบ')}</p>

      <div className="kpi-strip" role="list">
        <div className="kpi" role="listitem"><span className="kpi-value">{open.length}</span><span className="kpi-label">{tx('เปิดค้าง')}</span></div>
        <div className={cx('kpi', near > 0 && 'warn')} role="listitem"><span className="kpi-value">{near}</span><span className="kpi-label">{tx('ใกล้ครบ 30 วัน')}</span></div>
        <div className={cx('kpi', overdue > 0 && 'danger')} role="listitem"><span className="kpi-value">{overdue}</span><span className="kpi-label">{tx('เกินกำหนด')}</span></div>
      </div>

      <div className={cx('split', intake && 'with-drawer')}>
        <div className="panel">
          <div className="filter-bar">
            <select className="ui-input" aria-label={tx('สิทธิ์ที่ขอ')} value={right} onChange={event => setRight(event.target.value as DsarRight | '')}>
              <option value="">{tx('ทุกสิทธิ์')}</option>
              {RIGHTS.map(r => <option key={r} value={r}>{tx(DSAR_RIGHT[r])}</option>)}
            </select>
            <select className="ui-input" aria-label={tx('สถานะ')} value={status} onChange={event => setStatus(event.target.value as DsarRequest['status'] | '')}>
              <option value="">{tx('ทุกสถานะ')}</option>
              {STATUSES.map(s => <option key={s} value={s}>{tx(DSAR_STATUS[s].label)}</option>)}
            </select>
            <label className="check"><input type="checkbox" checked={nearOnly} onChange={event => setNearOnly(event.target.checked)} />{tx('เฉพาะใกล้ครบกำหนด')}</label>
            <span className="secondary grow">{tx('{n} รายการ', { n: rows.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="bo-table dsar">
              <thead>
                <tr>
                  <th scope="col" className="w-ref">{tx('เลขที่')}</th>
                  <th scope="col">{tx('ผู้ขอ / เจ้าของข้อมูล')}</th>
                  <th scope="col" className="w-owner">{tx('สิทธิ์ที่ขอ')}</th>
                  <th scope="col" className="w-status">{tx('สถานะ')}</th>
                  <th scope="col" className="w-due">{tx('ครบกำหนด (30 วัน)')}</th>
                </tr>
              </thead>
              <tbody>
                {pager.rows.map(r => {
                  const f = dsarFlag(r);
                  return (
                    <tr key={r.id} tabIndex={0} onClick={() => go(r)} onKeyDown={event => { if (event.key === 'Enter') { go(r); } }}>
                      <td><b>{r.id}</b><div className="secondary">{r.receivedAt}</div></td>
                      <td>{tx(r.requester)}<div className="secondary">{r.pets.length > 0 && <span>{r.pets.join(', ')} · </span>}{tx(CHANNEL[r.channel])}</div></td>
                      <td>{tx(DSAR_RIGHT[r.right])}</td>
                      <td><span className={`chip ${DSAR_STATUS[r.status].cls}`}>{tx(DSAR_STATUS[r.status].label)}</span></td>
                      <td className="num">{r.statutoryDue}
                        {f && <div className={cx('secondary', f !== 'ok' && 'text-danger')}>{f !== 'ok' && <span aria-hidden="true">⚠ </span>}{tx(DUE_FLAG[f].label)} · {tx('เหลือ {n} วัน', { n: daysLeft(r) })}</div>}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && <tr className="static"><td colSpan={5} className="empty">{tx(filtered ? 'ไม่มีคำขอที่ตรงกับตัวกรอง' : 'ยังไม่มีคำขอ')}</td></tr>}
              </tbody>
            </table>
          </div>
          <PagerFoot pager={pager} />
        </div>

        {intake && (
          <Drawer heading="รับคำขอใหม่" sub="นับ 30 วันตั้งแต่รับคำขอ" onClosed={() => setIntake(false)} foot={<>
            <UiButton variant="secondary" size="sm" type="button" onClick={() => setIntake(false)}>{tx('ยกเลิก')}</UiButton>
            <span className="grow"></span>
            <UiButton size="sm" type="button" disabled={problems.length > 0} onClick={take}>{tx('รับคำขอ')}</UiButton>
          </>}>
            <div className="form-grid">
              <label className="full">{tx('สิทธิ์ที่ขอ')}
                <select className="ui-input" value={form.right} onChange={event => set('right', event.target.value as DsarRight | '')}>
                  <option value="">{tx('เลือก')}</option>
                  {RIGHTS.map(r => <option key={r} value={r}>{tx(DSAR_RIGHT[r])}</option>)}
                </select>
              </label>
              <label>{tx('ผู้ขอ')}<input className="ui-input" value={form.requester} onChange={event => set('requester', event.target.value)} /></label>
              <label>{tx('เจ้าของในทะเบียน')}
                <select className="ui-input" value={form.ownerKey} onChange={event => set('ownerKey', event.target.value)}>
                  <option value="">{tx('ไม่พบในทะเบียน')}</option>
                  {owners.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label>{tx('สัตว์ (คั่นด้วย ,)')}<input className="ui-input" value={form.pets} onChange={event => set('pets', event.target.value)} /></label>
              <label>{tx('HN (คั่นด้วย ,)')}<input className="ui-input" placeholder={tx('เช่น HN-180533')} value={form.hns} onChange={event => set('hns', event.target.value)} /></label>
              <label className="full">{tx('ช่องทางรับเรื่อง')}
                <select className="ui-input" value={form.channel} onChange={event => set('channel', event.target.value as DsarInput['channel'])}>
                  {CHANNELS.map(c => <option key={c} value={c}>{tx(CHANNEL[c])}</option>)}
                </select>
              </label>
              <label className="full">{tx('ขอบเขตข้อมูลที่ขอ')}<textarea className="ui-input" rows={3} value={form.scope} onChange={event => set('scope', event.target.value)}></textarea></label>
            </div>
            {problems.length > 0 && <ul className="problems">{problems.map(p => <li key={p}>{tx(p)}</li>)}</ul>}
          </Drawer>
        )}
      </div>
    </bo-dsar>
  );
}
